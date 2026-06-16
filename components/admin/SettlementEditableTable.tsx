"use client";

import { useActionState } from "react";

import { saveSettlementRowAction, type SettlementActionState } from "@/app/admin/settlement/actions";
import type { SettlementRow } from "@/lib/settlementTable";

function SettlementRowForm({ row }: { row: SettlementRow }) {
  const [state, action, pending] = useActionState(saveSettlementRowAction, {} as SettlementActionState);
  return (
    <form action={action} className="contents">
      <input type="hidden" name="applicationId" value={row.applicationId} />
      <td className="px-2 py-2 tabular-nums">{row.overallRank}</td>
      <td className="px-2 py-2">{row.companyName}</td>
      <td className="max-w-[200px] px-2 py-2 text-sm">{row.title}</td>
      <td className="px-2 py-2">
        <input
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
      <td className="px-2 py-2 tabular-nums text-center font-semibold">{row.overallRank}</td>
      <td className="px-2 py-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 disabled:opacity-60"
        >
          {pending ? "…" : "儲存"}
        </button>
        {state.message ? <span className="ml-1 text-[10px] text-emerald-700">✓</span> : null}
      </td>
    </form>
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
              <th className="px-2 py-2">總排序</th>
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
                  <SettlementRowForm row={row} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
