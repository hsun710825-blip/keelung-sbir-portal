import { prisma } from "@/lib/prisma";

let ensured = false;

/** 正式 DB 若尚未跑 migration，自動建立／擴充委員評分相關表與欄位（冪等）。 */
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
    await prisma.$executeRawUnsafe(`ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT';`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS "scoresJson" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS "meetingDate" TEXT;`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Evaluation_meetingDate_idx" ON "Evaluation"("meetingDate");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Evaluation_status_idx" ON "Evaluation"("status");`);

    await prisma.$executeRawUnsafe(`ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "reviewMeetingDate" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "reviewAgendaOrder" INTEGER;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "reviewProposalType" TEXT DEFAULT 'STANDARD';`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "settlementSuggestedSubsidy" INTEGER;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "settlementSuggestedSelfFund" INTEGER;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "settlementSuggestedTotal" INTEGER;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "settlementAppliedSubsidy" INTEGER;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "settlementAppliedSelfFund" INTEGER;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "settlementAppliedTotal" INTEGER;`);
    await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Application_reviewMeetingDate_reviewAgendaOrder_idx"
      ON "Application"("reviewMeetingDate", "reviewAgendaOrder");
  `);

    await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommitteeReviewSession" (
      "id" TEXT NOT NULL,
      "committeeId" TEXT NOT NULL,
      "meetingDate" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "submittedAt" TIMESTAMP(3),
      "lockedAt" TIMESTAMP(3),
      "lockedByUserId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CommitteeReviewSession_pkey" PRIMARY KEY ("id")
    );
  `);
    await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "CommitteeReviewSession_committeeId_meetingDate_key"
      ON "CommitteeReviewSession"("committeeId", "meetingDate");
  `);
    await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CommitteeReviewSession_meetingDate_idx" ON "CommitteeReviewSession"("meetingDate");
  `);
    await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CommitteeReviewSession_status_idx" ON "CommitteeReviewSession"("status");
  `);
    await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "CommitteeReviewSession" ADD CONSTRAINT "CommitteeReviewSession_committeeId_fkey"
        FOREIGN KEY ("committeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
    await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "CommitteeReviewSession" ADD CONSTRAINT "CommitteeReviewSession_lockedByUserId_fkey"
        FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

    ensured = true;
  } catch (error) {
    ensured = false;
    throw error;
  }
}
