import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** 委員評分列表用（不查 rank，相容尚未套用 rank migration 的正式庫） */
export const committeeEvalListSelect = {
  id: true,
  score: true,
} as const;

/** 委員評分詳情用：先不含 rank，避免缺欄位時整頁 500 */
export const committeeEvalDetailSelectBase = {
  id: true,
  score: true,
  comment: true,
} as const;

export type CommitteeEvalDetail = {
  id: string;
  score: number;
  comment: string | null;
  rank: number | null;
};

export function getPrismaErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: string }).code);
  }
  return "";
}

export function getPrismaErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isMissingEvaluationSchemaError(error: unknown): boolean {
  const code = getPrismaErrorCode(error);
  const msg = getPrismaErrorMessage(error);
  if (code === "P2021") return true;
  if (code === "P2022" && /Evaluation|rank/i.test(msg)) return true;
  return (
    /relation\s+"Evaluation"\s+does not exist/i.test(msg) ||
    /table\s+[`"]?public\.Evaluation[`"]?\s+does not exist/i.test(msg) ||
    /column\s+[`"]?Evaluation\.rank[`"]?\s+does not exist/i.test(msg) ||
    /column\s+[`"]?rank[`"]?\s+does not exist/i.test(msg)
  );
}

export const COMMITTEE_EVALUATION_SCHEMA_FIX_SQL = `-- 委員評分表（若尚未建立）
CREATE TABLE IF NOT EXISTS "Evaluation" (
    "id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "applicationId" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Evaluation_applicationId_committeeId_key"
  ON "Evaluation"("applicationId", "committeeId");
CREATE INDEX IF NOT EXISTS "Evaluation_applicationId_idx" ON "Evaluation"("applicationId");
CREATE INDEX IF NOT EXISTS "Evaluation_committeeId_idx" ON "Evaluation"("committeeId");
DO $$ BEGIN
  ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_committeeId_fkey"
    FOREIGN KEY ("committeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 序位法欄位
ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS "rank" INTEGER;`;

type CommitteeDashboardApplication = Prisma.ApplicationGetPayload<{
  include: {
    applicant: { select: { name: true; email: true } };
    evaluations: { select: typeof committeeEvalListSelect };
  };
}>;

export async function loadCommitteeDashboardApplications(
  committeeId: string,
  where: Prisma.ApplicationWhereInput,
): Promise<{
  applications: CommitteeDashboardApplication[];
  evaluationSchemaIssue: boolean;
}> {
  const baseArgs = {
    where,
    orderBy: { updatedAt: "desc" as const },
    include: {
      applicant: {
        select: { name: true, email: true },
      },
      evaluations: {
        where: { committeeId },
        select: committeeEvalListSelect,
      },
    },
  };

  try {
    const applications = await prisma.application.findMany(baseArgs);
    return { applications, evaluationSchemaIssue: false };
  } catch (error) {
    if (!isMissingEvaluationSchemaError(error)) throw error;
    console.error("[committee/dashboard] Evaluation schema mismatch, listing without evaluations:", error);
    const applications = await prisma.application.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        applicant: {
          select: { name: true, email: true },
        },
      },
    });
    return {
      applications: applications.map((row) => ({ ...row, evaluations: [] })),
      evaluationSchemaIssue: true,
    };
  }
}

export async function loadCommitteeEvaluationDetail(
  applicationId: string,
  committeeId: string,
): Promise<{ evaluation: CommitteeEvalDetail | null; rankColumnMissing: boolean }> {
  const where = {
    applicationId_committeeId: { applicationId, committeeId },
  };

  try {
    const row = await prisma.evaluation.findUnique({
      where,
      select: { ...committeeEvalDetailSelectBase, rank: true },
    });
    if (!row) return { evaluation: null, rankColumnMissing: false };
    return {
      evaluation: {
        id: row.id,
        score: row.score,
        comment: row.comment,
        rank: row.rank,
      },
      rankColumnMissing: false,
    };
  } catch (error) {
    if (!isMissingEvaluationSchemaError(error)) throw error;
    try {
      const row = await prisma.evaluation.findUnique({
        where,
        select: committeeEvalDetailSelectBase,
      });
      if (!row) return { evaluation: null, rankColumnMissing: true };
      return {
        evaluation: {
          id: row.id,
          score: row.score,
          comment: row.comment,
          rank: null,
        },
        rankColumnMissing: true,
      };
    } catch (fallbackError) {
      if (isMissingEvaluationSchemaError(fallbackError)) {
        return { evaluation: null, rankColumnMissing: true };
      }
      throw fallbackError;
    }
  }
}
