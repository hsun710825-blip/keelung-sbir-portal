import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { applicationStatusLabel } from "@/lib/applicationStatusLabels";
import { loadMeetingApplications } from "@/lib/committeeMeetingApplications";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";
import { prisma } from "@/lib/prisma";
import { isReviewerRole } from "@/lib/rbac";
import {
  getReviewMeetingConfig,
  isReviewMeetingDate,
  reviewMeetingDateLabel,
  type ReviewMeetingDate,
} from "@/lib/reviewMeetingAgenda";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ date: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  if (!isReviewMeetingDate(date)) return { title: "審查會議" };
  return { title: `${reviewMeetingDateLabel(date)} — 議程列表` };
}

export default async function CommitteeMeetingPage({ params }: PageProps) {
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

  await ensureEvaluationSchema();
  const config = getReviewMeetingConfig(meetingDate);
  const rows = await loadMeetingApplications(meetingDate);

  const evaluations = await prisma.evaluation.findMany({
    where: { committeeId: dbUser.id, meetingDate },
    select: { applicationId: true, score: true },
  });
  const evalByApp = new Map(evaluations.map((e) => [e.applicationId, e]));

  return (
    <section className="space-y-6">
      <header className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <Link href="/committee/dashboard" className="text-sm font-medium text-blue-700 hover:underline">
          ← 返回場次選擇
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{config.label}</h1>
        <p className="mt-1 text-sm text-slate-600">{config.dateLabel} · 依議程表順序排列</p>
        <Link
          href="/committee/summary"
          className="mt-3 inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800"
        >
          我的評分總表
        </Link>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-800">議程案件列表</h2>
          <p className="text-sm text-slate-500">共 {rows.length} 案</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-600">順序</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-600">時段</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-600">公司名稱</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-600">計畫名稱</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-600">類型</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-600">狀態</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-600">評分</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    此場次尚無對應案件
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const ev = evalByApp.get(row.application.id);
                  const title = row.application.title?.trim() || row.agendaProject;
                  const isJoint = String(row.application.reviewProposalType || "").toUpperCase() === "JOINT";
                  return (
                    <tr key={row.application.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-semibold tabular-nums">{row.agendaOrder}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.agendaTime}</td>
                      <td className="px-4 py-3 text-slate-800">{row.companyName}</td>
                      <td className="max-w-[280px] px-4 py-3">
                        <Link
                          href={`/committee/application/${row.application.id}?meeting=${meetingDate}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs">{isJoint ? "聯合提案" : "一般"}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">
                          {applicationStatusLabel(row.application.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {ev ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            {ev.score.toFixed(0)} 分
                          </span>
                        ) : (
                          <Link
                            href={`/committee/application/${row.application.id}?meeting=${meetingDate}`}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900"
                          >
                            開始評分
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
