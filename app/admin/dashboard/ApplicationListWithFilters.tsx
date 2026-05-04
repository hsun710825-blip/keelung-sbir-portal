"use client";

import { useMemo, useState } from "react";

import { AdminApplicationsTable, type AdminApplicationTableRow } from "@/components/admin/AdminApplicationsTable";
import { normalizePlanTitleForDedupe } from "@/lib/applicationDedupeKey";

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
}: {
  rows: AdminApplicationTableRow[];
  isAdmin: boolean;
  searchQuery: string;
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
          <div className="text-sm font-medium text-slate-700" aria-live="polite">
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

      <AdminApplicationsTable
        rows={filteredRows}
        isAdmin={isAdmin}
        searchQuery={searchQuery}
        emptyStateMessage={emptyStateMessage}
      />
    </>
  );
}
