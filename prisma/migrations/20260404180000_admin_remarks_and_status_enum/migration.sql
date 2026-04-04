-- AlterEnum: 新增審查流程狀態（附加於既有 enum 末端）
ALTER TYPE "ApplicationStatus" ADD VALUE 'REVISION_REQUIRED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'PRE_REVIEW_PASSED';

-- AlterTable
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "adminRemarks" TEXT;
