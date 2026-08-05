/**
 * 產出「115年受補助廠商」Excel
 *
 * 納入條件：
 * - 決算清表「建議補助」> 0，或
 * - 核定計畫一覽表有核定補助金額
 * 聯合廠商分列；金額優先採核定一覽表各廠商列（元）。
 *
 * Usage:
 *   npx tsx --env-file=.env --env-file=.env.local scripts/export-subsidized-vendors-115.ts
 *   npx tsx --env-file=.env --env-file=.env.local scripts/export-subsidized-vendors-115.ts --out="D:\\path\\file.xlsx"
 *   … --approved-only   # 僅核定一覽表廠商（不含僅有決算建議補助者）
 */

import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

import { pickRegistryFieldsFromFormData } from "../app/api/_registrySheet";
import { normalizeCompanyDisplayName } from "../lib/companyNameNormalize";
import { prisma } from "../lib/prisma";
import {
  extractFormDataFromDraftPayload,
  resolveApplicationDisplayFieldsBatch,
} from "../lib/resolveApplicationDisplayFields";
import { resolveOnlineDraftViewPayload } from "../lib/adminOnlineDraftResolve";
import {
  getReviewMeetingConfig,
  REVIEW_MEETING_DATES,
} from "../lib/reviewMeetingAgenda";
import { loadSettlementRowsForExport, type SettlementRow } from "../lib/settlementTable";
import {
  resolveJointSheetCompanyTargets,
} from "../lib/youthId/jointMapping";
import {
  normalizeYouthCompanyCore,
  youthCompanyCoreMatch,
} from "../lib/youthId/companyMatch";

const DEFAULT_OUT_DIR = "C:\\恂\\02-業務\\05-115\\02-115基隆市SBIR";
const DEFAULT_OUT_NAME = "115年受補助廠商.xlsx";
const APPROVED_LIST_PATH =
  "C:\\恂\\02-業務\\05-115\\02-115基隆市SBIR\\115徵件\\115核定計畫一覽表-0716調整後.xlsx";
const CONTACT_XLSX_PATH =
  "C:\\恂\\02-業務\\05-115\\02-115基隆市SBIR\\廠商聯絡資訊V3.xlsx";

const HEADERS = [
  "公司名稱",
  "計畫主持人",
  "公司地址",
  "公司電話",
  "補助款",
  "廠商自籌款",
  "計畫名稱",
] as const;

type ApprovedEntry = {
  companyName: string;
  planTitle: string;
  subsidy: number; // 元
  selfFund: number; // 元
};

type ContactEntry = {
  companyName: string;
  zip: string;
  address: string;
};

type AgendaPi = {
  companyName: string;
  pi: string;
  project: string;
};

type DraftContact = {
  companyName: string;
  planHost: string;
  phone: string;
  address: string;
};

type OutputRow = {
  companyName: string;
  projectManager: string;
  address: string;
  phone: string;
  subsidy: number | "";
  selfFund: number | "";
  planTitle: string;
  sortKey: string;
};

