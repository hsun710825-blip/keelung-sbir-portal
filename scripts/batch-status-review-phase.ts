/**
 * 批次調整申請狀態（不發信）：
 * 1. Excel 決算清表名單內且為 IMPORTANT_NOTICE → COMMITTEE_REVIEW
 * 2. 馬頭報飯館、有炬、超寶 → REJECTED
 *
 * 用法：
 *   npx tsx --env-file=.env --env-file=.env.local scripts/batch-status-review-phase.ts --dry-run
 *   npx tsx --env-file=.env --env-file=.env.local scripts/batch-status-review-phase.ts --apply
 */
import { ApplicationStatus } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";

import { normalizeCompanyDisplayName, normalizeCompanyForMatch } from "../lib/companyNameNormalize";
import { prisma } from "../lib/prisma";
import { resolveApplicationDisplayFieldsBatch } from "../lib/resolveApplicationDisplayFields";

const EXCEL_PATH =
  process.env.BATCH_STATUS_EXCEL_PATH?.trim() ||
  String.raw`c:\恂\02-業務\05-115\02-115基隆市SBIR\115徵件\115SBIR審查評分補助結果.xlsx`;

const REJECT_COMPANY_HINTS = ["馬頭報飯館", "馬頭", "有炬", "超寶"];

function normalizeCore(name: string): string {
  return normalizeCompanyForMatch(name)
    .replace(/股份有限公司|有限公司|事業有限公司|企業有限公司|企業社|工作室|工作坊|咖啡店|專賣店|設計屋|食品行/g, "")
    .replace(/服務業/g, "服務");
}

function companyMatch(a: string, b: string): boolean {
  const ca = normalizeCore(a);
  const cb = normalizeCore(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  const shorter = ca.length <= cb.length ? ca : cb;
  const longer = ca.length > cb.length ? ca : cb;
  return shorter.length >= 2 && longer.includes(shorter);
}

function readExcelCompanies(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel not found: ${filePath}`);
  }
  const wb = XLSX.readFile(filePath);
  const names = new Set<string>();
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
    });
    let companyCol = -1;
    for (const row of rows) {
      const cells = (row || []).map((c) => String(c ?? "").trim());
      const headerIdx = cells.findIndex((c) => c === "申請單位");
      if (headerIdx >= 0) {
        companyCol = headerIdx;
        continue;
      }
      if (companyCol < 0) continue;
      const name = cells[companyCol]?.trim();
      if (!name || name === "申請單位") continue;
      if (/合計|備註|決算/.test(name)) continue;
      names.add(normalizeCompanyDisplayName(name));
    }
  }
  return [...names].filter(Boolean).sort();
}

function matchesRejectHint(companyName: string): boolean {
  const core = normalizeCore(companyName);
  return REJECT_COMPANY_HINTS.some((hint) => core.includes(normalizeCore(hint)) || companyMatch(companyName, hint));
}

function isOnExcelList(companyName: string, excelCompanies: string[]): boolean {
  return excelCompanies.some((ex) => companyMatch(companyName, ex));
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply || process.argv.includes("--dry-run");

  console.log("MODE:", apply && !process.argv.includes("--dry-run") ? "APPLY" : "DRY-RUN");
  console.log("EXCEL:", EXCEL_PATH);

  const excelCompanies = readExcelCompanies(EXCEL_PATH);
  console.log("EXCEL_COMPANIES:", excelCompanies.length);
  excelCompanies.forEach((n) => console.log("  -", n));

  const apps = await prisma.application.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      displayCompanyName: true,
      description: true,
      submissionMode: true,
      applicant: { select: { email: true, name: true } },
    },
  });

  const displayMap = await resolveApplicationDisplayFieldsBatch(
    apps.map((a) => ({ id: a.id, submissionMode: a.submissionMode, description: a.description })),
  );

  type Row = {
    id: string;
    companyName: string;
    title: string;
    status: ApplicationStatus;
    email: string;
    onExcel: boolean;
    rejectTarget: boolean;
    nextStatus: ApplicationStatus | null;
    reason: string;
  };

  const rows: Row[] = apps.map((app) => {
    const companyName =
      normalizeCompanyDisplayName(app.displayCompanyName) ||
      normalizeCompanyDisplayName(displayMap.get(app.id)?.companyName) ||
      "—";
    const onExcel = companyName !== "—" && isOnExcelList(companyName, excelCompanies);
    const rejectTarget = companyName !== "—" && matchesRejectHint(companyName);

    let nextStatus: ApplicationStatus | null = null;
    let reason = "";

    if (rejectTarget) {
      if (app.status !== ApplicationStatus.REJECTED) {
        nextStatus = ApplicationStatus.REJECTED;
        reason = "未進複審（Excel 無此家）";
      }
    } else if (onExcel && app.status === ApplicationStatus.IMPORTANT_NOTICE) {
      nextStatus = ApplicationStatus.COMMITTEE_REVIEW;
      reason = "Excel 複審名單：IMPORTANT_NOTICE 改回 COMMITTEE_REVIEW";
    }

    return {
      id: app.id,
      companyName,
      title: app.title?.trim() || "（未命名）",
      status: app.status,
      email: app.applicant.email || "—",
      onExcel,
      rejectTarget,
      nextStatus,
      reason,
    };
  });

  const toChange = rows.filter((r) => r.nextStatus);
  const importantNoticeAll = rows.filter((r) => r.status === ApplicationStatus.IMPORTANT_NOTICE);
  const importantNotOnExcel = importantNoticeAll.filter((r) => !r.onExcel && !r.rejectTarget);
  const excelNotInDb = excelCompanies.filter((ex) => !rows.some((r) => companyMatch(r.companyName, ex)));

  console.log("\n=== IMPORTANT_NOTICE cases ===");
  for (const r of importantNoticeAll) {
    console.log(`  ${r.companyName} | ${r.status} | excel=${r.onExcel} | ${r.reason || "no change"}`);
  }

  console.log("\n=== REJECT targets ===");
  for (const r of rows.filter((r) => r.rejectTarget)) {
    console.log(`  ${r.companyName} | ${r.status} -> ${r.nextStatus ?? "unchanged"}`);
  }

  console.log("\n=== PLANNED CHANGES ===");
  for (const r of toChange) {
    console.log(`  ${r.companyName} | ${r.status} -> ${r.nextStatus} | ${r.reason}`);
  }
  console.log("CHANGE_COUNT:", toChange.length);

  if (importantNotOnExcel.length > 0) {
    console.log("\nWARN: IMPORTANT_NOTICE not on Excel (will NOT auto-change):");
    importantNotOnExcel.forEach((r) => console.log("  -", r.companyName, r.id));
  }
  if (excelNotInDb.length > 0) {
    console.log("\nWARN: Excel companies not matched in DB:");
    excelNotInDb.forEach((n) => console.log("  -", n));
  }

  if (dryRun) {
    console.log("\nDRY-RUN complete. Use --apply to execute.");
    return;
  }

  let changed = 0;
  for (const r of toChange) {
    if (!r.nextStatus) continue;
    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: r.id },
        data: { status: r.nextStatus! },
      });
      await tx.applicationStatusHistory.create({
        data: {
          applicationId: r.id,
          fromStatus: r.status,
          toStatus: r.nextStatus!,
          note: `[batch] ${r.reason}（不發信）`,
        },
      });
    });
    changed++;
  }

  console.log("\nAPPLIED:", changed, "applications updated (no emails sent).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
