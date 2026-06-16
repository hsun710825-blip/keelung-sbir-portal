import { COMMITTEE_VISIBLE_APPLICATION_STATUSES } from "@/lib/committeeApplicationStatuses";
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
import { resolveApplicationBudgetBatch } from "@/lib/settlementBudget";
import {
  loadSettlementCommitteeConfig,
  type SettlementCommitteeConfig,
} from "@/lib/settlementConfig";
import { assignSkipTieRanks, avgCommitteeScore, sortRowsByAvgScoreDesc } from "@/lib/settlementRank";

export type SettlementRow = {
  applicationId: string;
  companyName: string;
  title: string;
  appliedSubsidy: number | null;
  appliedSelfFund: number | null;
  appliedTotal: number | null;
  suggestedSubsidy: number | null;
  suggestedSelfFund: number | null;
  suggestedTotal: number | null;
  committeeScores: [number | null, number | null, number | null];
  avgScore: number | null;
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
  displayCompanyName: string | null;
  reviewMeetingDate: string | null;
  reviewAgendaOrder: number | null;
  reviewProposalType: string | null;
  settlementAppliedSubsidy: number | null;
  settlementAppliedSelfFund: number | null;
  settlementAppliedTotal: number | null;
  settlementSuggestedSubsidy: number | null;
  settlementSuggestedSelfFund: number | null;
  settlementSuggestedTotal: number | null;
};

const APP_SELECT = {
  id: true,
  title: true,
  description: true,
  submissionMode: true,
  reviewMeetingDate: true,
  reviewAgendaOrder: true,
  reviewProposalType: true,
  displayCompanyName: true,
  settlementAppliedSubsidy: true,
  settlementAppliedSelfFund: true,
  settlementAppliedTotal: true,
  settlementSuggestedSubsidy: true,
  settlementSuggestedSelfFund: true,
  settlementSuggestedTotal: true,
} as const;

