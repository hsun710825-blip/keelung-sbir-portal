import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AttachmentCategory, Role } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { CommitteeEvaluationForm } from "@/components/committee/CommitteeEvaluationForm";
import { applicationStatusLabel } from "@/lib/applicationStatusLabels";
import { isCommitteeVisibleStatus } from "@/lib/committeeApplicationStatuses";
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
    title: app?.title?.trim() ? `${app.title} — 委員審查` : "委員審查",
  };
}

export default async function CommitteeApplicationDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  const emailRaw = session?.user?.email?.trim() || "";
  if (!session?.user?.email || !emailRaw) {
    redirect("/");
  }

  const dbUser = await prisma.user.findFirst({
    where: { email: { equals: emailRaw, mode: "insensitive" } },
    select: { id: true, role: true },
  });
  if (!dbUser || dbUser.role !== Role.COMMITTEE) {
    redirect("/");
  }

  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      applicant: {
        select: { id: true, name: true, email: true, createdAt: true },
      },
      attachments: { orderBy: { createdAt: "desc" } },
      evaluations: {
        where: { committeeId: dbUser.id },
        take: 1,
      },
    },
  });

  if (!application) {
    notFound();
  }
  if (!isCommitteeVisibleStatus(application.status)) {
    redirect("/committee/dashboard");
  }

  const parsedDesc = parseKeyValueDescription(application.description);
  const companyFromName = application.applicant.name?.trim() || null;
  const taxId = parsedDesc["統編"] ?? null;
  const driveFolder = parsedDesc["Drive"] ?? null;

  const existingEval = application.evaluations[0] ?? null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:max-w-5xl lg:px-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/committee/dashboard"
              className="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
            >
              ← 返回委員總表
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

        <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">唯讀：案件與計畫內容</h2>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">申請人</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-slate-500">公司／顯示名稱</dt>
                  <dd className="font-medium text-slate-900">{companyFromName || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">登入 Email</dt>
                  <dd>
                    <a href={`mailto:${application.applicant.email}`} className="text-blue-700 hover:underline">
                      {application.applicant.email}
                    </a>
                  </dd>
                </div>
                {taxId ? (
                  <div>
                    <dt className="text-slate-500">統一編號</dt>
                    <dd className="font-mono text-slate-900">{taxId}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">案件時間</h3>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">建立</dt>
                  <dd className="tabular-nums text-slate-900">{formatTaipeiDateTime(application.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">最後更新</dt>
                  <dd className="tabular-nums text-slate-900">{formatTaipeiDateTime(application.updatedAt)}</dd>
                </div>
              </dl>
            </section>

            {application.adminRemarks?.trim() ? (
              <section className="rounded-xl border border-amber-100 bg-amber-50/40 p-5 lg:col-span-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800">管理員初審／狀態說明</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-amber-950">
                  {application.adminRemarks.trim()}
                </p>
              </section>
            ) : null}

            {application.description?.trim() ? (
              <section className="rounded-xl border border-slate-100 bg-white p-5 lg:col-span-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">計畫內容與備註全文</h3>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs text-slate-800">
                  {application.description.trim()}
                </pre>
              </section>
            ) : (
              <section className="rounded-xl border border-slate-100 bg-white p-5 lg:col-span-2">
                <p className="text-sm text-slate-500">尚無寫入資料庫之計畫全文摘要（可參考下方附件）。</p>
              </section>
            )}

            {driveFolder ? (
              <section className="rounded-xl border border-slate-100 bg-white p-5 lg:col-span-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Drive 資料夾（遷移欄位）</h3>
                <a
                  href={driveFolder}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block break-all text-sm text-blue-700 hover:underline"
                >
                  {driveFolder}
                </a>
              </section>
            ) : null}

            <section className="rounded-xl border border-slate-100 bg-white p-5 lg:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">附件（Google Drive）</h3>
              {application.attachments.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">尚無附件紀錄。</p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {application.attachments.map((att) => {
                    const fileUrl = googleDriveFileViewUrl(att.driveFileId);
                    return (
                      <li
                        key={att.id}
                        className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                      >
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

        <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm ring-1 ring-blue-50">
          <h2 className="text-base font-semibold text-slate-900">評分區</h2>
          <p className="mt-1 text-sm text-slate-500">請填寫分數與審查評語；可重複儲存以更新。</p>
          <div className="mt-6">
            <CommitteeEvaluationForm
              applicationId={application.id}
              initialScore={existingEval?.score ?? null}
              initialComment={existingEval?.comment ?? null}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
