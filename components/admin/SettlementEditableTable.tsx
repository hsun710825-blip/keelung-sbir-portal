"use client";

import { useActionState } from "react";

import { HorizontalScrollPanel } from "@/components/admin/HorizontalScrollPanel";

import {
  saveSettlementCommitteeConfigAction,
  saveSettlementRowAction,
  type SettlementActionState,
} from "@/app/admin/settlement/actions";
import type { SettlementCommitteeConfig } from "@/lib/settlementConfig";
import {
  formatFundingAmount,
  formatRatioPercent,
  formatTierRatePercent,
} from "@/lib/settlementFormulas";
import type { SettlementRow } from "@/lib/settlementTable";

function FundingInput({
  formId,
  name,
  defaultValue,
  step = "1",
}: {
  formId: string;
  name: string;
  defaultValue: number | null;
  step?: string;
}) {
  return (
    <input
      form={formId}
      name={name}
      type="number"
      min={0}
      step={step}
      defaultValue={defaultValue ?? ""}
      className="w-20 rounded border border-slate-200 px-2 py-1 text-sm tabular-nums"
      placeholder="千"
    />
  );
}

function ReadOnlyCell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-2 py-2 text-center text-sm tabular-nums text-slate-800 ${className}`}>{children}</td>
  );
}

function SettlementRowEditor({
  row,
  memberNames,
  showProposalType = false,
}: {
  row: SettlementRow;
  memberNames: string[];
  showProposalType?: boolean;
}) {
  const [state, action, pending] = useActionState(saveSettlementRowAction, {} as SettlementActionState);
  const formId = `settlement-row-${row.applicationId}`;

  return (
    <>
      <td className="px-2 py-2 text-center font-semibold tabular-nums">{row.overallRank ?? "—"}</td>
      <td className="px-2 py-2 text-center tabular-nums">{row.briefingOrder}</td>
      {showProposalType ? (
        <td className="px-2 py-2 text-center text-xs">
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 font-medium ${
              row.isJoint
                ? "border-violet-200 bg-violet-50 text-violet-800"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {row.isJoint ? "聯合" : "一般"}
          </span>
        </td>
      ) : null}
      <td className="min-w-[120px] px-2 py-2">{row.companyName}</td>
      <td className="min-w-[200px] px-2 py-2 text-sm">{row.title}</td>
      <td className="px-2 py-2">
        <FundingInput formId={formId} name="appliedSubsidy" defaultValue={row.appliedSubsidy} />
      </td>
      <td className="px-2 py-2">
        <FundingInput formId={formId} name="appliedSelfFund" defaultValue={row.appliedSelfFund} />
      </td>
      <td className="px-2 py-2">
        <FundingInput formId={formId} name="appliedTotal" defaultValue={row.appliedTotal} />
      </td>
      <ReadOnlyCell>{formatFundingAmount(row.suggestedSubsidy)}</ReadOnlyCell>
      <ReadOnlyCell>{formatFundingAmount(row.suggestedSelfFund)}</ReadOnlyCell>
      <ReadOnlyCell>{formatFundingAmount(row.suggestedTotal)}</ReadOnlyCell>
      {row.committeeScores.map((s, i) => (
        <ReadOnlyCell key={`s-${memberNames[i] ?? i}`}>{s != null ? String(Math.round(s)) : "—"}</ReadOnlyCell>
      ))}
      <ReadOnlyCell>{row.avgScore != null ? row.avgScore.toFixed(1) : "—"}</ReadOnlyCell>
      <ReadOnlyCell>{formatRatioPercent(row.subsidyRatio)}</ReadOnlyCell>
      <ReadOnlyCell>{formatRatioPercent(row.totalSubsidyRatio)}</ReadOnlyCell>
      <td className="px-2 py-2">
        <FundingInput
          formId={formId}
          name="tierRate"
          defaultValue={row.subsidyGradeRatio}
          step="0.01"
        />
        <div className="mt-0.5 text-[10px] text-slate-500">{formatTierRatePercent(row.subsidyGradeRatio)}</div>
      </td>
      <td className="px-2 py-2">
        <form id={formId} action={action}>
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

function SettlementTableHeader({
  memberNames,
  showProposalType = false,
}: {
  memberNames: string[];
  showProposalType?: boolean;
}) {
  const th = "border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-xs font-semibold text-slate-700";
  return (
    <thead className="sticky top-0 z-10">
      <tr>
        <th className={th} rowSpan={3}>
          總排序
        </th>
        <th className={th} rowSpan={3}>
          編號
        </th>
        {showProposalType ? (
          <th className={th} rowSpan={3}>
            類型
          </th>
        ) : null}
        <th className={th} rowSpan={3}>
          申請單位
        </th>
        <th className={th} rowSpan={3}>
          計畫名稱
        </th>
        <th className={th} colSpan={3}>
          申請
        </th>
        <th className={th} colSpan={3}>
          建議
        </th>
        <th className={th} colSpan={3}>
          委員評分
        </th>
        <th className={th} rowSpan={2}>
          分數
        </th>
        <th className={th} rowSpan={2}>
          補助額度
        </th>
        <th className={th} rowSpan={2}>
          總補助
        </th>
        <th className={th} rowSpan={3}>
          比例係數(R)
        </th>
        <th className={th} rowSpan={3}>
          操作
        </th>
      </tr>
      <tr>
        <th className={th}>補助款</th>
        <th className={th}>自籌款</th>
        <th className={th}>總經費</th>
        <th className={th}>補助款</th>
        <th className={th}>自籌款</th>
        <th className={th}>總經費</th>
        <th className={th}>A</th>
        <th className={th}>B</th>
        <th className={th}>C</th>
      </tr>
      <tr>
        <th className={th}>(千)</th>
        <th className={th}>(千)</th>
        <th className={th}>(千)</th>
        <th className={th}>(千)</th>
        <th className={th}>(千)</th>
        <th className={th}>(千)</th>
        {memberNames.map((n) => (
          <th key={`n-${n}`} className={th}>
            {n}
          </th>
        ))}
        <th className={th}>平均</th>
        <th className={th}>補助比例</th>
        <th className={th}>比例</th>
      </tr>
    </thead>
  );
}

export function SettlementEditableTable({
  title,
  rows,
  memberNames,
  showProposalType = false,
}: {
  title: string;
  rows: SettlementRow[];
  memberNames: string[];
  showProposalType?: boolean;
}) {
  const colCount = showProposalType ? 19 : 18;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <HorizontalScrollPanel>
          <table className="w-full min-w-[1500px] border-collapse text-left text-sm">
            <SettlementTableHeader memberNames={memberNames} showProposalType={showProposalType} />
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-8 text-center text-slate-500">
                    無資料
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.applicationId} className="hover:bg-slate-50/80">
                    <SettlementRowEditor
                      row={row}
                      memberNames={memberNames}
                      showProposalType={showProposalType}
                    />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </HorizontalScrollPanel>
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
        <div className="flex items-center gap-3 md:col-span-3">
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
