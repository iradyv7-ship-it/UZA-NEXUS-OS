/**
 * Logins for the ten people in the register.
 *
 *   SEED_PASSWORD='...' pnpm --filter @uza/api exec tsx prisma/seed-users.ts
 *
 * The password is NOT set here and is not chosen by anyone but the founder. The script
 * reads SEED_PASSWORD from the environment, hashes it, and applies it as a temporary
 * credential to every account it creates. It refuses to run without one rather than
 * inventing a default — a seeded default password is the single most common way a system
 * like this ends up with ten accounts nobody ever changed.
 *
 * Everyone changes theirs on first sign-in. This script does not enforce that; the founder
 * does, by telling them.
 *
 * Role mapping is deliberate and has a consequence worth knowing before you run it:
 *
 *  - `ceo` sees everything, including the private intake lane.
 *  - `venture_manager` is the project-manager role. It carries full planning access, so
 *    Scorah, Badiane and Gad each see the WHOLE register, not only their own venture.
 *    That is the correct default for three people who have to cover for each other, but
 *    it does mean Mento's file is visible to them. If it should not be, that initiative
 *    needs to move to the private lane — see DEC-2026-0020.
 *  - `china_sourcing` and the other internal roles see only what they own. Cecilia
 *    therefore cannot see the Mento initiative at all, because it is owned by the CEO.
 *    That is the founder's instruction enforced by construction rather than by memory.
 */
import { PrismaClient, type RoleName } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

interface Seat {
  ref: string;
  email: string;
  /** Additional addresses (e.g. a personal Gmail) that sign in as this same account via
   *  Google — see User.alternateEmails and AuthService.loginWithGoogle. */
  alternateEmails?: string[];
  role: RoleName;
  office: string;
  name: string;
}

const OFFICES = [
  { code: 'KGL', name: 'Kigali' },
  { code: 'CN', name: 'China desk' },
];

const SEATS: Seat[] = [
  {
    ref: 'CEO-KGL-0001',
    // Corrected from yves@uzasolutions.rw — the real company domain is .com (UNIFY House,
    // Kiyovu; info@uzasolutions.com is the general address). The other nine seats below
    // still carry the .rw domain and have not been changed — flag to the founder before
    // touching them, since that affects everyone's password-login email, not just Google.
    email: 'yves@uzasolutions.com',
    alternateEmails: ['iradyv7@gmail.com'],
    role: 'ceo', office: 'KGL', name: 'Yves Iradukunda Nsengiyumva',
  },
  { ref: 'EMP-KGL-0002', email: 'scorah@uzasolutions.rw', role: 'venture_manager', office: 'KGL', name: 'Scorah — PM, UZA Mobility' },
  { ref: 'EMP-KGL-0003', email: 'badiane@uzasolutions.rw', role: 'venture_manager', office: 'KGL', name: 'Badiane Gahamanyi — PM, UZA Bulk' },
  { ref: 'EMP-KGL-0007', email: 'gad@uzasolutions.rw', role: 'venture_manager', office: 'KGL', name: 'Kalisa Gad — PM, IT' },
  { ref: 'EMP-CHN-0004', email: 'cecilia@uzasolutions.rw', role: 'china_sourcing', office: 'CN', name: 'Cecilia — China operations' },
  { ref: 'EMP-CHN-0005', email: 'francois@uzasolutions.rw', role: 'china_warehouse', office: 'CN', name: 'Francois Habineza — China verification' },
  { ref: 'EMP-KGL-0010', email: 'adeline@uzasolutions.rw', role: 'front_office', office: 'KGL', name: 'Adeline Uwibambe — customer care' },
  { ref: 'EMP-KGL-0006', email: 'tresor@uzasolutions.rw', role: 'front_office', office: 'KGL', name: 'Tresor — garage' },
  { ref: 'EMP-KGL-0008', email: 'saddock@uzasolutions.rw', role: 'front_office', office: 'KGL', name: 'Saddock Kabandana — engineering' },
  { ref: 'EMP-KGL-0009', email: 'abijuru@uzasolutions.rw', role: 'front_office', office: 'KGL', name: 'Abijuru — web and brand' },
];

async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 10) {
    console.error(
      'Refusing to run. Set SEED_PASSWORD to a temporary password of at least 10 characters:\n' +
        "  SEED_PASSWORD='<choose one>' pnpm --filter @uza/api exec tsx prisma/seed-users.ts\n" +
        'Everyone changes theirs on first sign-in.',
    );
    process.exitCode = 1;
    return;
  }

  const org = await prisma.organisation.upsert({
    where: { name: 'UZA Solutions Ltd' },
    create: { name: 'UZA Solutions Ltd' },
    update: {},
  });

  const officeIds = new Map<string, string>();
  for (const o of OFFICES) {
    const row = await prisma.office.upsert({
      where: { code: o.code },
      create: { code: o.code, name: o.name, organisationId: org.id },
      update: { name: o.name },
    });
    officeIds.set(o.code, row.id);
  }

  const passwordHash = await hash(password, 10);

  for (const seat of SEATS) {
    // The hash is written on create only. Re-running this script must not silently reset
    // a password someone has already changed.
    await prisma.user.upsert({
      where: { ref: seat.ref },
      create: {
        ref: seat.ref,
        email: seat.email,
        alternateEmails: seat.alternateEmails ?? [],
        passwordHash,
        role: seat.role,
        kind: 'employee',
        officeId: officeIds.get(seat.office)!,
      },
      update: {
        email: seat.email,
        alternateEmails: seat.alternateEmails ?? [],
        role: seat.role,
        officeId: officeIds.get(seat.office)!,
      },
    });
  }

  console.log(`${SEATS.length} accounts ready. Existing passwords were NOT reset.`);
  for (const s of SEATS) console.log(`  ${s.ref.padEnd(14)} ${s.email.padEnd(30)} ${s.role}`);
  console.log('\nEveryone changes their password on first sign-in. Three people hold venture_manager');
  console.log('and therefore see the whole register, not only their own venture.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
