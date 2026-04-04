import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { applicationStatusLabel } from "@/lib/applicationStatusLabels";
import { prisma } from "@/lib/prisma";
import { formatTaipeiDateTime } from "@/lib/taipeiTime";

export const metadata: Metadata = {
  title: "案件總表",
  description: "管理員後台：Prisma 案件總表",
};

/** 依登入與 DB 即時渲染，避免被誤判為靜態頁面 */
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  const emailRaw = session?.user?.email?.trim() || "";

  if (!session?.user?.email || !emailRaw) {
    redirect("/");
  }

  const dbUser = await prisma.user.findFirst({
    where: { email: { equals: emailRaw, mode: "insensitive" } },
    select: { role: true },
  });

  if (!dbUser || !isBackofficePrismaRole(dbUser.role)) {
    redirect("/");
  }

  const isAdmin = dbUser.role === Role.ADMIN;

  const applications = await prisma.application.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      applicant: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Admin</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">案件總表</h1>
            <p className="mt-2 text-sm text-slate-600">
              {session.user.name ?? "管理員"} · {session.user.email}
            </p>
            {!isAdmin ? (
              <p className="mt-2 text-xs text-amber-800">
                您為審查委員身分：可檢視列表；案件詳情與狀態變更僅限管理員。
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              返回首頁
            </Link>
            <Link
              href="/admin"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              後台（Sheets）
            </Link>
            <AdminSignOutButton />
          </div>
        </header>

        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-800">全部申請案</h2>
            <p className="mt-0.5 text-sm text-slate-500">共 {applications.length} 筆（Prisma）</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90">
                  <th scope="col" className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    計畫名稱
                  </th>
                  <th scope="col" className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    申請人／公司
                  </th>
                  <th scope="col" className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    送件時間
                  </th>
                  <th scope="col" className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    目前狀態
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-500">
                      尚無申請資料。請在資料庫建立測試資料後重新整理此頁。
                    </td>
                  </tr>
                ) : (
                  applications.map((row) => {
                    const applicantLabel =
                      [row.applicant.name, row.applicant.email].filter(Boolean).join(" · ") || "—";
                    const titleText = row.title?.trim() ? row.title : "（未命名計畫）";
                    return (
                      <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="max-w-[220px] px-5 py-3.5 font-medium text-slate-900">
                          {isAdmin ? (
                            <Link
                              href={`/admin/application/${row.id}`}
                              className="line-clamp-2 text-blue-700 hover:text-blue-900 hover:underline"
                              title={titleText}
                            >
                              {titleText}
                            </Link>
                          ) : (
                            <span className="line-clamp-2" title={titleText}>
                              {titleText}
                            </span>
                          )}
                        </td>
                        <td className="max-w-[200px] px-5 py-3.5 text-slate-700">
                          <span className="line-clamp-2" title={applicantLabel}>
                            {applicantLabel}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-slate-600">
                          {formatTaipeiDateTime(row.createdAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                            {applicationStatusLabel(row.status)}
                          </span>
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
