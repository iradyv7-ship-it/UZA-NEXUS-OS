-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('draft', 'approved', 'superseded');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('awaiting_payment', 'procurement_active', 'in_transit', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('due', 'paid');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "agentId" TEXT,
    "completedOrders" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "customerRef" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'Awareness',
    "clarified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "customerRef" TEXT NOT NULL,
    "leadRef" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "venture" TEXT NOT NULL DEFAULT 'BULK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "customerRef" TEXT NOT NULL,
    "agentId" TEXT,
    "requestRef" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'Qualification',
    "health" TEXT NOT NULL DEFAULT 'green',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "projectRef" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "accountable" TEXT NOT NULL,
    "responsible" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "ref" TEXT NOT NULL,
    "projectRef" TEXT NOT NULL,
    "customerRef" TEXT NOT NULL,
    "agentId" TEXT,
    "qty" INTEGER NOT NULL,
    "sellIncoterm" TEXT NOT NULL,
    "ladder" JSONB NOT NULL,
    "supplierUnitCostMinor" INTEGER NOT NULL,
    "targetPriceMinor" INTEGER NOT NULL,
    "walkawayPriceMinor" INTEGER NOT NULL,
    "customerUnitPriceMinor" INTEGER NOT NULL,
    "marginPct" DOUBLE PRECISION NOT NULL,
    "realizedMargin" DOUBLE PRECISION,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "QuotationStatus" NOT NULL DEFAULT 'draft',
    "supersededByRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "Order" (
    "ref" TEXT NOT NULL,
    "projectRef" TEXT NOT NULL,
    "customerRef" TEXT NOT NULL,
    "agentId" TEXT,
    "quotationRef" TEXT NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'awaiting_payment',
    "commissionAccrued" BOOLEAN NOT NULL DEFAULT false,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "Installment" (
    "ref" TEXT NOT NULL,
    "orderRef" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "pct" DOUBLE PRECISION NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'due',
    "paidEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("ref")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_ref_key" ON "Customer"("ref");

-- CreateIndex
CREATE INDEX "Customer_agentId_idx" ON "Customer"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_ref_key" ON "Lead"("ref");

-- CreateIndex
CREATE INDEX "Lead_customerRef_idx" ON "Lead"("customerRef");

-- CreateIndex
CREATE UNIQUE INDEX "Request_ref_key" ON "Request"("ref");

-- CreateIndex
CREATE INDEX "Request_customerRef_idx" ON "Request"("customerRef");

-- CreateIndex
CREATE INDEX "Request_leadRef_idx" ON "Request"("leadRef");

-- CreateIndex
CREATE UNIQUE INDEX "Project_ref_key" ON "Project"("ref");

-- CreateIndex
CREATE INDEX "Project_customerRef_idx" ON "Project"("customerRef");

-- CreateIndex
CREATE INDEX "Project_requestRef_idx" ON "Project"("requestRef");

-- CreateIndex
CREATE UNIQUE INDEX "Task_ref_key" ON "Task"("ref");

-- CreateIndex
CREATE INDEX "Task_projectRef_idx" ON "Task"("projectRef");

-- CreateIndex
CREATE INDEX "Quotation_projectRef_idx" ON "Quotation"("projectRef");

-- CreateIndex
CREATE INDEX "Quotation_customerRef_idx" ON "Quotation"("customerRef");

-- CreateIndex
CREATE INDEX "Order_customerRef_idx" ON "Order"("customerRef");

-- CreateIndex
CREATE INDEX "Order_quotationRef_idx" ON "Order"("quotationRef");

-- CreateIndex
CREATE INDEX "Installment_orderRef_idx" ON "Installment"("orderRef");

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_orderRef_fkey" FOREIGN KEY ("orderRef") REFERENCES "Order"("ref") ON DELETE CASCADE ON UPDATE CASCADE;
