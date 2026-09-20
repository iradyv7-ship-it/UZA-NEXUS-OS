import { PrismaClient } from '@prisma/client';

/**
 * One-off, idempotent: undo the CEO-KGL-0002 workaround from add-google-ceo-alias.ts.
 *
 * That script pre-dates the `alternateEmails` field and worked around its absence by
 * creating a SECOND User row for the founder's personal Gmail. The field it needed now
 * exists — `alternateEmails` is built for exactly "a company domain and a personal Gmail
 * both routing to one person" (see the schema's own comment) — so the correct fix is to
 * fold the Gmail identity onto CEO-KGL-0001 as an alternate email, not carry two rows.
 *
 * Why CEO-KGL-0002's email is RENAMED, not merely disabled: `loginWithGoogle` runs
 * `findFirst` across `{ email, alternateEmails }` with no ORDER BY, so if the literal
 * string "iradyv7@gmail.com" still matched CEO-KGL-0002's `email` column, which row wins
 * would be nondeterministic even after CEO-KGL-0002 is disabled. Renaming its email
 * removes the ambiguity outright, rather than depending on a disabledAt check running in
 * the right order.
 *
 * Everything real CEO-KGL-0002 ever owned (initiatives, decisions, tasks — check the
 * register before running this in a context where that might not be true) stays exactly
 * where it is; this script only changes how sign-in resolves an email to a user, never
 * ownership of anything already recorded.
 */
async function main() {
  const prisma = new PrismaClient();

  const real = await prisma.user.findUnique({ where: { ref: 'CEO-KGL-0001' } });
  if (!real) throw new Error('CEO-KGL-0001 not found — check DATABASE_URL points at the right database');

  const alias = await prisma.user.findUnique({ where: { ref: 'CEO-KGL-0002' } });
  if (!alias) {
    console.log('CEO-KGL-0002 does not exist — nothing to fix, already correct or never created here.');
    return;
  }

  if (alias.disabledAt && !alias.email.startsWith('disabled+')) {
    console.log('CEO-KGL-0002 is already disabled but its email was not renamed — completing that step.');
  }

  const gmailLower = alias.email.trim().toLowerCase();
  const alreadyLinked = real.alternateEmails.map((e) => e.toLowerCase()).includes(gmailLower);

  await prisma.$transaction([
    // Clear the alias row's unique fields FIRST, in the same transaction, so the update to
    // CEO-KGL-0001 below can never collide with them even under concurrent access.
    prisma.user.update({
      where: { ref: 'CEO-KGL-0002' },
      data: {
        email: `disabled+ceo-kgl-0002@uzasolutions.internal`,
        googleSub: null,
        alternateEmails: [],
        disabledAt: alias.disabledAt ?? new Date(),
      },
    }),
    prisma.user.update({
      where: { ref: 'CEO-KGL-0001' },
      data: {
        alternateEmails: alreadyLinked ? real.alternateEmails : [...real.alternateEmails, gmailLower],
        // Only adopt the alias's googleSub if the real account has none yet — never overwrite
        // a googleSub CEO-KGL-0001 may already have recorded from its own prior Google login.
        ...(real.googleSub ? {} : { googleSub: alias.googleSub }),
      },
    }),
  ]);

  console.log(`fixed    ${gmailLower} now signs in as CEO-KGL-0001 (was CEO-KGL-0002)`);
  console.log(`disabled CEO-KGL-0002, email renamed off ${gmailLower} to remove any ambiguity`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
