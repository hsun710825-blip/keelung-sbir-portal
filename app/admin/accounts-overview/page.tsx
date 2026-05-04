import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { AccountOverviewExportButton } from "@/app/admin/accounts-overview/AccountOverviewExportButton";
import type { AccountOverviewRow } from "@/app/admin/accounts-overview/types";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";
import { parseKeyValueDescription } from "@/lib/parseMigratedDescription";
import { prisma } from "@/lib/prisma";
import { formatTaipeiDateTime } from "@/lib/taipeiTime";

export const metadata: Metadata = {
  title: "帳號與案件總覽",
  description: "管理員後台：一筆 Application 一列之帳號與案件總覽。",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function pickFirst(parsed: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = String(parsed[k] || "").trim();
    if (v) return v;
  }
  return "";
}

export default async function AccountsOverviewPage() {
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
  if (dbUser.role !== Role.ADMIN) {
    redirect("/admin");
  }

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

  const rows: AccountOverviewRow[] = applications.map((app) => {
    const parsed = parseKeyValueDescription(app.description);
    const companyName = app.applicant.name?.trim() || pickFirst(parsed, ["公司名稱", "公司"]);
    const contactPerson = pickFirst(parsed, ["聯絡人", "計畫主持人", "負責人"]);
    const contactPhone = pickFirst(parsed, ["聯絡電話", "聯絡電話含分機", "手機"]);
    return {
      applicationId: app.id,
      lastOpAtLabel: formatTaipeiDateTime(app.updatedAt),
      email: app.applicant.email || "—",
      planTitle: app.title?.trim() || "（未命名計畫）",
      companyName: companyName || "—",
      contactPerson: contactPerson || "—",
      contactPhone: contactPhone || "—",
    };
  });

  return (
    <section className="mx-auto max-w-6xl px-1 py-2 sm:px-2">
      <header className="mb-8 flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">帳號與案件總覽</h1>
          <p className="mt-2 text-sm text-slate-600">一筆 Application 一列，顯示最後操作時間、帳號與聯絡資訊。</p>
        </div>
        <div className="flex items-center gap-3">
          <AccountOverviewExportButton rows={rows} />
          <Link
            href="/admin"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            返回後台首頁
          </Link>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <p className="text-sm text-slate-600">
            目前共 <span className="tabular-nums font-semibold text-slate-900">{rows.length}</span> 筆案件
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">最後操作時間</th>
                <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">帳號 (Email)</th>
                <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">計畫名稱</th>
                <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">公司名稱</th>
                <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">聯絡人</th>
                <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">連絡電話</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    目前沒有可顯示的案件資料。
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.applicationId} className="transition-colors hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-slate-700">{row.lastOpAtLabel}</td>
                    <td className="max-w-[250px] px-5 py-3.5 text-slate-800">{row.email}</td>
                    <td className="max-w-[280px] px-5 py-3.5 text-slate-900">{row.planTitle}</td>
                    <td className="max-w-[220px] px-5 py-3.5 text-slate-700">{row.companyName}</td>
                    <td className="max-w-[180px] px-5 py-3.5 text-slate-700">{row.contactPerson}</td>
                    <td className="max-w-[180px] px-5 py-3.5 text-slate-700">{row.contactPhone}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
