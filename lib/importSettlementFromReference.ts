import { normalizePlanTitleForDedupe } from "@/lib/applicationDedupeKey";
import { matchApplicationToAgenda } from "@/lib/matchApplicationToAgenda";
import importData from "@/lib/data/settlementImport0624.json";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";
import { prisma } from "@/lib/prisma";
import { resolveApplicationDisplayFieldsBatch } from "@/lib/resolveApplicationDisplayFields";

type ImportRow = {
  briefingOrder: string;
  companyName: string;
  planTitle: string;
  appliedSubsidy: number | null;
  appliedSelfFund: number | null;
  appliedTotal: number | null;
  suggestedSubsidy: number | null;
  suggestedSelfFund: number | null;
  suggestedTotal: number | null;
  tierRate: number | null;
  isJoint: boolean;
};

function normalizeCompany(name: string): string {
  return String(name || "")
    .replace(/\(主提案\)/g, "")
    .split("/")[0]
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function normalizeTitle(title: string): string {
  return normalizePlanTitleForDedupe(title);
}

function scoreMatch(
  app: { title: string | null; companyName: string },
  row: ImportRow,
): number {
  let score = 0;
  const appTitle = normalizeTitle(app.title || "");
  const rowTitle = normalizeTitle(row.planTitle);
  if (appTitle && rowTitle) {
    if (appTitle === rowTitle) score += 100;
    else if (appTitle.includes(rowTitle) || rowTitle.includes(appTitle)) score += 70;
  }
  const appCo = normalizeCompany(app.companyName);
  const rowCo = normalizeCompany(row.companyName);
  if (appCo && rowCo && (appCo.includes(rowCo) || rowCo.includes(appCo))) score += 30;
  return score;
}

export async function importSettlementFromReferenceJson(): Promise<{
  matched: number;
  unmatched: string[];
}> {
  await ensureEvaluationSchema();

  const apps = await prisma.application.findMany({
    where: { status: { not: "DRAFT" } },
    select: {
      id: true,
      title: true,
      description: true,
      submissionMode: true,
      displayCompanyName: true,
      reviewProposalType: true,
    },
  });

  const displayMap = await resolveApplicationDisplayFieldsBatch(
    apps.map((a) => ({
      id: a.id,
      submissionMode: a.submissionMode,
      description: a.description,
      displayCompanyName: a.displayCompanyName,
    })),
  );

  const rows: ImportRow[] = [...importData.standard, ...importData.joint];
  let matched = 0;
  const unmatched: string[] = [];
  const usedIds = new Set<string>();

  for (const row of rows) {
    let best: { id: string; score: number } | null = null;
    for (const app of apps) {
      if (usedIds.has(app.id)) continue;
      const companyName = displayMap.get(app.id)?.companyName || "";
      const s = scoreMatch({ title: app.title, companyName }, row);
      if (!best || s > best.score) best = { id: app.id, score: s };
    }
    if (!best || best.score < 50) {
      unmatched.push(`${row.companyName}｜${row.planTitle}`);
      continue;
    }

    const app = apps.find((a) => a.id === best!.id)!;
    const agenda = matchApplicationToAgenda({
      title: app.title,
      companyName: displayMap.get(app.id)?.companyName,
    });

    await prisma.application.update({
      where: { id: app.id },
      data: {
        settlementAppliedSubsidy: row.appliedSubsidy,
        settlementAppliedSelfFund: row.appliedSelfFund,
        settlementAppliedTotal: row.appliedTotal,
        settlementSuggestedSubsidy: row.suggestedSubsidy,
        settlementSuggestedSelfFund: row.suggestedSelfFund,
        settlementSuggestedTotal: row.suggestedTotal,
        settlementSubsidyTierRate: row.tierRate,
        reviewProposalType: row.isJoint ? "JOINT" : "STANDARD",
        ...(agenda
          ? {
              reviewMeetingDate: agenda.meetingDate,
              reviewAgendaOrder: agenda.order,
            }
          : {}),
      },
    });
    usedIds.add(app.id);
    matched += 1;
  }

  return { matched, unmatched };
}
