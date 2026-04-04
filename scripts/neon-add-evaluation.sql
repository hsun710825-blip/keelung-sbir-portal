-- 與 prisma/migrations/20260406120000_evaluation_model/migration.sql 相同
-- 正式庫若未跑 migration，可：npx prisma db push
-- 或於 Neon 執行本檔（若表已存在請略過或改用手動調整）

CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "applicationId" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Evaluation_applicationId_committeeId_key" ON "Evaluation"("applicationId", "committeeId");
CREATE INDEX "Evaluation_applicationId_idx" ON "Evaluation"("applicationId");
CREATE INDEX "Evaluation_committeeId_idx" ON "Evaluation"("committeeId");

ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
