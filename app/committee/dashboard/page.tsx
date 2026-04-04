import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { applicationStatusLabel } from "@/lib/applicationStatusLabels";
import { COMMITTEE_VISIBLE_APPLICATION_STATUSES } from "@/lib/committeeApplicationStatuses";
import { prisma } from "@/lib/prisma";
import { formatTaipeiDateTime } from "@/lib/taipeiTime";

export const metadata: Metadata = {
  title: "委員審查總表",
  description: "審查委員：初審通過後案件列表",
};

export const dynamic = "force-dynamic";

export default async function CommitteeDashboardPage() {
  const session = await getServerSession(authOptions);
  const emailRaw = session?.user?.email?.trim() || "";

  if (!session?.user?.email || !emailRaw) {
    redirect("/");
  }

  const dbUser = await prisma.user.findFirst({
    where: { email: { equals: emailRaw, mode: "insensitive" } },
    select: { id: true, role: true },
  });

  if (!dbUser || dbUser.role !== Role.COMMITTEE) {
    redirect("/");
  }

  const applications = await prisma.application.findMany({
    where: { status: { in: COMMITTEE_VISIBLE_APPLICATION_STATUSES } },
    orderBy: { updatedAt: "desc" },
    include: {
      applicant: {
        select: { name: true, email: true },
      },
      evaluations: {
        where: { committeeId: dbUser.id },
        select: { id: true },
      },
    },
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Committee</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">審查案件總表</h1>
            <p className="mt-2 text-sm text-slate-600">
              {session.user.name ?? "委員"} · {session.user.email}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              僅列出狀態為「初審通過」及之後階段之案件；請點擊列進入評分與檢視。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              返回首頁
            </Link>
            <AdminSignOutButton />
          </div>
        </header>

        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-800">案件列表</h2>
            <p className="mt-0.5 text-sm text-slate-500">共 {applications.length} 筆</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">計畫名稱</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">申請公司／聯絡</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">送件／更新</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">狀態</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">評分</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                      目前沒有符合條件的案件（需管理員將狀態設為「初審通過」或之後階段）。
                    </td>
                  </tr>
                ) : (
                  applications.map((row) => {
                    const companyLabel =
                      [row.applicant.name, row.applicant.email].filter(Boolean).join(" · ") || "—";
                    const titleText = row.title?.trim() ? row.title : "（未命名計畫）";
                    const done = row.evaluations.length > 0;
                    return (
                      <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="max-w-[220px] px-5 py-3.5 font-medium text-slate-900">
                          <Link
                            href={`/committee/application/${row.id}`}
                            className="line-clamp-2 text-blue-700 hover:text-blue-900 hover:underline"
                            title={titleText}
                          >
                            {titleText}
                          </Link>
                        </td>
                        <td className="max-w-[200px] px-5 py-3.5 text-slate-700">
                          <span className="line-clamp-2 text-sm" title={companyLabel}>
                            {companyLabel}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-slate-600">
                          {formatTaipeiDateTime(row.updatedAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                            {applicationStatusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {done ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                              已評分
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                              未評分
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
