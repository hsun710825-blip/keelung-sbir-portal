"use client";

import { useActionState, useCallback, useEffect, useState } from "react";

import {
  saveYouthVerificationRowAction,
  type SaveYouthVerificationState,
} from "@/app/admin/youth-id-verification/actions";
import { formatQualifiesLabel } from "@/lib/youthId/formatCommitteeNote";
import type { YouthVerificationRow } from "@/lib/youthId/types";

function qualifiesToSelectValue(q: boolean | null): string {
  if (q === true) return "yes";
  if (q === false) return "no";
  return "unknown";
}

function RowSaveForm({
  row,
  onOcrDone,
}: {
  row: YouthVerificationRow;
  onOcrDone: (updated: YouthVerificationRow) => void;
}) {
  const [state, action, pending] = useActionState(saveYouthVerificationRowAction, {} as SaveYouthVerificationState);
  const [ocrPending, setOcrPending] = useState(false);

  const runOcr = useCallback(async () => {
    setOcrPending(true);
    try {
      const res = await fetch("/api/admin/youth-id-verification/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: row.applicationId }),
      });
      if (!res.ok) throw new Error("ocr failed");
      const data = (await res.json()) as { row: YouthVerificationRow };
      onOcrDone(data.row);
    } catch {
      alert("證件判讀失敗，請稍後再試或手動填寫。");
    } finally {
      setOcrPending(false);
    }
  }, [onOcrDone, row.applicationId]);

  return (
    <form
      action={action}
      className="space-y-2"
      key={row.persons.map((p) => `${p.age}|${p.registeredCity}|${p.qualifies}|${p.poSaved}`).join(";")}
    >
      <input type="hidden" name="applicationId" value={row.applicationId} />
      <input type="hidden" name="personCount" value={row.persons.length} />

      {row.persons.map((person, idx) => (
        <div
          key={`${row.applicationId}-${idx}`}
          className="grid grid-cols-1 gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2 sm:grid-cols-5"
        >
          <input type="hidden" name={`person_${idx}_driveFileId`} value={person.driveFile?.id ?? ""} />
          <label className="block text-sm">
            <span className="text-xs text-slate-500">負責人</span>
            <input
              name={`person_${idx}_name`}
              defaultValue={person.responsibleName ?? ""}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-slate-500">設籍縣市</span>
            <input
              name={`person_${idx}_city`}
              defaultValue={person.registeredCity ?? ""}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-slate-500">年齡</span>
            <input
              name={`person_${idx}_age`}
              type="number"
              min={0}
              max={120}
              defaultValue={person.age ?? ""}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm tabular-nums"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-slate-500">是否符合</span>
            <select
              name={`person_${idx}_qualifies`}
              defaultValue={qualifiesToSelectValue(person.qualifies)}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="unknown">待查證</option>
              <option value="yes">是</option>
              <option value="no">否</option>
            </select>
          </label>
          <div className="flex flex-col justify-end gap-1 text-xs text-slate-500">
            {person.sheetCompanyName ? <span>試算表：{person.sheetCompanyName}</span> : null}
            {person.ocrReadError ? <span className="text-amber-700">{person.ocrReadError}</span> : null}
            {person.poSaved ? <span className="font-medium text-green-700">已儲存</span> : null}
            {!person.poSaved && person.age == null && person.driveFile ? (
              <span>目前：{formatQualifiesLabel(person.qualifies)}</span>
            ) : null}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => void runOcr()}
          disabled={ocrPending || !row.persons.some((p) => p.driveFile)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {ocrPending ? "判讀中…" : "自動判讀證件"}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "儲存中…" : "儲存此列"}
        </button>
        {state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
        {state.ok ? <span className="text-xs text-green-700">已儲存</span> : null}
      </div>
    </form>
  );
}

export function YouthIdVerificationEditor({ initialRows }: { initialRows: YouthVerificationRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [batchOcr, setBatchOcr] = useState(false);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const updateRow = useCallback((updated: YouthVerificationRow) => {
    setRows((prev) => prev.map((r) => (r.applicationId === updated.applicationId ? updated : r)));
  }, []);

  const runBatchOcr = useCallback(async () => {
    setBatchOcr(true);
    const needOcr = rows.filter(
      (r) => r.persons.some((p) => p.driveFile && !p.poSaved && p.age == null && p.registeredCity == null),
    );
    for (const row of needOcr) {
      try {
        const res = await fetch("/api/admin/youth-id-verification/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationId: row.applicationId }),
        });
        if (res.ok) {
          const data = (await res.json()) as { row: YouthVerificationRow };
          updateRow(data.row);
        }
      } catch {
        // continue other rows
      }
    }
    setBatchOcr(false);
  }, [rows, updateRow]);

  useEffect(() => {
    const need = rows.some(
      (r) => r.persons.some((p) => p.driveFile && !p.poSaved && p.age == null && !p.ocrReadError),
    );
    if (need) {
      void runBatchOcr();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto OCR once on mount
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-sm text-slate-600">進入頁面會自動判讀尚未處理之證件；PO 可修改後按「儲存此列」。</p>
        <button
          type="button"
          onClick={() => void runBatchOcr()}
          disabled={batchOcr}
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-50"
        >
          {batchOcr ? "全部判讀中…" : "重新全部判讀"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-3 text-xs font-semibold uppercase text-slate-600">序</th>
              <th className="px-3 py-3 text-xs font-semibold uppercase text-slate-600">公司／計畫</th>
              <th className="px-3 py-3 text-xs font-semibold uppercase text-slate-600">查證資料（可編輯）</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.applicationId} className="align-top">
                <td className="px-3 py-3 tabular-nums text-slate-700">{row.overallRank ?? "—"}</td>
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-900">
                    {row.companyName}
                    {row.isJoint ? (
                      <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
                        聯合
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-slate-700">{row.title}</p>
                  {row.warnings.length > 0 ? (
                    <ul className="mt-2 list-disc pl-4 text-xs text-amber-800">
                      {row.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <RowSaveForm row={row} onOcrDone={updateRow} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
