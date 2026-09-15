import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  mayDisclose,
  normaliseLender,
  redactForLender,
  type LenderFacingFile,
} from './lender-view-access';

/**
 * A lender asks about one borrower, by UZA ID, and gets what it is entitled to.
 *
 * The access rules live next door in lender-view-access.ts and are tested on their own.
 * This service is the part that touches the database: it establishes entitlement and
 * consent, composes the file from whatever is instrumented today, redacts, and records
 * that the disclosure happened.
 *
 * WHY THE SECTIONS ARE OPTIONAL
 *
 * Training, wallet, utilisation and inspections live in systems Nexus does not own —
 * exactly as the impact framework requires: Nexus computes and stores nothing of its own.
 * Until each of those systems adopts the UZA ID, its section is ABSENT rather than empty.
 *
 * That distinction is load-bearing. An empty section reads as "this borrower has no
 * training", which is a claim. An absent one reads as "we are not measuring this yet",
 * which is the truth. A credit committee shown a zero it believes is a measurement will
 * make a decision on it.
 */

/**
 * How the operational systems supply their part of the file.
 *
 * Deliberately an interface with a null implementation rather than direct database calls:
 * the Mobility platform, the wallet and the garage are separate services with separate
 * databases, and this is the seam where they plug in one at a time.
 */
export interface LenderDataSource {
  training(uzaId: string): Promise<LenderFacingFile['training'] | undefined>;
  wallet(uzaId: string): Promise<LenderFacingFile['wallet'] | undefined>;
  utilisation(uzaId: string): Promise<LenderFacingFile['utilisation'] | undefined>;
  inspections(uzaId: string): Promise<LenderFacingFile['inspections'] | undefined>;
  creditEnhancement(
    uzaId: string,
    lender: string,
  ): Promise<LenderFacingFile['creditEnhancement'] | undefined>;
}

/** Nothing is instrumented yet. Every section absent, which is the honest answer today. */
export const NOT_YET_INSTRUMENTED: LenderDataSource = {
  training: async () => undefined,
  wallet: async () => undefined,
  utilisation: async () => undefined,
  inspections: async () => undefined,
  creditEnhancement: async () => undefined,
};

export interface LenderView {
  file: LenderFacingFile;
  /** Sections not yet fed by a live system, named so nobody reads absence as zero. */
  notYetInstrumented: string[];
}

/**
 * A lender is not a UZA employee and has no Actor.
 *
 * So these write through `audit.record` with an explicit `lender` role rather than through
 * the `allow`/`deny` helpers, which take an Actor. The alternative was adding `lender` to
 * the Role union in @uza/contracts, and that would be wrong: Role drives ROLE_GRANTS and
 * the permission model for EMPLOYEES, and a counterparty that may read exactly one file
 * with its borrower's consent does not belong in it. `actorRole` on AuditLog is a free
 * string precisely so the log can record what actually happened.
 */
const AUDIT_ROLE = 'lender';

@Injectable()
export class LenderViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sources: LenderDataSource = NOT_YET_INSTRUMENTED,
  ) {}

  /**
   * Record that a lender has a loan with this person. This is the entitlement — without a
   * row here, that lender cannot see this borrower at all.
   */
  async registerBorrower(input: {
    personRef: string;
    lender: string;
    loanRef?: string;
  }): Promise<void> {
    const lender = normaliseLender(input.lender);
    await this.prisma.lenderBorrower.upsert({
      where: { personRef_lender: { personRef: input.personRef, lender } },
      create: { personRef: input.personRef, lender, loanRef: input.loanRef ?? null },
      update: { loanRef: input.loanRef ?? undefined },
    });
  }

  /**
   * The borrower's consent for THIS lender to see THIS file. Affirmative and revocable.
   *
   * Withdrawal sets a date rather than clearing the grant, so the record still shows that
   * consent existed and when it ended. A complaint or an audit asks exactly that, and a
   * cleared field cannot answer it.
   */
  async setConsent(personRef: string, lender: string, granted: boolean): Promise<void> {
    const key = { personRef, lender: normaliseLender(lender) };
    await this.prisma.lenderBorrower.update({
      where: { personRef_lender: key },
      data: granted
        ? { consentGivenAt: new Date(), consentWithdrawnAt: null }
        : { consentWithdrawnAt: new Date() },
    });
  }

  /**
   * The disclosure itself.
   *
   * Every refusal throws the SAME exception with the SAME message, whichever gate failed.
   * That is not laziness — it is the point. If "not your borrower" were distinguishable
   * from "no such person", a lender could walk UZA IDs and learn which ones are UZA
   * clients, which is a disclosure even when the answer is no. The specific reason goes to
   * the audit log, where it belongs, and never to the caller.
   */
  async view(lender: string, uzaId: string): Promise<LenderView> {
    const key = normaliseLender(lender);

    const [person, link] = await Promise.all([
      this.prisma.person.findUnique({ where: { ref: uzaId } }),
      this.prisma.lenderBorrower.findUnique({
        where: { personRef_lender: { personRef: uzaId, lender: key } },
      }),
    ]);

    const decision = mayDisclose({
      personExists: Boolean(person),
      isBorrowerOfThisLender: Boolean(link),
      consentGivenAt: link?.consentGivenAt ?? null,
      consentWithdrawnAt: link?.consentWithdrawnAt ?? null,
    });

    if (!decision.allowed) {
      // The reason is recorded, not returned. A refused attempt is worth keeping: a lender
      // asking repeatedly about people who are not its borrowers is a thing to notice.
      await this.audit.record({
        actorId: `lender:${key}`,
        actorRole: AUDIT_ROLE,
        resource: 'lender-view',
        action: 'read',
        decision: 'deny',
        reason: decision.reason ?? 'refused',
        targetRef: uzaId,
      });
      throw new ForbiddenException('No file available for that reference.');
    }

    const [training, wallet, utilisation, inspections, creditEnhancement] = await Promise.all([
      this.sources.training(uzaId),
      this.sources.wallet(uzaId),
      this.sources.utilisation(uzaId),
      this.sources.inspections(uzaId),
      this.sources.creditEnhancement(uzaId, key),
    ]);

    const composed: LenderFacingFile = {
      uzaId: person!.ref,
      displayName: person!.displayName,
      ...(training && { training }),
      ...(wallet && { wallet }),
      ...(utilisation && { utilisation }),
      ...(inspections && { inspections }),
      ...(creditEnhancement && { creditEnhancement }),
    };

    // The wall. Everything lender-facing goes through this, always — never around it.
    const file = redactForLender(composed, key);

    const notYetInstrumented = (
      [
        ['training', training],
        ['wallet', wallet],
        ['utilisation', utilisation],
        ['inspections', inspections],
      ] as const
    )
      .filter(([, v]) => v === undefined)
      .map(([name]) => name);

    await this.audit.record({
      actorId: `lender:${key}`,
      actorRole: AUDIT_ROLE,
      resource: 'lender-view',
      action: 'read',
      decision: 'allow',
      targetRef: uzaId,
    });

    return { file, notYetInstrumented };
  }
}
