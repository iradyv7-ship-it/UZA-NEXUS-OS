import type { Actor } from '@uza/contracts';
import { PrismaClient } from '@prisma/client';
import { IdentityService } from './src/platform/identity/identity.service';
import { AuditService } from './src/platform/audit/audit.service';
import { AuthorizationService } from './src/platform/authorization/authorization.service';

/** Idempotent seed for the web slice: one org, one office, and the users the
 *  venture_manager flow needs. Safe to run repeatedly. */
async function main() {
  const prisma = new PrismaClient();
  const authz = new AuthorizationService(new AuditService(prisma as never));
  const identity = new IdentityService(prisma as never, authz);
  const ceoActor: Actor = { userId: 'CEO-RW-0001', role: 'ceo', office: 'GOM', scope: {} };

  let org = await prisma.organisation.findFirst();
  if (!org) org = await identity.createOrganisation(ceoActor, 'UZA Solutions Ltd');
  let office = await prisma.office.findFirst({ where: { code: 'GOM' } });
  if (!office) office = await identity.createOffice(ceoActor, org.id, 'GOM', 'Goma HQ');

  const users: Array<[string, string, string]> = [
    ['CEO-RW-0001', 'ceo@uza.rw', 'ceo'],
    ['VM-RW-0001', 'vm@uza.rw', 'venture_manager'],
    ['AGT-GOM-0021', 'agent@uza.rw', 'sales_agent'],
    ['FIN-RW-0001', 'finance@uza.rw', 'finance'],
  ];
  for (const [ref, email, role] of users) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`exists   ${email} (${role})`);
      continue;
    }
    await identity.createEmployee(ceoActor, {
      ref,
      email,
      password: 'password1',
      role: role as never,
      officeId: office.id,
    });
    console.log(`created  ${email} (${role})`);
  }
  await prisma.$disconnect();
  console.log('seed done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
