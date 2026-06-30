import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { ReviewProgressMonitorTable } from "@/components/admin/ReviewProgressMonitorTable";
import { loadReviewProgressForAdmin } from "@/lib/committeePersonalScores";
import { canOperateApplications } from "@/lib/rbac";
import {
  REVIEW_MEETING_DATES,
  isReviewMeetingDate,
  reviewMeetingDateLabel,
  type ReviewMeetingDate,
} from "@/lib/reviewMeetingAgenda";

export const metadata: Metadata = {
  title: "審查進度監看",
  description: "PO 即時監看委員評分進度",
};

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ meeting?: string }> };

export default async function AdminReviewProgressPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const role = session.user.role ?? null;
  if (!canOperateApplications(role)) redirect("/admin/dashboard");

  const sp = await searchParams;
  const meetingParam = sp.meeting?.trim() || "0622";
  const meetingDate: ReviewMeetingDate = isReviewMeetingDate(meetingParam) ? meetingParam : "0622";

  const data = await loadReviewProgressForAdmin(meetingDate);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">審查進度監看</h1>
        <p className="mt-2 text-sm text-slate-600">
          即時檢視各委員評分進度，包含暫存（DRAFT）分數與審查意見；可於確認後鎖定委員編輯。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {REVIEW_MEETING_DATES.map((d) => (
            <Link
              key={d}
              href={`/admin/review-progress?meeting=${d}`}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                d === meetingDate
                  ? "bg-blue-600 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {reviewMeetingDateLabel(d)}
            </Link>
          ))}
        </div>
      </header>

      <ReviewProgressMonitorTable
        meetingDate={meetingDate}
        primaryMembers={data.primaryMembers}
        testMembers={data.testMembers}
        meetingApps={data.meetingApps}
        sessionByCommittee={data.sessionByCommittee}
        evalMap={data.evalMap}
      />
    </section>
  );
}
