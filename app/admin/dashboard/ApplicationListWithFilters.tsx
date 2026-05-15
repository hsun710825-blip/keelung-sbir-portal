"use client";

import { useMemo, useState } from "react";

import { AdminApplicationsTable, type AdminApplicationTableRow } from "@/components/admin/AdminApplicationsTable";
import { normalizePlanTitleForDedupe } from "@/lib/applicationDedupeKey";

const ASIA_TAIPEI = "Asia/Taipei";

function csvEscapeCell(v: string): string {
  const s = String(v ?? "");
  const safe = /^[=+\-@]/.test(s) ? `\t${s}` : s;
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, "\"\"")}"`;
  return safe;
}

function formatExportUpdatedAt(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ASIA_TAIPEI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const pick = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")}`;
}

function deriveCompanyFromApplicantLabel(label: string, email: string): string {
  const parts = label
    .split(" · ")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2 && parts[parts.length - 1].toLowerCase() === email.toLowerCase()) {
    return parts.slice(0, -1).join(" · ") || "—";
  }
  return parts[0] || "—";
}

function buildExportRecord(row: AdminApplicationTableRow) {
  const email = row.applicantEmail.trim() || "—";
  const derivedCompany = deriveCompanyFromApplicantLabel(row.applicantLabel, email);
  return {
    email,
    planTitle: row.planTitleRaw.trim() || row.titleText,
    companyName: row.exportCompanyName?.trim() || derivedCompany,
    contactPerson: row.exportContactPerson?.trim() || "—",
    contactPhone: row.exportContactPhone?.trim() || "—",
    submissionMode: row.submissionMode,
    status: row.status,
    updatedAt: formatExportUpdatedAt(row.updatedAtMs),
  };
}

function exportFilteredRowsToCsv(rows: AdminApplicationTableRow[]) {
  const headers = [
    "申請帳號 (Email)",
    "計畫名稱",
    "公司名稱",
    "聯絡人",
    "聯絡電話",
    "送件方式",
    "送件狀態",
    "最後更新時間",
  ];
  const lines = [
    headers.map(csvEscapeCell).join(","),
    ...rows.map((r) => {
      const rec = buildExportRecord(r);
      return [
        rec.email,
        rec.planTitle,
        rec.companyName,
        rec.contactPerson,
        rec.contactPhone,
        rec.submissionMode,
        rec.status,
        rec.updatedAt,
      ]
        .map(csvEscapeCell)
        .join(",");
    }),
  ];
  const csv = `\ufeff${lines.join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  a.href = url;
  a.download = `115基隆SBIR_提案清單_${yyyy}${mm}${dd}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type StatusFilter = "ALL" | "DRAFT" | "SUBMITTED";
type ModeFilter = "ALL" | "ONLINE" | "UPLOAD";

function isNewer(a: AdminApplicationTableRow, b: AdminApplicationTableRow): boolean {
  if (a.updatedAtMs !== b.updatedAtMs) return a.updatedAtMs > b.updatedAtMs;
  return a.createdAtMs >= b.createdAtMs;
}

function dedupeByApplicantAndTitle(rows: AdminApplicationTableRow[]): AdminApplicationTableRow[] {
  const map = new Map<string, AdminApplicationTableRow>();
  for (const r of rows) {
    if (r.isBlankPlanTitle) {
      map.set(`unnamed\t${r.id}`, r);
      continue;
    }
    const email = (r.applicantEmail ?? "").trim().toLowerCase();
    const title = normalizePlanTitleForDedupe(r.planTitleRaw);
    const key = `${email}\t${title}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, r);
      continue;
    }
    if (isNewer(r, prev)) map.set(key, r);
  }
  return Array.from(map.values()).sort((a, b) => b.updatedAtMs - a.updatedAtMs || b.createdAtMs - a.createdAtMs);
}

export function ApplicationListWithFilters({
  rows,
  isAdmin,
  searchQuery,
  canExportList = true,
}: {
  rows: AdminApplicationTableRow[];
  isAdmin: boolean;
  searchQuery: string;
  /** 管理員／市府等可檢視列表者；預設顯示匯出按鈕 */
  canExportList?: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("ALL");

  const dedupedRows = useMemo(() => dedupeByApplicantAndTitle(rows), [rows]);

  const filteredRows = useMemo(() => {
    let out = dedupedRows;
    if (statusFilter !== "ALL") {
      out = out.filter((r) => r.status === statusFilter);
    }
    if (modeFilter !== "ALL") {
      out = out.filter((r) => r.submissionMode === modeFilter);
    }
    return out;
  }, [dedupedRows, statusFilter, modeFilter]);

  const namedEffectiveCount = useMemo(() => dedupedRows.filter((r) => !r.isBlankPlanTitle).length, [dedupedRows]);
  const unnamedDraftCount = useMemo(
    () => dedupedRows.filter((r) => r.isBlankPlanTitle && r.status === "DRAFT").length,
    [dedupedRows],
  );

  const emptyStateMessage =
    filteredRows.length === 0 && dedupedRows.length > 0
      ? "沒有符合目前篩選條件的案件，請調整篩選條件。"
      : undefined;

  return (
    <>
      <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              送件狀態
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="min-w-[11rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">全部</option>
                <option value="DRAFT">草稿中（DRAFT）</option>
                <option value="SUBMITTED">已送出（SUBMITTED）</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              送件方式
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value as ModeFilter)}
                className="min-w-[12rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">全部</option>
                <option value="ONLINE">系統線上撰寫（ONLINE）</option>
                <option value="UPLOAD">自行上傳 PDF（UPLOAD）</option>
              </select>
            </label>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end" aria-live="polite">
            {canExportList ? (
              <button
                type="button"
                onClick={() => exportFilteredRowsToCsv(filteredRows)}
                disabled={filteredRows.length === 0}
                className="inline-flex rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-950 shadow-sm hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                📥 匯出列表資料 (Excel/CSV)
              </button>
            ) : null}
            <div className="text-sm font-medium text-slate-700">
              <p>
                目前列表顯示件數：<span className="tabular-nums text-slate-900">{filteredRows.length}</span> 件
              </p>
              <p className="mt-1 text-xs text-slate-600">
                排重後有效件數：<span className="tabular-nums font-semibold text-slate-900">{namedEffectiveCount}</span> 件
                <span className="mx-2 text-slate-300">|</span>
                未命名草稿：<span className="tabular-nums font-semibold text-slate-900">{unnamedDraftCount}</span> 件
              </p>
            </div>
          </div>
        </div>
      </div>

      <AdminApplicationsTable
        rows={filteredRows}
        isAdmin={isAdmin}
        searchQuery={searchQuery}
        emptyStateMessage={emptyStateMessage}
      />
    </>
  );
}
