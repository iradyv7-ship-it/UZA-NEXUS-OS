import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma, OrderStatus } from '@prisma/client';
import {
  scheduleFor,
  splitInstallments,
  MIN_DEPOSIT,
  UzaError,
  type Actor,
  type EventEnvelope,
  type Minor,
} from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { OutboxService } from '../../platform/outbox/outbox.service';
import { makeRef, VENTURE, currentYear } from '../trade-ids';
import { tradeScopeWhere } from '../list-scope';
import type { ListPage } from '../project/project.service';

const PAYMENT_VERIFIED_CONSUMER = 'trade.payment-verified';

/**
 * Orders and their installment schedule — the end of trade-flow's road. The order stops
 * here: the Invoice is Finance's (Sprint 2). trade publishes `order.created` and, on
 * cancellation, `order.cancelled`; it does NOT publish payment events — it subscribes to
 * Finance's `payment.verified` to mark installments paid and activate procurement.
 */
@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly outbox: OutboxService,
  ) {}

  /**
   * Create a confirmed order from an approved quotation. The tier and the installment
   * schedule are DERIVED from the customer's completed-order count via scheduleFor +
   * splitInstallments — never hardcoded — and the deposit may never fall below
   * policy.MIN_DEPOSIT.
   */
  async create(actor: Actor, quotationRef: string) {
    await this.authz.authorize(actor, 'order', 'create');

    const q = await this.prisma.quotation.findUnique({ where: { ref: quotationRef } });
    if (!q) throw new NotFoundException(`quotation ${quotationRef} not found`);
    if (q.status !== 'approved') {
      throw new BadRequestException(`order requires an approved quotation; ${quotationRef} is ${q.status}`);
    }

    const customer = await this.prisma.customer.findUnique({ where: { ref: q.customerRef } });
    const { tier, schedule } = scheduleFor(customer?.completedOrders ?? 0);

    const deposit = schedule[0]?.[1] ?? 0;
    if (deposit < MIN_DEPOSIT) {
      throw new UzaError({
        code: 'DEPOSIT_BELOW_MINIMUM',
        context: { tier, deposit, minimum: MIN_DEPOSIT },
      });
    }

    const totalMinor = (q.qty * q.customerUnitPriceMinor) as Minor;
    const parts = splitInstallments(totalMinor, schedule);

    return this.outbox.emit(actor.userId, async (tx, emit) => {
      const seq = (await tx.order.count()) + 1;
      const ref = makeRef('order', { venture: VENTURE, year: currentYear(), seq });
      const order = await tx.order.create({
        data: {
          ref,
          projectRef: q.projectRef,
          customerRef: q.customerRef,
          agentId: q.agentId,
          quotationRef,
          totalMinor,
          tier,
        },
      });
      for (const part of parts) {
        await tx.installment.create({
          data: {
            ref: makeRef('installment', { order: ref, trigger: part.trigger }),
            orderRef: ref,
            trigger: part.trigger,
            pct: part.pct,
            amountMinor: part.amountMinor,
          },
        });
      }
      await emit('order.created', {
        orderRef: ref,
        customerRef: q.customerRef,
        agentId: q.agentId ?? '',
        totalMinor,
        tier,
      });
      return order;
    });
  }

  async cancel(actor: Actor, orderRef: string, reason: string) {
    await this.authz.authorize(actor, 'order', 'update');
    const order = await this.prisma.order.findUnique({ where: { ref: orderRef } });
    if (!order) throw new NotFoundException(`order ${orderRef} not found`);

    return this.outbox.emit(actor.userId, async (tx, emit) => {
      const cancelled = await tx.order.update({
        where: { ref: orderRef },
        data: { status: 'cancelled', cancelReason: reason },
      });
      await emit('order.cancelled', { orderRef, reason });
      return cancelled;
    });
  }

  async read(actor: Actor, orderRef: string) {
    const order = await this.prisma.order.findUnique({
      where: { ref: orderRef },
      include: { installments: true },
    });
    if (!order) throw new NotFoundException(`order ${orderRef} not found`);
    await this.authz.authorize(actor, 'order', 'read', {
      customerId: order.customerRef,
      agentId: order.agentId ?? undefined,
    });
    return this.authz.mask(actor, { ...order });
  }

  /**
   * The caller's in-scope orders. Role grant is checked first (no object → 403 if the role
   * holds no `order:read`); object-scope is a WHERE predicate via `tradeScopeWhere`,
   * mirroring `inScope` so a listed order is always one the by-ref read would also admit.
   * Optional `status`/`customerRef` filters AND on top of scope. Stable sort: updatedAt
   * desc. Orders carry no CONFIDENTIAL_FIELDS, so `mask` is a no-op — applied for
   * uniformity across read paths. Installments are omitted here to keep the list light.
   */
  async list(
    actor: Actor,
    filters: { status?: OrderStatus; customerRef?: string },
    page: ListPage,
  ) {
    await this.authz.authorize(actor, 'order', 'read');
    const where: Prisma.OrderWhereInput = {
      AND: [
        tradeScopeWhere(actor),
        ...(filters.status ? [{ status: filters.status }] : []),
        ...(filters.customerRef ? [{ customerRef: filters.customerRef }] : []),
      ],
    };
    const rows = await this.prisma.order.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: page.limit,
      skip: page.offset,
    });
    return rows.map((row) => this.authz.mask(actor, { ...row }));
  }

  /**
   * Consume Finance's `payment.verified`. Marks the matching installment paid and, on
   * the `confirmation` trigger, activates procurement. Idempotent on eventId via
   * ProcessedEvent so a redelivered event is a no-op — payment/procurement state can
   * never double-apply.
   *
   * There is no authorize() call here: this is not a user action but a reaction to an
   * event Finance already authorised when it verified the payment. Trade never verifies
   * payments and never emits payment.verified.
   */
  async handlePaymentVerified(envelope: EventEnvelope<'payment.verified'>) {
    const already = await this.prisma.processedEvent.findUnique({
      where: { eventId_consumer: { eventId: envelope.eventId, consumer: PAYMENT_VERIFIED_CONSUMER } },
    });
    if (already) return { status: 'duplicate' as const, orderRef: envelope.payload.orderRef };

    const { orderRef, trigger } = envelope.payload;
    return this.prisma.$transaction(async (tx) => {
      await tx.processedEvent.create({
        data: { eventId: envelope.eventId, consumer: PAYMENT_VERIFIED_CONSUMER },
      });

      const order = await tx.order.findUnique({
        where: { ref: orderRef },
        include: { installments: true },
      });
      if (!order) throw new NotFoundException(`order ${orderRef} not found`);

      const installment = order.installments.find((i) => i.trigger === trigger && i.status === 'due');
      if (!installment) {
        throw new BadRequestException(`no due installment with trigger ${trigger} on order ${orderRef}`);
      }

      await tx.installment.update({
        where: { ref: installment.ref },
        data: { status: 'paid', paidEventId: envelope.eventId },
      });

      // Payment gates procurement: the order activates only on the verified confirmation
      // installment, never on any other trigger, never by an agent or AI.
      if (trigger === 'confirmation') {
        await tx.order.update({ where: { ref: orderRef }, data: { status: 'procurement_active' } });
      }

      return { status: 'processed' as const, orderRef, installmentRef: installment.ref, trigger };
    });
  }
}
