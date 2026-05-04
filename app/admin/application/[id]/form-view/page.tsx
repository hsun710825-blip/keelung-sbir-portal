"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { AdminReadOnlyApplicationTabs } from "@/components/admin/AdminReadOnlyApplicationTabs";

type DraftViewResponse =
  | { ok: true; draft: Record<string, unknown> | null; reason?: string | null }
  | { ok: false; error: string };

export default function AdminApplicationFormViewPage() {
  const params = useParams();
  const id = String(params?.id || "").trim();
  const [data, setData] = useState<DraftViewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/applications/${encodeURIComponent(id)}/draft-view`, { credentials: "include" });
      const json = (await res.json()) as DraftViewResponse;
      setData(json);
    } catch {
      setData({ ok: false, error: "無法載入資料" });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">管理員唯讀預覽</p>
            <h1 className="mt-1 text-xl font-semibold">線上撰寫內容（不可編輯）</h1>
            <p className="mt-1 font-mono text-xs text-slate-500">案件 {id}</p>
          </div>
          <Link
            href={`/admin/application/${id}`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            返回案件詳情
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600">載入中…</p>
        ) : !data ? (
          <p className="text-sm text-slate-600">無資料</p>
        ) : !data.ok ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{data.error}</p>
        ) : data.reason === "UPLOAD_MODE" ? (
          <p className="text-sm text-slate-700">此件為自行上傳模式，無線上草稿。</p>
        ) : data.reason === "NO_DRAFT_FILE" || !data.draft ? (
          <p className="text-sm text-slate-700">找不到線上草稿檔（可能尚未儲存過）。</p>
        ) : (
          <AdminReadOnlyApplicationTabs draft={data.draft} />
        )}
      </div>
    </main>
  );
}
