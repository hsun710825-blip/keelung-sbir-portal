"use client";

import type { ApplicationStatus } from "@prisma/client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { bulkDeleteApplicationsAction } from "@/app/admin/dashboard/actions";
import { DeleteApplicationButton } from "@/components/admin/DeleteApplicationButton";

export type AdminApplicationTableRow = {
  id: string;
  titleText: string;
  /** DB 原始計畫名稱（空字串表示未命名） */
  planTitleRaw: string;
  isBlankPlanTitle: boolean;
  applicantLabel: string;
  updatedAtLabel: string;
  createdAtLabel: string | null;
  statusLabel: string;
  submissionMode: "ONLINE" | "UPLOAD";
  /** 雲端 PDF 預覽連結（無則 null） */
  pdfViewUrl: string | null;
  /** 後台篩選用（不顯示於儲存格） */
  status: ApplicationStatus;
  applicantEmail: string;
  updatedAtMs: number;
  createdAtMs: number;
};

export function AdminApplicationsTable({
  rows,
  isAdmin,
  searchQuery,
  emptyStateMessage,
}: {
  rows: AdminApplicationTableRow[];
  isAdmin: boolean;
  searchQuery: string;
  /** 有資料但篩選後為空時的提示（例如前端篩選無結果） */
  emptyStateMessage?: string;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [bulkError, setBulkError] = useState<string | null>(null);
  const allRef = useRef<HTMLInputElement | null>(null);

  const [pdfRegenRunning, setPdfRegenRunning] = useState(false);
  const [pdfRegenProgress, setPdfRegenProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [pdfRegenResults, setPdfRegenResults] = useState<Array<{ id: string; title: string; ok: boolean; error?: string }>>([]);

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const onlineIds = useMemo(() => rows.filter((r) => r.submissionMode === "ONLINE").map((r) => r.id), [rows]);
  const allOnlineSelected = onlineIds.length > 0 && onlineIds.every((id) => selectedIds.includes(id));
  const someOnlineSelected = onlineIds.some((id) => selectedIds.includes(id)) && !allOnlineSelected;

  const onlineSelectedCount = useMemo(
    () =>
      selectedIds.filter((id) => {
        const r = rows.find((x) => x.id === id);
        return r?.submissionMode === "ONLINE";
      }).length,
    [selectedIds, rows],
  );

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => allIds.includes(id)));
  }, [allIds]);

  useEffect(() => {
    if (allRef.current) {
      allRef.current.indeterminate = someOnlineSelected;
    }
  }, [someOnlineSelected]);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  /** 表頭核取：僅勾選／取消「線上撰寫 (ONLINE)」列（不影響自行上傳列）。 */
  const toggleSelectAllOnline = () => {
    if (allOnlineSelected) {
      setSelectedIds((prev) => prev.filter((id) => !onlineIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...onlineIds])]);
    }
  };

  const selectAllRowsForDelete = () => {
    setSelectedIds(allIds.length > 0 ? [...allIds] : []);
  };

  const runSequentialOnlinePdfRegenerate = async () => {
    const targets = selectedIds
      .map((id) => rows.find((r) => r.id === id))
      .filter((r): r is AdminApplicationTableRow => !!r && r.submissionMode === "ONLINE");
    if (targets.length === 0) {
      window.alert("請至少勾選一筆「線上撰寫（ONLINE）」案件；自行上傳模式不會被重製。");
      return;
    }
    const ok = window.confirm(
      `即將依序重製 ${targets.length} 筆線上撰寫案件之 PDF（逐一處理），並覆寫或寫入雲端計畫書檔。是否繼續？`,
    );
    if (!ok) return;

    setPdfRegenResults([]);
    setPdfRegenRunning(true);
    const results: Array<{ id: string; title: string; ok: boolean; error?: string }> = [];

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      setPdfRegenProgress({ current: i + 1, total: targets.length, label: t.titleText });
      let lastErr = "";
      let success = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch(`/api/admin/applications/${encodeURIComponent(t.id)}/regenerate-online-pdf`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
          if (res.ok && j.ok) {
            success = true;
            break;
          }
          lastErr = String(j.error || `HTTP ${res.status}`);
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
        }
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 600 * attempt));
        }
      }
      results.push({ id: t.id, title: t.titleText, ok: success, error: success ? undefined : lastErr || "失敗" });
      setPdfRegenResults([...results]);
    }

    setPdfRegenProgress(null);
    setPdfRegenRunning(false);
    router.refresh();
  };

  const bulkDelete = () => {
    if (!isAdmin || selectedIds.length === 0) return;
    const ok = window.confirm(`確定要刪除這 ${selectedIds.length} 筆計畫紀錄嗎？此動作無法復原！`);
    if (!ok) return;
    setBulkError(null);
    startTransition(async () => {
      const result = await bulkDeleteApplicationsAction(selectedIds);
      if (!result.ok) {
        setBulkError(result.error);
        return;
      }
      alert(`成功刪除 ${result.deletedCount} 筆資料`);
      setSelectedIds([]);
      router.refresh();
    });
  };

  return (
    <>
      {isAdmin ? (
        <div className="border-b border-slate-100 px-6 py-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={bulkDelete}
                disabled={pending || selectedIds.length === 0}
                className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {pending ? "刪除中..." : "🗑️ 刪除已選取計畫"}
              </button>
              <button
                type="button"
                onClick={selectAllRowsForDelete}
                disabled={pending || rows.length === 0}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                全選本頁（刪除用，含自行上傳）
              </button>
              <button
                type="button"
                onClick={runSequentialOnlinePdfRegenerate}
                disabled={pdfRegenRunning || onlineSelectedCount === 0}
                className="rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {pdfRegenRunning ? "重製中…" : "🔄 重製所選案件之 PDF"}
              </button>
              <span className="text-xs text-slate-500">
                已選取 {selectedIds.length} 筆（線上撰寫 {onlineSelectedCount} 筆可重製 PDF）
              </span>
              {bulkError ? <span className="text-xs text-rose-600">{bulkError}</span> : null}
            </div>
            <p className="text-xs text-slate-500">
              表頭核取方塊僅會勾選或取消「線上撰寫（ONLINE）」列；自行上傳（UPLOAD）不會被批次重製 PDF。
            </p>
            {pdfRegenProgress ? (
              <div
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-950"
                role="status"
                aria-live="polite"
              >
                正在重製 PDF：{pdfRegenProgress.current} / {pdfRegenProgress.total} 件…
                <span className="mt-1 block text-xs font-normal text-blue-900/90">目前：{pdfRegenProgress.label}</span>
              </div>
            ) : null}
            {pdfRegenResults.length > 0 && !pdfRegenRunning ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <p className="font-semibold text-slate-800">重製結果</p>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-slate-700">
                  {pdfRegenResults.map((r) => (
                    <li key={r.id}>
                      {r.ok ? (
                        <span className="text-emerald-800">✓ {r.title}</span>
                      ) : (
                        <span className="text-rose-700">
                          ✕ {r.title} — {r.error}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90">
              <th scope="col" className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <input
                  ref={allRef}
                  type="checkbox"
                  checked={allOnlineSelected}
                  onChange={toggleSelectAllOnline}
                  disabled={!isAdmin || onlineIds.length === 0}
                  aria-label="全選或取消全選線上撰寫（ONLINE）案件"
                  title="僅勾選／取消 線上撰寫（ONLINE）；不含自行上傳"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
              </th>
              <th scope="col" className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                計畫名稱
              </th>
              <th scope="col" className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                申請人／公司
              </th>
              <th scope="col" className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                最後更新／建立
              </th>
              <th scope="col" className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                目前狀態
              </th>
              <th scope="col" className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                送件方式
              </th>
              <th scope="col" className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                計畫書 PDF
              </th>
              <th scope="col" className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                  {emptyStateMessage
                    ? emptyStateMessage
                    : searchQuery
                      ? `沒有符合「${searchQuery}」的申請案。請改關鍵字或清除搜尋。`
                      : "尚無申請資料。請在資料庫建立測試資料後重新整理此頁。"}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={() => toggleOne(row.id)}
                      disabled={!isAdmin}
                      aria-label={`選取 ${row.titleText}`}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                  </td>
                  <td className="max-w-[220px] px-5 py-3.5 font-medium text-slate-900">
                    {isAdmin ? (
                      <Link
                        href={`/admin/application/${row.id}`}
                        className="line-clamp-2 text-blue-700 hover:text-blue-900 hover:underline"
                        title={row.titleText}
                      >
                        {row.titleText}
                      </Link>
                    ) : (
                      <span className="line-clamp-2" title={row.titleText}>
                        {row.titleText}
                      </span>
                    )}
                  </td>
                  <td className="max-w-[200px] px-5 py-3.5 text-slate-700">
                    <span className="line-clamp-2" title={row.applicantLabel}>
                      {row.applicantLabel}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 tabular-nums text-slate-600">
                    <div className="whitespace-nowrap font-medium text-slate-800">{row.updatedAtLabel}</div>
                    {row.createdAtLabel ? <div className="mt-0.5 whitespace-nowrap text-xs text-slate-400">建立 {row.createdAtLabel}</div> : null}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {row.submissionMode === "UPLOAD" ? (
                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        自行上傳
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                        線上撰寫
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {row.pdfViewUrl ? (
                      <a
                        href={row.pdfViewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-slate-50"
                      >
                        📄 檢視 PDF
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400" title="尚未產生或未寫入雲端連結">
                        尚未產生 PDF
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {isAdmin ? <DeleteApplicationButton applicationId={row.id} /> : <span className="text-xs text-slate-400">—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

