import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { CommitteePersonalScoreTable } from "@/components/committee/CommitteePersonalScoreTable";
import { loadCommitteePersonalScores } from "@/lib/committeePersonalScores";
import { prisma } from "@/lib/prisma";
import { isReviewerRole } from "@/lib/rbac";
import {
  isReviewMeetingDate,
  reviewMeetingDateLabel,
  type ReviewMeetingDate,
} from "@/lib/reviewMeetingAgenda";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ date: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  if (!isReviewMeetingDate(date)) return { title: "評分總表" };
  return { title: `${reviewMeetingDateLabel(date)} — 我的評分總表` };
}

export default async function CommitteeMeetingSummaryPage({ params }: PageProps) {
  const { date } = await params;
  if (!isReviewMeetingDate(date)) notFound();
  const meetingDate = date as ReviewMeetingDate;

  const session = await getServerSession(authOptions);
  const emailRaw = session?.user?.email?.trim() || "";
  if (!session?.user?.email || !emailRaw) redirect("/");

  const dbUser = await prisma.user.findFirst({
    where: { email: { equals: emailRaw, mode: "insensitive" } },
    select: { id: true, role: true },
  });
  if (!dbUser || !isReviewerRole(dbUser.role)) redirect("/");

  const data = await loadCommitteePersonalScores(dbUser.id, meetingDate);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href={`/committee/meeting/${meetingDate}`}
              className="text-sm font-medium text-blue-700 hover:underline"
            >
              ← 返回議程列表
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">
              {reviewMeetingDateLabel(meetingDate)} — 我的評分總表
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              已評 {data.scoredCount} / {data.totalCases} 案 · 依總分由高至低排序
            </p>
          </div>
          <AdminSignOutButton />
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <CommitteePersonalScoreTable
            meetingDate={meetingDate}
            rows={data.rows}
            sessionStatus={data.sessionStatus}
            canEdit={data.canEdit}
          />
        </section>
      </div>
    </main>
  );
}
