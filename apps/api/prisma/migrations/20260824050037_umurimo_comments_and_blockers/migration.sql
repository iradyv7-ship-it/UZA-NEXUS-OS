-- CreateEnum
CREATE TYPE "CommentKind" AS ENUM ('comment', 'request');

-- AlterTable
ALTER TABLE "WeeklyReport" ADD COLUMN     "asking" TEXT;

-- CreateTable
CREATE TABLE "Blocker" (
    "ref" TEXT NOT NULL,
    "reportRef" TEXT NOT NULL,
    "raisedBy" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "ownerId" TEXT,
    "dueAt" TIMESTAMP(3),
    "ownedAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "clearedBy" TEXT,
    "clearedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Blocker_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "Comment" (
    "ref" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectRef" TEXT NOT NULL,
    "parentRef" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" "CommentKind" NOT NULL DEFAULT 'comment',
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolvedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("ref")
);

-- CreateIndex
CREATE INDEX "Blocker_reportRef_idx" ON "Blocker"("reportRef");

-- CreateIndex
CREATE INDEX "Blocker_ownerId_idx" ON "Blocker"("ownerId");

-- CreateIndex
CREATE INDEX "Blocker_clearedAt_idx" ON "Blocker"("clearedAt");

-- CreateIndex
CREATE INDEX "Blocker_dueAt_idx" ON "Blocker"("dueAt");

-- CreateIndex
CREATE INDEX "Comment_subjectType_subjectRef_createdAt_idx" ON "Comment"("subjectType", "subjectRef", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX "Comment_parentRef_idx" ON "Comment"("parentRef");

-- CreateIndex
CREATE INDEX "Comment_kind_resolvedAt_idx" ON "Comment"("kind", "resolvedAt");

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_reportRef_fkey" FOREIGN KEY ("reportRef") REFERENCES "WeeklyReport"("ref") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentRef_fkey" FOREIGN KEY ("parentRef") REFERENCES "Comment"("ref") ON DELETE CASCADE ON UPDATE CASCADE;
