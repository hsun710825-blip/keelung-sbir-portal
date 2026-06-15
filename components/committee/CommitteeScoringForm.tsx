"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  BASE_SCORE_FIELDS,
  BONUS_SCORE_FIELDS,
  type CommitteeScoreBreakdown,
  computeTotalScore,
  emptyScoreBreakdown,
} from "@/lib/committeeScoringRubric";

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
    >
      {pending ? "儲存中…" : "儲存送出"}
    </button>
  );
}

export function CommitteeScoringForm({
  applicationId,
  meetingDate,
  initialBreakdown,
  initialComment,
  readOnly = false,
  action,
  state,
}: {
  applicationId: string;
  meetingDate: string;
  initialBreakdown: CommitteeScoreBreakdown | null;
  initialComment: string | null;
  readOnly?: boolean;
  action: (payload: FormData) => void;
  state: { error?: string; message?: string };
}) {
  const [breakdown, setBreakdown] = useState<CommitteeScoreBreakdown>(
    initialBreakdown ?? emptyScoreBreakdown(),
  );

  const total = useMemo(() => computeTotalScore(breakdown), [breakdown]);

  function setBaseField(key: keyof CommitteeScoreBreakdown, raw: string, max: number) {
    const n = raw === "" ? 0 : parseInt(raw, 10);
    setBreakdown((prev) => ({
      ...prev,
      [key]: Number.isInteger(n) && n >= 0 && n <= max ? n : 0,
    }));
  }

  function setBonusField(key: keyof CommitteeScoreBreakdown, raw: string) {
    const n = parseInt(raw, 10);
    setBreakdown((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : 0 }));
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="meetingDate" value={meetingDate} />

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

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <p className="text-sm font-semibold text-slate-800">基礎項目（滿分 86 分）</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {BASE_SCORE_FIELDS.map((field) => (
            <div key={field.key}>
              <label htmlFor={field.key} className="block text-sm font-medium text-slate-700">
                {field.label}
                <span className="ml-1 text-xs text-slate-500">（0～{field.max}）</span>
              </label>
              <input
                id={field.key}
                name={field.key}
                type="number"
                min={0}
                max={field.max}
                step={1}
                required
                disabled={readOnly}
                value={breakdown[field.key]}
                onChange={(e) => setBaseField(field.key, e.target.value, field.max)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
        <p className="text-sm font-semibold text-slate-800">加分項目（滿分 14 分）</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {BONUS_SCORE_FIELDS.map((field) => (
            <div key={field.key}>
              <label htmlFor={field.key} className="block text-sm font-medium text-slate-700">
                {field.label}
              </label>
              <select
                id={field.key}
                name={field.key}
                required
                disabled={readOnly}
                value={breakdown[field.key]}
                onChange={(e) => setBonusField(field.key, e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
              >
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt} 分
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-sm text-slate-600">即時總分</p>
        <p className="text-3xl font-bold tabular-nums text-blue-900">{total}</p>
        <p className="text-xs text-slate-500">基礎項 + 加分項 = 總分（滿分 100）</p>
      </div>

      <div>
        <label htmlFor="eval-comment" className="block text-sm font-medium text-slate-700">
          審查意見
        </label>
        <textarea
          id="eval-comment"
          name="comment"
          rows={5}
          disabled={readOnly}
          defaultValue={initialComment ?? ""}
          placeholder="請填寫審查意見"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
        />
      </div>

      {!readOnly ? <SubmitButton /> : null}
    </form>
  );
}
