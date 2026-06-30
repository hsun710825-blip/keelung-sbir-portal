import { normalizePlanTitleForDedupe } from "@/lib/applicationDedupeKey";
import { normalizeCompanyDisplayName, normalizeCompanyForMatch } from "@/lib/companyNameNormalize";
import importData from "@/lib/data/settlementImport0624.json";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";
import { matchApplicationToAgenda } from "@/lib/matchApplicationToAgenda";
import { prisma } from "@/lib/prisma";
import { resolveApplicationDisplayFieldsBatch } from "@/lib/resolveApplicationDisplayFields";
import { roundFunding } from "@/lib/settlementFormulas";

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

function normalizeTitle(title: string): string {
  return normalizePlanTitleForDedupe(title);
}

function titleKeywords(text: string): string[] {
  const t = String(text || "").toLowerCase();
  const keys: string[] = [];
  if (t.includes("溺水")) keys.push("溺水");
  if (t.includes("ai")) keys.push("ai");
  if (t.includes("無人機")) keys.push("無人機");
  if (t.includes("港區")) keys.push("港區");
  return keys;
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

  const appCo = normalizeCompanyForMatch(app.companyName);
  const rowCo = normalizeCompanyForMatch(row.companyName);
  if (appCo && rowCo) {
    if (appCo === rowCo) score += 40;
    else if (appCo.includes(rowCo) || rowCo.includes(appCo)) score += 30;
  }

  const appKeys = titleKeywords(`${app.title || ""} ${app.companyName}`);
  const rowKeys = titleKeywords(`${row.planTitle} ${row.companyName}`);
  for (const k of rowKeys) {
    if (appKeys.includes(k)) score += 15;
  }

  if (rowCo.includes("浚研") && (appCo.includes("浚研") || appCo.includes("浚沿"))) {
    score += 25;
  }

  return score;
}

function roundRow(row: ImportRow): ImportRow {
  return {
    ...row,
    appliedSubsidy: roundFunding(row.appliedSubsidy),
    appliedSelfFund: roundFunding(row.appliedSelfFund),
    appliedTotal: roundFunding(row.appliedTotal),
    suggestedSubsidy: roundFunding(row.suggestedSubsidy),
    suggestedSelfFund: roundFunding(row.suggestedSelfFund),
    suggestedTotal: roundFunding(row.suggestedTotal),
  };
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

  const rows: ImportRow[] = [...importData.standard, ...importData.joint].map(roundRow);
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

    const fixedCompany = normalizeCompanyDisplayName(displayMap.get(app.id)?.companyName);

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
        ...(fixedCompany ? { displayCompanyName: fixedCompany } : {}),
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

/** 將 DB 中所有「浚沿」顯示名稱改為「浚研」 */
export async function fixJunYanCompanyNameTypos(): Promise<number> {
  const apps = await prisma.application.findMany({
    where: {
      OR: [
        { displayCompanyName: { contains: "浚沿" } },
        { description: { contains: "浚沿" } },
      ],
    },
    select: { id: true, displayCompanyName: true, description: true },
  });
  let count = 0;
  for (const app of apps) {
    const data: { displayCompanyName?: string; description?: string } = {};
    if (app.displayCompanyName?.includes("浚沿")) {
      data.displayCompanyName = app.displayCompanyName.replace(/浚沿/g, "浚研");
    }
    if (app.description?.includes("浚沿")) {
      data.description = app.description.replace(/浚沿/g, "浚研");
    }
    if (Object.keys(data).length > 0) {
      await prisma.application.update({ where: { id: app.id }, data });
      count += 1;
    }
  }
  return count;
}
