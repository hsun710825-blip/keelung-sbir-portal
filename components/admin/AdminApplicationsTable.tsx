"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { bulkDeleteApplicationsAction } from "@/app/admin/dashboard/actions";
import { DeleteApplicationButton } from "@/components/admin/DeleteApplicationButton";

export type AdminApplicationTableRow = {
  id: string;
  titleText: string;
  applicantLabel: string;
  updatedAtLabel: string;
  createdAtLabel: string | null;
  statusLabel: string;
};

export function AdminApplicationsTable({
  rows,
  isAdmin,
  searchQuery,
}: {
  rows: AdminApplicationTableRow[];
  isAdmin: boolean;
  searchQuery: string;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [bulkError, setBulkError] = useState<string | null>(null);
  const allRef = useRef<HTMLInputElement | null>(null);

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = allIds.length > 0 && selectedIds.length === allIds.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < allIds.length;

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => allIds.includes(id)));
  }, [allIds]);

  useEffect(() => {
    if (allRef.current) {
      allRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    setSelectedIds((prev) => (prev.length === allIds.length ? [] : [...allIds]));
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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={bulkDelete}
              disabled={pending || selectedIds.length === 0}
              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {pending ? "刪除中..." : "🗑️ 刪除已選取計畫"}
            </button>
            <span className="text-xs text-slate-500">已選取 {selectedIds.length} 筆</span>
            {bulkError ? <span className="text-xs text-rose-600">{bulkError}</span> : null}
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
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={!isAdmin || rows.length === 0}
                  aria-label="全選 / 取消全選"
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
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                  {searchQuery
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

