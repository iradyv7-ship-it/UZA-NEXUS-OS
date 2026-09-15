import { prisma } from './db';

/**
 * Full truncate for the HTTP e2e suite, which drives trade, sourcing, quality, finance and
 * logistics through real controllers in one app. Resets every domain table plus the
 * platform tables (users/offices/orgs, outbox, processed-events, audit, notifications).
 */
export async function resetAllDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE ' +
      // trade
      '"Installment","Order","Quotation","Task","Project","Request","Lead","Customer",' +
      // sourcing / quality
      '"InspectionEvidence","Capa","Inspection","Visit","PurchaseOrder",' +
      '"SupplierQuote","Rfq","SupplierQualityRecord","SupplierPricePoint",' +
      '"SupplierScoreEvent","SupplierCertification","Supplier",' +
      // finance
      '"InvoiceInstallment","Invoice","Payment","CommissionEntry","ForwarderClaim",' +
      '"PettyCashTransaction","SupplierBankChangeApproval","SupplierBankChangeRequest","SupplierBankAccount",' +
      // logistics
      '"FreightAllocation","TrackingEvent","Delivery","Package","Shipment","WarehouseReceipt",' +
      '"OrderPaymentState","InspectionOutcome",' +
      // platform
      '"RoleAssignment","User","Office","Organisation",' +
      '"OutboxEvent","ProcessedEvent","AuditLog","Notification" ' +
      'RESTART IDENTITY CASCADE',
  );
}
