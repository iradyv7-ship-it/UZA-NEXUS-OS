-- AlterTable: propagate cost basis from SupplierQuote onto PurchaseOrder (never trusted
-- from the caller when a quote exists), plus who books the origin->port/vessel leg.
ALTER TABLE "PurchaseOrder" ADD COLUMN     "basis" "QuoteBasis" NOT NULL DEFAULT 'EXW';
ALTER TABLE "PurchaseOrder" ADD COLUMN     "inlandSeparable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PurchaseOrder" ADD COLUMN     "originForwarderRef" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN     "originForwarderName" TEXT;

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('submitted', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "OfferAttachmentKind" AS ENUM ('image', 'inspection_report', 'battery_health_certificate');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('reserved', 'inspected', 'inspection_failed', 'balance_due', 'paid', 'cancelled');

-- CreateTable
CREATE TABLE "SupplierOffer" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "supplierRef" TEXT NOT NULL,
    "projectRef" TEXT,
    "unitCostMinor" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "moq" INTEGER NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "unitCbm" DOUBLE PRECISION NOT NULL,
    "unitKg" DOUBLE PRECISION NOT NULL,
    "basis" "QuoteBasis" NOT NULL DEFAULT 'EXW',
    "inlandSeparable" BOOLEAN NOT NULL DEFAULT true,
    "channel" TEXT NOT NULL DEFAULT 'staff_relay',
    "relayedBy" TEXT NOT NULL,
    "supplierContact" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'submitted',
    "decidedBy" TEXT,
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierOfferAttachment" (
    "id" TEXT NOT NULL,
    "offerRef" TEXT NOT NULL,
    "kind" "OfferAttachmentKind" NOT NULL,
    "uri" TEXT NOT NULL,
    "note" TEXT,
    "clientRequestId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierOfferAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierDeal" (
    "ref" TEXT NOT NULL,
    "offerRef" TEXT NOT NULL,
    "supplierRef" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitCostMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "bookingFeeMinor" INTEGER NOT NULL,
    "bookingFeePaidAt" TIMESTAMP(3),
    "bookingFeeConfirmedBy" TEXT,
    "balanceMinor" INTEGER NOT NULL,
    "balancePaidAt" TIMESTAMP(3),
    "balanceConfirmedBy" TEXT,
    "status" "DealStatus" NOT NULL DEFAULT 'reserved',
    "inspectionRef" TEXT,
    "inspectionResult" "InspectionResult",
    "basis" "QuoteBasis" NOT NULL,
    "inlandSeparable" BOOLEAN NOT NULL,
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierDeal_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "SupplierDealEvent" (
    "id" TEXT NOT NULL,
    "dealRef" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" JSONB,
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierDealEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierOffer_ref_key" ON "SupplierOffer"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierOffer_clientRequestId_key" ON "SupplierOffer"("clientRequestId");

-- CreateIndex
CREATE INDEX "SupplierOffer_supplierRef_idx" ON "SupplierOffer"("supplierRef");

-- CreateIndex
CREATE INDEX "SupplierOffer_status_idx" ON "SupplierOffer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierOfferAttachment_clientRequestId_key" ON "SupplierOfferAttachment"("clientRequestId");

-- CreateIndex
CREATE INDEX "SupplierOfferAttachment_offerRef_idx" ON "SupplierOfferAttachment"("offerRef");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierDeal_clientRequestId_key" ON "SupplierDeal"("clientRequestId");

-- CreateIndex
CREATE INDEX "SupplierDeal_supplierRef_idx" ON "SupplierDeal"("supplierRef");

-- CreateIndex
CREATE INDEX "SupplierDeal_offerRef_idx" ON "SupplierDeal"("offerRef");

-- CreateIndex
CREATE INDEX "SupplierDeal_status_idx" ON "SupplierDeal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierDealEvent_clientRequestId_key" ON "SupplierDealEvent"("clientRequestId");

-- CreateIndex
CREATE INDEX "SupplierDealEvent_dealRef_idx" ON "SupplierDealEvent"("dealRef");

-- AddForeignKey
ALTER TABLE "SupplierOffer" ADD CONSTRAINT "SupplierOffer_supplierRef_fkey" FOREIGN KEY ("supplierRef") REFERENCES "Supplier"("ref") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOfferAttachment" ADD CONSTRAINT "SupplierOfferAttachment_offerRef_fkey" FOREIGN KEY ("offerRef") REFERENCES "SupplierOffer"("ref") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierDeal" ADD CONSTRAINT "SupplierDeal_offerRef_fkey" FOREIGN KEY ("offerRef") REFERENCES "SupplierOffer"("ref") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierDealEvent" ADD CONSTRAINT "SupplierDealEvent_dealRef_fkey" FOREIGN KEY ("dealRef") REFERENCES "SupplierDeal"("ref") ON DELETE CASCADE ON UPDATE CASCADE;
