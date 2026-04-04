"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ApplicationStatus } from "@prisma/client";

import { updateApplicationStatusAction } from "@/app/admin/application/[id]/actions";
import { APPLICATION_STATUS_OPTIONS } from "@/lib/applicationStatusOptions";
import { applicationStatusLabel } from "@/lib/applicationStatusLabels";
import {
  defaultAdminRemarksForStatus,
  REVISION_REQUIRED_PLACEHOLDER,
  statusUsesRemarkPlaceholder,
} from "@/lib/statusRemarkTemplates";

type Props = {
  applicationId: string;
  currentStatus: ApplicationStatus;
  initialAdminRemarks: string | null;
  planTitle: string;
};

export function ApplicationStatusControl({
  applicationId,
  currentStatus,
  initialAdminRemarks,
  planTitle,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState<ApplicationStatus>(currentStatus);
  const [remarks, setRemarks] = useState<string>(initialAdminRemarks ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setValue(currentStatus);
    setRemarks(initialAdminRemarks ?? "");
    setMsg(null);
    setErr(null);
  }, [currentStatus, initialAdminRemarks]);

  const baselineRemarks = initialAdminRemarks ?? "";
  const dirty = value !== currentStatus || remarks !== baselineRemarks;

  const onStatusChange = (next: ApplicationStatus) => {
    setValue(next);
    const tpl = defaultAdminRemarksForStatus(next, planTitle);
    if (tpl !== null) {
      setRemarks(tpl);
    }
  };

  const save = () => {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await updateApplicationStatusAction(applicationId, value, remarks);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMsg("狀態與說明已儲存，並已寄發通知信（若 SMTP 已設定）。");
      router.refresh();
    });
  };

  const remarkPlaceholder = statusUsesRemarkPlaceholder(value)
    ? REVISION_REQUIRED_PLACEHOLDER
    : "可在此撰寫給申請者的說明，將以醒目區塊顯示於通知信（可留空）。";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">狀態更改</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-sm text-slate-700">
            <span className="mb-1.5 block text-xs text-slate-500">案件狀態</span>
            <select
              value={value}
              disabled={pending}
              onChange={(e) => onStatusChange(e.target.value as ApplicationStatus)}
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
            {pending ? "儲存中…" : "儲存並寄送通知"}
          </button>
        </div>
        {msg && <p className="mt-2 text-xs text-emerald-700">{msg}</p>}
        {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label htmlFor="admin-remarks" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          管理員說明（通知信內文）
        </label>
        <p className="mt-1 text-xs text-slate-500">
          變更狀態時會依選項自動帶入範本，可自行修改日期與內容。儲存後會更新資料庫並寄信給申請者。
        </p>
        <textarea
          id="admin-remarks"
          rows={8}
          disabled={pending}
          placeholder={remarkPlaceholder}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="mt-3 w-full resize-y rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
        />
      </div>
    </div>
  );
}
