import { BadRequestException, Injectable } from '@nestjs/common';
import type { Actor, Destination } from '@uza/contracts';
import { nextSequence } from '../../platform/ids/next-sequence';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { partnerRateRef as makePartnerRateRef } from '../logistics-ids';
import type { EntryPortValue } from './container.service';

export interface RecordPartnerRateInput {
  readonly partnerId: string;
  readonly destination: Destination;
  readonly ratePerRevenueTonMinor: number;
  readonly entryPort?: EntryPortValue;
  readonly note?: string;
}

/**
 * Weekly (or ad hoc) freight-PARTNER rate log (2026-09-14 gap-closure audit, item 7).
 *
 * "Partner" here is the logistics/freight forwarder (Imari and its peers) — this module's
 * own domain — not the factory `Supplier` (`SupplierPricePoint` belongs to sourcing-quality,
 * out of this module's ownership per the integration contract's module table; sourcing owns
 * that model and touching it here would be exactly the cross-module reach the constitution
 * forbids). This is the logistics-owned equivalent, same append-only discipline.
 *
 * No scheduler/cron infrastructure exists anywhere in this monorepo (confirmed by the audit:
 * no `@Cron`/BullMQ-repeatable job anywhere). Building one is out of scope for this pass —
 * this is deliberately the NARROW, manually-triggerable half of item 7: a coordinator (or a
 * partner-submitted price update, once that intake exists) calls `recordWeeklyRate` and a new
 * row is appended, never an UPDATE. Weekly automation (a BullMQ repeatable job in
 * backend/worker, or @nestjs/schedule) is a stated follow-up, not built here.
 */
@Injectable()
export class PartnerRateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  async recordWeeklyRate(actor: Actor, input: RecordPartnerRateInput) {
    await this.authz.authorize(actor, 'shipment', 'create');

    if (!input.partnerId.trim()) throw new BadRequestException('partnerId is required');
    if (!Number.isInteger(input.ratePerRevenueTonMinor) || input.ratePerRevenueTonMinor <= 0) {
      throw new BadRequestException('ratePerRevenueTonMinor must be a positive integer (minor units)');
    }

    const seq = await nextSequence(this.prisma.partnerRateCard, (n) => makePartnerRateRef(n));
    const ref = makePartnerRateRef(seq);
    return this.prisma.partnerRateCard.create({
      data: {
        ref,
        partnerId: input.partnerId,
        destination: input.destination,
        entryPort: input.entryPort ?? null,
        ratePerRevenueTonMinor: input.ratePerRevenueTonMinor,
        note: input.note ?? null,
        recordedBy: actor.userId,
      },
    });
  }

  /** Full append-only history for a partner, newest first — nothing is ever deleted or
   *  overwritten, so this IS the audit trail. */
  async history(actor: Actor, partnerId: string) {
    await this.authz.authorize(actor, 'shipment', 'read');
    return this.prisma.partnerRateCard.findMany({
      where: { partnerId },
      orderBy: { observedAt: 'desc' },
    });
  }

  /** The latest rate for a partner+destination — "current" is simply "most recent",
   *  never a mutated field. Null when no rate has ever been recorded. */
  async currentRate(actor: Actor, partnerId: string, destination: Destination) {
    await this.authz.authorize(actor, 'shipment', 'read');
    return this.prisma.partnerRateCard.findFirst({
      where: { partnerId, destination },
      orderBy: { observedAt: 'desc' },
    });
  }
}
