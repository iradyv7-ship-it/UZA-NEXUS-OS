import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import type { Actor } from '@uza/contracts';
import { prisma } from './db';
import { AuditService } from '../src/platform/audit/audit.service';
import { AuthorizationService } from '../src/platform/authorization/authorization.service';
import { UzaIdService } from '../src/platform/uza-id/uza-id.service';
import { LenderViewService } from '../src/platform/lender-view/lender-view.service';
import { PORTAL_REFUSAL } from '../src/platform/portal/portal-access';
import { COLLATERAL_ENTITLED } from '../src/platform/lender-view/lender-view-access';

/**
 * Onboarding a NEW stakeholder in an existing category.
 *
 * The question this file answers, and the reason it exists: when UZA signs a fifth bank,
 * is that a data change or a code change?
 *
 * It must be a data change. A portal that needs a developer, a pull request and a deploy
 * every time a lender signs is a portal that will be bypassed by somebody emailing a
 * spreadsheet — which is exactly the disclosure this whole design prevents.
 *
 * Every lender below is invented in the test itself. Nothing in `src/` names it, and that
 * is the point being asserted.
 */

const audit = new AuditService(prisma as never);
const ids = new UzaIdService(prisma as never, new AuthorizationService(audit));
const view = new LenderViewService(prisma as never, audit);

const vm: Actor = { userId: 'VM-RW-0001', role: 'venture_manager', office: 'KGL', scope: {} };

beforeAll(() => {
  process.env['UZA_ID_PEPPER'] = 'test-pepper-not-a-real-secret';
});

async function reset(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "LenderBorrower","PersonLink","Person","AuditLog" RESTART IDENTITY CASCADE',
  );
}

/** Onboard a lender and a consenting borrower using only public API calls. */
async function onboard(lender: string, externalId: string): Promise<string> {
  const p = await ids.resolve(vm, {
    system: 'mobility',
    externalId,
    displayName: 'A Borrower',
  });
  await view.registerBorrower({ personRef: p.ref, lender, loanRef: `L-${lender}` });
  await view.setConsent(p.ref, lender, true);
  return p.ref;
}

beforeEach(reset);
afterAll(async () => {
  await prisma.$disconnect();
});

describe('a brand-new lender, with no code written for it', () => {
  // Not in COLLATERAL_ENTITLED, not in any switch, not in any config file.
  const NEW = 'bank-of-kigali';

  it('gets a working portal the moment the data exists', async () => {
    const ref = await onboard(NEW, 'm-new-1');
    const { file } = await view.view(NEW, ref);
    expect(file.uzaId).toBe(ref);
  });

  it('is walled from every existing lender by the same rule', async () => {
    const theirs = await onboard('unguka', 'm-u-1');
    await expect(view.view(NEW, theirs)).rejects.toThrow();

    const mine = await onboard(NEW, 'm-new-2');
    await expect(view.view('unguka', mine)).rejects.toThrow();
  });

  it('does NOT inherit the collateral entitlement', async () => {
    // The one thing onboarding must never grant by default. A new lender starts with no
    // sight of the facility, and getting it is a separate, deliberate decision.
    const ref = await onboard(NEW, 'm-new-3');
    const { file } = await view.view(NEW, ref);
    expect(file.creditEnhancement).toBeUndefined();
    expect(COLLATERAL_ENTITLED).not.toContain(NEW);
  });

  it('refuses identically to every other lender', async () => {
    const ref = await onboard('unguka', 'm-u-2');
    const notMine = await view.view(NEW, ref).catch((e) => e.message);
    const unknown = await view.view(NEW, 'UZA-P-999999').catch((e) => e.message);
    expect(notMine).toBe(unknown);
  });

  it('needs its own consent — an existing lender’s consent does not carry over', async () => {
    // 058/2021 consent is specific. Agreeing Unguka may see a file is not agreeing the new
    // bank may, and onboarding must not quietly assume otherwise.
    const ref = await onboard('unguka', 'm-u-3');
    await view.registerBorrower({ personRef: ref, lender: NEW }); // entitled, no consent
    await expect(view.view(NEW, ref)).rejects.toThrow();

    await view.setConsent(ref, NEW, true);
    await expect(view.view(NEW, ref)).resolves.toBeDefined();
  });

  it('is audited under its own name from the first read', async () => {
    const ref = await onboard(NEW, 'm-new-4');
    await view.view(NEW, ref);
    const row = await prisma.auditLog.findFirst({
      where: { actorId: `lender:${NEW}`, decision: 'allow' },
      orderBy: { createdAt: 'desc' },
    });
    expect(row?.targetRef).toBe(ref);
  });
});

describe('the lender key is data, not an enum', () => {
  it('accepts any name, normalised the same way', async () => {
    // No switch statement anywhere decides what a valid lender is. If it were an enum,
    // onboarding would be a schema migration.
    for (const [i, name] of ['I&M Bank', 'BPR', 'Cogebanque'].entries()) {
      await reset();
      const key = name.toLowerCase();
      const ref = await onboard(key, `m-${i}`);
      await expect(view.view('  ' + name.toUpperCase() + ' ', ref)).resolves.toBeDefined();
    }
  });
});

describe('widening the collateral entitlement is deliberately NOT data', () => {
  it('is a list of one, in code, and changing it changes this test', () => {
    // The friction is the point. Onboarding a lender is routine and should be data.
    // Granting one sight of the cash-collateral facility is a founder's decision, and it
    // should require a file to change, a test to change, and somebody to review both.
    expect(COLLATERAL_ENTITLED).toEqual(['unguka']);
  });
});

describe('the refusal message is shared, not per-portal', () => {
  it('is defined once so no portal can invent a more helpful one', () => {
    // A "helpful" error leaks which rule failed, which is how a portal starts answering
    // whether a given person is a UZA client.
    expect(PORTAL_REFUSAL).toBe('No record available for that reference.');
  });
});
