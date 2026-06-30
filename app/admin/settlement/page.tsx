import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import {
  SettlementCommitteeConfigPanel,
  SettlementEditableTable,
} from "@/components/admin/SettlementEditableTable";
import { loadSettlementPageData } from "@/lib/settlementTable";
import { canOperateApplications } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "決算清表",
  description: "PO 決算經費輸入與 Excel 匯出",
};

export const dynamic = "force-dynamic";

export default async function AdminSettlementPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const role = session.user.role ?? null;
  if (!canOperateApplications(role)) redirect("/admin/dashboard");

  const data = await loadSettlementPageData();

  return (
    <section className="space-y-6">
      <header className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">決算清表</h1>
        <p className="mt-2 text-sm text-slate-600">
          一般與聯合提案依委員平均分數合併排序（同分跳號並列）；聯合案於「類型」欄標示。申請經費可自 Excel
          匯入或手動編輯；建議補助依比例係數 R 計算（H=ROUND(G×R)）。匯出 Excel 第一分頁為合併排序，第二分頁仍為聯合提案。
        </p>
        <div className="mt-4">
          <a
            href="/api/admin/settlement/export"
            className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            下載 Excel 決算清表
          </a>
        </div>
      </header>

      <SettlementCommitteeConfigPanel
        config={data.committeeConfig}
        reviewerOptions={data.reviewerOptions}
      />

      <SettlementEditableTable
        title="決算清表（一般＋聯合合併排序）"
        rows={data.combinedRows}
        memberNames={data.memberNames}
        showProposalType
      />

      {data.jointRows.length > 0 ? (
        <SettlementEditableTable
          title="聯合提案（Excel 第二分頁對照；總排序同主表）"
          rows={data.jointRows}
          memberNames={data.memberNames}
        />
      ) : null}
    </section>
  );
}
