"use client";

import { useSession } from "next-auth/react";

import { ApplicantReviewPhaseBlockedView } from "@/components/auth/ApplicantReviewPhaseBlockedView";
import { ApplicantSupplementBlockedView } from "@/components/auth/ApplicantSupplementBlockedView";
import { isPastApplicationDeadline } from "@/lib/applicationDeadline";

type Props = {
  onLogout: () => void;
  children: React.ReactNode;
};

/**
 * 申請者進入撰寫區前的 Auth 閘道（補件期／修改開放期資格由 JWT 決定）。
 * 徵件截止後必須有正向放行旗標，避免舊 session 缺 denied 旗標時誤放行。
 */
export function ApplicantEntryGate({ onLogout, children }: Props) {
  const { data: session, status } = useSession();
  const supplementAccess = session?.user?.applicantSupplementAccess === true;
  const supplementDenied = session?.user?.applicantSupplementDenied === true;
  const reviewAccess = session?.user?.applicantReviewAccess === true;
  const reviewDenied = session?.user?.applicantReviewDenied === true;
  const pastDeadline = isPastApplicationDeadline();
  const unlocked = supplementAccess || reviewAccess;

  if (status === "loading") {
    return (
      <section className="min-h-screen bg-[#fafafa] flex items-center justify-center text-slate-500 text-sm">
        驗證登入狀態中…
      </section>
    );
  }

  if (supplementDenied) {
    return <ApplicantSupplementBlockedView onLogout={onLogout} />;
  }

  if (reviewDenied || (pastDeadline && !unlocked)) {
    return <ApplicantReviewPhaseBlockedView onLogout={onLogout} />;
  }

  return <>{children}</>;
}
