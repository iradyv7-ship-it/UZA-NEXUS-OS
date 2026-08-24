import { type Actor } from '@uza/contracts';
import { PrismaClient } from '@prisma/client';
import { IdentityService } from './src/platform/identity/identity.service';
import { AuditService } from './src/platform/audit/audit.service';
import { AuthorizationService } from './src/platform/authorization/authorization.service';

/**
 * One-off: add the founder's Gmail as a Google-only sign-in identity, matched at the
 * `ceo` role. "Sign in with Google" matches solely by email — since the real work
 * account is yves@uzasolutions.rw and the founder's Google identity is a personal
 * Gmail, the two need separate User rows. Password login stays on yves@uzasolutions.rw;
 * this row exists only so the Google flow has an email to match. Idempotent.
 *
 * Scope, deliberately narrow: this does NOT change auto-provisioning. Google sign-in
 * still only works for emails that already have a User row — this script adds exactly
 * one, for the founder himself, matching what the original seed already intended
 * (see the "owner's Gmail" comment in apps/api/seed-web.ts).
 */
async function main() {
  const prisma = new PrismaClient();
  const authz = new AuthorizationService(new AuditService(prisma as never));
  const identity = new IdentityService(prisma as never, authz);
  const ceoActor: Actor = { userId: 'CEO-KGL-0001', role: 'ceo', office: 'KGL', scope: {} };

  const email = 'iradyv7@gmail.com';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`exists   ${email} (${existing.role}, ref=${existing.ref})`);
    return;
  }

  const office = await prisma.office.findFirst({ where: { code: 'KGL' } });
  if (!office) throw new Error('KGL office not found — run seed-users.ts first');

  // Random, unused password: this account is meant to be reached only via Google.
  const password = `google-only-${Math.random().toString(36).slice(2)}${Date.now()}`;

  await identity.createEmployee(ceoActor, {
    ref: 'CEO-KGL-0002',
    email,
    password,
    role: 'ceo',
    officeId: office.id,
  });
  console.log(`created  ${email} (ceo, ref=CEO-KGL-0002) — Google sign-in only, no usable password`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
