import { prisma } from './db';

/**
 * Truncate every sourcing/quality table plus the platform tables these modules write to
 * (outbox, processed-events, audit, notifications). Called between tests. CASCADE handles
 * the FK children (certifications, score events, evidence, inspections, visits, capas).
 */
export async function resetSourcingQualityDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE ' +
      '"InspectionEvidence","Capa","Inspection","Visit","PurchaseOrder",' +
      '"SupplierQuote","Rfq","SupplierQualityRecord","SupplierPricePoint",' +
      '"SupplierScoreEvent","SupplierCertification","Supplier",' +
      '"OutboxEvent","ProcessedEvent","AuditLog","Notification" ' +
      'RESTART IDENTITY CASCADE',
  );
}
