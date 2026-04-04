"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ApplicationStatus } from "@prisma/client";

import { updateApplicationStatusAction } from "@/app/admin/application/[id]/actions";
import { APPLICATION_STATUS_OPTIONS } from "@/lib/applicationStatusOptions";
import { applicationStatusLabel } from "@/lib/applicationStatusLabels";

type Props = {
  applicationId: string;
  currentStatus: ApplicationStatus;
};

export function ApplicationStatusControl({ applicationId, currentStatus }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<ApplicationStatus>(currentStatus);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setValue(currentStatus);
    setMsg(null);
    setErr(null);
  }, [currentStatus]);

  const dirty = value !== currentStatus;

  const save = () => {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await updateApplicationStatusAction(applicationId, value);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMsg("狀態已更新");
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">狀態更改</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1 text-sm text-slate-700">
          <span className="mb-1.5 block text-xs text-slate-500">案件狀態</span>
          <select
            value={value}
            disabled={pending}
            onChange={(e) => setValue(e.target.value as ApplicationStatus)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
          >
            {APPLICATION_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {applicationStatusLabel(s)} ({s})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() => save()}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "儲存中…" : "儲存狀態"}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-emerald-700">{msg}</p>}
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
    </div>
  );
}
