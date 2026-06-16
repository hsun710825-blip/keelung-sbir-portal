"use client";

import { useActionState } from "react";

import {
  saveSettlementCommitteeConfigAction,
  saveSettlementRowAction,
  type SettlementActionState,
} from "@/app/admin/settlement/actions";
import type { SettlementCommitteeConfig } from "@/lib/settlementConfig";
import type { SettlementRow } from "@/lib/settlementTable";

function SettlementRowEditor({ row }: { row: SettlementRow }) {
  const [state, action, pending] = useActionState(saveSettlementRowAction, {} as SettlementActionState);

  return (
    <>
      <td className="px-2 py-2 tabular-nums text-center font-semibold">{row.overallRank}</td>
      <td className="px-2 py-2 tabular-nums text-center">{row.briefingOrder}</td>
      <td className="px-2 py-2">{row.companyName}</td>
      <td className="max-w-[200px] px-2 py-2 text-sm">{row.title}</td>
      <td className="px-2 py-2">
        <input
          form={`settlement-row-${row.applicationId}`}
          name="suggestedSubsidy"
          type="number"
          min={0}
          defaultValue={row.suggestedSubsidy ?? ""}
          className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
          placeholder="千"
        />
      </td>
      <td className="px-2 py-2">
        <input
          form={`settlement-row-${row.applicationId}`}
          name="suggestedSelfFund"
          type="number"
          min={0}
          defaultValue={row.suggestedSelfFund ?? ""}
          className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
          placeholder="千"
        />
      </td>
      <td className="px-2 py-2">
        <input
          form={`settlement-row-${row.applicationId}`}
          name="suggestedTotal"
          type="number"
          min={0}
          defaultValue={row.suggestedTotal ?? ""}
          className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
          placeholder="千"
        />
      </td>
      {row.committeeScores.map((s, i) => (
        <td key={`s-${i}`} className="px-2 py-2 tabular-nums text-center">
          {s != null ? s.toFixed(0) : "—"}
        </td>
      ))}
      <td className="px-2 py-2 tabular-nums text-center">
        {row.avgScore != null ? row.avgScore.toFixed(1) : "—"}
      </td>
      {row.committeeRanks.map((r, i) => (
        <td key={`r-${i}`} className="px-2 py-2 tabular-nums text-center">
          {r ?? "—"}
        </td>
      ))}
      <td className="px-2 py-2 tabular-nums text-center">{row.rankSum ?? "—"}</td>
      <td className="px-2 py-2">
        <form id={`settlement-row-${row.applicationId}`} action={action}>
          <input type="hidden" name="applicationId" value={row.applicationId} />
          <button
            type="submit"
            disabled={pending}
            className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 disabled:opacity-60"
          >
            {pending ? "…" : "儲存"}
          </button>
          {state.message ? <span className="ml-1 text-[10px] text-emerald-700">✓</span> : null}
          {state.error ? <span className="ml-1 text-[10px] text-red-600">{state.error}</span> : null}
        </form>
      </td>
    </>
  );
}

export function SettlementEditableTable({
  title,
  rows,
  memberNames,
}: {
  title: string;
  rows: SettlementRow[];
  memberNames: string[];
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs">
              <th className="px-2 py-2">總排序</th>
              <th className="px-2 py-2">編號排序</th>
              <th className="px-2 py-2">申請單位</th>
              <th className="px-2 py-2">計畫名稱</th>
              <th className="px-2 py-2">建議補助(千)</th>
              <th className="px-2 py-2">建議自籌(千)</th>
              <th className="px-2 py-2">建議總計(千)</th>
              {memberNames.map((n) => (
                <th key={`s-${n}`} className="px-2 py-2">
                  {n}分
                </th>
              ))}
              <th className="px-2 py-2">平均</th>
              {memberNames.map((n) => (
                <th key={`r-${n}`} className="px-2 py-2">
                  {n}序
                </th>
              ))}
              <th className="px-2 py-2">序位加總</th>
              <th className="px-2 py-2">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={20} className="px-4 py-8 text-center text-slate-500">
                  無資料
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.applicationId} className="hover:bg-slate-50/80">
                  <SettlementRowEditor row={row} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SettlementCommitteeConfigPanel({
  config,
  reviewerOptions,
}: {
  config: SettlementCommitteeConfig;
  reviewerOptions: Array<{ id: string; name: string | null; email: string }>;
}) {
  const [state, formAction, pending] = useActionState(saveSettlementCommitteeConfigAction, {} as SettlementActionState);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">委員設定</h2>
      <p className="mt-1 text-sm text-slate-600">
        選擇三位審查委員帳號，並可調整決算清表上顯示的姓名（無需重新部署）。
      </p>
      <form action={formAction} className="mt-4 grid gap-4 md:grid-cols-3">
        {config.slots.map((slot, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
            <p className="text-xs font-medium text-slate-500">委員 {i + 1}</p>
            <label className="block text-xs text-slate-600">
              系統帳號
              <select
                name={`slot${i}UserId`}
                defaultValue={slot.userId}
                className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">（未指定）</option>
                {reviewerOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name?.trim() || u.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-600">
              清表顯示姓名
              <input
                name={`slot${i}DisplayName`}
                type="text"
                defaultValue={slot.displayName}
                className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        ))}
        <div className="md:col-span-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "儲存中…" : "儲存委員設定"}
          </button>
          {state.message ? <span className="text-sm text-emerald-700">{state.message}</span> : null}
          {state.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
        </div>
      </form>
    </section>
  );
}
