import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, type Quotation, type QuotationStatus } from '@prisma/client';
import {
  dapMargin,
  MASK,
  type Actor,
  type CostLadder,
  type CostRung,
  type Incoterm,
  type Minor,
} from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { OutboxService } from '../../platform/outbox/outbox.service';
import { makeRef, VENTURE, currentYear } from '../trade-ids';
import { tradeScopeWhere } from '../list-scope';
import type { ListPage } from '../project/project.service';
import { priceQuotation } from './pricing';

export interface QuotationPricingInput {
  readonly supplierUnitCostMinor: Minor;
  readonly estCostsMinor: Partial<Record<CostRung, Minor>>;
  readonly qty: number;
  readonly requiredMargin: number;
  readonly sellIncoterm?: Incoterm;
}

const asLadder = (json: Prisma.JsonValue): CostLadder => json as unknown as CostLadder;
const asJson = (ladder: CostLadder): Prisma.InputJsonValue => ladder as unknown as Prisma.InputJsonValue;

/**
 * Quotations. Priced at the sell incoterm on a full CostLadder, with the DAP margin
 * always computed alongside (read()). Versioned, never edited in place: a revision
 * supersedes its predecessor and bumps the version. The quoted `marginPct` is locked at
 * build time and never recomputed; `realizedMargin` is a SEPARATE field filled from
 * actuals later. Confidential fields (cost, target, walkaway, both margins) are masked
 * on every read.
 */
