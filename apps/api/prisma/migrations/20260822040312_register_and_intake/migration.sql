-- CreateEnum
CREATE TYPE "SignalSource" AS ENUM ('claude_code', 'artifact', 'email', 'manual');

-- CreateEnum
CREATE TYPE "SignalLane" AS ENUM ('shared', 'private');

-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('new', 'triaged', 'promoted', 'dismissed');

-- CreateEnum
CREATE TYPE "AttentionState" AS ENUM ('runs', 'holds', 'parked');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('open', 'answered', 'deferred');

-- AlterEnum
ALTER TYPE "InitiativeKind" ADD VALUE 'venture';

-- AlterTable
ALTER TABLE "Initiative" ADD COLUMN     "artifactUrl" TEXT,
ADD COLUMN     "attention" "AttentionState" NOT NULL DEFAULT 'holds',
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "nextAction" TEXT,
ADD COLUMN     "reviewAt" TIMESTAMP(3),
ADD COLUMN     "ventureCode" TEXT;

-- CreateTable
CREATE TABLE "InitiativeCheckin" (
    "ref" TEXT NOT NULL,
    "initiativeRef" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "weekOf" TIMESTAMP(3) NOT NULL,
    "moved" TEXT NOT NULL,
    "blocked" TEXT,
    "needsFromCeo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitiativeCheckin_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "Signal" (
    "ref" TEXT NOT NULL,
    "source" "SignalSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "lane" "SignalLane" NOT NULL DEFAULT 'shared',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "summary" TEXT,
    "wallTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SignalStatus" NOT NULL DEFAULT 'new',
    "proposedInitiativeRef" TEXT,
    "proposedAction" TEXT,
    "proposedConfidence" DOUBLE PRECISION,
    "promotedRef" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "dismissedReason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "ExecDecision" (
    "ref" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "context" TEXT,
    "initiativeRef" TEXT,
    "raisedById" TEXT NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DecisionStatus" NOT NULL DEFAULT 'open',
    "answer" TEXT,
    "answeredById" TEXT,
    "answeredAt" TIMESTAMP(3),
    "deferredTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecDecision_pkey" PRIMARY KEY ("ref")
);

-- CreateIndex
CREATE INDEX "InitiativeCheckin_weekOf_idx" ON "InitiativeCheckin"("weekOf");

-- CreateIndex
CREATE INDEX "InitiativeCheckin_ownerId_idx" ON "InitiativeCheckin"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "InitiativeCheckin_initiativeRef_weekOf_key" ON "InitiativeCheckin"("initiativeRef", "weekOf");

-- CreateIndex
CREATE INDEX "Signal_status_occurredAt_idx" ON "Signal"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "Signal_lane_idx" ON "Signal"("lane");

-- CreateIndex
CREATE INDEX "Signal_proposedInitiativeRef_idx" ON "Signal"("proposedInitiativeRef");

-- CreateIndex
CREATE UNIQUE INDEX "Signal_source_externalId_key" ON "Signal"("source", "externalId");

-- CreateIndex
CREATE INDEX "ExecDecision_status_raisedAt_idx" ON "ExecDecision"("status", "raisedAt");

-- CreateIndex
CREATE INDEX "ExecDecision_initiativeRef_idx" ON "ExecDecision"("initiativeRef");

-- CreateIndex
CREATE INDEX "ExecDecision_raisedById_idx" ON "ExecDecision"("raisedById");

-- CreateIndex
CREATE INDEX "Initiative_attention_idx" ON "Initiative"("attention");

-- CreateIndex
CREATE INDEX "Initiative_reviewAt_idx" ON "Initiative"("reviewAt");

-- CreateIndex
CREATE INDEX "Initiative_ventureCode_attention_idx" ON "Initiative"("ventureCode", "attention");

-- AddForeignKey
ALTER TABLE "InitiativeCheckin" ADD CONSTRAINT "InitiativeCheckin_initiativeRef_fkey" FOREIGN KEY ("initiativeRef") REFERENCES "Initiative"("ref") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecDecision" ADD CONSTRAINT "ExecDecision_initiativeRef_fkey" FOREIGN KEY ("initiativeRef") REFERENCES "Initiative"("ref") ON DELETE SET NULL ON UPDATE CASCADE;
