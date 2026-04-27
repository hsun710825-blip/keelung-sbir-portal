"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, LayoutDashboard, ShieldCheck } from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  description?: string;
  icon?: "home" | "dashboard" | "users" | "applications";
  matchPrefix?: string;
};

const iconClass = "h-4 w-4 shrink-0";

function resolveIcon(name: AdminNavItem["icon"]) {
  if (name === "home") return <Home className={iconClass} />;
  if (name === "users") return <ShieldCheck className={iconClass} />;
  if (name === "applications") return <ClipboardList className={iconClass} />;
  return <LayoutDashboard className={iconClass} />;
}

export default function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1" aria-label="管理後台導覽">
      {items.map((item) => {
        const active = item.matchPrefix ? pathname.startsWith(item.matchPrefix) : pathname === item.href;
        return (
          <Link
            key={item.href}
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
        );
      })}
    </nav>
  );
}

