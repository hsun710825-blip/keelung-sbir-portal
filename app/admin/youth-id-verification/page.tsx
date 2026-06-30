import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { YouthIdVerificationExportButton } from "@/components/admin/YouthIdVerificationExportButton";
import { YouthIdVerificationEditor } from "@/components/admin/YouthIdVerificationEditor";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";
import { isReviewerRole } from "@/lib/rbac";
import { loadYouthVerificationTable } from "@/lib/youthId/loadVerificationTable";
import { formatTaipeiDateTime } from "@/lib/taipeiTime";

export const metadata: Metadata = {
  title: "青年設籍查證彙整",
  description: "提案業者負責人身分證件與青年資格查證彙整表",
};

export const dynamic = "force-dynamic";

export default async function YouthIdVerificationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const role = session.user.role ?? null;
  if (!isBackofficePrismaRole(role) || isReviewerRole(role)) redirect("/");

  let table;
  let loadError: string | null = null;
  try {
    table = await loadYouthVerificationTable({ runOcr: false });
  } catch (error) {
    console.error("[youth-id-verification]", error);
    loadError = "無法同步 Google 試算表，請確認服務帳戶權限後再試。";
    table = {
      rows: [],
      unmatchedSheetCompanies: [],
      unmatchedSettlementCompanies: [],
      syncedAt: new Date().toISOString(),
      sheetRowCount: 0,
    };
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-1 py-2 sm:px-2">
      <header className="flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin/accounts-overview" className="text-sm font-medium text-blue-700 hover:underline">
            ← 帳號與案件總覽
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">青年設籍查證彙整</h1>
          <p className="mt-2 text-sm text-slate-600">
            試算表僅供公司名稱與證件連結對應；縣市、年齡、是否符合由證件自動判讀，PO 可修改後儲存，委員端顯示儲存結果。
          </p>
          <p className="mt-1 text-xs text-slate-500">
            最後同步：{formatTaipeiDateTime(table.syncedAt)} · 試算表 {table.sheetRowCount} 筆
          </p>
        </div>
        <YouthIdVerificationExportButton />
      </header>

      {loadError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</p>
      ) : null}

      {(table.unmatchedSheetCompanies.length > 0 || table.unmatchedSettlementCompanies.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">名稱對應提醒</p>
          {table.unmatchedSheetCompanies.length > 0 ? (
            <p className="mt-2">
              <span className="font-medium">試算表有、決算清表無法對應：</span>
              {table.unmatchedSheetCompanies.join("、")}
            </p>
          ) : null}
          {table.unmatchedSettlementCompanies.length > 0 ? (
            <p className="mt-2">
              <span className="font-medium">決算清表有、試算表缺資料：</span>
              {table.unmatchedSettlementCompanies.join("、")}
            </p>
          ) : null}
        </div>
      )}

      <YouthIdVerificationEditor initialRows={table.rows} />
    </section>
  );
}
