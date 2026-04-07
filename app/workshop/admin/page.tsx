"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteField, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";
import { workshopDb } from "@/lib/firebaseWorkshop";
import { WORKSHOP_GROUPS } from "@/app/workshop/_lib/workshopGroups";
import { formatTaipeiDateTime } from "@/lib/taipeiTime";

type BoardRow = {
  groupId: string;
  teacherName: string;
  planTitle: string;
  status: string;
  memberCount?: number;
  updatedAtMs?: number;
};

export default function WorkshopAdminPage() {
  const [rows, setRows] = useState<Record<string, BoardRow>>({});
  const [clearingGroup, setClearingGroup] = useState<string | null>(null);

  useEffect(() => {
    const un = onSnapshot(collection(workshopDb, "workshop_boards"), (snap) => {
      const next: Record<string, BoardRow> = {};
      snap.forEach((d) => {
        const x = d.data() as Record<string, unknown>;
        const ms = (x.updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.();
        next[d.id] = {
          groupId: String(x.groupId || d.id),
          teacherName: String(x.teacherName || ""),
          planTitle: String(x.planTitle || "未命名計畫"),
          status: String(x.status || "草案中"),
          memberCount: typeof x.memberCount === "number" ? x.memberCount : undefined,
          updatedAtMs: typeof ms === "number" ? ms : undefined,
        };
      });
      setRows(next);
    });
    return () => un();
  }, []);

  const displayRows = useMemo(
    () =>
      WORKSHOP_GROUPS.map((g) => {
        const row = rows[g.id];
        return {
          groupId: g.id,
          groupLabel: g.label,
          teacher: g.teacher,
          planTitle: row?.planTitle || "尚未儲存",
          status: row?.status || "未開始",
          memberCount: row?.memberCount ?? 0,
          updatedAt: row?.updatedAtMs ? formatTaipeiDateTime(row.updatedAtMs) : "—",
        };
      }),
    [rows],
  );

  async function clearGroup(groupId: string) {
    const ok = window.confirm(`確定清空 ${groupId} 組所有資料？此操作不可復原。`);
    if (!ok) return;
    setClearingGroup(groupId);
    try {
      const qIdeas = query(collection(workshopDb, "workshop_ideas"), where("groupId", "==", groupId));
      const snap = await getDocs(qIdeas);
      const batch = writeBatch(workshopDb);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();

      await setDoc(
        doc(workshopDb, "workshop_boards", groupId),
        {
          groupId,
          planTitle: "",
          status: "未開始",
          memberCount: 0,
          budgetRows: [],
          budgetSummary: deleteField(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } finally {
      setClearingGroup(null);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">工作坊總控台</h1>
        <p className="mt-1 text-sm text-slate-500">即時檢視 A/B/C 各組目前儲存於 `workshop_boards` 的計畫名稱與狀態。</p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">組別</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">帶領老師</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">最終計畫名稱</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">狀態</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">組員數</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">最後更新</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayRows.map((row) => (
                <tr key={row.groupId} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.groupLabel}</td>
                  <td className="px-4 py-3 text-slate-700">{row.teacher}</td>
                  <td className="px-4 py-3 text-slate-800">{row.planTitle}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.memberCount}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{row.updatedAt}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void clearGroup(row.groupId)}
                      disabled={clearingGroup === row.groupId}
                      className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      {clearingGroup === row.groupId ? "清除中..." : "⚠️ 清空該組所有資料"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
