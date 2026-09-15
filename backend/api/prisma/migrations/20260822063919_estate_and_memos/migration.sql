-- CreateEnum
CREATE TYPE "SystemKind" AS ENUM ('repository', 'web_app', 'mobile_app', 'backend', 'admin_panel', 'prototype', 'document');

-- CreateEnum
CREATE TYPE "SystemStatus" AS ENUM ('live', 'building', 'prototype', 'dormant', 'retired');

-- CreateEnum
CREATE TYPE "SystemVisibility" AS ENUM ('public', 'private', 'unknown');

-- CreateEnum
CREATE TYPE "MemoAudience" AS ENUM ('everyone', 'department', 'person');

-- CreateTable
CREATE TABLE "SystemRecord" (
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SystemKind" NOT NULL,
    "ventureCode" TEXT,
    "ownerId" TEXT NOT NULL,
    "status" "SystemStatus" NOT NULL DEFAULT 'building',
    "repoUrl" TEXT,
    "liveUrl" TEXT,
    "visibility" "SystemVisibility" NOT NULL DEFAULT 'unknown',
    "lastPushAt" TIMESTAMP(3),
    "supersededBy" TEXT,
    "initiativeRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemRecord_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "Memo" (
    "ref" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "audience" "MemoAudience" NOT NULL,
    "departmentCode" TEXT,
    "toId" TEXT,
    "ventureCode" TEXT,
    "needsAck" BOOLEAN NOT NULL DEFAULT false,
    "linkedRef" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Memo_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "MemoReceipt" (
    "id" TEXT NOT NULL,
    "memoRef" TEXT NOT NULL,
    "userRef" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "ackedAt" TIMESTAMP(3),

    CONSTRAINT "MemoReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemRecord_ventureCode_status_idx" ON "SystemRecord"("ventureCode", "status");

-- CreateIndex
CREATE INDEX "SystemRecord_ownerId_idx" ON "SystemRecord"("ownerId");

-- CreateIndex
CREATE INDEX "SystemRecord_status_idx" ON "SystemRecord"("status");

-- CreateIndex
CREATE INDEX "Memo_fromId_idx" ON "Memo"("fromId");

-- CreateIndex
CREATE INDEX "Memo_sentAt_idx" ON "Memo"("sentAt");

-- CreateIndex
CREATE INDEX "Memo_audience_idx" ON "Memo"("audience");

-- CreateIndex
CREATE INDEX "MemoReceipt_userRef_idx" ON "MemoReceipt"("userRef");

-- CreateIndex
CREATE UNIQUE INDEX "MemoReceipt_memoRef_userRef_key" ON "MemoReceipt"("memoRef", "userRef");

-- AddForeignKey
ALTER TABLE "MemoReceipt" ADD CONSTRAINT "MemoReceipt_memoRef_fkey" FOREIGN KEY ("memoRef") REFERENCES "Memo"("ref") ON DELETE CASCADE ON UPDATE CASCADE;
