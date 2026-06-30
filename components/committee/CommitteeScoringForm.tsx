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

type BaseFieldKey = (typeof BASE_SCORE_FIELDS)[number]["key"];

function initBaseInputs(initialBreakdown: CommitteeScoreBreakdown | null): Record<BaseFieldKey, string> {
  const out = {} as Record<BaseFieldKey, string>;
  for (const field of BASE_SCORE_FIELDS) {
    if (initialBreakdown == null) {
      out[field.key] = "";
    } else {
      out[field.key] = String(initialBreakdown[field.key]);
    }
  }
  return out;
}

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

const EDITABLE_INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

const READONLY_INPUT_CLASS =
  "mt-1 w-full cursor-not-allowed rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600";

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
  const [baseInputs, setBaseInputs] = useState(() => initBaseInputs(initialBreakdown));
  const [breakdown, setBreakdown] = useState<CommitteeScoreBreakdown>(
    initialBreakdown ?? emptyScoreBreakdown(),
  );

  const total = useMemo(() => {
    const merged = { ...breakdown };
    for (const field of BASE_SCORE_FIELDS) {
      const raw = baseInputs[field.key].trim();
      merged[field.key] = raw === "" ? 0 : parseInt(raw, 10) || 0;
    }
    return computeTotalScore(merged);
  }, [baseInputs, breakdown]);

  function setBaseField(key: BaseFieldKey, raw: string) {
    if (raw !== "" && !/^\d+$/.test(raw)) return;
    setBaseInputs((prev) => ({ ...prev, [key]: raw }));
  }

  function handleBaseFocus(e: React.FocusEvent<HTMLInputElement>) {
    if (e.target.value) {
      e.target.select();
    }
  }

  function setBonusField(key: keyof CommitteeScoreBreakdown, raw: string) {
    const n = parseInt(raw, 10);
    setBreakdown((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : 0 }));
  }

  const fieldClass = readOnly ? READONLY_INPUT_CLASS : EDITABLE_INPUT_CLASS;

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

      {readOnly ? (
        <p className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
          此場次已鎖定，以下欄位僅供檢視。
        </p>
      ) : null}

      <div
        className={`rounded-xl border p-4 ${readOnly ? "border-slate-300 bg-slate-100/90" : "border-slate-200 bg-slate-50/80"}`}
      >
        <p className="text-sm font-semibold text-slate-900">基礎項目（滿分 86 分）</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {BASE_SCORE_FIELDS.map((field) => (
            <div key={field.key}>
              <label htmlFor={field.key} className="block text-sm font-medium text-slate-800">
                {field.label}
                <span className="ml-1 text-xs text-slate-600">（0～{field.max}）</span>
              </label>
              <input
                id={field.key}
                name={field.key}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                disabled={readOnly}
                readOnly={readOnly}
                value={baseInputs[field.key]}
                onChange={(e) => setBaseField(field.key, e.target.value)}
                onFocus={handleBaseFocus}
                placeholder={readOnly ? "" : "請輸入分數"}
                className={fieldClass}
                aria-label={`${field.label}，0到${field.max}分`}
              />
            </div>
          ))}
        </div>
      </div>

      <div
        className={`rounded-xl border p-4 ${readOnly ? "border-slate-300 bg-slate-100/80" : "border-amber-100 bg-amber-50/50"}`}
      >
        <p className="text-sm font-semibold text-slate-900">加分項目（滿分 14 分）</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {BONUS_SCORE_FIELDS.map((field) => (
            <div key={field.key}>
              <label htmlFor={field.key} className="block text-sm font-medium text-slate-800">
                {field.label}
              </label>
              <select
                id={field.key}
                name={field.key}
                disabled={readOnly}
                value={breakdown[field.key]}
                onChange={(e) => setBonusField(field.key, e.target.value)}
                className={fieldClass}
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
        <p className="text-sm text-slate-700">即時總分</p>
        <p className="text-3xl font-bold tabular-nums text-blue-900">{total}</p>
        <p className="text-xs text-slate-600">基礎項 + 加分項 = 總分（滿分 100）</p>
      </div>

      <div>
        <label htmlFor="eval-comment" className="block text-sm font-medium text-slate-800">
          審查意見
        </label>
        <textarea
          id="eval-comment"
          name="comment"
          rows={5}
          disabled={readOnly}
          readOnly={readOnly}
          defaultValue={initialComment ?? ""}
          placeholder={readOnly ? "" : "請填寫審查意見"}
          className={fieldClass}
        />
      </div>

      {!readOnly ? <SubmitButton /> : null}
    </form>
  );
}