const APP_SELECT_FALLBACK = {
  id: true,
  title: true,
  description: true,
  submissionMode: true,
  reviewMeetingDate: true,
  reviewAgendaOrder: true,
  settlementSuggestedSubsidy: true,
  settlementSuggestedSelfFund: true,
  settlementSuggestedTotal: true,
} as const;

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
      select: APP_SELECT,
      orderBy: [{ reviewMeetingDate: "asc" }, { reviewAgendaOrder: "asc" }],
    });
  } catch {
    apps = await prisma.application.findMany({
      where: { status: { in: COMMITTEE_VISIBLE_APPLICATION_STATUSES } },
      select: APP_SELECT_FALLBACK,
      orderBy: [{ reviewMeetingDate: "asc" }, { reviewAgendaOrder: "asc" }],
    }).then((rows) =>
      rows.map((r) => ({
        ...r,
        reviewProposalType: null as string | null,
        displayCompanyName: null,
        settlementAppliedSubsidy: null,
        settlementAppliedSelfFund: null,
        settlementAppliedTotal: null,
      })),
    );
  }

  const displayMap = await resolveApplicationDisplayFieldsBatch(
    apps.map((a) => ({
      id: a.id,
      submissionMode: a.submissionMode,
      description: a.description,
      displayCompanyName: a.displayCompanyName,
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

function pickAppliedAmount(
  override: number | null | undefined,
  draft: number | null | undefined,
): number | null {
  if (override != null) return override;
  if (draft != null) return draft;
  return null;
}

type SettlementAppItem = Awaited<ReturnType<typeof loadSettlementApplications>>[number];

type SettlementBuildContext = {
  items: SettlementAppItem[];
  committeeIds: string[];
  evaluations: Array<{ applicationId: string; committeeId: string; score: number }>;
  budgetMap: Awaited<ReturnType<typeof resolveApplicationBudgetBatch>>;
  briefingMaps: ReturnType<typeof computeBriefingOrders>;
};

async function createSettlementBuildContext(
  committeeConfig: SettlementCommitteeConfig,
): Promise<SettlementBuildContext> {
  const items = await loadSettlementApplications();
  const applicationIds = items.map((item) => item.app.id);
  const committeeIds = committeeConfig.slots.map((s) => s.userId);

  const [evaluations, budgetMap] = await Promise.all([
    applicationIds.length > 0
      ? prisma.evaluation.findMany({
          where: { applicationId: { in: applicationIds } },
          select: {
            applicationId: true,
            committeeId: true,
            score: true,
          },
        })
      : Promise.resolve([]),
    resolveApplicationBudgetBatch(
      items.map((item) => ({ id: item.app.id, submissionMode: item.app.submissionMode })),
    ),
  ]);

  return {
    items,
    committeeIds,
    evaluations,
    budgetMap,
    briefingMaps: computeBriefingOrders(),
  };
}

function buildSettlementRowsFromContext(
  context: SettlementBuildContext,
  jointOnly: boolean,
): SettlementRow[] {
  const filtered = context.items.filter((item) => (jointOnly ? item.isJoint : !item.isJoint));

  const evalByAppCommittee = new Map<string, { score: number }>();
  for (const ev of context.evaluations) {
    evalByAppCommittee.set(`${ev.applicationId}:${ev.committeeId}`, ev);
  }

  const rows: SettlementRow[] = [];

  for (const item of filtered) {
    const scores: [number | null, number | null, number | null] = [null, null, null];

    context.committeeIds.forEach((cid, idx) => {
      if (!cid) return;
      const ev = evalByAppCommittee.get(`${item.app.id}:${cid}`);
      if (ev) scores[idx] = ev.score;
    });

    const draftBudget = context.budgetMap.get(item.app.id);
    const appliedSubsidy = pickAppliedAmount(item.app.settlementAppliedSubsidy, draftBudget?.subsidy);
    const appliedSelfFund = pickAppliedAmount(item.app.settlementAppliedSelfFund, draftBudget?.selfFund);
    const appliedTotal = pickAppliedAmount(item.app.settlementAppliedTotal, draftBudget?.total);

    const agendaKey = `${item.meetingDate}:${item.agendaOrder}`;
    const briefingOrder = item.isJoint
      ? context.briefingMaps.jointBriefingByKey.get(agendaKey) || "—"
      : String(context.briefingMaps.standardBriefingByKey.get(agendaKey) ?? "—");

    rows.push({
      applicationId: item.app.id,
      companyName: item.companyName,
      title: item.app.title?.trim() || item.agendaProject,
      appliedSubsidy,
      appliedSelfFund,
      appliedTotal,
      suggestedSubsidy: item.app.settlementSuggestedSubsidy ?? null,
      suggestedSelfFund:
        item.app.settlementSuggestedSelfFund ?? appliedSelfFund ?? null,
      suggestedTotal: item.app.settlementSuggestedTotal ?? null,
      committeeScores: scores,
      avgScore: avgCommitteeScore(scores),
      overallRank: null,
      briefingOrder,
      isJoint: item.isJoint,
      reviewMeetingDate: item.meetingDate,
      agendaOrder: item.agendaOrder,
    });
  }

  const sorted = sortRowsByAvgScoreDesc(rows);
  assignSkipTieRanks(sorted);
  return sorted;
}

export async function buildSettlementRows(
  jointOnly: boolean,
  committeeConfig?: SettlementCommitteeConfig,
): Promise<SettlementRow[]> {
  const config = committeeConfig ?? (await loadSettlementCommitteeConfig());
  const context = await createSettlementBuildContext(config);
  return buildSettlementRowsFromContext(context, jointOnly);
}

export async function loadSettlementRowsForExport(committeeConfig?: SettlementCommitteeConfig) {
  const config = committeeConfig ?? (await loadSettlementCommitteeConfig());
  const context = await createSettlementBuildContext(config);
  return {
    standardRows: buildSettlementRowsFromContext(context, false),
    jointRows: buildSettlementRowsFromContext(context, true),
  };
}

export async function loadSettlementPageData() {
  const committeeConfig = await loadSettlementCommitteeConfig();
  const { listReviewerOptionsForSettlement } = await import("@/lib/settlementConfig");
  const [context, reviewerOptions] = await Promise.all([
    createSettlementBuildContext(committeeConfig),
    listReviewerOptionsForSettlement(),
  ]);

  return {
    standardRows: buildSettlementRowsFromContext(context, false),
    jointRows: buildSettlementRowsFromContext(context, true),
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
