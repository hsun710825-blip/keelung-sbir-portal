import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { prisma } from "@/lib/prisma";
import { isReviewerRole } from "@/lib/rbac";
import { REVIEW_MEETING_DATES, reviewMeetingDateLabel } from "@/lib/reviewMeetingAgenda";

export const metadata: Metadata = {
  title: "委員審查會議",
  description: "選擇審查場次",
};

export const dynamic = "force-dynamic";

export default async function CommitteeDashboardPage() {
  const session = await getServerSession(authOptions);
  const emailRaw = session?.user?.email?.trim() || "";
  if (!session?.user?.email || !emailRaw) redirect("/");

  const dbUser = await prisma.user.findFirst({
    where: { email: { equals: emailRaw, mode: "insensitive" } },
    select: { id: true, role: true },
  });
  if (!dbUser || !isReviewerRole(dbUser.role)) redirect("/");

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <header className="mb-8 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Committee</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">審查委員入口</h1>
          <p className="mt-2 text-sm text-slate-600">
            {session.user.name ?? "委員"} · {session.user.email}
          </p>
          <p className="mt-3 text-sm text-slate-500">請選擇本次審查會議場次，進入議程排序之案件列表與評分。</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/admin/dashboard"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              提案清單（唯讀）
            </Link>
            <AdminSignOutButton />
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {REVIEW_MEETING_DATES.map((date) => (
            <Link
              key={date}
              href={`/committee/meeting/${date}`}
              className="group rounded-2xl border border-blue-100 bg-white p-6 shadow-sm ring-1 ring-blue-50 transition hover:border-blue-300 hover:shadow-md"
            >
              <p className="text-lg font-semibold text-blue-900 group-hover:text-blue-700">
                {reviewMeetingDateLabel(date)}
              </p>
              <p className="mt-2 text-sm text-slate-600">依議程表順序進行評分與個人總表管理</p>
              <span className="mt-4 inline-flex text-sm font-medium text-blue-700">進入場次 →</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
