-- CreateTable
CREATE TABLE "LenderBorrower" (
    "id" TEXT NOT NULL,
    "personRef" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "loanRef" TEXT,
    "consentGivenAt" TIMESTAMP(3),
    "consentWithdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LenderBorrower_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LenderBorrower_lender_idx" ON "LenderBorrower"("lender");

-- CreateIndex
CREATE UNIQUE INDEX "LenderBorrower_personRef_lender_key" ON "LenderBorrower"("personRef", "lender");
