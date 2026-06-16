"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteReviewerAccountAction } from "@/app/admin/users/actions";

export function DeleteReviewerAccountButton({
  userId,
  email,
  disabled,
}: {
  userId: string;
  email: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          if (
            !window.confirm(
              `確定刪除審查委員「${email}」？\n\n將一併刪除其所有評分資料，且無法復原。`,
            )
          ) {
            return;
          }
          startTransition(async () => {
            const r = await deleteReviewerAccountAction(userId);
            if (r.ok) {
              router.refresh();
            } else {
              setError(r.error);
            }
          });
        }}
        className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
      >
        {pending ? "處理中…" : "刪除委員"}
      </button>
      {error ? <span className="max-w-[12rem] text-right text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
