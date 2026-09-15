-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('issued', 'part_paid', 'paid', 'void');

-- CreateEnum
CREATE TYPE "FinanceInstallmentStatus" AS ENUM ('due', 'settled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending_verification', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "CommissionEntryType" AS ENUM ('accrual', 'clawback', 'payout');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('raised', 'submitted', 'recovered', 'written_off');

-- CreateEnum
CREATE TYPE "PettyCashKind" AS ENUM ('float', 'expense', 'replenishment');

-- CreateEnum
CREATE TYPE "BankChangeStatus" AS ENUM ('pending_dual_approval', 'applied', 'rejected');

-- CreateTable
CREATE TABLE "Invoice" (
    "ref" TEXT NOT NULL,
    "orderRef" TEXT NOT NULL,
    "customerRef" TEXT NOT NULL,
    "agentId" TEXT,
    "totalMinor" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'issued',
    "commissionAccrued" BOOLEAN NOT NULL DEFAULT false,
    "commissionClawedBack" BOOLEAN NOT NULL DEFAULT false,
    "sourceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "InvoiceInstallment" (
    "ref" TEXT NOT NULL,
    "invoiceRef" TEXT NOT NULL,
    "orderRef" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "pct" DOUBLE PRECISION NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" "FinanceInstallmentStatus" NOT NULL DEFAULT 'due',
    "settledByPaymentRef" TEXT,
    "settledEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceInstallment_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "Payment" (
    "ref" TEXT NOT NULL,
    "invoiceRef" TEXT NOT NULL,
    "orderRef" TEXT NOT NULL,
    "customerRef" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "proofRef" TEXT NOT NULL,
    "targetTrigger" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending_verification',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "settledInstallmentRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "CommissionEntry" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "orderRef" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "type" "CommissionEntryType" NOT NULL,
    "reason" TEXT,
    "sourceEventId" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForwarderClaim" (
    "ref" TEXT NOT NULL,
    "shipmentRef" TEXT NOT NULL,
    "measuredRevenueTon" DOUBLE PRECISION NOT NULL,
    "billedRevenueTon" DOUBLE PRECISION NOT NULL,
    "overRevenueTon" DOUBLE PRECISION NOT NULL,
    "freightPaidMinor" INTEGER,
    "status" "ClaimStatus" NOT NULL DEFAULT 'raised',
    "sourceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForwarderClaim_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "PettyCashTransaction" (
    "ref" TEXT NOT NULL,
    "office" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "kind" "PettyCashKind" NOT NULL,
    "memo" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PettyCashTransaction_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "SupplierBankAccount" (
    "supplierRef" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "appliedByRequest" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierBankAccount_pkey" PRIMARY KEY ("supplierRef")
);

-- CreateTable
CREATE TABLE "SupplierBankChangeRequest" (
    "ref" TEXT NOT NULL,
    "supplierRef" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" "BankChangeStatus" NOT NULL DEFAULT 'pending_dual_approval',
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierBankChangeRequest_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "SupplierBankChangeApproval" (
    "id" TEXT NOT NULL,
    "requestRef" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierBankChangeApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderRef_key" ON "Invoice"("orderRef");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_sourceEventId_key" ON "Invoice"("sourceEventId");

-- CreateIndex
CREATE INDEX "Invoice_customerRef_idx" ON "Invoice"("customerRef");

-- CreateIndex
CREATE INDEX "Invoice_orderRef_idx" ON "Invoice"("orderRef");

-- CreateIndex
CREATE INDEX "InvoiceInstallment_invoiceRef_idx" ON "InvoiceInstallment"("invoiceRef");

-- CreateIndex
CREATE INDEX "InvoiceInstallment_orderRef_idx" ON "InvoiceInstallment"("orderRef");

-- CreateIndex
CREATE INDEX "Payment_invoiceRef_idx" ON "Payment"("invoiceRef");

-- CreateIndex
CREATE INDEX "Payment_orderRef_idx" ON "Payment"("orderRef");

-- CreateIndex
CREATE INDEX "Payment_customerRef_idx" ON "Payment"("customerRef");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEntry_dedupeKey_key" ON "CommissionEntry"("dedupeKey");

-- CreateIndex
CREATE INDEX "CommissionEntry_agentId_idx" ON "CommissionEntry"("agentId");

-- CreateIndex
CREATE INDEX "CommissionEntry_orderRef_idx" ON "CommissionEntry"("orderRef");

-- CreateIndex
CREATE UNIQUE INDEX "ForwarderClaim_sourceEventId_key" ON "ForwarderClaim"("sourceEventId");

-- CreateIndex
CREATE INDEX "ForwarderClaim_shipmentRef_idx" ON "ForwarderClaim"("shipmentRef");

-- CreateIndex
CREATE INDEX "PettyCashTransaction_office_idx" ON "PettyCashTransaction"("office");

-- CreateIndex
CREATE INDEX "SupplierBankChangeRequest_supplierRef_idx" ON "SupplierBankChangeRequest"("supplierRef");

-- CreateIndex
CREATE INDEX "SupplierBankChangeApproval_requestRef_idx" ON "SupplierBankChangeApproval"("requestRef");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierBankChangeApproval_requestRef_approverId_key" ON "SupplierBankChangeApproval"("requestRef", "approverId");

-- AddForeignKey
ALTER TABLE "InvoiceInstallment" ADD CONSTRAINT "InvoiceInstallment_invoiceRef_fkey" FOREIGN KEY ("invoiceRef") REFERENCES "Invoice"("ref") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBankChangeApproval" ADD CONSTRAINT "SupplierBankChangeApproval_requestRef_fkey" FOREIGN KEY ("requestRef") REFERENCES "SupplierBankChangeRequest"("ref") ON DELETE CASCADE ON UPDATE CASCADE;
