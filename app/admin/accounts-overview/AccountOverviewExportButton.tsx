"use client";

import type { AccountOverviewRow } from "@/app/admin/accounts-overview/types";

function csvEscapeCell(v: string): string {
  const s = String(v ?? "");
  const safe = /^[=+\-@]/.test(s) ? `\t${s}` : s;
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, "\"\"")}"`;
  return safe;
}

function toCsv(rows: AccountOverviewRow[]): string {
  const headers = ["最後操作時間", "帳號 (Email)", "計畫名稱", "公司名稱", "聯絡人", "連絡電話"];
  const lines = [
    headers.map(csvEscapeCell).join(","),
    ...rows.map((r) =>
      [r.lastOpAtLabel, r.email, r.planTitle, r.companyName, r.contactPerson, r.contactPhone]
        .map(csvEscapeCell)
        .join(","),
    ),
  ];
  return `\ufeff${lines.join("\r\n")}`;
}

export function AccountOverviewExportButton({ rows }: { rows: AccountOverviewRow[] }) {
  const onExport = () => {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    a.href = url;
    a.download = `帳號與案件總覽_${yyyy}${mm}${dd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={onExport}
      disabled={rows.length === 0}
      className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 shadow-sm hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      📥 匯出為 Excel（CSV）
    </button>
  );
}
