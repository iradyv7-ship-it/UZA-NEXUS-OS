-- 2026-09-14 gap-closure audit (logistics-warehouse): vessel/voyage/entry-port tracking,
-- planned-vs-actual etd/eta, LOOSE-cargo sellable line, Consignee, venture tagging on
-- Shipment, and the append-only PartnerRateCard log. Hand-written (no live DB in this
-- sandbox to run `prisma migrate dev`), mirroring this repo's existing migration style.

-- CreateEnum
CREATE TYPE "EntryPort" AS ENUM ('MOMBASA', 'DAR_ES_SALAAM');

-- CreateEnum
CREATE TYPE "CargoType" AS ENUM ('CONSOLIDATED', 'LOOSE');

-- AlterTable: Package — LOOSE-cargo sellable line + per-package consignee
ALTER TABLE "Package"
  ADD COLUMN "cargoType" "CargoType" NOT NULL DEFAULT 'CONSOLIDATED',
  ADD COLUMN "pricePerCbmMinor" INTEGER,
  ADD COLUMN "photoUrl" TEXT,
  ADD COLUMN "goodsDescription" TEXT,
  ADD COLUMN "consigneeRef" TEXT;

CREATE INDEX "Package_consigneeRef_idx" ON "Package"("consigneeRef");

-- AlterTable: Shipment — split etd/eta into planned-vs-actual pairs, never overwriting one
-- with the other (same discipline as declared/measured/billed CBM). Backfill the existing
-- single etd/eta into the PLANNED columns (the only value that ever existed), then drop the
-- old columns.
ALTER TABLE "Shipment"
  ADD COLUMN "etdPlanned" TEXT,
  ADD COLUMN "etaPlanned" TEXT,
  ADD COLUMN "etdActual" TEXT,
  ADD COLUMN "etaActual" TEXT,
  ADD COLUMN "vesselName" TEXT,
  ADD COLUMN "voyageNumber" TEXT,
  ADD COLUMN "entryPort" "EntryPort",
  ADD COLUMN "ventureCode" TEXT,
  ADD COLUMN "consigneeRef" TEXT;

UPDATE "Shipment" SET "etdPlanned" = "etd", "etaPlanned" = "eta";

ALTER TABLE "Shipment"
  ALTER COLUMN "etdPlanned" SET NOT NULL,
  ALTER COLUMN "etaPlanned" SET NOT NULL;

ALTER TABLE "Shipment" DROP COLUMN "etd";
ALTER TABLE "Shipment" DROP COLUMN "eta";

CREATE INDEX "Shipment_ventureCode_idx" ON "Shipment"("ventureCode");
CREATE INDEX "Shipment_consigneeRef_idx" ON "Shipment"("consigneeRef");

-- CreateTable: Consignee — the receiving party, distinct from the ordering Customer.
CREATE TABLE "Consignee" (
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "tinNumber" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consignee_pkey" PRIMARY KEY ("ref")
);

-- CreateTable: PartnerRateCard — append-only weekly freight-partner rate log.
CREATE TABLE "PartnerRateCard" (
    "ref" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "destination" "Destination" NOT NULL,
    "entryPort" "EntryPort",
    "ratePerRevenueTonMinor" INTEGER NOT NULL,
    "note" TEXT,
    "recordedBy" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerRateCard_pkey" PRIMARY KEY ("ref")
);

CREATE INDEX "PartnerRateCard_partnerId_idx" ON "PartnerRateCard"("partnerId");
CREATE INDEX "PartnerRateCard_partnerId_destination_idx" ON "PartnerRateCard"("partnerId", "destination");
