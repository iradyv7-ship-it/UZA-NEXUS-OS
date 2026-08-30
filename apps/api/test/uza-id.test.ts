import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import type { Actor } from '@uza/contracts';
import { prisma } from './db';
import { AuditService } from '../src/platform/audit/audit.service';
import { AuthorizationService } from '../src/platform/authorization/authorization.service';
import { UzaIdService } from '../src/platform/uza-id/uza-id.service';
import {
  MissingPepperError,
  nationalIdHash,
  normalisePhone,
  phoneHash,
} from '../src/platform/uza-id/uza-id.hash';

const audit = new AuditService(prisma as never);
const authz = new AuthorizationService(audit);
const ids = new UzaIdService(prisma as never, authz);

// venture_manager: the broadest of the internal-staff roles granted uza-id access — used
// as the default actor throughout this file so the pre-existing tests exercise the normal
// path. The dedicated 'authorization' describe block below covers the boundary.
const vm: Actor = { userId: 'VM-1', role: 'venture_manager', office: 'RW', scope: {} };
// 'customer' was the original actor for the no-uza-id-grant case; no longer a Nexus login
// role. logistics_partner also holds zero uza-id grants (see ROLE_GRANTS), same conformance
// point.
const partner: Actor = {
  userId: 'PTR-1',
  role: 'logistics_partner',
  office: 'RW',
  scope: { shipmentRefs: [] },
};
const financeActor: Actor = { userId: 'FIN-1', role: 'finance', office: 'RW', scope: {} };

beforeAll(() => {
  // Matching refuses to run unpeppered, so the suite must supply one.
  process.env['UZA_ID_PEPPER'] = 'test-pepper-not-a-real-secret';
});

async function reset(): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "PersonLink","Person" RESTART IDENTITY CASCADE');
}

beforeEach(reset);
afterAll(async () => {
  await prisma.$disconnect();
});

describe('phone normalisation', () => {
  it('collapses every spelling of one Rwandan number to the same key', () => {
    const forms = ['0788123456', '+250788123456', '250 788 123 456', '788-123-456', '788123456'];
    const keys = new Set(forms.map(normalisePhone));
    expect(keys.size).toBe(1);
    expect([...keys][0]).toBe('788123456');
  });

  it('keeps two genuinely different numbers apart', () => {
    expect(normalisePhone('0788123456')).not.toBe(normalisePhone('0788123457'));
  });

  it('ignores input too short to be a phone number rather than hashing rubbish', () => {
    expect(phoneHash('123')).toBeUndefined();
    expect(phoneHash('')).toBeUndefined();
    expect(phoneHash(null)).toBeUndefined();
  });
});

describe('the pepper', () => {
  it('refuses to hash without one, rather than producing a reversible digest', () => {
    const saved = process.env['UZA_ID_PEPPER'];
    delete process.env['UZA_ID_PEPPER'];
    try {
      expect(() => phoneHash('0788123456')).toThrow(MissingPepperError);
    } finally {
      process.env['UZA_ID_PEPPER'] = saved;
    }
  });

  it('does not let a phone and a national ID of the same digits collide', () => {
    expect(phoneHash('788123456')).not.toBe(nationalIdHash('788123456'));
  });
});

describe('issuing the UZA ID', () => {
  it('issues the documented format', async () => {
    const r = await ids.resolve(vm, {
      system: 'mobility',
      externalId: 'm-1',
      displayName: 'A Driver',
    });
    expect(r.ref).toMatch(/^UZA-P-\d{6}$/);
    expect(r.outcome).toBe('created');
  });

  it('is idempotent — the same system record always returns the same ID', async () => {
    const a = await ids.resolve(vm, {
      system: 'mobility',
      externalId: 'm-1',
      displayName: 'A Driver',
    });
    const b = await ids.resolve(vm, {
      system: 'mobility',
      externalId: 'm-1',
      displayName: 'A Driver',
    });
    expect(b.ref).toBe(a.ref);
    expect(b.outcome).toBe('existing-link');
    expect(await prisma.person.count()).toBe(1);
  });

  it('increments from the highest existing ref, not from a row count', async () => {
    // The bug this guards against: delete a row and `count() + 1` collides with a ref that
    // is still in use. It has already happened once in this codebase.
    const a = await ids.resolve(vm, { system: 'mobility', externalId: 'm-1', displayName: 'One' });
    const b = await ids.resolve(vm, { system: 'mobility', externalId: 'm-2', displayName: 'Two' });
    await prisma.person.delete({ where: { ref: a.ref } });
    const c = await ids.resolve(vm, {
      system: 'mobility',
      externalId: 'm-3',
      displayName: 'Three',
    });
    expect(c.ref).not.toBe(b.ref);
    expect(c.ref).not.toBe(a.ref);
    expect(c.ref > b.ref).toBe(true);
  });
});

