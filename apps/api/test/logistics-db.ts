import { prisma } from './db';

/**
 * Truncate every logistics-warehouse table plus the platform tables logistics writes to
 * (outbox, processed-events, audit, notifications). Called between logistics tests.
 * CASCADE handles the WarehouseReceipt→Package and Shipment→FreightAllocation FKs.
 */
export async function resetLogisticsDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE ' +
      '"FreightAllocation","TrackingEvent","Delivery","Package","Shipment","WarehouseReceipt",' +
      '"OrderPaymentState","InspectionOutcome",' +
      '"OutboxEvent","ProcessedEvent","AuditLog","Notification" ' +
      'RESTART IDENTITY CASCADE',
  );
}
