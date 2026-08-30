-- CreateEnum
CREATE TYPE "CheckOutcome" AS ENUM ('pass', 'fail', 'not_applicable', 'not_run');

-- CreateTable
CREATE TABLE "SystemVerification" (
    "ref" TEXT NOT NULL,
    "systemRef" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "typecheck" "CheckOutcome" NOT NULL DEFAULT 'not_run',
    "tests" "CheckOutcome" NOT NULL DEFAULT 'not_run',
    "imageBuilds" "CheckOutcome" NOT NULL DEFAULT 'not_run',
    "testsPassed" INTEGER,
    "testsTotal" INTEGER,
    "gaps" TEXT,
    "verifiedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemVerification_pkey" PRIMARY KEY ("ref")
);

-- CreateIndex
CREATE INDEX "SystemVerification_systemRef_verifiedAt_idx" ON "SystemVerification"("systemRef", "verifiedAt");

-- CreateIndex
CREATE INDEX "SystemVerification_verifiedAt_idx" ON "SystemVerification"("verifiedAt");

-- AddForeignKey
ALTER TABLE "SystemVerification" ADD CONSTRAINT "SystemVerification_systemRef_fkey" FOREIGN KEY ("systemRef") REFERENCES "SystemRecord"("ref") ON DELETE CASCADE ON UPDATE CASCADE;
