-- CreateEnum
CREATE TYPE "CommandTaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "CommandTaskStatus" AS ENUM ('todo', 'in_progress', 'blocked', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "GrantStatus" AS ENUM ('identified', 'preparing', 'submitted', 'awarded', 'rejected', 'closed');

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT,
    "managerId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandTask" (
    "ref" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT NOT NULL,
    "departmentId" TEXT,
    "priority" "CommandTaskPriority" NOT NULL DEFAULT 'medium',
    "status" "CommandTaskStatus" NOT NULL DEFAULT 'todo',
    "dueAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "linkedRef" TEXT,
    "parentTaskId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommandTask_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "Grant" (
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "funder" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "status" "GrantStatus" NOT NULL DEFAULT 'identified',
    "fitNotes" TEXT,
    "nextAction" TEXT,
    "ownerId" TEXT,
    "requirements" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grant_pkey" PRIMARY KEY ("ref")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_ref_key" ON "Department"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_userId_key" ON "EmployeeProfile"("userId");

-- CreateIndex
CREATE INDEX "EmployeeProfile_departmentId_idx" ON "EmployeeProfile"("departmentId");

-- CreateIndex
CREATE INDEX "EmployeeProfile_managerId_idx" ON "EmployeeProfile"("managerId");

-- CreateIndex
CREATE INDEX "CommandTask_assigneeId_idx" ON "CommandTask"("assigneeId");

-- CreateIndex
CREATE INDEX "CommandTask_departmentId_idx" ON "CommandTask"("departmentId");

-- CreateIndex
CREATE INDEX "CommandTask_createdById_idx" ON "CommandTask"("createdById");

-- CreateIndex
CREATE INDEX "CommandTask_status_idx" ON "CommandTask"("status");

-- CreateIndex
CREATE INDEX "CommandTask_parentTaskId_idx" ON "CommandTask"("parentTaskId");

-- CreateIndex
CREATE INDEX "Grant_status_idx" ON "Grant"("status");

-- CreateIndex
CREATE INDEX "Grant_ownerId_idx" ON "Grant"("ownerId");

-- CreateIndex
CREATE INDEX "Grant_deadlineAt_idx" ON "Grant"("deadlineAt");

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
