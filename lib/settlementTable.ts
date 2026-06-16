import { COMMITTEE_VISIBLE_APPLICATION_STATUSES } from "@/lib/committeeApplicationStatuses";
import { loadAllMeetingApplications } from "@/lib/loadAllMeetingApplications";
import { compareByRankSumThenTotal } from "@/lib/committeeScoreSort";
import { TEMPLATE_COMMITTEE_MEMBER_NAMES } from "@/lib/committeeScoreSort";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export type SettlementRow = {
  index: number;
  applicationId: string;
  companyName: string;
  title: string;
  suggestedSubsidy: number | null;
  suggestedSelfFund: number | null;
  suggestedTotal: number | null;
  committeeScores: [number | null, number | null, number | null];
  committeeRanks: [number | null, number | null, number | null];
  avgScore: number | null;
  rankSum: number | null;
  overallRank: number | null;
  isJoint: boolean;
};

function avgOf(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sumOf(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

export async function buildSettlementRows(jointOnly: boolean): Promise<SettlementRow[]> {
  await ensureEvaluationSchema();

  const [apps, dbCommittee, evaluations] = await Promise.all([
    loadAllMeetingApplications(),
    prisma.user.findMany({
      where: { role: { in: [Role.REVIEWER, Role.COMMITTEE] } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      take: 3,
      select: { id: true },
    }),
    prisma.evaluation.findMany({
      select: {
        applicationId: true,
        committeeId: true,
        score: true,
        rank: true,
      },
    }),
  ]);

  const committeeIds = dbCommittee.map((u) => u.id);
  while (committeeIds.length < 3) committeeIds.push("");

  const evalByAppCommittee = new Map<string, { score: number; rank: number | null }>();
  for (const ev of evaluations) {
    evalByAppCommittee.set(`${ev.applicationId}:${ev.committeeId}`, ev);
  }

  const rows: SettlementRow[] = [];

  for (const row of apps) {
    const isJoint = String(row.application.reviewProposalType || "").toUpperCase() === "JOINT";
    if (jointOnly !== isJoint) continue;

    const scores: [number | null, number | null, number | null] = [null, null, null];
    const ranks: [number | null, number | null, number | null] = [null, null, null];

    committeeIds.forEach((cid, idx) => {
      if (!cid) return;
      const ev = evalByAppCommittee.get(`${row.application.id}:${cid}`);
      if (ev) {
        scores[idx] = ev.score;
        ranks[idx] = ev.rank;
      }
    });

    rows.push({
      index: 0,
      applicationId: row.application.id,
      companyName: row.companyName,
      title: row.application.title?.trim() || row.agendaProject,
      suggestedSubsidy: row.application.settlementSuggestedSubsidy ?? null,
      suggestedSelfFund: row.application.settlementSuggestedSelfFund ?? null,
      suggestedTotal: row.application.settlementSuggestedTotal ?? null,
      committeeScores: scores,
      committeeRanks: ranks,
      avgScore: avgOf(scores),
      rankSum: sumOf(ranks),
      overallRank: null,
      isJoint,
    });
  }

  rows.sort((a, b) =>
    compareByRankSumThenTotal({
      rankSumA: a.rankSum,
      rankSumB: b.rankSum,
      totalA: a.avgScore,
      totalB: b.avgScore,
    }),
  );

  rows.forEach((r, i) => {
    r.index = i + 1;
    r.overallRank = i + 1;
  });

  return rows;
}

export async function loadSettlementPageData() {
  const [standard, joint] = await Promise.all([buildSettlementRows(false), buildSettlementRows(true)]);
  return {
    standardRows: standard,
    jointRows: joint,
    templateMemberNames: [...TEMPLATE_COMMITTEE_MEMBER_NAMES],
  };
}

export async function deleteUnnamedTestApplications(): Promise<number> {
  const apps = await prisma.application.findMany({
    where: {
      status: { in: COMMITTEE_VISIBLE_APPLICATION_STATUSES },
      OR: [
        { title: null },
        { title: "" },
        { title: { contains: "未命名" } },
      ],
    },
    select: { id: true },
  });
  if (apps.length === 0) return 0;
  const result = await prisma.application.deleteMany({
    where: { id: { in: apps.map((a) => a.id) } },
  });
  return result.count;
}
