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
  initialComment,
}: {
  applicationId: string;
  initialScore: number | null;
  initialComment: string | null;
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
          className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
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