function parseArgValue(flag: string): string | null {
  const prefix = `${flag}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : null;
}

function stripParens(name: string): string {
  return String(name || "")
    .replace(/\s*[\(（].*?[\)）]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCompanyName(name: string): string {
  return normalizeCompanyDisplayName(stripParens(name));
}

function loadApprovedList(filePath: string): ApprovedEntry[] {
  if (!fs.existsSync(filePath)) {
    console.warn("核定一覽表不存在，略過：", filePath);
    return [];
  }
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const entries: ApprovedEntry[] = [];

  for (const row of rows) {
    const idx = row?.[0];
    if (typeof idx !== "number") continue;
    const companyName = cleanCompanyName(String(row[1] || ""));
    if (!companyName) continue;
    const planTitle = String(row[3] || "").trim();
    const moe = Number(row[6]) || 0;
    const city = Number(row[7]) || 0;
    const subsidy = Math.round(moe + city);
    const selfFund = Math.round(Number(row[9]) || 0);
    if (subsidy <= 0 && selfFund <= 0) continue;
    entries.push({ companyName, planTitle, subsidy, selfFund });
  }
  return entries;
}

function loadContactBook(filePath: string): ContactEntry[] {
  if (!fs.existsSync(filePath)) {
    console.warn("聯絡資訊檔不存在，略過：", filePath);
    return [];
  }
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const out: ContactEntry[] = [];
  for (const row of rows.slice(1)) {
    const companyName = cleanCompanyName(String(row?.[1] || ""));
    if (!companyName) continue;
    out.push({
      companyName,
      zip: String(row?.[5] || "").trim(),
      address: String(row?.[6] || "").trim(),
    });
  }
  return out;
}

function loadAgendaPiList(): AgendaPi[] {
  const out: AgendaPi[] = [];
  for (const meetingDate of REVIEW_MEETING_DATES) {
    const config = getReviewMeetingConfig(meetingDate);
    for (const c of config.cases) {
      const companyName = cleanCompanyName(String(c.company || ""));
      if (!companyName) continue;
      out.push({
        companyName,
        pi: String((c as { pi?: string }).pi || "").trim(),
        project: String(c.project || "").trim(),
      });
      // 聯合案若公司欄含「/」也拆出第二家（主持人同列主提案）
      const parts = companyName.split("/").map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        for (const part of parts) {
          if (!out.some((x) => youthCompanyCoreMatch(x.companyName, part))) {
            out.push({
              companyName: cleanCompanyName(part),
              pi: String((c as { pi?: string }).pi || "").trim(),
              project: String(c.project || "").trim(),
            });
          }
        }
      }
    }
  }
  return out;
}

function findByCompanyName<T extends { companyName: string }>(
  list: T[],
  companyName: string,
): T | null {
  for (const item of list) {
    if (youthCompanyCoreMatch(item.companyName, companyName)) return item;
  }
  return null;
}

function formatAddress(zip: string, address: string): string {
  const addr = String(address || "").trim();
  if (!addr) return "";
  const z = String(zip || "").trim();
  if (!z) return addr;
  if (addr.startsWith(z)) return addr;
  return `${z} ${addr}`.trim();
}

function preferPhone(...candidates: Array<string | null | undefined>): string {
  for (const c of candidates) {
    const v = String(c || "").trim();
    if (v) return v;
  }
  return "";
}

function settleAmountToNtd(thousand: number | null | undefined): number | "" {
  if (thousand == null || !Number.isFinite(thousand) || thousand <= 0) return "";
  return Math.round(thousand * 1000);
}

async function loadDraftContacts(
  settlementRows: SettlementRow[],
): Promise<Map<string, DraftContact>> {
  const byId = new Map<string, DraftContact>();
  const apps = await prisma.application.findMany({
    where: { id: { in: settlementRows.map((r) => r.applicationId) } },
    select: {
      id: true,
      submissionMode: true,
      description: true,
      displayCompanyName: true,
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

  for (const app of apps) {
    const displayName =
      displayMap.get(app.id)?.companyName ||
      cleanCompanyName(app.displayCompanyName || "");
    let planHost = "";
    let phone = "";
    let address = "";

    try {
      const draft = await resolveOnlineDraftViewPayload(app.id);
      if (draft.kind === "ok") {
        const fd = extractFormDataFromDraftPayload(draft.draft);
        const reg = pickRegistryFieldsFromFormData(fd);
        const cp =
          (fd.companyProfile as { formData?: Record<string, unknown> } | undefined)
            ?.formData || {};
        planHost =
          String(fd.projectManager || "").trim() ||
          reg.planHost ||
          reg.responsiblePerson ||
          "";
        phone = preferPhone(
          String(cp.phone || ""),
          String(cp.mobilePhone || ""),
          reg.phone,
        );
        address =
          String(cp.mailingAddress || "").trim() ||
          String(cp.registeredAddress || "").trim() ||
          "";
      }
    } catch (e) {
      console.warn(
        `[draft] ${app.id} failed:`,
        e instanceof Error ? e.message : e,
      );
    }

    byId.set(app.id, {
      companyName: displayName,
      planHost,
      phone,
      address,
    });
  }
  return byId;
}

function expandSettlementCompanies(row: SettlementRow): string[] {
  const targets = resolveJointSheetCompanyTargets(
    row.companyName,
    row.title,
    row.isJoint,
  );
  return targets.map((n) => cleanCompanyName(n)).filter(Boolean);
}

function buildOutputRows(input: {
  settlementRows: SettlementRow[];
  approved: ApprovedEntry[];
  contacts: ContactEntry[];
  agendaPi: AgendaPi[];
  draftsByAppId: Map<string, DraftContact>;
  includeSettlementOnly: boolean;
}): OutputRow[] {
  const {
    settlementRows,
    approved,
    contacts,
    agendaPi,
    draftsByAppId,
    includeSettlementOnly,
  } = input;
  const byCompany = new Map<string, OutputRow>();

  const upsert = (row: OutputRow) => {
    const key = normalizeYouthCompanyCore(row.companyName);
    if (!key) return;
    const existing = byCompany.get(key);
    if (!existing) {
      byCompany.set(key, row);
      return;
    }
    if (typeof row.subsidy === "number" && row.subsidy > 0) existing.subsidy = row.subsidy;
    if (typeof row.selfFund === "number" && row.selfFund > 0) {
      existing.selfFund = row.selfFund;
    }
    if (!existing.projectManager && row.projectManager) {
      existing.projectManager = row.projectManager;
    }
    if (!existing.address && row.address) existing.address = row.address;
    if (!existing.phone && row.phone) existing.phone = row.phone;
    if (row.planTitle) existing.planTitle = row.planTitle;
    if (row.companyName.length > existing.companyName.length) {
      existing.companyName = row.companyName;
    }
    // 保留核定一覽表原始排序鍵
  };

  // 1) 核定一覽表（受補助主名單；聯合已分列）
  for (const [idx, entry] of approved.entries()) {
    const contact = findByCompanyName(contacts, entry.companyName);
    const piHit = findByCompanyName(agendaPi, entry.companyName);
    upsert({
      companyName: entry.companyName,
      projectManager: piHit?.pi || "",
      address: formatAddress(contact?.zip || "", contact?.address || ""),
      phone: "",
      subsidy: entry.subsidy > 0 ? entry.subsidy : "",
      selfFund: entry.selfFund > 0 ? entry.selfFund : "",
      planTitle: entry.planTitle || piHit?.project || "",
      sortKey: `a:${String(idx + 1).padStart(2, "0")}`,
    });
  }

  // 2) 決算清表建議補助：補電話／主持人／校對；可選納入僅決算有金額者
  for (const row of settlementRows) {
    if (row.suggestedSubsidy == null || row.suggestedSubsidy <= 0) continue;
    const companies = expandSettlementCompanies(row);
    const draft = draftsByAppId.get(row.applicationId);
    const settleSubsidy = settleAmountToNtd(row.suggestedSubsidy);
    const settleSelf = settleAmountToNtd(row.suggestedSelfFund);

    for (let i = 0; i < companies.length; i++) {
      const companyName = companies[i];
      const key = normalizeYouthCompanyCore(companyName);
      const inApproved = Boolean(findByCompanyName(approved, companyName));
      if (!inApproved && !includeSettlementOnly) continue;

      const approvedHit = findByCompanyName(approved, companyName);
      const contact = findByCompanyName(contacts, companyName);
      const piHit = findByCompanyName(agendaPi, companyName);

      let subsidy: number | "" = "";
      let selfFund: number | "" = "";
      if (approvedHit && approvedHit.subsidy > 0) {
        subsidy = approvedHit.subsidy;
        selfFund = approvedHit.selfFund > 0 ? approvedHit.selfFund : "";
      } else if (companies.length === 1 || i === 0) {
        subsidy = settleSubsidy;
        selfFund = settleSelf;
      }

      upsert({
        companyName,
        projectManager: piHit?.pi || (i === 0 ? draft?.planHost || "" : "") || "",
        address:
          formatAddress(contact?.zip || "", contact?.address || "") ||
          (i === 0 ? draft?.address || "" : ""),
        phone: i === 0 ? preferPhone(draft?.phone) : "",
        subsidy,
        selfFund,
        planTitle: approvedHit?.planTitle || row.title || piHit?.project || "",
        // 已在核定名單者沿用核定排序（upsert 不覆蓋 sortKey）
        sortKey: `s:${row.reviewMeetingDate}:${String(row.agendaOrder).padStart(2, "0")}:${i}`,
      });
    }
  }

  for (const row of byCompany.values()) {
    if (!row.address) {
      const contact = findByCompanyName(contacts, row.companyName);
      if (contact) row.address = formatAddress(contact.zip, contact.address);
    }
    if (!row.projectManager) {
      const piHit = findByCompanyName(agendaPi, row.companyName);
      if (piHit?.pi) row.projectManager = piHit.pi;
    }
  }

  return [...byCompany.values()].sort((a, b) =>
    a.sortKey.localeCompare(b.sortKey, "zh-Hant"),
  );
}

function writeWorkbook(rows: OutputRow[], outPath: string) {
  const sheetRows: Array<Array<string | number>> = [
    ["115年受補助廠商名單"],
    [...HEADERS],
    ...rows.map((r) => [
      r.companyName,
      r.projectManager,
      r.address,
      r.phone,
      r.subsidy,
      r.selfFund,
      r.planTitle,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  ws["!cols"] = [
    { wch: 28 },
    { wch: 14 },
    { wch: 42 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 48 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "115年受補助廠商");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  XLSX.writeFile(wb, outPath);
}

async function main() {
  const outOverride = parseArgValue("--out");
  const approvedOnly = process.argv.includes("--approved-only");
  const includeSettlementOnly = !approvedOnly;
  const outPath =
    outOverride || path.join(DEFAULT_OUT_DIR, DEFAULT_OUT_NAME);

  console.log("Loading settlement rows…");
  const { combinedRows } = await loadSettlementRowsForExport();
  const fundedSettlement = combinedRows.filter(
    (r) => r.suggestedSubsidy != null && r.suggestedSubsidy > 0,
  );
  console.log(
    `Settlement: ${combinedRows.length} rows, funded(suggested>0): ${fundedSettlement.length}`,
  );

  console.log("Loading 核定一覽表 / 聯絡資訊 / 議程主持人…");
  const approved = loadApprovedList(APPROVED_LIST_PATH);
  const contacts = loadContactBook(CONTACT_XLSX_PATH);
  const agendaPi = loadAgendaPiList();
  console.log(
    `Approved: ${approved.length}, contacts: ${contacts.length}, agendaPi: ${agendaPi.length}`,
  );
  console.log(
    approvedOnly
      ? "mode: --approved-only（僅核定一覽表）"
      : "mode: 決算建議補助 ∪ 核定一覽表",
  );

  console.log("Loading draft contacts from Drive…");
  const draftsByAppId = await loadDraftContacts(fundedSettlement);

  const rows = buildOutputRows({
    settlementRows: fundedSettlement,
    approved,
    contacts,
    agendaPi,
    draftsByAppId,
    includeSettlementOnly,
  });

  const filtered = rows.filter(
    (r) =>
      (typeof r.subsidy === "number" && r.subsidy > 0) ||
      (typeof r.selfFund === "number" && r.selfFund > 0),
  );

  writeWorkbook(filtered, outPath);
  console.log(`Wrote ${filtered.length} rows → ${outPath}`);
  for (const r of filtered) {
    console.log(
      `- ${r.companyName} | PI=${r.projectManager || "—"} | 補助=${r.subsidy || "—"} | 自籌=${r.selfFund || "—"}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
