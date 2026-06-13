-- AlterTable: 委員評分新增序位法欄位
ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS "rank" INTEGER;
