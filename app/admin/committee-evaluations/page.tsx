import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { CommitteeEvaluationSummaryTable } from "@/components/admin/CommitteeEvaluationSummaryTable";
import { COMMITTEE_VISIBLE_APPLICATION_STATUSES } from "@/lib/committeeApplicationStatuses";
import { buildApplicationEvaluationSummaryRows } from "@/lib/committeeEvaluationSummary";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";
import { prisma } from "@/lib/prisma";
import { canOperateApplications, isGovReadOnlyRole } from "@/lib/rbac";
import { resolveApplicationDisplayFieldsBatch } from "@/lib/resolveApplicationDisplayFields";

export const metadata: Metadata = {
  title: "委員評分彙總",
  description: "序位法綜合排序與各委員分數序位明細",
};

export const dynamic = "force-dynamic";

export default async function AdminCommitteeEvaluationsPage() {
  const session = await getServerSession(authOptions);
  const emailRaw = session?.user?.email?.trim() || "";
  if (!session?.user?.email || !emailRaw) {
    redirect("/");
  }

  const jwtRole = session.user.role ?? null;
  if (!isBackofficePrismaRole(jwtRole)) {
    redirect("/");
  }
  if (!canOperateApplications(jwtRole) && !isGovReadOnlyRole(jwtRole)) {
    redirect("/admin/dashboard");
  }

  const [committeeMembers, applications] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: [Role.REVIEWER, Role.COMMITTEE] } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    prisma.application.findMany({
      where: { status: { in: COMMITTEE_VISIBLE_APPLICATION_STATUSES } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        submissionMode: true,
        description: true,
        reviewMeetingDate: true,
        applicant: { select: { name: true, email: true } },
        evaluations: {
          select: { committeeId: true, score: true, rank: true },
        },
      },
    }),
  ]);

  const displayMap = await resolveApplicationDisplayFieldsBatch(
    applications.map((app) => ({
      id: app.id,
      submissionMode: app.submissionMode,
      description: app.description,
    })),
  );
  const companyNameByAppId = new Map<string, string>();
  for (const app of applications) {
    const name = displayMap.get(app.id)?.companyName?.trim();
    if (name) companyNameByAppId.set(app.id, name);
  }

  const rows = buildApplicationEvaluationSummaryRows({
    applications,
    committeeMembers,
    companyNameByAppId,
  });

  return (
    <section className="space-y-6">
      <header className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">委員評分彙總</h1>
        <p className="mt-2 text-sm text-slate-600">
          彙整各審查委員對案件之<strong className="font-medium text-slate-800">序位</strong>與
          <strong className="font-medium text-slate-800">分數</strong>，並依序位法平均序位自動排序（序位數字愈小愈前）。
        </p>
        <p className="mt-2 text-xs text-slate-500">
          資料來源：委員於 <code className="rounded bg-slate-100 px-1">/committee</code> 填寫之評分；平均序位僅計入已填序位之委員。
          共 {committeeMembers.length} 位委員、{applications.length} 筆可見案件。
        </p>
      </header>

      <CommitteeEvaluationSummaryTable rows={rows} committeeMembers={committeeMembers} />
    </section>
  );
}
