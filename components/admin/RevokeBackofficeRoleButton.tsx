"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { revokeBackofficeRoleAction } from "@/app/admin/users/actions";

export function RevokeBackofficeRoleButton({
  userId,
  label,
}: {
  userId: string;
  /** 按鈕顯示文字 */
  label?: string;
}) {
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
          if (!window.confirm("確定將此帳號改回一般使用者（USER）？對方將無法進入後台／委員區。")) {
            return;
          }
          startTransition(async () => {
            const r = await revokeBackofficeRoleAction(userId);
            if (r.ok) {
              router.refresh();
            } else {
              setError(r.error);
            }
          });
        }}
        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
      >
        {pending ? "處理中…" : label ?? "移除權限"}
      </button>
      {error ? <span className="max-w-[12rem] text-right text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
