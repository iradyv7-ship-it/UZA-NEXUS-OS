import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/**
 * Refuse to truncate anything that is not obviously a test database.
 *
 * This is the guard that should have existed from the first day. `resetDb()` empties User,
 * Office and Organisation with CASCADE, which also takes EmployeeProfile and Department with
 * them. Pointed at a development database it logs the whole team out; pointed at a production
 * one it would be unrecoverable. A name check costs nothing and removes the entire class.
 */
function assertTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? '';
  const name = url.split('/').pop()?.split('?')[0] ?? '';
  if (!/test/i.test(name)) {
    throw new Error(
      `resetDb() refused to run: DATABASE_URL points at "${name}", which is not a test ` +
        `database. Set TEST_DATABASE_URL, or name the database with a _test suffix. ` +
        `This guard exists because the suite silently emptied the dev database twice.`,
    );
  }
}

/** Truncate every platform table. Called between tests that touch the database. */
export async function resetDb(): Promise<void> {
  assertTestDatabase();
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "AuditLog","OutboxEvent","ProcessedEvent","Notification","RoleAssignment","User","Office","Organisation" RESTART IDENTITY CASCADE',
  );
}
