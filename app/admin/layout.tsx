import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import AdminNav, { type AdminNavItem } from "@/components/admin/AdminNav";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({ children }: { children: ReactNode }) {
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

  const navItems: AdminNavItem[] = [
    { href: "/admin", label: "後台首頁", description: "管理功能入口", icon: "home" },
    {
      href: "/admin/dashboard",
      label: "提案清單管理",
      description: "查詢與審閱申請案",
      icon: "applications",
      matchPrefix: "/admin/application/",
    },
  ];

  if (dbUser.role === Role.ADMIN) {
    navItems.push({
      href: "/admin/users",
      label: "帳號審核/管理",
      description: "維護管理員與委員權限",
      icon: "users",
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm lg:sticky lg:top-6">
          <div className="mb-4 border-b border-slate-100 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Admin Console</p>
            <p className="mt-1 truncate text-sm font-medium text-slate-900">{session.user.name ?? "管理員"}</p>
            <p className="truncate text-xs text-slate-500">{session.user.email}</p>
          </div>
          <AdminNav items={navItems} />
          <div className="mt-4 border-t border-slate-100 pt-4">
            <AdminSignOutButton />
          </div>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}

