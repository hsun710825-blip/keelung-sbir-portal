import { prisma } from "@/lib/prisma";

let ensured = false;

/** 正式 DB 若尚未跑 migration，自動建立 Evaluation 表與 rank 欄位（冪等）。 */
export async function ensureEvaluationSchema(): Promise<void> {
  if (ensured) return;

  try {
    await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Evaluation" (
      "id" TEXT NOT NULL,
      "score" DOUBLE PRECISION NOT NULL,
      "comment" TEXT,
      "applicationId" TEXT NOT NULL,
      "committeeId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Evaluation_applicationId_committeeId_key"
      ON "Evaluation"("applicationId", "committeeId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Evaluation_applicationId_idx" ON "Evaluation"("applicationId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Evaluation_committeeId_idx" ON "Evaluation"("committeeId");
  `);

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_applicationId_fkey"
        FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_committeeId_fkey"
        FOREIGN KEY ("committeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await prisma.$executeRawUnsafe(`ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS "rank" INTEGER;`);

    ensured = true;
  } catch (error) {
    ensured = false;
    throw error;
  }
}
