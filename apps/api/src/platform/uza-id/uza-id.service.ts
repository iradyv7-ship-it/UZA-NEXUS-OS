import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { formatId } from '../ids/readable-id';
import { nationalIdHash, phoneHash } from './uza-id.hash';

/**
 * The UZA ID — one person, one identifier, across every UZA system.
 *
 * The problem this solves is concrete rather than architectural. The mobility apps were
 * each spun off the same starter, and each carries its OWN Supabase project. So a driver
 * who trains through the onboarding app, buys through the Mobility platform and charges
 * through the charging platform is three unrelated people with three logins, and no
 * question that spans two systems can be answered at all.
 *
 * This service issues the identifier and holds the map. It does NOT merge the databases.
 * Each system keeps its own user table and records the UZA ID next to its own row; a
 * system that has not adopted the ID yet simply has no link, which shows up as a gap
 * rather than as a wrong answer. That is reversible and can be rolled out one system at a
 * time. A merge is neither.
 */

export interface PersonIdentity {
  /** Whatever the calling system calls this person. */
  externalId: string;
  /** "mobility" | "charge" | "evfleet" | "battery" | "taxi" | "nexus" — free, but agree it. */
  system: string;
  displayName: string;
  phone?: string | null;
  nationalId?: string | null;
}

export interface ResolveResult {
  ref: string;
  displayName: string;
  /** How this person was arrived at. Worth surfacing — see the note on `matched`. */
  outcome: 'existing-link' | 'matched' | 'created';
}

