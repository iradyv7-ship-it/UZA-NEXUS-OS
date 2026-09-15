-- CreateEnum
CREATE TYPE "InitiativeKind" AS ENUM ('internal', 'client');

-- CreateEnum
CREATE TYPE "InitiativeStatus" AS ENUM ('active', 'paused', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "PlanLevel" AS ENUM ('quarter', 'month', 'week');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('draft', 'active', 'done');

-- CreateEnum
CREATE TYPE "KpiDirection" AS ENUM ('up_good', 'down_good');

-- CreateTable
CREATE TABLE "Initiative" (
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "InitiativeKind" NOT NULL,
    "clientName" TEXT,
    "ownerId" TEXT NOT NULL,
    "departmentId" TEXT,
    "status" "InitiativeStatus" NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Initiative_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "Plan" (
    "ref" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "level" "PlanLevel" NOT NULL,
    "periodKey" TEXT NOT NULL,
    "parentPlanRef" TEXT,
    "initiativeRef" TEXT,
    "objectives" JSONB NOT NULL DEFAULT '[]',
    "status" "PlanStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "WeeklyReport" (
    "ref" TEXT NOT NULL,
    "planRef" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "highlights" TEXT NOT NULL,
    "blockers" TEXT,
    "nextWeek" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "Kpi" (
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "direction" "KpiDirection" NOT NULL DEFAULT 'up_good',
    "target" DOUBLE PRECISION,
    "ownerId" TEXT,
    "departmentId" TEXT,
    "initiativeRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kpi_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "KpiValue" (
    "ref" TEXT NOT NULL,
    "kpiRef" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiValue_pkey" PRIMARY KEY ("ref")
);

-- CreateIndex
CREATE INDEX "Initiative_kind_idx" ON "Initiative"("kind");

-- CreateIndex
CREATE INDEX "Initiative_status_idx" ON "Initiative"("status");

-- CreateIndex
CREATE INDEX "Initiative_ownerId_idx" ON "Initiative"("ownerId");

-- CreateIndex
CREATE INDEX "Initiative_departmentId_idx" ON "Initiative"("departmentId");

-- CreateIndex
CREATE INDEX "Plan_ownerId_idx" ON "Plan"("ownerId");

-- CreateIndex
CREATE INDEX "Plan_level_idx" ON "Plan"("level");

-- CreateIndex
CREATE INDEX "Plan_periodKey_idx" ON "Plan"("periodKey");

-- CreateIndex
CREATE INDEX "Plan_parentPlanRef_idx" ON "Plan"("parentPlanRef");

-- CreateIndex
CREATE INDEX "Plan_initiativeRef_idx" ON "Plan"("initiativeRef");

-- CreateIndex
CREATE INDEX "Plan_status_idx" ON "Plan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_ownerId_level_periodKey_key" ON "Plan"("ownerId", "level", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReport_planRef_key" ON "WeeklyReport"("planRef");

-- CreateIndex
CREATE INDEX "WeeklyReport_ownerId_idx" ON "WeeklyReport"("ownerId");

-- CreateIndex
CREATE INDEX "WeeklyReport_periodKey_idx" ON "WeeklyReport"("periodKey");

-- CreateIndex
CREATE INDEX "Kpi_ownerId_idx" ON "Kpi"("ownerId");

-- CreateIndex
CREATE INDEX "Kpi_departmentId_idx" ON "Kpi"("departmentId");

-- CreateIndex
CREATE INDEX "Kpi_initiativeRef_idx" ON "Kpi"("initiativeRef");

-- CreateIndex
CREATE INDEX "KpiValue_kpiRef_idx" ON "KpiValue"("kpiRef");

-- CreateIndex
CREATE INDEX "KpiValue_periodKey_idx" ON "KpiValue"("periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "KpiValue_kpiRef_periodKey_key" ON "KpiValue"("kpiRef", "periodKey");

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_planRef_fkey" FOREIGN KEY ("planRef") REFERENCES "Plan"("ref") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiValue" ADD CONSTRAINT "KpiValue_kpiRef_fkey" FOREIGN KEY ("kpiRef") REFERENCES "Kpi"("ref") ON DELETE CASCADE ON UPDATE CASCADE;
