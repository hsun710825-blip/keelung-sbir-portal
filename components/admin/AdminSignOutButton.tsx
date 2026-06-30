"use client";

import { signOut } from "next-auth/react";

export function AdminSignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl: "/" })}
      className={
        compact
          ? "rounded-lg border border-slate-300 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50"
          : "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
      }
      title="登出"
    >
      {compact ? "⎋" : "登出"}
    </button>
  );
}
