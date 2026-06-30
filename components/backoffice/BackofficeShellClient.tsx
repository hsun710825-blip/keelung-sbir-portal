"use client";

import { ChevronLeft, ChevronRight, PanelLeft } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";

import AdminNav, { type AdminNavItem } from "@/components/admin/AdminNav";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";

const STORAGE_KEY = "backoffice-sidebar-collapsed";

export function BackofficeShellClient({
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
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50">
      <div
        className={`mx-auto grid max-w-[1600px] grid-cols-1 gap-4 px-4 py-6 sm:px-6 lg:px-8 ${
          collapsed ? "lg:grid-cols-[56px_minmax(0,1fr)]" : "lg:grid-cols-[260px_minmax(0,1fr)]"
        }`}
      >
        <aside
          className={`relative h-fit rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:sticky lg:top-6 ${
            collapsed ? "p-2" : "p-4"
          }`}
        >
          <button
            type="button"
            onClick={toggle}
            className="absolute -right-3 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            aria-label={collapsed ? "展開側欄" : "收合側欄"}
            title={collapsed ? "展開側欄" : "收合側欄"}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>

          {collapsed ? (
            <div className="flex flex-col items-center gap-3 pt-1">
              <PanelLeft className="h-5 w-5 text-slate-400" aria-hidden />
              <AdminSignOutButton compact />
            </div>
          ) : (
            <>
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
            </>
          )}
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
