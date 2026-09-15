-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phoneHash" TEXT,
    "nationalIdHash" TEXT,
    "reportingConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentRecordedAt" TIMESTAMP(3),
    "consentWithdrawnAt" TIMESTAMP(3),
    "mergedIntoRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonLink" (
    "id" TEXT NOT NULL,
    "personRef" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_ref_key" ON "Person"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Person_phoneHash_key" ON "Person"("phoneHash");

-- CreateIndex
CREATE UNIQUE INDEX "Person_nationalIdHash_key" ON "Person"("nationalIdHash");

-- CreateIndex
CREATE INDEX "Person_mergedIntoRef_idx" ON "Person"("mergedIntoRef");

-- CreateIndex
CREATE INDEX "PersonLink_personRef_idx" ON "PersonLink"("personRef");

-- CreateIndex
CREATE UNIQUE INDEX "PersonLink_system_externalId_key" ON "PersonLink"("system", "externalId");

-- AddForeignKey
ALTER TABLE "PersonLink" ADD CONSTRAINT "PersonLink_personRef_fkey" FOREIGN KEY ("personRef") REFERENCES "Person"("ref") ON DELETE CASCADE ON UPDATE CASCADE;
