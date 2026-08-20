"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RevisionUploadRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);

  const busy = isPending || refreshing;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setRefreshing(true);
        startTransition(() => {
          router.refresh();
          setRefreshing(false);
        });
      }}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
      {busy ? "重新檢查中…" : "重新檢查"}
    </button>
  );
}
