"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  saveCommitteeEvaluationAction,
  type SaveEvaluationState,
} from "@/app/committee/application/[id]/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
    >
      {pending ? "儲存中…" : "儲存評分"}
    </button>
  );
}

const initial: SaveEvaluationState = {};

export function CommitteeEvaluationForm({
  applicationId,
  initialScore,
  initialRank,
  initialComment,
  rankOptional = false,
}: {
  applicationId: string;
  initialScore: number | null;
  initialRank: number | null;
  initialComment: string | null;
  /** 正式庫尚未有 rank 欄位時，序位改為選填 */
  rankOptional?: boolean;
}) {
  const [state, formAction] = useActionState(saveCommitteeEvaluationAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="applicationId" value={applicationId} />

      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="eval-score" className="block text-sm font-medium text-slate-700">
            分數（0～100）
          </label>
          <input
            id="eval-score"
            name="score"
            type="number"
            step="0.1"
            min={0}
            max={100}
            required
            defaultValue={initialScore != null ? String(initialScore) : ""}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="eval-rank" className="block text-sm font-medium text-slate-700">
            序位（序位法）
          </label>
          <input
            id="eval-rank"
            name="rank"
            type="number"
            step={1}
            min={1}
            required={!rankOptional}
            defaultValue={initialRank != null ? String(initialRank) : ""}
            placeholder="1 為最佳，數字愈小愈前"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            正整數；1 表示本輪最優先，2 次之，依此類推。
            {rankOptional ? "（資料庫更新前暫為選填）" : null}
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="eval-comment" className="block text-sm font-medium text-slate-700">
          審查評語
        </label>
        <textarea
          id="eval-comment"
          name="comment"
          rows={6}
          defaultValue={initialComment ?? ""}
          placeholder="請填寫審查意見（選填）"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
