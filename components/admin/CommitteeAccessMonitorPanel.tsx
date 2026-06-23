"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { CommitteeAccessLogRow } from "@/lib/committeeAccessLog";
import { RESTRICTED_COMMITTEE_EMAILS } from "@/lib/committeeAccessWindow";
import { formatTaipeiDateTime } from "@/lib/taipeiTime";

type Props = {
  logs: CommitteeAccessLogRow[];
};

export function CommitteeAccessMonitorPanel({ logs }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-base font-semibold text-slate-900">指定委員登入紀錄</h2>
          <p className="mt-1 text-sm text-slate-600">
            鎖定期間嘗試進入後台之紀錄（共 {logs.length} 筆，顯示最近 200 筆）
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-slate-200 px-5 pb-5 pt-4">
          <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="font-medium text-slate-900">鎖定對象（3 位）</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {RESTRICTED_COMMITTEE_EMAILS.map((email) => (
                <li key={email}>{email}</li>
              ))}
            </ul>
            <p className="mt-3 text-slate-600">
              開放時段：2026/07/01 00:00 ～ 17:00（台北時間）；其餘時間鎖定。
            </p>
          </div>

          {logs.length === 0 ? (
            <p className="text-sm text-slate-500">尚無登入紀錄。</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">時間（台北）</th>
                    <th className="px-3 py-2 font-medium">委員</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">事件</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {formatTaipeiDateTime(row.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-slate-900">{row.name?.trim() || "—"}</td>
                      <td className="px-3 py-2 text-slate-700">{row.email}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {row.event === "ACCESS_BLOCKED" ? "鎖定期嘗試登入" : row.event}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
