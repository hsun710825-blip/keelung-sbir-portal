import { ReactNode } from "react";

import AdminNav, { type AdminNavItem } from "@/components/admin/AdminNav";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";

export function BackofficeShell({
  children,
  navItems,
  userName,
  userEmail,
  roleLabel,
}: {
  children: ReactNode;
  navItems: AdminNavItem[];
  userName: string;
  userEmail: string;
  roleLabel: string;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm lg:sticky lg:top-6">
          <div className="mb-4 border-b border-slate-100 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Admin Console</p>
            <p className="mt-1 truncate text-sm font-medium text-slate-900">{userName}</p>
            <p className="truncate text-xs text-slate-500">{userEmail}</p>
            <p className="mt-1 text-[11px] font-medium text-slate-600">角色：{roleLabel}</p>
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
