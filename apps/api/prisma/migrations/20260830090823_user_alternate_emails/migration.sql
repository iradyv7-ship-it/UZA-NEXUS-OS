-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alternateEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];
