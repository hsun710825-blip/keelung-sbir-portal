"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteApplicationAction } from "@/app/admin/dashboard/actions";

export function DeleteApplicationButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          if (!window.confirm("確定要刪除這筆計畫紀錄嗎？此動作無法復原！")) return;
          startTransition(async () => {
            const res = await deleteApplicationAction(applicationId);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            alert("刪除成功");
            router.refresh();
          });
        }}
        className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
      >
        {pending ? "刪除中..." : "🗑️ 刪除"}
      </button>
      {error ? <span className="max-w-[11rem] text-xs text-rose-600">{error}</span> : null}
    </div>
  );
}

