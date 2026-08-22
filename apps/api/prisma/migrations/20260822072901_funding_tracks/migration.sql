-- CreateEnum
CREATE TYPE "FundingInstrument" AS ENUM ('grant', 'concessional', 'debt', 'revolver', 'facility', 'equity', 'offtake');

-- CreateEnum
CREATE TYPE "FundingStage" AS ENUM ('identified', 'qualifying', 'preparing', 'submitted', 'in_diligence', 'approved', 'closed', 'declined', 'parked');

-- CreateTable
CREATE TABLE "FundingTrack" (
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instrument" "FundingInstrument" NOT NULL,
    "funder" TEXT NOT NULL,
    "ventureCode" TEXT,
    "amountSought" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "stage" "FundingStage" NOT NULL DEFAULT 'identified',
    "ownerId" TEXT NOT NULL,
    "unlocks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidence" TEXT,
    "blocker" TEXT,
    "decisionBy" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "grantRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingTrack_pkey" PRIMARY KEY ("ref")
);

-- CreateIndex
CREATE INDEX "FundingTrack_stage_idx" ON "FundingTrack"("stage");

-- CreateIndex
CREATE INDEX "FundingTrack_ventureCode_stage_idx" ON "FundingTrack"("ventureCode", "stage");

-- CreateIndex
CREATE INDEX "FundingTrack_ownerId_idx" ON "FundingTrack"("ownerId");
