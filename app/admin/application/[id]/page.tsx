import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AttachmentCategory, Role } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { ApplicationStatusControl } from "@/components/admin/ApplicationStatusControl";
import { applicationStatusLabel } from "@/lib/applicationStatusLabels";
import { googleDriveFileViewUrl } from "@/lib/driveLinks";
import { parseKeyValueDescription } from "@/lib/parseMigratedDescription";
import { prisma } from "@/lib/prisma";
import { formatTaipeiDateTime } from "@/lib/taipeiTime";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<AttachmentCategory, string> = {
  DRAFT_PDF: "計畫書稿 PDF",
  SLOT_ATTACHMENT: "欄位附件",
  FINAL_APPROVED_PDF: "核定本 PDF",
  GENERAL: "一般附件",
  OTHER: "其他",
};

function formatBytes(n: bigint | number): string {
  const v = typeof n === "bigint" ? Number(n) : n;
  if (!Number.isFinite(v) || v < 0) return "—";
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const app = await prisma.application.findUnique({
    where: { id },
    select: { title: true },
  });
  return {
    title: app?.title?.trim() ? `${app.title} — 案件詳情` : "案件詳情",
  };
}

export default async function AdminApplicationDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  const emailRaw = session?.user?.email?.trim() || "";
  if (!session?.user?.email || !emailRaw) {
    redirect("/");
  }

  const dbUser = await prisma.user.findFirst({
    where: { email: { equals: emailRaw, mode: "insensitive" } },
    select: { role: true },
  });
  if (!dbUser || dbUser.role !== Role.ADMIN) {
    redirect("/admin/dashboard");
  }

  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      applicant: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!application) {
    notFound();
  }

  const parsedDesc = parseKeyValueDescription(application.description);
  const companyFromName = application.applicant.name?.trim() || null;
  const taxId = parsedDesc["統編"] ?? null;
  const driveFolder = parsedDesc["Drive"] ?? null;
  const sheetRow = parsedDesc["試算表列"] ?? null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:max-w-5xl lg:px-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/admin/dashboard"
              className="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
            >
              ← 返回案件總表
            </Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              {application.title?.trim() || "（未命名計畫）"}
            </h1>
            <p className="mt-1 font-mono text-xs text-slate-500">ID：{application.id}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-800">
                {applicationStatusLabel(application.status)}
              </span>
              {application.periodYear != null ? (
                <span className="text-xs text-slate-600">年度：{application.periodYear}</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Link
              href="/"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
            >
              首頁
            </Link>
            <AdminSignOutButton />
          </div>
        </header>

        <div className="mb-6">
          <ApplicationStatusControl applicationId={application.id} currentStatus={application.status} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">申請人</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">姓名／顯示名稱</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{companyFromName || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">登入 Email</dt>
                <dd className="mt-0.5">
                  <a
                    href={`mailto:${application.applicant.email}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {application.applicant.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">帳號建立時間</dt>
                <dd className="mt-0.5 tabular-nums text-slate-800">
                  {formatTaipeiDateTime(application.applicant.createdAt)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">公司與聯絡（匯入／表單）</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">公司名稱（User.name）</dt>
                <dd className="mt-0.5 text-slate-900">{companyFromName || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">統一編號</dt>
                <dd className="mt-0.5 font-mono text-slate-900">{taxId || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">聯絡信箱</dt>
                <dd className="mt-0.5 text-slate-900">與登入 Email 相同（如上）</dd>
              </div>
              {driveFolder ? (
                <div>
                  <dt className="text-slate-500">Drive 資料夾／連結</dt>
                  <dd className="mt-0.5 break-all">
                    <a
                      href={driveFolder}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:underline"
                    >
                      {driveFolder}
                    </a>
                  </dd>
                </div>
              ) : null}
              {sheetRow ? (
                <div>
                  <dt className="text-slate-500">試算表列號（遷移來源）</dt>
                  <dd className="mt-0.5 text-slate-900">{sheetRow}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">案件時間</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">建立時間</dt>
                <dd className="mt-0.5 tabular-nums text-slate-900">
                  {formatTaipeiDateTime(application.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">最後更新</dt>
                <dd className="mt-0.5 tabular-nums text-slate-900">
                  {formatTaipeiDateTime(application.updatedAt)}
                </dd>
              </div>
            </dl>
          </section>

          {application.description?.trim() ? (
            <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">備註／遷移全文</h2>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs text-slate-800">
                {application.description.trim()}
              </pre>
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">附件</h2>
            {application.attachments.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">尚無寫入 Prisma 的附件紀錄（可於後續串接 Drive metadata）。</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {application.attachments.map((att) => {
                  const fileUrl = googleDriveFileViewUrl(att.driveFileId);
                  return (
                    <li key={att.id} className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{att.fileName}</p>
                        <p className="text-xs text-slate-500">
                          {CATEGORY_LABEL[att.category]} · {att.mimeType} · {formatBytes(att.sizeBytes)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {fileUrl ? (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            在 Drive 開啟
                          </a>
                        ) : att.storageKey ? (
                          <span className="text-xs text-slate-500">storage：{att.storageKey}</span>
                        ) : (
                          <span className="text-xs text-slate-400">無可用連結</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
