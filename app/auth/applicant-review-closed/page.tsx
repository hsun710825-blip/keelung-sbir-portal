"use client";

import { signOut } from "next-auth/react";

import { ApplicantReviewPhaseBlockedView } from "@/components/auth/ApplicantReviewPhaseBlockedView";

export default function ApplicantReviewClosedPage() {
  return (
    <ApplicantReviewPhaseBlockedView
      onLogout={() => {
        void signOut({ callbackUrl: "/" });
      }}
    />
  );
}
