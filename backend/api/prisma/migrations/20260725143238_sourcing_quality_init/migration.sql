-- CreateEnum
CREATE TYPE "SupplierLifecycle" AS ENUM ('Discovered', 'Contacted', 'PreScreened', 'SampleRequested', 'SampleApproved', 'TrialOrder', 'Verified', 'Preferred', 'StrategicPartner', 'Suspended', 'Blocked');

-- CreateEnum
CREATE TYPE "QuoteBasis" AS ENUM ('EXW', 'FOB');

-- CreateEnum
CREATE TYPE "PoStatus" AS ENUM ('issued', 'in_production', 'ready', 'shipped', 'cancelled');

-- CreateEnum
CREATE TYPE "InspectionStage" AS ENUM ('pre_production', 'during_production', 'pre_shipment', 'warehouse');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('pass', 'conditional', 'fail');

-- CreateEnum
CREATE TYPE "CapaStatus" AS ENUM ('open', 'evidence_submitted', 'closed');

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'CN',
    "lifecycle" "SupplierLifecycle" NOT NULL DEFAULT 'Discovered',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "relationshipOwnerId" TEXT,
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCertification" (
    "id" TEXT NOT NULL,
    "supplierRef" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "number" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierScoreEvent" (
    "id" TEXT NOT NULL,
    "supplierRef" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "previousScore" DOUBLE PRECISION NOT NULL,
    "newScore" DOUBLE PRECISION NOT NULL,
    "cause" TEXT NOT NULL,
    "causeRef" TEXT,
    "detail" JSONB,
    "sourceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierScoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPricePoint" (
    "id" TEXT NOT NULL,
    "supplierRef" TEXT NOT NULL,
    "quoteRef" TEXT,
    "unitCostMinor" INTEGER NOT NULL,
    "basis" "QuoteBasis" NOT NULL,
    "inlandSeparable" BOOLEAN NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPricePoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQualityRecord" (
    "id" TEXT NOT NULL,
    "supplierRef" TEXT NOT NULL,
    "inspectionRef" TEXT NOT NULL,
    "poRef" TEXT NOT NULL,
    "stage" "InspectionStage" NOT NULL,
    "result" "InspectionResult" NOT NULL,
    "critical" INTEGER NOT NULL,
    "major" INTEGER NOT NULL,
    "minor" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierQualityRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rfq" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "projectRef" TEXT NOT NULL,
    "detail" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rfq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuote" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "supplierRef" TEXT NOT NULL,
    "projectRef" TEXT NOT NULL,
    "rfqRef" TEXT,
    "unitCostMinor" INTEGER NOT NULL,
    "moq" INTEGER NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "unitCbm" DOUBLE PRECISION NOT NULL,
    "unitKg" DOUBLE PRECISION NOT NULL,
    "basis" "QuoteBasis" NOT NULL DEFAULT 'EXW',
    "inlandSeparable" BOOLEAN NOT NULL DEFAULT true,
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "ref" TEXT NOT NULL,
    "supplierRef" TEXT NOT NULL,
    "orderRef" TEXT NOT NULL,
    "quoteRef" TEXT,
    "qty" INTEGER NOT NULL,
    "unitCostMinor" INTEGER NOT NULL,
    "poTotalMinor" INTEGER NOT NULL,
    "declaredCbm" DOUBLE PRECISION NOT NULL,
    "declaredKg" DOUBLE PRECISION NOT NULL,
    "status" "PoStatus" NOT NULL DEFAULT 'issued',
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "poRef" TEXT NOT NULL,
    "assignedTo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "ref" TEXT NOT NULL,
    "visitRef" TEXT NOT NULL,
    "poRef" TEXT NOT NULL,
    "supplierRef" TEXT NOT NULL,
    "stage" "InspectionStage" NOT NULL DEFAULT 'pre_shipment',
    "critical" INTEGER NOT NULL DEFAULT 0,
    "major" INTEGER NOT NULL DEFAULT 0,
    "minor" INTEGER NOT NULL DEFAULT 0,
    "result" "InspectionResult" NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "capturedOffline" BOOLEAN NOT NULL DEFAULT false,
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "InspectionEvidence" (
    "id" TEXT NOT NULL,
    "inspectionRef" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "lotRef" TEXT,
    "packageRef" TEXT,
    "note" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Capa" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "inspectionRef" TEXT NOT NULL,
    "supplierRef" TEXT NOT NULL,
    "poRef" TEXT NOT NULL,
    "status" "CapaStatus" NOT NULL DEFAULT 'open',
    "correctiveAction" TEXT,
    "draftedBy" TEXT,
    "closedByReinspectionRef" TEXT,
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Capa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_ref_key" ON "Supplier"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_clientRequestId_key" ON "Supplier"("clientRequestId");

-- CreateIndex
CREATE INDEX "Supplier_lifecycle_idx" ON "Supplier"("lifecycle");

-- CreateIndex
CREATE INDEX "SupplierCertification_supplierRef_idx" ON "SupplierCertification"("supplierRef");

-- CreateIndex
CREATE INDEX "SupplierScoreEvent_supplierRef_idx" ON "SupplierScoreEvent"("supplierRef");

-- CreateIndex
CREATE INDEX "SupplierScoreEvent_cause_idx" ON "SupplierScoreEvent"("cause");

-- CreateIndex
CREATE INDEX "SupplierPricePoint_supplierRef_idx" ON "SupplierPricePoint"("supplierRef");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQualityRecord_inspectionRef_key" ON "SupplierQualityRecord"("inspectionRef");

-- CreateIndex
CREATE INDEX "SupplierQualityRecord_supplierRef_idx" ON "SupplierQualityRecord"("supplierRef");

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_ref_key" ON "Rfq"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_clientRequestId_key" ON "Rfq"("clientRequestId");

-- CreateIndex
CREATE INDEX "Rfq_projectRef_idx" ON "Rfq"("projectRef");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQuote_ref_key" ON "SupplierQuote"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQuote_clientRequestId_key" ON "SupplierQuote"("clientRequestId");

-- CreateIndex
CREATE INDEX "SupplierQuote_supplierRef_idx" ON "SupplierQuote"("supplierRef");

-- CreateIndex
CREATE INDEX "SupplierQuote_projectRef_idx" ON "SupplierQuote"("projectRef");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_clientRequestId_key" ON "PurchaseOrder"("clientRequestId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierRef_idx" ON "PurchaseOrder"("supplierRef");

-- CreateIndex
CREATE INDEX "PurchaseOrder_orderRef_idx" ON "PurchaseOrder"("orderRef");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_ref_key" ON "Visit"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_clientRequestId_key" ON "Visit"("clientRequestId");

-- CreateIndex
CREATE INDEX "Visit_poRef_idx" ON "Visit"("poRef");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_clientRequestId_key" ON "Inspection"("clientRequestId");

-- CreateIndex
CREATE INDEX "Inspection_poRef_idx" ON "Inspection"("poRef");

-- CreateIndex
CREATE INDEX "Inspection_supplierRef_idx" ON "Inspection"("supplierRef");

-- CreateIndex
CREATE INDEX "InspectionEvidence_inspectionRef_idx" ON "InspectionEvidence"("inspectionRef");

-- CreateIndex
CREATE INDEX "InspectionEvidence_lotRef_idx" ON "InspectionEvidence"("lotRef");

-- CreateIndex
CREATE INDEX "InspectionEvidence_packageRef_idx" ON "InspectionEvidence"("packageRef");

-- CreateIndex
CREATE UNIQUE INDEX "Capa_ref_key" ON "Capa"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Capa_clientRequestId_key" ON "Capa"("clientRequestId");

-- CreateIndex
CREATE INDEX "Capa_supplierRef_idx" ON "Capa"("supplierRef");

-- CreateIndex
CREATE INDEX "Capa_inspectionRef_idx" ON "Capa"("inspectionRef");

-- AddForeignKey
ALTER TABLE "SupplierCertification" ADD CONSTRAINT "SupplierCertification_supplierRef_fkey" FOREIGN KEY ("supplierRef") REFERENCES "Supplier"("ref") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierScoreEvent" ADD CONSTRAINT "SupplierScoreEvent_supplierRef_fkey" FOREIGN KEY ("supplierRef") REFERENCES "Supplier"("ref") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPricePoint" ADD CONSTRAINT "SupplierPricePoint_supplierRef_fkey" FOREIGN KEY ("supplierRef") REFERENCES "Supplier"("ref") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQualityRecord" ADD CONSTRAINT "SupplierQualityRecord_supplierRef_fkey" FOREIGN KEY ("supplierRef") REFERENCES "Supplier"("ref") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuote" ADD CONSTRAINT "SupplierQuote_rfqRef_fkey" FOREIGN KEY ("rfqRef") REFERENCES "Rfq"("ref") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_poRef_fkey" FOREIGN KEY ("poRef") REFERENCES "PurchaseOrder"("ref") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_visitRef_fkey" FOREIGN KEY ("visitRef") REFERENCES "Visit"("ref") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_poRef_fkey" FOREIGN KEY ("poRef") REFERENCES "PurchaseOrder"("ref") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionEvidence" ADD CONSTRAINT "InspectionEvidence_inspectionRef_fkey" FOREIGN KEY ("inspectionRef") REFERENCES "Inspection"("ref") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_inspectionRef_fkey" FOREIGN KEY ("inspectionRef") REFERENCES "Inspection"("ref") ON DELETE RESTRICT ON UPDATE CASCADE;
