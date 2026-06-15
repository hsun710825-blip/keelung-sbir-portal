import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";
import { ApplicationListWithFilters } from "@/app/admin/dashboard/ApplicationListWithFilters";
import type { AdminApplicationTableRow } from "@/components/admin/AdminApplicationsTable";
import { normalizePlanTitleForDedupe } from "@/lib/applicationDedupeKey";
import { applicationStatusLabel } from "@/lib/applicationStatusLabels";
import { resolveApplicationPdfViewUrl } from "@/lib/adminApplicationPdfViewUrl";
import { prisma } from "@/lib/prisma";
import { canOperateApplications, isGovReadOnlyRole, isReviewerRole } from "@/lib/rbac";
import { formatTaipeiDateTime } from "@/lib/taipeiTime";

export const metadata: Metadata = {
  title: "案件總表",
  description: "管理員後台：Prisma 案件總表",
};

/** 依登入與 DB 即時渲染，避免被誤判為靜態頁面 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ApplicationListRow = Prisma.ApplicationGetPayload<{
  include: {
    applicant: { select: { name: true; email: true } };
    attachments: {
      select: {
        category: true;
        driveFileId: true;
        createdAt: true;
      };
    };
  };
}>;

type DashboardSearchParams = { q?: string | string[] };

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>;
}) {
  noStore();
  const session = await getServerSession(authOptions);
  const emailRaw = session?.user?.email?.trim() || "";
  const sp = (await searchParams) ?? {};
  const qRaw = sp.q;
  const searchQuery = typeof qRaw === "string" ? qRaw.trim() : "";

  if (!session?.user?.email || !emailRaw) {
    redirect("/");
  }

  const jwtRole = session.user.role ?? null;
  if (!isBackofficePrismaRole(jwtRole)) {
    redirect("/");
  }

  const canOperate = canOperateApplications(jwtRole);
  const isReviewer = isReviewerRole(jwtRole);
  const isGov = isGovReadOnlyRole(jwtRole);

  let applications: ApplicationListRow[];
  try {
    applications = await prisma.application.findMany({
      where: searchQuery
        ? {
            OR: [
              { title: { contains: searchQuery, mode: "insensitive" } },
              { applicant: { email: { contains: searchQuery, mode: "insensitive" } } },
              { applicant: { name: { contains: searchQuery, mode: "insensitive" } } },
            ],
          }
        : undefined,
      orderBy: { updatedAt: "desc" },
      include: {
        applicant: {
          select: {
            name: true,
            email: true,
          },
        },
        attachments: {
          select: {
            category: true,
            driveFileId: true,
            createdAt: true,
          },
          where: {
            category: "DRAFT_PDF",
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
    const msg = e instanceof Error ? e.message : String(e);
    const looksLikeMissingColumn =
      code === "P2022" ||
      /column\s+[`"]?driveProjectFolderId[`"]?\s+does not exist/i.test(msg) ||
      /column\s+Application\.driveProjectFolderId/i.test(msg);
    console.error("[admin/dashboard] prisma.application.findMany failed:", code || msg);

    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 to-slate-50 px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">案件總表暫時無法載入</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            資料庫結構與目前程式版本不一致（常見原因：正式環境尚未套用最新 Prisma migration，缺少{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">driveProjectFolderId</code>{" "}
            欄位）。請至 Neon（或正式 PostgreSQL）執行下列 SQL 後重新整理本頁：
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
            {looksLikeMissingColumn
              ? `ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "driveProjectFolderId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Application_driveProjectFolderId_key"
  ON "Application"("driveProjectFolderId");`
              : `-- 若仍失敗，請至 Vercel 函式日誌搜尋 [admin/dashboard]
-- 錯誤代碼：${code || "（無）"}
-- ${msg.slice(0, 200)}`}
          </pre>
          {!looksLikeMissingColumn ? (
            <p className="mt-3 text-xs text-slate-500">
              技術細節已寫入伺服器日誌；若 <code className="text-[11px]">DATABASE_URL</code>{" "}
              未設定或無法連線，也會無法開啟本頁。
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              返回後台首頁
            </Link>
            <Link
              href="/"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              返回網站首頁
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const tableRows: AdminApplicationTableRow[] = applications.map((row) => {
    const applicantLabel = [row.applicant.name, row.applicant.email].filter(Boolean).join(" · ") || "—";
    const planTitleRaw = row.title?.trim() ?? "";
    const isBlankPlanTitle = !planTitleRaw;
    const titleText = planTitleRaw || "（未命名計畫）";
    const createdMs = row.createdAt.getTime();
    const updatedMs = row.updatedAt.getTime();
    const showCreatedSub = Math.abs(updatedMs - createdMs) > 60_000;
    const pdfViewUrl = resolveApplicationPdfViewUrl({
      submissionMode: row.submissionMode,
      uploadedProposalUrl: row.uploadedProposalUrl,
      attachments: row.attachments,
    });
    return {
      id: row.id,
      titleText,
      planTitleRaw,
      isBlankPlanTitle,
      applicantLabel,
      updatedAtLabel: formatTaipeiDateTime(row.updatedAt),
      createdAtLabel: showCreatedSub ? formatTaipeiDateTime(row.createdAt) : null,
      statusLabel: applicationStatusLabel(row.status),
      submissionMode: row.submissionMode === "UPLOAD" ? "UPLOAD" : "ONLINE",
      pdfViewUrl,
      status: row.status,
      applicantEmail: row.applicant.email,
      updatedAtMs: updatedMs,
      createdAtMs: createdMs,
    };
  });

  const dedupeMap = new Map<string, AdminApplicationTableRow>();
  for (const row of tableRows) {
    if (row.isBlankPlanTitle) continue;
    const key = `${row.applicantEmail.trim().toLowerCase()}\t${normalizePlanTitleForDedupe(row.planTitleRaw)}`;
    const prev = dedupeMap.get(key);
    if (!prev) {
      dedupeMap.set(key, row);
      continue;
    }
    const isNewer = row.updatedAtMs > prev.updatedAtMs || (row.updatedAtMs === prev.updatedAtMs && row.createdAtMs >= prev.createdAtMs);
    if (isNewer) dedupeMap.set(key, row);
  }
  const namedEffectiveCount = dedupeMap.size;
  const unnamedDraftCount = tableRows.filter((r) => r.isBlankPlanTitle && r.status === "DRAFT").length;

  return (
    <section className="mx-auto max-w-6xl px-1 py-2 sm:px-2">
        <header className="mb-8 flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Admin</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">案件總表</h1>
            <p className="mt-2 text-sm text-slate-600">
              {session.user.name ?? "管理員"} · {session.user.email}
            </p>
            {isGov ? (
              <p className="mt-2 text-xs text-sky-900">您為市府人員身分：可檢視與匯出；變更狀態、刪除與補件等操作已停用。</p>
            ) : null}
            {isReviewer && !isGov ? (
              <p className="mt-2 text-xs text-amber-800">
                您為審查委員身分：可檢視列表；初審通過案件請點「評分」或左側「委員評分任務」進入評分頁。
              </p>
            ) : null}
          </div>
          {isReviewer ? (
            <Link
              href="/committee/dashboard"
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 shadow-sm hover:bg-blue-100"
            >
              委員評分任務
            </Link>
          ) : null}
        </header>

        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800">全部申請案</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  共 {applications.length} 筆（Prisma）
                  {searchQuery ? (
                    <span className="text-slate-600">
                      {" "}
                      · 搜尋「<span className="font-medium">{searchQuery}</span>」
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  列表預設依「帳號 Email + 正規化計畫名稱」排重，僅保留最後更新最新一筆；空白計畫名稱草稿不併入有效件數。
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  排重後有效件數：<span className="tabular-nums font-semibold text-slate-900">{namedEffectiveCount}</span> 件
                  <span className="mx-2 text-slate-300">|</span>
                  未命名草稿：<span className="tabular-nums font-semibold text-slate-900">{unnamedDraftCount}</span> 件
                </p>
              </div>
              <form action="/admin/dashboard" method="get" className="flex w-full max-w-md flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <label className="sr-only" htmlFor="admin-dashboard-q">
                  搜尋 Email、計畫名稱或申請人
                </label>
                <input
                  id="admin-dashboard-q"
                  name="q"
                  type="search"
                  defaultValue={searchQuery}
                  placeholder="搜尋 Email／計畫／申請人"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex shrink-0 gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    搜尋
                  </button>
                  {searchQuery ? (
                    <Link
                      href="/admin/dashboard"
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      清除
                    </Link>
                  ) : null}
                </div>
              </form>
            </div>
          </div>

          <ApplicationListWithFilters
            rows={tableRows}
            isAdmin={canOperate}
            isReviewer={isReviewer}
            searchQuery={searchQuery}
          />
        </section>
    </section>
  );
}
