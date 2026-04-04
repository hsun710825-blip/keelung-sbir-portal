import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Prisma, Role } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { applicationStatusLabel } from "@/lib/applicationStatusLabels";
import { prisma } from "@/lib/prisma";
import { formatTaipeiDateTime } from "@/lib/taipeiTime";

export const metadata: Metadata = {
  title: "案件總表",
  description: "管理員後台：Prisma 案件總表",
};

/** 依登入與 DB 即時渲染，避免被誤判為靜態頁面 */
export const dynamic = "force-dynamic";

type ApplicationListRow = Prisma.ApplicationGetPayload<{
  include: {
    applicant: { select: { name: true; email: true } };
  };
}>;

type DashboardSearchParams = { q?: string | string[] };

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>;
}) {
  const session = await getServerSession(authOptions);
  const emailRaw = session?.user?.email?.trim() || "";
  const sp = (await searchParams) ?? {};
  const qRaw = sp.q;
  const searchQuery = typeof qRaw === "string" ? qRaw.trim() : "";

  if (!session?.user?.email || !emailRaw) {
    redirect("/");
  }

  const dbUser = await prisma.user.findFirst({
    where: { email: { equals: emailRaw, mode: "insensitive" } },
    select: { role: true },
  });

  if (!dbUser || !isBackofficePrismaRole(dbUser.role)) {
    redirect("/");
  }

  const isAdmin = dbUser.role === Role.ADMIN;
  const isCommittee = dbUser.role === Role.COMMITTEE;

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

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Admin</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">案件總表</h1>
            <p className="mt-2 text-sm text-slate-600">
              {session.user.name ?? "管理員"} · {session.user.email}
            </p>
            {!isAdmin ? (
              <p className="mt-2 text-xs text-amber-800">
                您為審查委員身分：可檢視列表；案件詳情與狀態變更僅限管理員。
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              返回首頁
            </Link>
            <Link
              href="/admin"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              後台（Sheets）
            </Link>
            {isAdmin ? (
              <Link
                href="/admin/users"
                className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900 shadow-sm transition hover:bg-violet-100"
              >
                權限管理
              </Link>
            ) : null}
            {isCommittee ? (
              <Link
                href="/committee/dashboard"
                className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900 shadow-sm transition hover:bg-sky-100"
              >
                委員審查
              </Link>
            ) : null}
            <AdminSignOutButton />
          </div>
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
                  列表依最後更新排序；欄位主顯示為最後更新時間，若與建立時間相差超過一分鐘會於下方附註建立時間。
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

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90">
                  <th scope="col" className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    計畫名稱
                  </th>
                  <th scope="col" className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    申請人／公司
                  </th>
                  <th scope="col" className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    最後更新／建立
                  </th>
                  <th scope="col" className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    目前狀態
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-500">
                      {searchQuery
                        ? `沒有符合「${searchQuery}」的申請案。請改關鍵字或清除搜尋。`
                        : "尚無申請資料。請在資料庫建立測試資料後重新整理此頁。"}
                    </td>
                  </tr>
                ) : (
                  applications.map((row) => {
                    const applicantLabel =
                      [row.applicant.name, row.applicant.email].filter(Boolean).join(" · ") || "—";
                    const titleText = row.title?.trim() ? row.title : "（未命名計畫）";
                    const createdMs = row.createdAt.getTime();
                    const updatedMs = row.updatedAt.getTime();
                    const showCreatedSub = Math.abs(updatedMs - createdMs) > 60_000;
                    return (
                      <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="max-w-[220px] px-5 py-3.5 font-medium text-slate-900">
                          {isAdmin ? (
                            <Link
                              href={`/admin/application/${row.id}`}
                              className="line-clamp-2 text-blue-700 hover:text-blue-900 hover:underline"
                              title={titleText}
                            >
                              {titleText}
                            </Link>
                          ) : (
                            <span className="line-clamp-2" title={titleText}>
                              {titleText}
                            </span>
                          )}
                        </td>
                        <td className="max-w-[200px] px-5 py-3.5 text-slate-700">
                          <span className="line-clamp-2" title={applicantLabel}>
                            {applicantLabel}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 tabular-nums text-slate-600">
                          <div className="whitespace-nowrap font-medium text-slate-800">
                            {formatTaipeiDateTime(row.updatedAt)}
                          </div>
                          {showCreatedSub ? (
                            <div className="mt-0.5 whitespace-nowrap text-xs text-slate-400">
                              建立 {formatTaipeiDateTime(row.createdAt)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                            {applicationStatusLabel(row.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
