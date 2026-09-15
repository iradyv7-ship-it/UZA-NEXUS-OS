-- CreateEnum
CREATE TYPE "WorkspaceTaskStatus" AS ENUM ('todo', 'in_progress', 'done');

-- CreateTable
CREATE TABLE "WorkspaceTask" (
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "WorkspaceTaskStatus" NOT NULL,
    "project" TEXT,
    "priority" TEXT,
    "url" TEXT,
    "assigneeEmail" TEXT,
    "assigneeRef" TEXT,
    "createdAtSource" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completionNote" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceTask_pkey" PRIMARY KEY ("externalId")
);

-- CreateIndex
CREATE INDEX "WorkspaceTask_assigneeRef_status_idx" ON "WorkspaceTask"("assigneeRef", "status");

-- CreateIndex
CREATE INDEX "WorkspaceTask_status_deadline_idx" ON "WorkspaceTask"("status", "deadline");

-- CreateIndex
CREATE INDEX "WorkspaceTask_project_idx" ON "WorkspaceTask"("project");

-- CreateIndex
CREATE INDEX "WorkspaceTask_syncedAt_idx" ON "WorkspaceTask"("syncedAt");
