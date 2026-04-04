import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { AdminGrantRoleForm } from "@/components/admin/AdminGrantRoleForm";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { RevokeBackofficeRoleButton } from "@/components/admin/RevokeBackofficeRoleButton";
import { prisma } from "@/lib/prisma";
import { formatTaipeiDateTime } from "@/lib/taipeiTime";

export const metadata: Metadata = {
  title: "後台權限管理",
  description: "預先授權管理員與審查委員",
};

export const dynamic = "force-dynamic";

function roleLabel(role: Role): string {
  if (role === Role.ADMIN) return "管理員";
  if (role === Role.COMMITTEE) return "審查委員";
  return role;
}

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  const emailRaw = session?.user?.email?.trim() || "";

  if (!session?.user?.email || !emailRaw) {
    redirect("/");
  }

  const dbUser = await prisma.user.findFirst({
    where: { email: { equals: emailRaw, mode: "insensitive" } },
    select: { id: true, role: true },
  });

  if (!dbUser || dbUser.role !== Role.ADMIN) {
    redirect("/admin/dashboard");
  }

  const privileged = await prisma.user.findMany({
    where: { role: { in: [Role.ADMIN, Role.COMMITTEE] } },
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Admin</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">後台權限管理</h1>
            <p className="mt-2 text-sm text-slate-600">
              {session.user.name ?? "管理員"} · {session.user.email}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              預先輸入 Google 登入用 Email 並指定角色；對方首次以該帳號登入時即套用權限。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/dashboard"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              案件總表
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              首頁
            </Link>
            <AdminSignOutButton />
          </div>
        </header>

        <section className="mb-8 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800">新增／更新授權</h2>
          <p className="mt-1 text-sm text-slate-500">若 Email 已存在於系統，將只更新角色；否則建立新 User 列（待首次 OAuth 綁定）。</p>
          <div className="mt-6">
            <AdminGrantRoleForm />
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-800">目前後台名單</h2>
            <p className="mt-0.5 text-sm text-slate-500">角色為管理員或審查委員的帳號（共 {privileged.length} 人）</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">Email</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">顯示名稱</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">角色</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">最後更新</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {privileged.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                      尚無後台帳號。
                    </td>
                  </tr>
                ) : (
                  privileged.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-800">{row.email}</td>
                      <td className="px-5 py-3.5 text-slate-700">{row.name?.trim() || "—"}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                            row.role === Role.ADMIN
                              ? "border-violet-200 bg-violet-50 text-violet-900"
                              : "border-sky-200 bg-sky-50 text-sky-900"
                          }`}
                        >
                          {roleLabel(row.role)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-slate-600">
                        {formatTaipeiDateTime(row.updatedAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <RevokeBackofficeRoleButton userId={row.id} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
