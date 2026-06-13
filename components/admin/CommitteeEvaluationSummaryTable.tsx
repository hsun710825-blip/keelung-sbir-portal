import Link from "next/link";

import { applicationStatusLabel } from "@/lib/applicationStatusLabels";
import {
  type ApplicationEvaluationSummaryRow,
  type CommitteeMemberColumn,
  committeeMemberDisplayLabel,
  formatAverage,
} from "@/lib/committeeEvaluationSummary";

type Props = {
  rows: ApplicationEvaluationSummaryRow[];
  committeeMembers: CommitteeMemberColumn[];
};

export function CommitteeEvaluationSummaryTable({ rows, committeeMembers }: Props) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-800">序位法綜合排序</h2>
        <p className="mt-1 text-sm text-slate-500">
          以各委員序位之平均數升序排列（序位愈小愈前）；同平均序位時以平均分數降序。僅統計已填序位之委員。
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90">
              <th className="sticky left-0 z-10 bg-slate-50/95 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
                綜合序
              </th>
              <th className="min-w-[180px] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
                計畫名稱
              </th>
              <th className="min-w-[160px] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
                申請單位
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">狀態</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">平均序位</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">平均分數</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">已評委員數</th>
              {committeeMembers.map((m) => (
                <th
                  key={m.id}
                  className="min-w-[120px] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600"
                  title={m.email}
                >
                  {committeeMemberDisplayLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7 + committeeMembers.length} className="px-5 py-12 text-center text-slate-500">
                  目前沒有委員可見階段之案件。
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.applicationId} className="hover:bg-slate-50/80">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3.5 font-semibold tabular-nums text-slate-900">
                    {row.avgRank != null ? index + 1 : "—"}
                  </td>
                  <td className="px-4 py-3.5 font-medium text-slate-900">
                    <Link
                      href={`/admin/application/${row.applicationId}`}
                      className="line-clamp-2 text-blue-700 hover:underline"
                      title={row.title}
                    >
                      {row.title}
                    </Link>
                  </td>
                  <td className="max-w-[200px] px-4 py-3.5 text-slate-700">
                    <span className="line-clamp-2" title={row.applicantLabel}>
                      {row.applicantLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-800">
                      {applicationStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 tabular-nums font-medium text-amber-900">
                    {formatAverage(row.avgRank)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-slate-800">
                    {formatAverage(row.avgScore, 1)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-slate-600">
                    {row.evaluationCount}
                  </td>
                  {committeeMembers.map((m) => {
                    const cell = row.memberCells[m.id];
                    return (
                      <td key={m.id} className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-700">
                        {cell ? (
                          <div className="space-y-0.5">
                            <p>
                              序位 <span className="font-semibold text-amber-900">{cell.rank ?? "—"}</span>
                            </p>
                            <p>
                              分數 <span className="font-medium tabular-nums">{cell.score}</span>
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400">未評</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
