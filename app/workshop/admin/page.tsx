"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
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
  const [recoveringGroup, setRecoveringGroup] = useState<string | null>(null);

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

  async function recoverGroupAB(groupId: string) {
    const ok = window.confirm(
      `確定要對 ${groupId} 組執行「A+B」嗎？\n\nA: 先備份現況（boards + ideas）\nB: 修復 ideas 欄位與版面座標（不改文字內容）`,
    );
    if (!ok) return;

    setRecoveringGroup(groupId);
    const archiveId = `${groupId}-${Date.now()}`;
    try {
      // A) 備份 board
      const boardRef = doc(workshopDb, "workshop_boards", groupId);
      const boardSnap = await getDoc(boardRef);
      if (boardSnap.exists()) {
        await setDoc(doc(workshopDb, "workshop_boards", `ARCHIVE-${archiveId}-${groupId}`), {
          archiveId,
          isArchive: true,
          sourceGroupId: groupId,
          archivedAt: serverTimestamp(),
          ...boardSnap.data(),
        }, { merge: false });
      }

      // A) 備份 ideas（分批，避免 batch 上限）
      const qIdeas = query(collection(workshopDb, "workshop_ideas"), where("groupId", "==", groupId));
      const snap = await getDocs(qIdeas);
      const ideaDocs = snap.docs;
      for (let i = 0; i < ideaDocs.length; i += 300) {
        const slice = ideaDocs.slice(i, i + 300);
        const batch = writeBatch(workshopDb);
        slice.forEach((d) => {
          const backupRef = doc(collection(workshopDb, "workshop_ideas"));
          batch.set(backupRef, {
            archiveId,
            isArchive: true,
            sourceGroupId: groupId,
            sourceId: d.id,
            archivedAt: serverTimestamp(),
            groupId: `ARCHIVE-${groupId}`,
            ...d.data(),
          });
        });
        await batch.commit();
      }

      // B) 修復 ideas 必要欄位與座標（不改既有文字）
      const softColors = ["#fee2e2", "#ffedd5", "#fef3c7", "#ecfccb", "#dcfce7", "#ccfbf1", "#dbeafe", "#e0e7ff", "#ede9fe", "#fce7f3"];
      const sortedIdeas = [...ideaDocs].sort((a, b) => {
        const ta = a.data()?.createdAt?.toMillis?.() ?? 0;
        const tb = b.data()?.createdAt?.toMillis?.() ?? 0;
        return ta - tb || a.id.localeCompare(b.id);
      });
      for (let i = 0; i < sortedIdeas.length; i += 300) {
        const slice = sortedIdeas.slice(i, i + 300);
        const batch = writeBatch(workshopDb);
        slice.forEach((d, idx) => {
          const x = d.data() as Record<string, unknown>;
          const globalIdx = i + idx;
          const patch: Record<string, unknown> = {
            updatedAt: serverTimestamp(),
          };

          const hasType = x.type === "sticky" || x.type === "draw";
          if (!hasType) patch.type = "sticky";

          const hasX = typeof x.x === "number" && Number.isFinite(x.x);
          const hasY = typeof x.y === "number" && Number.isFinite(x.y);
          if (!hasX) patch.x = 120 + (globalIdx % 4) * 280;
          if (!hasY) patch.y = 120 + Math.floor(globalIdx / 4) * 180;

          if ((x.type ?? patch.type) === "sticky") {
            if (typeof x.companyName !== "string") patch.companyName = "";
            if (typeof x.studentName !== "string") patch.studentName = "";
            if (typeof x.ideaText !== "string") patch.ideaText = "";
            if (typeof x.color !== "string" || !x.color) patch.color = softColors[globalIdx % softColors.length];
          }

          if ((x.type ?? patch.type) === "draw") {
            if (typeof x.pathData !== "string") patch.pathData = "";
            if (typeof x.strokeColor !== "string") patch.strokeColor = "#0f172a";
            if (typeof x.strokeWidth !== "number") patch.strokeWidth = 3;
            if (typeof x.opacity !== "number") patch.opacity = 1;
            if (typeof x.width !== "number") patch.width = 220;
            if (typeof x.height !== "number") patch.height = 140;
          }

          batch.set(doc(workshopDb, "workshop_ideas", d.id), patch, { merge: true });
        });
        await batch.commit();
      }

      // 記錄最近一次復原資訊
      await setDoc(
        boardRef,
        {
          lastRecoveryArchiveId: archiveId,
          recoveryAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      window.alert(`${groupId} 組已完成 A+B（已備份並復原版面）。`);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "unknown error";
      window.alert(`${groupId} 組復原失敗：${msg}`);
    } finally {
      setRecoveringGroup(null);
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
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/workshop/workspace/${row.groupId}`}
                        className="rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        👁️ 查看畫布
                      </Link>
                      <button
                        type="button"
                        onClick={() => void recoverGroupAB(row.groupId)}
                        disabled={recoveringGroup === row.groupId}
                        className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                      >
                        {recoveringGroup === row.groupId ? "復原中..." : "🛟 備份+復原(A+B)"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void clearGroup(row.groupId)}
                        disabled={clearingGroup === row.groupId}
                        className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        {clearingGroup === row.groupId ? "清除中..." : "⚠️ 清空該組所有資料"}
                      </button>
                    </div>
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
