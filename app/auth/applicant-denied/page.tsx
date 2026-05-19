"use client";

import { ApplicantSupplementBlockedView } from "@/components/auth/ApplicantSupplementBlockedView";
import { signOut } from "next-auth/react";

export default function ApplicantDeniedPage() {
  return (
    <ApplicantSupplementBlockedView
      onLogout={() => {
        void signOut({ callbackUrl: "/" });
      }}
    />
  );
}
