import { formatQualifiesLabel } from "@/lib/youthId/formatCommitteeNote";
import type { YouthVerificationRow } from "@/lib/youthId/types";

export function YouthIdVerificationTable({ rows }: { rows: YouthVerificationRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[960px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-3 py-3 text-xs font-semibold uppercase text-slate-600">序</th>
            <th className="px-3 py-3 text-xs font-semibold uppercase text-slate-600">公司名稱</th>
            <th className="px-3 py-3 text-xs font-semibold uppercase text-slate-600">計畫名稱</th>
            <th className="px-3 py-3 text-xs font-semibold uppercase text-slate-600">負責人</th>
            <th className="px-3 py-3 text-xs font-semibold uppercase text-slate-600">設籍縣市</th>
            <th className="px-3 py-3 text-xs font-semibold uppercase text-slate-600">年齡</th>
            <th className="px-3 py-3 text-xs font-semibold uppercase text-slate-600">是否符合</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) =>
            row.persons.map((person, personIdx) => (
              <tr key={`${row.applicationId}-${personIdx}`} className="align-top">
                {personIdx === 0 ? (
                  <>
                    <td className="px-3 py-3 tabular-nums text-slate-700" rowSpan={row.persons.length}>
                      {row.overallRank ?? "—"}
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-900" rowSpan={row.persons.length}>
                      {row.companyName}
                      {row.isJoint ? (
                        <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
                          聯合
                        </span>
                      ) : null}
                      {row.warnings.length > 0 ? (
                        <ul className="mt-2 list-disc pl-4 text-xs font-normal text-amber-800">
                          {row.warnings.map((w) => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-800" rowSpan={row.persons.length}>
                      {row.title}
                    </td>
                  </>
                ) : null}
                <td className="px-3 py-3 text-slate-900">{person.responsibleName || "—"}</td>
                <td className="px-3 py-3 text-slate-700">{person.registeredCity || "—"}</td>
                <td className="px-3 py-3 tabular-nums text-slate-700">{person.age ?? "—"}</td>
                <td className="px-3 py-3 text-slate-700">{formatQualifiesLabel(person.qualifies)}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