@Injectable()
export class UzaIdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  /**
   * The single entry point every system calls. Idempotent by construction: called twice
   * with the same (system, externalId) it returns the same UZA ID and changes nothing.
   *
   * Resolution runs in a deliberate order, cheapest and most certain first:
   *
   *   1. An existing link for this (system, externalId). Definitive — this system has
   *      already told us who this is.
   *   2. A match on national ID, then on phone. Probable, not certain: see below.
   *   3. Otherwise a new person.
   *
   * ON STEP 2, WHICH IS THE ONLY RISKY ONE. Two people genuinely do share a phone — a
   * couple, a parent and child, a co-operative using one handset. Matching on it will
   * therefore sometimes be wrong, and merging two people is far more damaging than
   * failing to link them: it puts one person's loan against another's name.
   *
   * So a phone match returns `outcome: 'matched'` rather than pretending to be certain,
   * and callers are expected to surface that for confirmation before anything
   * consequential is attached to it. National ID is treated as strong, phone as a
   * suggestion. This service will not silently unify two identities on a phone number
   * alone — it links, and it tells you it guessed.
   */
  async resolve(actor: Actor, input: PersonIdentity): Promise<ResolveResult> {
    await this.authz.authorize(actor, 'uza-id', 'resolve');
    const system = input.system.trim().toLowerCase();
    const externalId = input.externalId.trim();
    if (!system || !externalId) {
      throw new BadRequestException('system and externalId are both required');
    }
    const displayName = input.displayName.trim();
    if (!displayName) throw new BadRequestException('displayName is required');

    // 1 — this system already knows them.
    const link = await this.prisma.personLink.findUnique({
      where: { system_externalId: { system, externalId } },
      include: { person: true },
    });
    if (link) {
      return {
        ref: this.follow(link.person.ref, link.person.mergedIntoRef),
        displayName: link.person.displayName,
        outcome: 'existing-link',
      };
    }

    const nid = nationalIdHash(input.nationalId);
    const phone = phoneHash(input.phone);

    // 2 — somebody else already knows them. National ID first: it is the stronger key.
    const existing =
      (nid ? await this.prisma.person.findUnique({ where: { nationalIdHash: nid } }) : null) ??
      (phone ? await this.prisma.person.findUnique({ where: { phoneHash: phone } }) : null);

    if (existing) {
      await this.prisma.personLink.create({
        data: { personRef: existing.ref, system, externalId },
      });
      // Fill in a key the earlier record lacked, but never overwrite one. A conflicting
      // key means the match was wrong, and the right response to that is to leave both
      // records intact for a human rather than to quietly pick a winner.
      const fill: { nationalIdHash?: string; phoneHash?: string } = {};
      if (nid && !existing.nationalIdHash) fill.nationalIdHash = nid;
      if (phone && !existing.phoneHash) fill.phoneHash = phone;
      if (Object.keys(fill).length) {
        await this.prisma.person.update({ where: { ref: existing.ref }, data: fill });
      }
      return {
        ref: this.follow(existing.ref, existing.mergedIntoRef),
        displayName: existing.displayName,
        outcome: 'matched',
      };
    }

    // 3 — new to UZA.
    const ref = await this.issueRef();
    await this.prisma.person.create({
      data: {
        ref,
        displayName,
        nationalIdHash: nid ?? null,
        phoneHash: phone ?? null,
        links: { create: [{ system, externalId }] },
      },
    });
    return { ref, displayName, outcome: 'created' };
  }

  /** Everything UZA knows about where this person exists. The point of the whole thing. */
  async links(actor: Actor, ref: string): Promise<{ system: string; externalId: string }[]> {
    await this.authz.authorize(actor, 'uza-id', 'links', { ref });
    const person = await this.prisma.person.findUnique({
      where: { ref },
      include: { links: { orderBy: { system: 'asc' } } },
    });
    if (!person) throw new NotFoundException(`no person with ref ${ref}`);
    return person.links.map((l) => ({ system: l.system, externalId: l.externalId }));
  }

  /**
   * Attach a system's record to a person that is already known — used when a human has
   * confirmed a match the automatic path was not confident enough to make.
   */
  async link(actor: Actor, ref: string, system: string, externalId: string): Promise<void> {
    await this.authz.authorize(actor, 'uza-id', 'link', { ref });
    const person = await this.prisma.person.findUnique({ where: { ref } });
    if (!person) throw new NotFoundException(`no person with ref ${ref}`);
    const s = system.trim().toLowerCase();
    const existing = await this.prisma.personLink.findUnique({
      where: { system_externalId: { system: s, externalId } },
    });
    if (existing) {
      if (existing.personRef === ref) return; // already so; saying so twice is not an error
      throw new ConflictException(
        `${s}:${externalId} is already linked to ${existing.personRef}. Unlink it deliberately ` +
          'rather than moving it, so there is a record of the decision.',
      );
    }
    await this.prisma.personLink.create({ data: { personRef: ref, system: s, externalId } });
  }

  /**
   * Fold one person into another after a human has established they are the same.
   *
   * The loser is NOT deleted. Its links move and it keeps a `mergedIntoRef` tombstone, so
   * an ID printed on a form, quoted in a loan file or stored in a system that has not been
   * updated yet still resolves to the right person. Deleting it would turn every one of
   * those into a dead reference, and merges are exactly the situation where old references
   * are still in circulation.
   */
  async merge(actor: Actor, loserRef: string, winnerRef: string): Promise<void> {
    // Scoped on the winner: the surviving record is the one whose future this decision
    // actually shapes, and it is always present (loserRef===winnerRef is rejected next).
    await this.authz.authorize(actor, 'uza-id', 'merge', { ref: winnerRef });
    if (loserRef === winnerRef) throw new BadRequestException('cannot merge a person into themselves');
    const [loser, winner] = await Promise.all([
      this.prisma.person.findUnique({ where: { ref: loserRef } }),
      this.prisma.person.findUnique({ where: { ref: winnerRef } }),
    ]);
    if (!loser) throw new NotFoundException(`no person with ref ${loserRef}`);
    if (!winner) throw new NotFoundException(`no person with ref ${winnerRef}`);
    if (loser.mergedIntoRef) {
      throw new ConflictException(`${loserRef} was already merged into ${loser.mergedIntoRef}`);
    }

    await this.prisma.$transaction(async (tx) => {
      const links = await tx.personLink.findMany({ where: { personRef: loserRef } });
      for (const l of links) {
        const clash = await tx.personLink.findUnique({
          where: { system_externalId: { system: l.system, externalId: l.externalId } },
        });
        // If the winner already holds the identical link, drop the duplicate rather than
        // violating the unique constraint and failing the whole merge.
        if (clash && clash.personRef === winnerRef) {
          await tx.personLink.delete({ where: { id: l.id } });
        } else {
          await tx.personLink.update({ where: { id: l.id }, data: { personRef: winnerRef } });
        }
      }
      // The match keys must move too, or the loser keeps the unique hash and the winner
      // can never be found by it again.
      await tx.person.update({
        where: { ref: loserRef },
        data: { mergedIntoRef: winnerRef, phoneHash: null, nationalIdHash: null },
      });
      await tx.person.update({
        where: { ref: winnerRef },
        data: {
          phoneHash: winner.phoneHash ?? loser.phoneHash,
          nationalIdHash: winner.nationalIdHash ?? loser.nationalIdHash,
        },
      });
    });
  }

  /** Consent to appear in aggregate impact reporting. Revocable, and revocation is dated. */
  async setReportingConsent(actor: Actor, ref: string, granted: boolean): Promise<void> {
    await this.authz.authorize(actor, 'uza-id', 'consent', { ref });
    const person = await this.prisma.person.findUnique({ where: { ref } });
    if (!person) throw new NotFoundException(`no person with ref ${ref}`);
    await this.prisma.person.update({
      where: { ref },
      data: granted
        ? { reportingConsent: true, consentRecordedAt: new Date(), consentWithdrawnAt: null }
        : { reportingConsent: false, consentWithdrawnAt: new Date() },
    });
  }

  /** A merged record still answers, pointing at the person it became. */
  private follow(ref: string, mergedIntoRef: string | null): string {
    return mergedIntoRef ?? ref;
  }

  /**
   * Reads the highest existing ref rather than counting rows. Counting is the bug that
   * already bit this codebase once: delete row 7 of 33 and the next `count() + 1` collides
   * with an ID that is still in use, and every insert 500s until somebody works out why.
   */
  private async issueRef(): Promise<string> {
    const newest = await this.prisma.person.findFirst({
      where: { ref: { startsWith: 'UZA-P-' } },
      orderBy: { ref: 'desc' },
      select: { ref: true },
    });
    const seq = newest ? Number.parseInt(newest.ref.slice('UZA-P-'.length), 10) + 1 : 1;
    return formatId('person', { seq: Number.isNaN(seq) ? 1 : seq });
  }
}
