"use client";

import { useActionState } from "react";

import {
  submitCommitteeMeetingToPoAction,
  type CommitteeMeetingActionState,
} from "@/app/committee/meeting/[date]/actions";
import type { ReviewMeetingDate } from "@/lib/reviewMeetingAgenda";
import { evaluationStatusLabel } from "@/lib/committeeScoringRubric";

export type PersonalScoreRow = {
  applicationId: string;
  title: string;
  companyName: string;
  totalScore: number | null;
  rank: number | null;
  status: string;
  comment: string | null;
};

function SubmitToPoButton({ meetingDate }: { meetingDate: ReviewMeetingDate }) {
  const [state, action, pending] = useActionState(submitCommitteeMeetingToPoAction, {} as CommitteeMeetingActionState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="meetingDate" value={meetingDate} />
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

export function CommitteePersonalScoreTable({
  meetingDate,
  rows,
  sessionStatus,
  canEdit,
}: {
  meetingDate: ReviewMeetingDate;
  rows: PersonalScoreRow[];
  sessionStatus: string;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          依總分由高至低排序；共 {rows.length} 案。
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            批次狀態：{sessionStatus}
          </span>
        </p>
        {canEdit ? <SubmitToPoButton meetingDate={meetingDate} /> : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-600">序位</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-600">公司名稱</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-600">計畫名稱</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-600">總分</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-600">狀態</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  尚無評分資料，請先至議程列表進行評分。
                </td>
              </tr>
            ) : (
              rows.map((row) => {
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
                    <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">{row.rank ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-800">{row.companyName}</td>
                    <td className="max-w-[240px] px-4 py-3 text-slate-700">{row.title}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-blue-800">
                      {row.totalScore != null ? row.totalScore.toFixed(0) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
                        {evaluationStatusLabel(status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {editable ? (
                        <a
                          href={`/committee/application/${row.applicationId}?meeting=${meetingDate}`}
                          className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                        >
                          修改
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
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
