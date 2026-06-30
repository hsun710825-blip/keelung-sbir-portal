"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, ClipboardList, Home, LayoutDashboard, ShieldCheck } from "lucide-react";

export type AdminNavChildItem = {
  href: string;
  label: string;
  matchPrefix?: string;
  /** Highlight when on /committee/application/...?meeting=... */
  meetingDateKey?: string;
};

export type AdminNavItem = {
  href: string;
  label: string;
  description?: string;
  icon?: "home" | "dashboard" | "users" | "applications" | "evaluations";
  matchPrefix?: string;
  children?: AdminNavChildItem[];
};

const iconClass = "h-4 w-4 shrink-0";

function resolveIcon(name: AdminNavItem["icon"]) {
  if (name === "home") return <Home className={iconClass} />;
  if (name === "users") return <ShieldCheck className={iconClass} />;
  if (name === "applications") return <ClipboardList className={iconClass} />;
  if (name === "evaluations") return <BarChart3 className={iconClass} />;
  return <LayoutDashboard className={iconClass} />;
}

function isChildActive(
  child: AdminNavChildItem,
  pathname: string,
  meetingParam: string | null,
): boolean {
  if (
    child.meetingDateKey &&
    pathname.startsWith("/committee/application/") &&
    meetingParam === child.meetingDateKey
  ) {
    return true;
  }
  if (child.matchPrefix) return pathname.startsWith(child.matchPrefix);
  return pathname === child.href || pathname.startsWith(`${child.href}/`);
}

export default function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const meetingParam = searchParams.get("meeting");

  return (
    <nav className="space-y-1" aria-label="管理後台導覽">
      {items.map((item) => {
        const childActive = item.children?.some((child) => isChildActive(child, pathname, meetingParam));
        const active = childActive
          ? true
          : item.matchPrefix
            ? pathname.startsWith(item.matchPrefix)
            : pathname === item.href;
        return (
          <div key={item.href} className="space-y-0.5">
            <Link
              href={item.href}
              className={`group flex items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                active
                  ? "border-blue-200 bg-blue-50 text-blue-800 shadow-sm"
                  : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className={`mt-0.5 ${active ? "text-blue-700" : "text-slate-500 group-hover:text-slate-700"}`}>
                {resolveIcon(item.icon)}
              </span>
              <span>
                <span className="block text-sm font-medium">{item.label}</span>
                {item.description ? <span className="block text-xs text-slate-500">{item.description}</span> : null}
              </span>
            </Link>

            {item.children?.length ? (
              <div className="ml-7 space-y-0.5 border-l border-slate-200 pl-2" role="group" aria-label={`${item.label}子選單`}>
                {item.children.map((child) => {
                  const childActive = isChildActive(child, pathname, meetingParam);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`block rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                        childActive
                          ? "bg-blue-100 text-blue-800"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                      aria-current={childActive ? "page" : undefined}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

