"use client";

import { useSession } from "next-auth/react";

import { ApplicantSupplementBlockedView } from "@/components/auth/ApplicantSupplementBlockedView";

type Props = {
  onLogout: () => void;
  children: React.ReactNode;
};

/**
 * 申請者進入撰寫區前的 Auth 閘道（補件期資格由 JWT 決定）。
 */
export function ApplicantEntryGate({ onLogout, children }: Props) {
  const { data: session, status } = useSession();
  const supplementDenied = session?.user?.applicantSupplementDenied === true;

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

  return <>{children}</>;
}
