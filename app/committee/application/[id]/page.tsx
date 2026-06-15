import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { CommitteeEvaluationForm } from "@/components/committee/CommitteeEvaluationForm";
import { applicationStatusLabel } from "@/lib/applicationStatusLabels";
import { isCommitteeVisibleStatus } from "@/lib/committeeApplicationStatuses";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";
import { loadCommitteeApplicationReview } from "@/lib/loadCommitteeApplicationReview";
import { prisma } from "@/lib/prisma";
import { isReviewerRole } from "@/lib/rbac";
import {
  isMissingEvaluationSchemaError,
  loadCommitteeEvaluationDetail,
} from "@/lib/safeCommitteeEvaluation";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const app = await prisma.application.findUnique({
      where: { id },
      select: { title: true },
    });
    return {
      title: app?.title?.trim() ? `${app.title} — 委員審查` : "委員審查",
    };
  } catch {
    return { title: "委員審查" };
  }
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
  if (!dbUser || !isReviewerRole(dbUser.role)) {
    redirect("/");
  }

  let application;
  try {
    application = await loadCommitteeApplicationReview(id);
  } catch (error) {
    console.error("[committee/application] load failed:", error);
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">無法載入案件</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            讀取案件資料時發生錯誤，請稍後再試或聯絡管理員。
          </p>
          <Link
            href="/committee/dashboard"
            className="mt-6 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            返回委員總表
          </Link>
        </div>
      </main>
    );
  }

  if (!application) {
    notFound();
  }
  if (!isCommitteeVisibleStatus(application.status)) {
    redirect("/committee/dashboard");
  }

  let existingEval: Awaited<ReturnType<typeof loadCommitteeEvaluationDetail>>["evaluation"] = null;
  let evaluationSchemaIssue: "none" | "rank_column_missing" | "table_missing" = "none";
  try {
    await ensureEvaluationSchema();
  } catch (error) {
    console.error("[committee/application] ensure evaluation schema:", error);
    evaluationSchemaIssue = "table_missing";
  }

  try {
    const loaded = await loadCommitteeEvaluationDetail(application.id, dbUser.id);
    existingEval = loaded.evaluation;
    if (loaded.schemaIssue !== "none") {
      evaluationSchemaIssue = loaded.schemaIssue;
    }
  } catch (error) {
    if (isMissingEvaluationSchemaError(error)) {
      evaluationSchemaIssue = "table_missing";
    } else {
      console.error("[committee/application] evaluation load failed:", error);
    }
  }

  const titleText = application.title?.trim() || "（未命名計畫）";
  const applicantLabel =
    [application.applicant.name, application.applicant.email].filter(Boolean).join(" · ") || "—";
  const submissionLabel =
    String(application.submissionMode || "").toUpperCase() === "UPLOAD" ? "自行上傳 PDF" : "線上撰寫產製 PDF";

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link
              href="/committee/dashboard"
              className="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
            >
              ← 返回委員總表
            </Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{titleText}</h1>
            <p className="mt-2 text-sm text-slate-600">{applicantLabel}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-800">
                {applicationStatusLabel(application.status)}
              </span>
              <span className="text-xs text-slate-500">{submissionLabel}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {application.pdfViewUrl ? (
              <a
                href={application.pdfViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 shadow-sm hover:bg-slate-50"
              >
                新分頁開啟 PDF
              </a>
            ) : null}
            <AdminSignOutButton />
          </div>
        </header>

        {!application.pdfAttachmentsLoaded ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            附件 metadata 暫時無法讀取；若下方無法預覽 PDF，請使用上方「新分頁開啟 PDF」或聯絡管理員。
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-slate-900">計畫書 PDF</h2>
            <p className="mt-1 text-sm text-slate-500">請閱讀計畫內容後，於右側填寫序位與評分。</p>
            <div className="mt-4">
              {application.pdfEmbedUrl ? (
                <iframe
                  title="計畫書 PDF 預覽"
                  src={application.pdfEmbedUrl}
                  className="h-[min(80vh,900px)] w-full rounded-xl border border-slate-200 bg-white"
                />
              ) : application.pdfViewUrl ? (
                <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-600">
                  <p>內嵌預覽暫不可用，請使用上方「新分頁開啟 PDF」。</p>
                  <a
                    href={application.pdfViewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    新分頁開啟 PDF
                  </a>
                </div>
              ) : (
                <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-600">
                  <p>目前無法載入此案件 PDF。</p>
                  <p className="text-xs text-slate-500">
                    可能原因：尚未產生 PDF，或資料庫未記錄雲端檔案 ID。
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm ring-1 ring-blue-50 sm:p-6">
            <h2 className="text-base font-semibold text-slate-900">評分與審查意見</h2>
            <p className="mt-1 text-sm text-slate-500">
              序位法為先決：請先填序位，再填分數與評語。
            </p>
            {evaluationSchemaIssue === "table_missing" ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                評分資料表初始化失敗；若儲存失敗請聯絡管理員確認資料庫權限。
              </div>
            ) : evaluationSchemaIssue === "rank_column_missing" ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                資料庫尚未建立序位欄位；可先儲存分數與評語，序位待 migration 套用後即可寫入。
              </div>
            ) : null}
            <div className="mt-6">
              <CommitteeEvaluationForm
                applicationId={application.id}
                initialScore={existingEval?.score ?? null}
                initialRank={existingEval?.rank ?? null}
                initialComment={existingEval?.comment ?? null}
                rankOptional={evaluationSchemaIssue === "rank_column_missing"}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
