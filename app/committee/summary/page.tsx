import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CommitteeCombinedScoreTable } from "@/components/committee/CommitteeCombinedScoreTable";
import { getReviewerDbUser } from "@/lib/cachedAuth";
import { loadCombinedCommitteePersonalScores } from "@/lib/committeePersonalScores";

export const metadata: Metadata = {
  title: "我的評分總表",
  description: "委員合併評分總表",
};

export const dynamic = "force-dynamic";

export default async function CommitteeSummaryPage() {
  const dbUser = await getReviewerDbUser();
  if (!dbUser) redirect("/");

  const data = await loadCombinedCommitteePersonalScores(dbUser.id);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <Link href="/committee/dashboard" className="text-sm font-medium text-blue-700 hover:underline">
          ← 返回場次選擇
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">我的評分總表</h1>
        <p className="mt-1 text-sm text-slate-600">6/22 與 7/1 全部案件合併顯示；聯合提案另區塊排序。</p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <CommitteeCombinedScoreTable
          regularRows={data.regularRows}
          jointRows={data.jointRows}
          sessionStatus={data.sessionStatus}
          canEdit={data.canEdit}
          scoredCount={data.scoredCount}
          totalCases={data.totalCases}
        />
      </div>
    </section>
  );
}