@Injectable()
export class QuotationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly outbox: OutboxService,
  ) {}

  async build(actor: Actor, projectRef: string, pricing: QuotationPricingInput) {
    await this.authz.authorize(actor, 'quotation', 'create');
    const project = await this.prisma.project.findUnique({ where: { ref: projectRef } });
    if (!project) throw new NotFoundException(`project ${projectRef} not found`);

    const sellIncoterm = pricing.sellIncoterm ?? 'CIF';
    const priced = priceQuotation({ ...pricing, sellIncoterm });

    const seq = (await this.prisma.quotation.count()) + 1;
    const ref = makeRef('quotation', { venture: VENTURE, year: currentYear(), seq });
    return this.prisma.quotation.create({
      data: {
        ref,
        projectRef,
        customerRef: project.customerRef,
        agentId: project.agentId,
        qty: pricing.qty,
        sellIncoterm,
        ladder: asJson(priced.ladder),
        supplierUnitCostMinor: pricing.supplierUnitCostMinor,
        targetPriceMinor: priced.targetPriceMinor,
        walkawayPriceMinor: priced.walkawayPriceMinor,
        customerUnitPriceMinor: priced.customerUnitPriceMinor,
        marginPct: priced.marginPct,
        version: 1,
        status: 'draft',
      },
    });
  }

  /**
   * Never edit in place. A revision creates version n+1 and marks the predecessor
   * `superseded`, chaining old → new via supersededByRef.
   */
  async revise(actor: Actor, quotationRef: string, pricing: QuotationPricingInput) {
    await this.authz.authorize(actor, 'quotation', 'create');
    const prev = await this.prisma.quotation.findUnique({ where: { ref: quotationRef } });
    if (!prev) throw new NotFoundException(`quotation ${quotationRef} not found`);
    if (prev.status === 'superseded') {
      throw new BadRequestException(`quotation ${quotationRef} is already superseded`);
    }

    const sellIncoterm = pricing.sellIncoterm ?? (prev.sellIncoterm as Incoterm);
    const priced = priceQuotation({ ...pricing, sellIncoterm });

    return this.prisma.$transaction(async (tx) => {
      const seq = (await tx.quotation.count()) + 1;
      const ref = makeRef('quotation', { venture: VENTURE, year: currentYear(), seq });
      const next = await tx.quotation.create({
        data: {
          ref,
          projectRef: prev.projectRef,
          customerRef: prev.customerRef,
          agentId: prev.agentId,
          qty: pricing.qty,
          sellIncoterm,
          ladder: asJson(priced.ladder),
          supplierUnitCostMinor: pricing.supplierUnitCostMinor,
          targetPriceMinor: priced.targetPriceMinor,
          walkawayPriceMinor: priced.walkawayPriceMinor,
          customerUnitPriceMinor: priced.customerUnitPriceMinor,
          marginPct: priced.marginPct,
          version: prev.version + 1,
          status: 'draft',
        },
      });
      await tx.quotation.update({
        where: { ref: prev.ref },
        data: { status: 'superseded', supersededByRef: ref },
      });
      return next;
    });
  }

  /**
   * Approval locks the quoted margin. `marginPct` was computed at build and is NOT
   * recomputed here — approval only flips status and publishes quotation.approved.
   */
  async approve(actor: Actor, quotationRef: string) {
    await this.authz.authorize(actor, 'quotation', 'approve');
    const q = await this.prisma.quotation.findUnique({ where: { ref: quotationRef } });
    if (!q) throw new NotFoundException(`quotation ${quotationRef} not found`);
    if (q.status === 'superseded') {
      throw new BadRequestException(`cannot approve superseded quotation ${quotationRef}`);
    }

    return this.outbox.emit(actor.userId, async (tx, emit) => {
      const approved = await tx.quotation.update({
        where: { ref: quotationRef },
        data: { status: 'approved' },
      });
      await emit('quotation.approved', { quotationRef, projectRef: q.projectRef });
      return approved;
    });
  }

  /**
   * Land actuals (weeks later) and recompute the realized margin at DAP. The quoted
   * `marginPct` is never touched — the quoted-vs-realized gap is the most valuable
   * number the system produces, so both are preserved (CF-029).
   *
   * Authorised as `margin:read`: closing the books on a quotation's true margin is a
   * finance/exec activity, gated on the same permission that governs seeing margin at all.
   */
  async closeCosts(actor: Actor, quotationRef: string, actualsMinor: Partial<Record<CostRung, Minor>>) {
    await this.authz.authorize(actor, 'margin', 'read');
    const q = await this.prisma.quotation.findUnique({ where: { ref: quotationRef } });
    if (!q) throw new NotFoundException(`quotation ${quotationRef} not found`);

    const ladder = asLadder(q.ladder);
    for (const [rung, val] of Object.entries(actualsMinor) as [CostRung, Minor | undefined][]) {
      if (val !== undefined) ladder[rung].actMinor = val;
    }
    const realizedMargin = dapMargin(ladder, q.customerUnitPriceMinor as Minor);

    return this.prisma.quotation.update({
      where: { ref: quotationRef },
      data: { ladder: asJson(ladder), realizedMargin },
    });
  }

  /**
   * Masked read. Both margins (quoted + DAP) are shown together to roles allowed to see
   * margin; for everyone else supplier cost, target, walkaway and both margins are
   * masked. dapMargin visibility is tied to the quoted margin's — a margin is a margin.
   */
  async read(actor: Actor, quotationRef: string) {
    const q = await this.prisma.quotation.findUnique({ where: { ref: quotationRef } });
    if (!q) throw new NotFoundException(`quotation ${quotationRef} not found`);
    await this.authz.authorize(actor, 'quotation', 'read', {
      customerId: q.customerRef,
      agentId: q.agentId ?? undefined,
    });
    return this.maskedView(actor, q);
  }

  /**
   * The caller's in-scope quotations, masked EXACTLY as the by-ref read (cost / target /
   * walkaway / both margins hidden for roles outside CONFIDENTIAL_FIELDS). Role grant is
   * checked first (no object → 403 if the role holds no `quotation:read`); object-scope is
   * a WHERE predicate via `tradeScopeWhere`, mirroring `inScope`. Optional
   * `projectRef`/`status` filters AND on top of scope. Stable sort: updatedAt desc.
   */
  async list(
    actor: Actor,
    filters: { projectRef?: string; status?: QuotationStatus },
    page: ListPage,
  ) {
    await this.authz.authorize(actor, 'quotation', 'read');
    const where: Prisma.QuotationWhereInput = {
      AND: [
        tradeScopeWhere(actor),
        ...(filters.projectRef ? [{ projectRef: filters.projectRef }] : []),
        ...(filters.status ? [{ status: filters.status }] : []),
      ],
    };
    const rows = await this.prisma.quotation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: page.limit,
      skip: page.offset,
    });
    return rows.map((q) => this.maskedView(actor, q));
  }

  /**
   * Single masking + DAP-margin projection, shared by `read` and `list` so a list row is
   * never a weaker security posture than a by-ref read. Projects onto the field names
   * CONFIDENTIAL_FIELDS masks against (supplierUnitCost, targetPrice, walkawayPrice carry
   * Minor values, matching the repo's masking convention). dapMargin is masked in lockstep
   * with the quoted marginPct — a margin is a margin.
   */
  private maskedView(actor: Actor, q: Quotation) {
    const ladder = asLadder(q.ladder);
    const view = {
      ref: q.ref,
      projectRef: q.projectRef,
      customerRef: q.customerRef,
      agentId: q.agentId,
      qty: q.qty,
      sellIncoterm: q.sellIncoterm,
      version: q.version,
      status: q.status,
      customerUnitPriceMinor: q.customerUnitPriceMinor,
      supplierUnitCost: q.supplierUnitCostMinor,
      targetPrice: q.targetPriceMinor,
      walkawayPrice: q.walkawayPriceMinor,
      marginPct: q.marginPct,
      realizedMargin: q.realizedMargin,
    };
    const masked = this.authz.mask(actor, view);
    const dap = dapMargin(ladder, q.customerUnitPriceMinor as Minor);
    return { ...masked, dapMargin: masked.marginPct === MASK ? MASK : dap };
  }
}
