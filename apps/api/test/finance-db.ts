import { prisma } from './db';

/**
 * Truncate every finance-commission table plus the platform tables finance writes to
 * (outbox, processed-events, audit, notifications). Called between finance tests. CASCADE
 * handles the Invoice→InvoiceInstallment and request→approval FKs.
 */
export async function resetFinanceDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE ' +
      '"InvoiceInstallment","Invoice","Payment","CommissionEntry","ForwarderClaim",' +
      '"PettyCashTransaction","SupplierBankChangeApproval","SupplierBankChangeRequest","SupplierBankAccount",' +
      '"OutboxEvent","ProcessedEvent","AuditLog","Notification" ' +
      'RESTART IDENTITY CASCADE',
  );
}
