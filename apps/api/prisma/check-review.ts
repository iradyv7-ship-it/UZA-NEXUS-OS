/**
 * Prints the Monday review against whatever is currently in the database.
 *
 * Not a test — a way to look at the register the way the CEO will, without a running API
 * or a token. Services are instantiated directly, which is also how the module's unit
 * tests construct them.
 *
 *   pnpm --filter @uza/api exec tsx prisma/check-review.ts
 */
import { PrismaClient } from '@prisma/client';
import type { Actor } from '@uza/contracts';
import { PlanningAccessService } from '../src/planning/planning-authz.service';
import { ReviewService } from '../src/planning/review/review.service';
import { DecisionService } from '../src/planning/decision/decision.service';

const prisma = new PrismaClient();

/** The audit log needs an office and a user to point at; this script only reads. */
const audit = {
  deny: async () => ({ id: 'noop' }),
  allow: async () => ({ id: 'noop' }),
} as any;

const CEO: Actor = { userId: 'CEO-KGL-0001', role: 'ceo', office: 'KGL', scope: {} };

async function main() {
  const access = new PlanningAccessService(audit);
  const review = new ReviewService(prisma as any, access);
  const decisions = new DecisionService(prisma as any, access);

  console.log(await review.brief(CEO));
  console.log('\n---\n');
  const b = await decisions.bottleneck(CEO);
  console.log(
    `bottleneck: ${b.openCount} open, oldest ${b.oldestDays} days, mean ${b.meanAgeDays} days, ${b.deferredNowDue} deferrals now due`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
