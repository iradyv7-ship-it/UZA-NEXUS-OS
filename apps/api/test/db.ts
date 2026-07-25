import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/** Truncate every platform table. Called between tests that touch the database. */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "AuditLog","OutboxEvent","ProcessedEvent","Notification","RoleAssignment","User","Office","Organisation" RESTART IDENTITY CASCADE',
  );
}
