import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { REVIEW_MEETING_DATES, reviewMeetingDateLabel } from "@/lib/reviewMeetingAgenda";

export const metadata: Metadata = {
  title: "委員審查會議",
  description: "選擇審查場次",
};

export const dynamic = "force-dynamic";

export default async function CommitteeDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  return (
    <section className="space-y-6">
      <header className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Committee</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">審查委員入口</h1>
        <p className="mt-2 text-sm text-slate-600">
          {session.user.name ?? "委員"} · {session.user.email}
        </p>
        <p className="mt-3 text-sm text-slate-500">請選擇審查場次進入議程；評分總表為 6/22 + 7/1 合併顯示。</p>
        <Link
          href="/committee/summary"
          className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          我的評分總表
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {REVIEW_MEETING_DATES.map((date) => (
          <Link
            key={date}
            href={`/committee/meeting/${date}`}
            className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm ring-1 ring-blue-50 transition hover:border-blue-300 hover:shadow-md"
          >
            <p className="text-lg font-semibold text-blue-900">{reviewMeetingDateLabel(date)}</p>
            <p className="mt-2 text-sm text-slate-600">依議程表順序評分</p>
            <span className="mt-4 inline-flex text-sm font-medium text-blue-700">進入場次 →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
