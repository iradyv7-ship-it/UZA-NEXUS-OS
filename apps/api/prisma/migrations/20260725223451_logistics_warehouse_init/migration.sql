-- CreateEnum
CREATE TYPE "WarehouseZone" AS ENUM ('AWAITING_INSPECTION', 'READY_FOR_LOADING', 'QUARANTINE', 'AWAITING_CORRECTION', 'FRAGILE');

-- CreateEnum
CREATE TYPE "Destination" AS ENUM ('KIGALI', 'GOMA', 'BUKAVU', 'UZA_STOCK', 'OTHER');

-- CreateEnum
CREATE TYPE "TrackingSource" AS ENUM ('carrier', 'partner', 'uza', 'estimated');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('planned', 'in_transit', 'delayed', 'arrived', 'delivered');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('planned', 'in_progress', 'delivered', 'failed');

-- CreateTable
CREATE TABLE "WarehouseReceipt" (
    "ref" TEXT NOT NULL,
    "orderRef" TEXT NOT NULL,
    "poRef" TEXT NOT NULL,
    "customerRef" TEXT NOT NULL,
    "lotRef" TEXT NOT NULL,
    "declaredCbm" DOUBLE PRECISION NOT NULL,
    "declaredKg" DOUBLE PRECISION NOT NULL,
    "measuredCbm" DOUBLE PRECISION NOT NULL,
    "measuredKg" DOUBLE PRECISION NOT NULL,
    "measuredRevenueTon" DOUBLE PRECISION NOT NULL,
    "variance" DOUBLE PRECISION NOT NULL,
    "discrepancy" BOOLEAN NOT NULL,
    "hardStop" BOOLEAN NOT NULL,
    "decision" TEXT,
    "decidedBy" TEXT,
    "decidedNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseReceipt_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "Package" (
    "ref" TEXT NOT NULL,
    "orderRef" TEXT NOT NULL,
    "customerRef" TEXT NOT NULL,
    "poRef" TEXT NOT NULL,
    "lotRef" TEXT NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "cbm" DOUBLE PRECISION NOT NULL,
    "destination" "Destination",
    "zone" "WarehouseZone" NOT NULL DEFAULT 'AWAITING_INSPECTION',
    "qcReleased" BOOLEAN NOT NULL DEFAULT false,
    "varianceHold" BOOLEAN NOT NULL DEFAULT false,
    "shipmentRef" TEXT,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "ref" TEXT NOT NULL,
    "container" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "destination" "Destination" NOT NULL,
    "etd" TEXT NOT NULL,
    "eta" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'planned',
    "partnerId" TEXT,
    "billedRevenueTon" DOUBLE PRECISION,
    "measuredRevenueTon" DOUBLE PRECISION,
    "freightPaidMinor" INTEGER,
    "daysWaitingForConsolidation" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "FreightAllocation" (
    "id" TEXT NOT NULL,
    "shipmentRef" TEXT NOT NULL,
    "orderRef" TEXT NOT NULL,
    "revenueTon" DOUBLE PRECISION NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreightAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "ref" TEXT NOT NULL,
    "shipmentRef" TEXT NOT NULL,
    "milestone" TEXT NOT NULL,
    "source" "TrackingSource" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "ref" TEXT NOT NULL,
    "shipmentRef" TEXT NOT NULL,
    "orderRef" TEXT NOT NULL,
    "customerRef" TEXT NOT NULL,
    "packageRefs" TEXT[],
    "podRef" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'delivered',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "OrderPaymentState" (
    "orderRef" TEXT NOT NULL,
    "paidFraction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidTriggers" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderPaymentState_pkey" PRIMARY KEY ("orderRef")
);

-- CreateTable
CREATE TABLE "InspectionOutcome" (
    "poRef" TEXT NOT NULL,
    "lastResult" TEXT NOT NULL,
    "releaseBlocked" BOOLEAN NOT NULL DEFAULT false,
    "critical" INTEGER NOT NULL DEFAULT 0,
    "major" INTEGER NOT NULL DEFAULT 0,
    "minor" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionOutcome_pkey" PRIMARY KEY ("poRef")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseReceipt_lotRef_key" ON "WarehouseReceipt"("lotRef");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseReceipt_clientRequestId_key" ON "WarehouseReceipt"("clientRequestId");

-- CreateIndex
CREATE INDEX "WarehouseReceipt_orderRef_idx" ON "WarehouseReceipt"("orderRef");

-- CreateIndex
CREATE INDEX "WarehouseReceipt_poRef_idx" ON "WarehouseReceipt"("poRef");

-- CreateIndex
CREATE INDEX "Package_orderRef_idx" ON "Package"("orderRef");

-- CreateIndex
CREATE INDEX "Package_lotRef_idx" ON "Package"("lotRef");

-- CreateIndex
CREATE INDEX "Package_shipmentRef_idx" ON "Package"("shipmentRef");

-- CreateIndex
CREATE INDEX "Shipment_partnerId_idx" ON "Shipment"("partnerId");

-- CreateIndex
CREATE INDEX "FreightAllocation_shipmentRef_idx" ON "FreightAllocation"("shipmentRef");

-- CreateIndex
CREATE UNIQUE INDEX "FreightAllocation_shipmentRef_orderRef_key" ON "FreightAllocation"("shipmentRef", "orderRef");

-- CreateIndex
CREATE INDEX "TrackingEvent_shipmentRef_idx" ON "TrackingEvent"("shipmentRef");

-- CreateIndex
CREATE INDEX "Delivery_shipmentRef_idx" ON "Delivery"("shipmentRef");

-- CreateIndex
CREATE INDEX "Delivery_orderRef_idx" ON "Delivery"("orderRef");

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_lotRef_fkey" FOREIGN KEY ("lotRef") REFERENCES "WarehouseReceipt"("lotRef") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightAllocation" ADD CONSTRAINT "FreightAllocation_shipmentRef_fkey" FOREIGN KEY ("shipmentRef") REFERENCES "Shipment"("ref") ON DELETE CASCADE ON UPDATE CASCADE;
