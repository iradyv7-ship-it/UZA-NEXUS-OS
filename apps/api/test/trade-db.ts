import { prisma } from './db';

/**
 * Truncate every trade-flow table plus the platform tables trade writes to (outbox,
 * processed-events, audit). Called between trade tests. CASCADE handles the
 * Order→Installment FK.
 */
export async function resetTradeDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE ' +
      '"Installment","Order","Quotation","Task","Project","Request","Lead","Customer",' +
      '"OutboxEvent","ProcessedEvent","AuditLog" ' +
      'RESTART IDENTITY CASCADE',
  );
}
