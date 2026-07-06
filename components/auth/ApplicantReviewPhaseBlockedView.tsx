"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";

const LINE_URL = "https://lin.ee/RnnQSS0";

type Props = {
  onLogout?: () => void;
};

/** 複審階段：非 COMMITTEE_REVIEW 申請者登入阻擋 */
export function ApplicantReviewPhaseBlockedView({ onLogout }: Props) {
  return (
    <section className="min-h-screen bg-[#fafafa] font-sans text-slate-800 flex flex-col items-center justify-center px-4 py-12">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.06)] text-center">
        <section className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-12 w-12 text-amber-500" strokeWidth={2.2} aria-hidden />
        </section>
        <p className="text-xl md:text-2xl font-bold text-slate-900 leading-relaxed whitespace-pre-wrap">
          目前系統僅開放「審查中」之複審提案者登入查詢進度。{"\n"}
          您的案件未在複審審查名單內，暫不提供申請人登入。{"\n"}
          如有疑問，歡迎加入「115基隆SBIR幫」LINE 官方帳號聯繫專案辦公室。
        </p>
        <p className="mt-6 text-lg md:text-xl font-bold text-slate-900 leading-relaxed">
          💁🏻‍♀️加入115基隆SBIR幫可點選右方連結👉
          <Link
            href={LINE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline underline-offset-4 hover:text-blue-800 break-all"
          >
            {LINE_URL}
          </Link>
        </p>
        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            className="mt-10 rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            返回首頁
          </button>
        ) : null}
      </section>
    </section>
  );
}
