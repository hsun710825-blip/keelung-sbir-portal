import { COMMITTEE_VISIBLE_APPLICATION_STATUSES } from "@/lib/committeeApplicationStatuses";
import { compareByRankSumThenTotal } from "@/lib/committeeScoreSort";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";
import { matchApplicationToAgenda } from "@/lib/matchApplicationToAgenda";
import { prisma } from "@/lib/prisma";
import { resolveApplicationDisplayFieldsBatch } from "@/lib/resolveApplicationDisplayFields";
import {
  getReviewMeetingConfig,
  isAgendaJointProposal,
  REVIEW_MEETING_DATES,
  type ReviewMeetingDate,
} from "@/lib/reviewMeetingAgenda";
import {
  loadSettlementCommitteeConfig,
  type SettlementCommitteeConfig,
} from "@/lib/settlementConfig";

export type SettlementRow = {
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
  briefingOrder: string;
  isJoint: boolean;
  reviewMeetingDate: string;
  agendaOrder: number;
};

type AppRow = {
  id: string;
  title: string | null;
  description: string | null;
  submissionMode: string;
  reviewMeetingDate: string | null;
  reviewAgendaOrder: number | null;
  reviewProposalType: string | null;
  settlementSuggestedSubsidy: number | null;
  settlementSuggestedSelfFund: number | null;
  settlementSuggestedTotal: number | null;
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

function computeBriefingOrders(): {
  standardBriefingByKey: Map<string, number>;
  jointBriefingByKey: Map<string, string>;
} {
  const standardBriefingByKey = new Map<string, number>();
  const jointBriefingByKey = new Map<string, string>();
  let offset = 0;
  let jointIndex = 0;

  for (const meetingDate of REVIEW_MEETING_DATES) {
    const config = getReviewMeetingConfig(meetingDate);
    for (const c of config.cases) {
      const key = `${meetingDate}:${c.order}`;
      if (isAgendaJointProposal(c)) {
        jointIndex += 1;
        jointBriefingByKey.set(key, `A${String(jointIndex).padStart(2, "0")}`);
      } else {
        offset += 1;
        standardBriefingByKey.set(key, offset);
      }
    }
  }

  return { standardBriefingByKey, jointBriefingByKey };
}

async function loadSettlementApplications(): Promise<
  Array<{
    app: AppRow;
    companyName: string;
    agendaProject: string;
    meetingDate: ReviewMeetingDate;
    agendaOrder: number;
    isJoint: boolean;
  }>
> {
  await ensureEvaluationSchema();

  let apps: AppRow[];
  try {
    apps = await prisma.application.findMany({
      where: { status: { in: COMMITTEE_VISIBLE_APPLICATION_STATUSES } },
      select: {
        id: true,
        title: true,
        description: true,
        submissionMode: true,
        reviewMeetingDate: true,
        reviewAgendaOrder: true,
        reviewProposalType: true,
        settlementSuggestedSubsidy: true,
        settlementSuggestedSelfFund: true,
        settlementSuggestedTotal: true,
      },
      orderBy: [{ reviewMeetingDate: "asc" }, { reviewAgendaOrder: "asc" }],
    });
  } catch {
    apps = await prisma.application.findMany({
      where: { status: { in: COMMITTEE_VISIBLE_APPLICATION_STATUSES } },
      select: {
        id: true,
        title: true,
        description: true,
        submissionMode: true,
        reviewMeetingDate: true,
        reviewAgendaOrder: true,
        settlementSuggestedSubsidy: true,
        settlementSuggestedSelfFund: true,
        settlementSuggestedTotal: true,
      },
      orderBy: [{ reviewMeetingDate: "asc" }, { reviewAgendaOrder: "asc" }],
    }).then((rows) =>
      rows.map((r) => ({
        ...r,
        reviewProposalType: null as string | null,
      })),
    );
  }

  const displayMap = await resolveApplicationDisplayFieldsBatch(
    apps.map((a) => ({
      id: a.id,
      submissionMode: a.submissionMode,
      description: a.description,
    })),
  );

  const out: Array<{
    app: AppRow;
    companyName: string;
    agendaProject: string;
    meetingDate: ReviewMeetingDate;
    agendaOrder: number;
    isJoint: boolean;
  }> = [];

  for (const app of apps) {
    const companyName = displayMap.get(app.id)?.companyName?.trim() || "";
    let meetingDate = app.reviewMeetingDate as ReviewMeetingDate | null;
    let agendaOrder = app.reviewAgendaOrder;
    let isJoint = String(app.reviewProposalType || "").toUpperCase() === "JOINT";

    if (!meetingDate || agendaOrder == null) {
      const hit = matchApplicationToAgenda({ title: app.title, companyName });
      if (!hit) continue;
      meetingDate = hit.meetingDate;
      agendaOrder = hit.order;
      isJoint = isAgendaJointProposal(hit.agendaCase);
    }

    if (!meetingDate || agendaOrder == null) continue;

    const config = getReviewMeetingConfig(meetingDate);
    const agendaCase = config.cases.find((c) => c.order === agendaOrder);

    out.push({
      app,
      companyName: companyName || agendaCase?.company || "—",
      agendaProject: agendaCase?.project || app.title?.trim() || "—",
      meetingDate,
      agendaOrder,
      isJoint,
    });
  }

  return out;
}

export async function buildSettlementRows(
  jointOnly: boolean,
  committeeConfig?: SettlementCommitteeConfig,
): Promise<SettlementRow[]> {
  const config = committeeConfig ?? (await loadSettlementCommitteeConfig());
  const committeeIds = config.slots.map((s) => s.userId);

  const [items, evaluations, briefingMaps] = await Promise.all([
    loadSettlementApplications(),
    prisma.evaluation.findMany({
      select: {
        applicationId: true,
        committeeId: true,
        score: true,
        rank: true,
      },
    }),
    Promise.resolve(computeBriefingOrders()),
  ]);

  const evalByAppCommittee = new Map<string, { score: number; rank: number | null }>();
  for (const ev of evaluations) {
    evalByAppCommittee.set(`${ev.applicationId}:${ev.committeeId}`, ev);
  }

  const rows: SettlementRow[] = [];

  for (const item of items) {
    if (jointOnly !== item.isJoint) continue;

    const scores: [number | null, number | null, number | null] = [null, null, null];
    const ranks: [number | null, number | null, number | null] = [null, null, null];

    committeeIds.forEach((cid, idx) => {
      if (!cid) return;
      const ev = evalByAppCommittee.get(`${item.app.id}:${cid}`);
      if (ev) {
        scores[idx] = ev.score;
        ranks[idx] = ev.rank;
      }
    });

    const agendaKey = `${item.meetingDate}:${item.agendaOrder}`;
    const briefingOrder = item.isJoint
      ? briefingMaps.jointBriefingByKey.get(agendaKey) || "—"
      : String(briefingMaps.standardBriefingByKey.get(agendaKey) ?? "—");

    rows.push({
      applicationId: item.app.id,
      companyName: item.companyName,
      title: item.app.title?.trim() || item.agendaProject,
      suggestedSubsidy: item.app.settlementSuggestedSubsidy ?? null,
      suggestedSelfFund: item.app.settlementSuggestedSelfFund ?? null,
      suggestedTotal: item.app.settlementSuggestedTotal ?? null,
      committeeScores: scores,
      committeeRanks: ranks,
      avgScore: avgOf(scores),
      rankSum: sumOf(ranks),
      overallRank: null,
      briefingOrder,
      isJoint: item.isJoint,
      reviewMeetingDate: item.meetingDate,
      agendaOrder: item.agendaOrder,
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
    r.overallRank = i + 1;
  });

  return rows;
}

export async function loadSettlementPageData() {
  const committeeConfig = await loadSettlementCommitteeConfig();
  const { listReviewerOptionsForSettlement } = await import("@/lib/settlementConfig");
  const [standard, joint, reviewerOptions] = await Promise.all([
    buildSettlementRows(false, committeeConfig),
    buildSettlementRows(true, committeeConfig),
    listReviewerOptionsForSettlement(),
  ]);

  return {
    standardRows: standard,
    jointRows: joint,
    committeeConfig,
    reviewerOptions,
    memberNames: committeeConfig.slots.map((s) => s.displayName),
  };
}

export async function deleteUnnamedTestApplications(): Promise<number> {
  const apps = await prisma.application.findMany({
    where: {
      status: { in: COMMITTEE_VISIBLE_APPLICATION_STATUSES },
      OR: [{ title: null }, { title: "" }, { title: { contains: "未命名" } }],
    },
    select: { id: true },
  });
  if (apps.length === 0) return 0;
  const result = await prisma.application.deleteMany({
    where: { id: { in: apps.map((a) => a.id) } },
  });
  return result.count;
}
