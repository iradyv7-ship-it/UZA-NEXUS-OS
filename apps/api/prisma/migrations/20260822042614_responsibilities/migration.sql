-- CreateEnum
CREATE TYPE "ResponsibilityKind" AS ENUM ('standing', 'gate', 'approval');

-- CreateEnum
CREATE TYPE "ResponsibilityTrigger" AS ENUM ('per_shipment', 'per_deal', 'per_request', 'daily', 'weekly', 'monthly', 'ad_hoc');

-- CreateTable
CREATE TABLE "Responsibility" (
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ventureCode" TEXT,
    "ownerId" TEXT NOT NULL,
    "backupId" TEXT,
    "kind" "ResponsibilityKind" NOT NULL,
    "trigger" "ResponsibilityTrigger" NOT NULL DEFAULT 'ad_hoc',
    "responseHours" INTEGER,
    "notes" TEXT,
    "startsOn" TIMESTAMP(3),
    "endsOn" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Responsibility_pkey" PRIMARY KEY ("ref")
);

-- CreateIndex
CREATE INDEX "Responsibility_ownerId_idx" ON "Responsibility"("ownerId");

-- CreateIndex
CREATE INDEX "Responsibility_backupId_idx" ON "Responsibility"("backupId");

-- CreateIndex
CREATE INDEX "Responsibility_ventureCode_active_idx" ON "Responsibility"("ventureCode", "active");

-- CreateIndex
CREATE INDEX "Responsibility_kind_idx" ON "Responsibility"("kind");
