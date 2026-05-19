import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Prisma, Role } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { AdminGrantRoleForm } from "@/components/admin/AdminGrantRoleForm";
import { RevokeBackofficeRoleButton } from "@/components/admin/RevokeBackofficeRoleButton";
import { ensureRbacRoleEnumValues } from "@/lib/ensureRbacRoleEnums";
import { prisma } from "@/lib/prisma";
import { canManageBackofficeAccounts, normalizeEmailForCompare, roleDisplayLabel, SUPER_ADMIN_EMAIL_FORCED } from "@/lib/rbac";
import { formatTaipeiDateTime } from "@/lib/taipeiTime";

type PrivilegedUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
};

async function loadPrivilegedUsers(): Promise<{ rows: PrivilegedUserRow[]; loadError: string | null }> {
  await ensureRbacRoleEnumValues();
  try {
    const rows = await prisma.user.findMany({
      where: { role: { not: Role.USER } },
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
    return {
      rows: rows.map((r) => ({ ...r, role: String(r.role) })),
      loadError: null,
    };
  } catch (e) {
    console.error("[admin/users] prisma.user.findMany failed:", e);
    try {
      const raw = await prisma.$queryRaw<
        Array<{
          id: string;
          email: string;
          name: string | null;
          role: string;
          createdAt: Date;
          updatedAt: Date;
        }>
      >(Prisma.sql`
        SELECT id, email, name, role::text AS role, "createdAt", "updatedAt"
        FROM "User"
        WHERE role::text <> 'USER'
        ORDER BY role ASC, email ASC
      `);
      return { rows: raw, loadError: null };
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : String(e2);
      return { rows: [], loadError: msg || "無法載入後台帳號列表" };
    }
  }
}

export const metadata: Metadata = {
  title: "後台權限管理",
  description: "最高管理員：PO／市府／委員帳號授權",
};

export const dynamic = "force-dynamic";

function roleBadgeClass(role: string): string {
  if (role === "SUPER_ADMIN") return "border-violet-300 bg-violet-100 text-violet-950";
  if (role === "ADMIN") return "border-indigo-200 bg-indigo-50 text-indigo-950";
  if (role === "GOV") return "border-sky-200 bg-sky-50 text-sky-950";
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  const emailRaw = session?.user?.email?.trim() || "";

  if (!session?.user?.email || !emailRaw) {
    redirect("/");
  }

  const jwtRole = session.user.role ?? null;
  if (!canManageBackofficeAccounts(jwtRole)) {
    redirect("/admin/dashboard");
  }

  const { rows: privileged, loadError } = await loadPrivilegedUsers();

  return (
    <section className="mx-auto max-w-4xl px-1 py-2 sm:px-2">
      <header className="mb-8 flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">後台權限管理</h1>
          <p className="mt-2 text-sm text-slate-600">
            {session.user.name ?? "管理員"} · {session.user.email}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            僅最高管理員可新增／移除 PO人員、市府人員與審查委員。受保護之最高管理員帳號不可移除此處權限。
          </p>
        </div>
      </header>

      {loadError ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
          無法載入帳號列表：{loadError}
        </div>
      ) : null}

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
          <p className="mt-0.5 text-sm text-slate-500">具後台或委員權限之帳號（共 {privileged.length} 人）</p>
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
                privileged.map((row) => {
                  const displayRole = row.role === "COMMITTEE" ? "REVIEWER" : row.role;
                  const protectedSuper = normalizeEmailForCompare(row.email) === normalizeEmailForCompare(SUPER_ADMIN_EMAIL_FORCED);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-800">{row.email}</td>
                      <td className="px-5 py-3.5 text-slate-700">{row.name?.trim() || "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${roleBadgeClass(row.role)}`}>
                          {roleDisplayLabel(displayRole)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-slate-600">
                        {formatTaipeiDateTime(row.updatedAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <RevokeBackofficeRoleButton userId={row.id} disabled={protectedSuper || row.role === "SUPER_ADMIN"} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
