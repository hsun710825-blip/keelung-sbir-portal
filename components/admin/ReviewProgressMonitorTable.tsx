"use client";

import { CollapsibleSection } from "@/components/admin/HorizontalScrollPanel";
import { PoLockMeetingButton } from "@/components/admin/PoLockMeetingButton";
import { evaluationStatusLabel, sessionStatusLabel } from "@/lib/committeeScoringRubric";
import { getReviewProgressCell, type ReviewProgressEvalEntry } from "@/lib/reviewProgressCells";
import type { ReviewMeetingDate } from "@/lib/reviewMeetingAgenda";

type Member = { id: string; name: string | null; email: string };
type MeetingApp = {
  agendaOrder: number;
  companyName: string;
  application: { id: string; title: string | null };
};

function MemberProgressSection({
  member,
  meetingDate,
  meetingApps,
  sessionByCommittee,
  evalMap,
}: {
  member: Member;
  meetingDate: ReviewMeetingDate;
  meetingApps: MeetingApp[];
  sessionByCommittee: Record<string, { status: string }>;
  evalMap: Record<string, ReviewProgressEvalEntry>;
}) {
  const session = sessionByCommittee[member.id];
  const sessionStatus = session?.status || "ACTIVE";
  const label = member.name?.trim() || member.email;
  const scored = meetingApps.filter((app) =>
    getReviewProgressCell(evalMap, member.id, app.application.id, sessionStatus).hasData,
  ).length;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div>
          <h3 className="font-semibold text-slate-900">{label}</h3>
          <p className="text-xs text-slate-500">
            進度 {scored}/{meetingApps.length} · 批次：{sessionStatusLabel(sessionStatus)}
          </p>
        </div>
        {String(sessionStatus).toUpperCase() !== "LOCKED_BY_PO" ? (
          <PoLockMeetingButton
            meetingDate={meetingDate}
            committeeId={member.id}
            committeeLabel={label}
          />
        ) : (
          <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            已鎖定
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-3 py-2 text-xs font-semibold text-slate-600">序</th>
              <th className="px-3 py-2 text-xs font-semibold text-slate-600">公司</th>
              <th className="px-3 py-2 text-xs font-semibold text-slate-600">計畫</th>
              <th className="px-3 py-2 text-xs font-semibold text-slate-600">分數</th>
              <th className="px-3 py-2 text-xs font-semibold text-slate-600">狀態</th>
              <th className="px-3 py-2 text-xs font-semibold text-slate-600">意見</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {meetingApps.map((app) => {
              const cell = getReviewProgressCell(
                evalMap,
                member.id,
                app.application.id,
                sessionStatus,
              );
              const badgeClass =
                cell.status === "SUBMITTED"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : cell.status === "LOCKED"
                    ? "border-slate-300 bg-slate-100 text-slate-700"
                    : cell.hasData
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-slate-200 bg-white text-slate-400";
              return (
                <tr key={app.application.id} className="hover:bg-slate-50/50">
                  <td className="px-3 py-2 tabular-nums text-slate-600">{app.agendaOrder}</td>
                  <td className="px-3 py-2 text-slate-800">{app.companyName}</td>
                  <td className="max-w-[200px] px-3 py-2 text-slate-700">
                    {app.application.title?.trim() || "—"}
                  </td>
                  <td className="px-3 py-2 font-semibold tabular-nums text-blue-800">
                    {cell.score != null ? cell.score.toFixed(0) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}
                    >
                      {cell.hasData ? evaluationStatusLabel(cell.status) : "未評"}
                    </span>
                  </td>
                  <td className="max-w-[180px] px-3 py-2 text-xs text-slate-600">
                    {cell.comment?.trim() ? (
                      <span title={cell.comment}>
                        {cell.comment.slice(0, 40)}
                        {cell.comment.length > 40 ? "…" : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ReviewProgressMonitorTable({
  meetingDate,
  primaryMembers,
  testMembers,
  meetingApps,
  sessionByCommittee,
  evalMap,
}: {
  meetingDate: ReviewMeetingDate;
  primaryMembers: Member[];
  testMembers: Member[];
  meetingApps: MeetingApp[];
  sessionByCommittee: Record<string, { status: string }>;
  evalMap: Record<string, ReviewProgressEvalEntry>;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          評分中／可修改（DRAFT）
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          已確認送出（SUBMITTED）
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
          PO 已鎖定
        </span>
      </div>

      {primaryMembers.map((member) => (
        <MemberProgressSection
          key={member.id}
          member={member}
          meetingDate={meetingDate}
          meetingApps={meetingApps}
          sessionByCommittee={sessionByCommittee}
          evalMap={evalMap}
        />
      ))}

      {testMembers.length > 0 ? (
        <CollapsibleSection
          title="測試委員（點擊展開）"
          subtitle={`共 ${testMembers.length} 位，預設收合`}
          defaultOpen={false}
        >
          <div className="space-y-4 p-4">
            {testMembers.map((member) => (
              <MemberProgressSection
                key={member.id}
                member={member}
                meetingDate={meetingDate}
                meetingApps={meetingApps}
                sessionByCommittee={sessionByCommittee}
                evalMap={evalMap}
              />
            ))}
          </div>
        </CollapsibleSection>
      ) : null}
    </div>
  );
}
