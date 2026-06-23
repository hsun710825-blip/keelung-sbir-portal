import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { CommitteeAccessMonitorPanel } from "@/components/admin/CommitteeAccessMonitorPanel";
import { listCommitteeAccessLogs } from "@/lib/committeeAccessLog";
import { canOperateApplications } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "委員權限鎖定監看",
  description: "指定委員時間鎖定與登入紀錄",
};

export const dynamic = "force-dynamic";

export default async function AdminCommitteeAccessPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const role = session.user.role ?? null;
  if (!canOperateApplications(role)) redirect("/admin/dashboard");

  const logs = await listCommitteeAccessLogs();

  return (
    <section className="space-y-6">
      <header className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">委員權限鎖定監看</h1>
        <p className="mt-2 text-sm text-slate-600">
          115 年 7/1 複審場次：3 位指定委員於非審查時段無法進入後台；鎖定期間之登入嘗試將記錄於下方（可收合）。
        </p>
      </header>

      <CommitteeAccessMonitorPanel logs={logs} />
    </section>
  );
}