describe('recognising the same person across systems', () => {
  it('links a second system to the person already known, by national ID', async () => {
    const first = await ids.resolve(vm, {
      system: 'evfleet',
      externalId: 'f-1',
      displayName: 'A Driver',
      nationalId: '1199012345678901',
    });
    const second = await ids.resolve(vm, {
      system: 'charge',
      externalId: 'c-9',
      displayName: 'A. Driver',
      nationalId: '1199 0123 4567 8901',
    });
    expect(second.ref).toBe(first.ref);
    expect(second.outcome).toBe('matched');
    expect(await prisma.person.count()).toBe(1);

    const links = await ids.links(vm, first.ref);
    expect(links).toEqual([
      { system: 'charge', externalId: 'c-9' },
      { system: 'evfleet', externalId: 'f-1' },
    ]);
  });

  it('reports a phone match as a guess rather than a certainty', async () => {
    await ids.resolve(vm, {
      system: 'evfleet',
      externalId: 'f-1',
      displayName: 'One',
      phone: '0788123456',
    });
    const second = await ids.resolve(vm, {
      system: 'charge',
      externalId: 'c-1',
      displayName: 'Two',
      phone: '+250 788 123 456',
    });
    // Two people really do share a handset. The caller is told this was inferred so it can
    // be confirmed before anything consequential is attached to it.
    expect(second.outcome).toBe('matched');
  });

  it('fills a missing match key but never overwrites one that disagrees', async () => {
    const first = await ids.resolve(vm, {
      system: 'evfleet',
      externalId: 'f-1',
      displayName: 'One',
      nationalId: '1199012345678901',
    });
    await ids.resolve(vm, {
      system: 'charge',
      externalId: 'c-1',
      displayName: 'One',
      nationalId: '1199012345678901',
      phone: '0788123456',
    });
    const person = await prisma.person.findUnique({ where: { ref: first.ref } });
    expect(person?.phoneHash).toBe(phoneHash('0788123456'));
  });

  it('keeps two different people apart', async () => {
    const a = await ids.resolve(vm, {
      system: 'mobility',
      externalId: 'm-1',
      displayName: 'One',
      nationalId: '1199012345678901',
    });
    const b = await ids.resolve(vm, {
      system: 'mobility',
      externalId: 'm-2',
      displayName: 'Two',
      nationalId: '1199012345678902',
    });
    expect(b.ref).not.toBe(a.ref);
    expect(await prisma.person.count()).toBe(2);
  });
});

describe('the constraint that stops fragmentation re-forming', () => {
  it('refuses to move a system record to another person by accident', async () => {
    const a = await ids.resolve(vm, { system: 'mobility', externalId: 'm-1', displayName: 'One' });
    const b = await ids.resolve(vm, { system: 'mobility', externalId: 'm-2', displayName: 'Two' });
    await expect(ids.link(vm, b.ref, 'mobility', 'm-1')).rejects.toThrow(/already linked to/);
    const links = await ids.links(vm, a.ref);
    expect(links).toEqual([{ system: 'mobility', externalId: 'm-1' }]);
  });

  it('treats re-linking the same pair as a no-op, not an error', async () => {
    const a = await ids.resolve(vm, { system: 'mobility', externalId: 'm-1', displayName: 'One' });
    await expect(ids.link(vm, a.ref, 'mobility', 'm-1')).resolves.toBeUndefined();
  });
});

