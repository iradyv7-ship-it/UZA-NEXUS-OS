import { nextSequence } from '../../platform/ids/next-sequence';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { NotificationService } from '../../platform/notification/notification.service';
import { makeRef, COUNTRY, currentYear } from '../quality-ids';
import { findByClientRequestId } from '../sync';

export interface NewVisit {
  readonly poRef: string;
  readonly inspectorId: string;
  readonly clientRequestId?: string;
}

/**
 * Factory visits. Assigning a visit notifies the inspector (François). Offline-safe via
 * clientRequestId. A visit is the container an inspection is recorded against.
 */
@Injectable()
export class VisitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly notifications: NotificationService,
  ) {}

  async assign(actor: Actor, input: NewVisit) {
    await this.authz.authorize(actor, 'visit', 'create');

    const existing = await findByClientRequestId(this.prisma.visit, input.clientRequestId);
    if (existing) return existing;

    const po = await this.prisma.purchaseOrder.findUnique({ where: { ref: input.poRef } });
    if (!po) throw new NotFoundException(`purchase order ${input.poRef} not found`);

    return this.prisma.$transaction(async (tx) => {
      const seq = await nextSequence(tx.visit, (n) =>
        makeRef('visit', { country: COUNTRY, year: currentYear(), seq: n }),
      );
      const ref = makeRef('visit', { country: COUNTRY, year: currentYear(), seq });
      const visit = await tx.visit.create({
        data: {
          ref,
          poRef: input.poRef,
          assignedTo: input.inspectorId,
          clientRequestId: input.clientRequestId ?? null,
        },
      });
      await this.notifications.dispatch(
        ref,
        {
          audience: 'warehouse',
          recipientId: input.inspectorId,
          body: `Factory visit ${ref} assigned for ${input.poRef}`,
        },
        tx,
      );
      return visit;
    });
  }

  async read(actor: Actor, ref: string) {
    await this.authz.authorize(actor, 'visit', 'read');
    const visit = await this.prisma.visit.findUnique({
      where: { ref },
      include: { inspections: true },
    });
    if (!visit) throw new NotFoundException(`visit ${ref} not found`);
    return visit;
  }
}
