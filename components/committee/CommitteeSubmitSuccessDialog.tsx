"use client";

import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function CommitteeSubmitSuccessDialog({
  planTitle,
  totalScore,
  meetingDate,
  nextApplicationId,
  onEditCurrent,
}: {
  planTitle: string;
  totalScore: number;
  meetingDate: string;
  nextApplicationId: string | null;
  onEditCurrent: () => void;
}) {
  const router = useRouter();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-success-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" aria-hidden />
          <h2 id="submit-success-title" className="mt-3 text-lg font-semibold text-slate-900">
            評分已送出
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{planTitle}</p>
          <p className="mt-2 text-base text-slate-800">
            總分 <span className="text-2xl font-bold tabular-nums text-blue-700">{totalScore}</span> 分
            已送出
          </p>
          <p className="mt-2 text-xs text-slate-500">您可繼續評下一案，或返回修改本分數。</p>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {nextApplicationId ? (
            <button
              type="button"
              onClick={() =>
                router.push(`/committee/application/${nextApplicationId}?meeting=${meetingDate}`)
              }
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              進入下一案 →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push(`/committee/meeting/${meetingDate}`)}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              返回議程列表
            </button>
          )}
          <button
            type="button"
            onClick={onEditCurrent}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            回到原案更改分數
          </button>
        </div>
      </div>
    </div>
  );
}