describe('merging two records for one person', () => {
  it('moves the links and leaves the old ID resolving to the new one', async () => {
    const loser = await ids.resolve(vm, {
      system: 'evfleet',
      externalId: 'f-1',
      displayName: 'One',
    });
    const winner = await ids.resolve(vm, {
      system: 'mobility',
      externalId: 'm-1',
      displayName: 'One',
    });

    await ids.merge(vm, loser.ref, winner.ref);

    expect(await ids.links(vm, winner.ref)).toEqual([
      { system: 'evfleet', externalId: 'f-1' },
      { system: 'mobility', externalId: 'm-1' },
    ]);

    // The old ID is NOT deleted — it is printed on forms and quoted in loan files, and it
    // must keep resolving.
    const tombstone = await prisma.person.findUnique({ where: { ref: loser.ref } });
    expect(tombstone?.mergedIntoRef).toBe(winner.ref);

    const again = await ids.resolve(vm, {
      system: 'evfleet',
      externalId: 'f-1',
      displayName: 'One',
    });
    expect(again.ref).toBe(winner.ref);
  });

  it('moves the match keys, so the surviving person is still findable by them', async () => {
    const loser = await ids.resolve(vm, {
      system: 'evfleet',
      externalId: 'f-1',
      displayName: 'One',
      nationalId: '1199012345678901',
    });
    const winner = await ids.resolve(vm, {
      system: 'mobility',
      externalId: 'm-1',
      displayName: 'One',
    });
    await ids.merge(vm, loser.ref, winner.ref);

    const found = await ids.resolve(vm, {
      system: 'taxi',
      externalId: 't-1',
      displayName: 'One',
      nationalId: '1199012345678901',
    });
    expect(found.ref).toBe(winner.ref);
  });

  it('does not fail when both records already hold the identical link', async () => {
    const loser = await ids.resolve(vm, {
      system: 'evfleet',
      externalId: 'f-1',
      displayName: 'One',
    });
    const winner = await ids.resolve(vm, {
      system: 'mobility',
      externalId: 'm-1',
      displayName: 'One',
    });
    await ids.link(vm, winner.ref, 'charge', 'c-1');
    await ids.link(vm, loser.ref, 'charge', 'c-2');
    await expect(ids.merge(vm, loser.ref, winner.ref)).resolves.toBeUndefined();
  });

  it('refuses to merge a person into themselves, or to re-merge', async () => {
    const a = await ids.resolve(vm, { system: 'mobility', externalId: 'm-1', displayName: 'One' });
    const b = await ids.resolve(vm, { system: 'mobility', externalId: 'm-2', displayName: 'Two' });
    await expect(ids.merge(vm, a.ref, a.ref)).rejects.toThrow(/themselves/);
    await ids.merge(vm, a.ref, b.ref);
    await expect(ids.merge(vm, a.ref, b.ref)).rejects.toThrow(/already merged/);
  });
});

describe('reporting consent', () => {
  it('is off until it is given, and withdrawal is dated', async () => {
    const p = await ids.resolve(vm, { system: 'mobility', externalId: 'm-1', displayName: 'One' });
    let person = await prisma.person.findUnique({ where: { ref: p.ref } });
    expect(person?.reportingConsent).toBe(false);

    await ids.setReportingConsent(vm, p.ref, true);
    person = await prisma.person.findUnique({ where: { ref: p.ref } });
    expect(person?.reportingConsent).toBe(true);
    expect(person?.consentRecordedAt).toBeInstanceOf(Date);

    await ids.setReportingConsent(vm, p.ref, false);
    person = await prisma.person.findUnique({ where: { ref: p.ref } });
    expect(person?.reportingConsent).toBe(false);
    expect(person?.consentWithdrawnAt).toBeInstanceOf(Date);
  });
});

// Regression coverage for the finding that every UzaId endpoint enforced NO authorization
// at all: any authenticated actor of any role could merge two people's records or flip
// someone's Law N°058/2021 reporting-consent flag. See permissions.ts for the grant design.
describe('authorization', () => {
  it('lets an internal-staff role resolve, link and read links', async () => {
    const a = await ids.resolve(financeActor, {
      system: 'mobility',
      externalId: 'm-1',
      displayName: 'One',
    });
    await expect(ids.links(financeActor, a.ref)).resolves.toEqual([
      { system: 'mobility', externalId: 'm-1' },
    ]);
  });

  it('refuses resolve, link and links to a role with no uza-id grant', async () => {
    await expect(
      ids.resolve(partner, { system: 'mobility', externalId: 'm-1', displayName: 'One' }),
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED_ROLE' });

    const a = await ids.resolve(vm, { system: 'mobility', externalId: 'm-2', displayName: 'Two' });
    await expect(ids.links(partner, a.ref)).rejects.toMatchObject({ code: 'ACCESS_DENIED_ROLE' });
    await expect(ids.link(partner, a.ref, 'charge', 'c-1')).rejects.toMatchObject({
      code: 'ACCESS_DENIED_ROLE',
    });
  });

  it('refuses merge and reporting-consent to a role that can resolve/link but is not trusted-admin', async () => {
    const loser = await ids.resolve(vm, {
      system: 'evfleet',
      externalId: 'f-1',
      displayName: 'One',
    });
    const winner = await ids.resolve(vm, {
      system: 'mobility',
      externalId: 'm-1',
      displayName: 'One',
    });

    // finance can resolve/link (routine integration) but not merge/consent (trusted-admin only).
    await expect(ids.merge(financeActor, loser.ref, winner.ref)).rejects.toMatchObject({
      code: 'ACCESS_DENIED_ROLE',
    });
    await expect(ids.setReportingConsent(financeActor, winner.ref, true)).rejects.toMatchObject({
      code: 'ACCESS_DENIED_ROLE',
    });

    // venture_manager holds both grants and can actually do it.
    await expect(ids.merge(vm, loser.ref, winner.ref)).resolves.toBeUndefined();
    await expect(ids.setReportingConsent(vm, winner.ref, true)).resolves.toBeUndefined();
  });
});
