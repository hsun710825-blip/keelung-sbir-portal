import type { ApplicationStatus } from "@prisma/client";

export type CommitteeMemberColumn = {
  id: string;
  name: string | null;
  email: string;
};

export type MemberEvaluationCell = {
  score: number;
  rank: number | null;
};

export type ApplicationEvaluationSummaryRow = {
  applicationId: string;
  title: string;
  applicantLabel: string;
  status: ApplicationStatus;
  avgRank: number | null;
  avgScore: number | null;
  evaluationCount: number;
  memberCells: Record<string, MemberEvaluationCell | null>;
};

export function averageOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

export function formatAverage(value: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

/**
 * 彙總排序：平均序位升序（愈小愈前）；同序位時平均分數降序。
 * 尚無序位資料者排於最後。
 */
export function sortApplicationEvaluationRows(
  rows: ApplicationEvaluationSummaryRow[],
): ApplicationEvaluationSummaryRow[] {
  return [...rows].sort((a, b) => {
    if (a.avgRank == null && b.avgRank == null) {
      return (b.avgScore ?? -Infinity) - (a.avgScore ?? -Infinity);
    }
    if (a.avgRank == null) return 1;
    if (b.avgRank == null) return -1;
    if (a.avgRank !== b.avgRank) return a.avgRank - b.avgRank;
    return (b.avgScore ?? 0) - (a.avgScore ?? 0);
  });
}

export function buildApplicationEvaluationSummaryRows(input: {
  applications: Array<{
    id: string;
    title: string | null;
    status: ApplicationStatus;
    applicant: { name: string | null; email: string };
    evaluations: Array<{ committeeId: string; score: number; rank: number | null }>;
  }>;
  committeeMembers: CommitteeMemberColumn[];
}): ApplicationEvaluationSummaryRow[] {
  const rows: ApplicationEvaluationSummaryRow[] = input.applications.map((app) => {
    const memberCells: Record<string, MemberEvaluationCell | null> = {};
    for (const m of input.committeeMembers) {
      memberCells[m.id] = null;
    }
    const ranks: number[] = [];
    const scores: number[] = [];
    for (const ev of app.evaluations) {
      memberCells[ev.committeeId] = { score: ev.score, rank: ev.rank };
      scores.push(ev.score);
      if (ev.rank != null && Number.isFinite(ev.rank)) {
        ranks.push(ev.rank);
      }
    }
    const applicantLabel =
      [app.applicant.name, app.applicant.email].filter(Boolean).join(" · ") || "—";
    return {
      applicationId: app.id,
      title: app.title?.trim() || "（未命名計畫）",
      applicantLabel,
      status: app.status,
      avgRank: averageOf(ranks),
      avgScore: averageOf(scores),
      evaluationCount: app.evaluations.length,
      memberCells,
    };
  });
  return sortApplicationEvaluationRows(rows);
}

export function committeeMemberDisplayLabel(m: CommitteeMemberColumn): string {
  return m.name?.trim() || m.email;
}
