"use client";

import { useState } from "react";

type MigrateStats = {
  rowsRead: number;
  rowsSkipped: number;
  usersCreated: number;
  usersUpdated: number;
  applicationsUpserted: number;
  warnings: string[];
};

export function MigrateFromSheetsButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string | null>(null);

  const run = async () => {
    if (
      !window.confirm(
        "確定要從 Google「專案總表」執行一次性資料轉移？\n已存在的遷移列將以相同 id 覆寫更新（Upsert）。",
      )
    ) {
      return;
    }
    setLoading(true);
    setMessage(null);
    setError(null);
    setWarnings(null);
    try {
      const res = await fetch("/api/admin/migrate", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; stats?: MigrateStats; message?: string }
        | null;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const s = body.stats;
      if (s) {
        setMessage(
          `完成：讀取 ${s.rowsRead} 列，略過 ${s.rowsSkipped} 列；新增使用者 ${s.usersCreated}、更新使用者 ${s.usersUpdated}；申請案 Upsert ${s.applicationsUpserted} 筆。`,
        );
        if (s.warnings.length) {
          setWarnings(s.warnings.slice(0, 12).join("\n") + (s.warnings.length > 12 ? "\n…" : ""));
        }
      } else {
        setMessage(body.message || "完成");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "遷移失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-10 rounded-lg border border-dashed border-amber-300/80 bg-amber-50/40 p-4 text-sm text-slate-700">
      <p className="font-medium text-amber-900">一次性資料轉移（Sheets → Prisma）</p>
      <p className="mt-1 text-xs text-slate-600">
        僅 ADMIN 可執行。完成後請重新整理本頁確認列表；轉移完成可移除此區塊。
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={() => void run()}
        className="mt-3 rounded-md bg-amber-700 px-3 py-2 text-xs font-medium text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "執行中…" : "執行資料轉移"}
      </button>
      {message && <p className="mt-3 text-xs text-emerald-800 whitespace-pre-wrap">{message}</p>}
      {warnings && (
        <p className="mt-2 text-xs text-amber-900 whitespace-pre-wrap rounded border border-amber-200 bg-amber-50/80 p-2">
          {warnings}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-rose-700 whitespace-pre-wrap">{error}</p>}
    </div>
  );
}
