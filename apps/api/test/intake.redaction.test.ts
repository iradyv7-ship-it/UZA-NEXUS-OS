import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import type { Actor } from '@uza/contracts';
import { prisma } from './db';
import { AuditService } from '../src/platform/audit/audit.service';
import { PlanningAccessService } from '../src/planning/planning-authz.service';
import { IntakeService } from '../src/intake/intake.service';

// The three capture sources are only used by sweep(); add/read/promote/dismiss/share never
// touch them, so a stub is enough here — matching how other fixtures use `as never` for
// dependencies a given test file doesn't exercise.
const audit = new AuditService(prisma as never);
const access = new PlanningAccessService(audit);
const intake = new IntakeService(prisma as never, access, {} as never, {} as never, {} as never);

const finance: Actor = { userId: 'FIN-1', role: 'finance', office: 'RW', scope: {} };

async function reset(): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Signal" RESTART IDENTITY CASCADE');
}
beforeEach(reset);
afterAll(async () => {
  await prisma.$disconnect();
});

// Regression coverage for the finding that intake.service.ts stored `body` raw and served
// it raw on every read path, unlike `title`/`summary` which are redacted before anything
// shared sees them. classify() only wall-flags a signal on a wall term or a RESTRICTED
// phrase (e.g. "bank details") — a bare phone number with neither triggers neither, stays
// lane='shared', and previously reached any of the five intake:read roles unredacted.
describe('intake body redaction on egress', () => {
  const bodyWithPhone = 'Call the driver back on 0788123456 about the pickup time.';

  it('redacts a bare phone number in the body returned by add(), even though it never trips a wall or RESTRICTED term', async () => {
    const created = await intake.add(finance, { title: 'Pickup follow-up', body: bodyWithPhone });
    expect(created?.lane).toBe('shared'); // confirms this signal was never walled in the first place
    expect(created?.body).not.toContain('0788123456');
    expect(created?.body).toContain('[phone]');
  });

  it('keeps the stored row raw but redacts every read through the service — the same store-raw, redact-at-egress design triage.service.ts already uses before a model call', async () => {
    const created = await intake.add(finance, { title: 'Pickup follow-up', body: bodyWithPhone });
    const raw = await prisma.signal.findUnique({ where: { ref: created!.ref } });
    // Storage is deliberately untouched by this fix — a future egress point (or a
    // legitimate internal consumer like triage.service.ts) still gets the true source text
    // and decides for itself whether/how to redact, rather than working from an already-
    // lossy copy.
    expect(raw?.body).toContain('0788123456');

    const read = await intake.read(finance, created!.ref);
    expect(read.body).not.toContain('0788123456');
    expect(read.body).toContain('[phone]');
  });

  it('still excludes body entirely from list(), unchanged', async () => {
    await intake.add(finance, { title: 'Pickup follow-up', body: bodyWithPhone });
    const rows = await intake.list(finance);
    expect(rows.every((r) => !('body' in r))).toBe(true);
  });
});
