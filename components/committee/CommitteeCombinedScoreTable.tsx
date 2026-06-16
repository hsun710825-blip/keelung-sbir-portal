"use client";

import { useActionState } from "react";

import { submitAllCommitteeToPoAction, type CommitteeSummaryActionState } from "@/app/committee/actions";
import type { CombinedPersonalScoreRow } from "@/lib/committeePersonalScores";
import { BASE_SCORE_FIELDS, BONUS_SCORE_FIELDS, evaluationStatusLabel } from "@/lib/committeeScoringRubric";

function SubmitAllToPoButton() {
  const [state, action, pending] = useActionState(submitAllCommitteeToPoAction, {} as CommitteeSummaryActionState);
  return (
    <form action={action} className="space-y-2">
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "處理中…" : "確認送出給專案辦公室 (PO)"}
      </button>
    </form>
  );
}

function ScoreTable({
  title,
  rows,
  canEdit,
}: {
  title: string;
  rows: CombinedPersonalScoreRow[];
  canEdit: boolean;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1200px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-2 py-2 font-semibold text-slate-600">序位</th>
              <th className="px-2 py-2 font-semibold text-slate-600">場次</th>
              <th className="px-2 py-2 font-semibold text-slate-600">公司</th>
              <th className="px-2 py-2 font-semibold text-slate-600">計畫</th>
              {BASE_SCORE_FIELDS.map((f) => (
                <th key={f.key} className="px-2 py-2 font-semibold text-slate-600" title={f.label}>
                  {f.max}
                </th>
              ))}
              {BONUS_SCORE_FIELDS.map((f) => (
                <th key={f.key} className="px-1 py-2 font-semibold text-slate-600" title={f.label}>
                  +
                </th>
              ))}
              <th className="px-2 py-2 font-semibold text-slate-600">總分</th>
              <th className="px-2 py-2 font-semibold text-slate-600">狀態</th>
              <th className="px-2 py-2 font-semibold text-slate-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={20} className="px-4 py-8 text-center text-slate-500">
                  尚無評分資料
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const b = row.breakdown;
                const status = String(row.status || "DRAFT").toUpperCase();
                const badgeClass =
                  status === "SUBMITTED"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : status === "LOCKED"
                      ? "border-slate-300 bg-slate-100 text-slate-700"
                      : "border-amber-200 bg-amber-50 text-amber-900";
                const editable = canEdit && status !== "LOCKED";
                return (
                  <tr key={row.applicationId} className="hover:bg-slate-50/80">
                    <td className="px-2 py-2 font-semibold tabular-nums">{row.rank ?? "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-slate-600">{row.meetingDate}</td>
                    <td className="px-2 py-2 text-slate-800">{row.companyName}</td>
                    <td className="max-w-[180px] px-2 py-2 text-slate-700">{row.title}</td>
                    {BASE_SCORE_FIELDS.map((f) => (
                      <td key={f.key} className="px-2 py-2 tabular-nums text-center">
                        {b?.[f.key] ?? "—"}
                      </td>
                    ))}
                    {BONUS_SCORE_FIELDS.map((f) => (
                      <td key={f.key} className="px-1 py-2 tabular-nums text-center">
                        {b?.[f.key] ?? "—"}
                      </td>
                    ))}
                    <td className="px-2 py-2 font-semibold tabular-nums text-blue-800">{row.totalScore}</td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${badgeClass}`}>
                        {evaluationStatusLabel(status)}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      {editable ? (
                        <a
                          href={`/committee/application/${row.applicationId}?meeting=${row.meetingDate}`}
                          className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800"
                        >
                          修改
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CommitteeCombinedScoreTable({
  regularRows,
  jointRows,
  sessionStatus,
  canEdit,
  scoredCount,
  totalCases,
}: {
  regularRows: CombinedPersonalScoreRow[];
  jointRows: CombinedPersonalScoreRow[];
  sessionStatus: string;
  canEdit: boolean;
  scoredCount: number;
  totalCases: number;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          6/22 + 7/1 合併總表 · 已評 {scoredCount}/{totalCases} 案 · 同分時依權重細項比序
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{sessionStatus}</span>
        </p>
        {canEdit ? <SubmitAllToPoButton /> : null}
      </div>
      <ScoreTable title="一般提案（6/22 + 7/1）" rows={regularRows} canEdit={canEdit} />
      {jointRows.length > 0 ? (
        <ScoreTable title="聯合提案（7/1）" rows={jointRows} canEdit={canEdit} />
      ) : null}
    </div>
  );
}
