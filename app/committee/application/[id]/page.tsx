import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CommitteeScoringFormClient } from "@/components/committee/CommitteeScoringFormClient";
import { CommitteeProposalPdfViewer } from "@/components/committee/CommitteeProposalPdfViewer";
import { getReviewerDbUser } from "@/lib/cachedAuth";
import { resolveCommitteePresentationPdfSource } from "@/lib/resolveCommitteePresentationPdf";
import { applicationStatusLabel } from "@/lib/applicationStatusLabels";
import { isCommitteeVisibleStatus } from "@/lib/committeeApplicationStatuses";
import { isMeetingLockedForCommittee } from "@/lib/committeeReviewSession";
import { parseScoresJson } from "@/lib/committeeScoringRubric";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";
import { loadCommitteeApplicationReview } from "@/lib/loadCommitteeApplicationReview";
import { prisma } from "@/lib/prisma";
import { resolveApplicationDisplayFields } from "@/lib/resolveApplicationDisplayFields";
import { isReviewMeetingDate, reviewMeetingDateLabel } from "@/lib/reviewMeetingAgenda";
import { isMissingEvaluationSchemaError } from "@/lib/safeCommitteeEvaluation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ meeting?: string }>;
};

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

export default async function CommitteeApplicationDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const meetingRaw = sp.meeting?.trim() || "";
  if (!isReviewMeetingDate(meetingRaw)) {
    redirect("/committee/dashboard");
  }
  const meetingDate = meetingRaw;

  const dbUser = await getReviewerDbUser();
  if (!dbUser) redirect("/");

  let application;
  try {
    application = await loadCommitteeApplicationReview(id);
  } catch (error) {
    console.error("[committee/application] load failed:", error);
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">無法載入案件</h1>
          <p className="mt-3 text-sm text-slate-600">讀取案件資料時發生錯誤，請稍後再試。</p>
          <Link href={`/committee/meeting/${meetingDate}`} className="mt-6 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">
            返回議程列表
          </Link>
        </div>
      </main>
    );
  }

  if (!application) notFound();
  if (!isCommitteeVisibleStatus(application.status)) redirect(`/committee/meeting/${meetingDate}`);

  const [display, locked] = await Promise.all([
    resolveApplicationDisplayFields({
      id: application.id,
      submissionMode: application.submissionMode,
      description: application.description,
    }),
    (async () => {
      await ensureEvaluationSchema();
      return isMeetingLockedForCommittee(dbUser.id, meetingDate);
    })(),
  ]);
  const companyLabel = display.companyName?.trim() || application.applicant.email || "—";

  let existingEval: {
    score: number;
    comment: string | null;
    scoresJson: string | null;
    status: string;
  } | null = null;

  try {
    existingEval = await prisma.evaluation.findUnique({
      where: {
        applicationId_committeeId: { applicationId: application.id, committeeId: dbUser.id },
      },
      select: { score: true, comment: true, scoresJson: true, status: true },
    });
  } catch (error) {
    if (!isMissingEvaluationSchemaError(error)) throw error;
  }

  const breakdown = parseScoresJson(existingEval?.scoresJson);
  const titleText = application.title?.trim() || "（未命名計畫）";
  const submissionLabel =
    String(application.submissionMode || "").toUpperCase() === "UPLOAD" ? "自行上傳 PDF" : "線上撰寫產製 PDF";

  const presentationSource = await resolveCommitteePresentationPdfSource(application.id, {
    companyName: display.companyName,
  });
  const hasPresentation = presentationSource.kind === "drive_file";

  return (
    <section className="space-y-6">
        <header className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link
              href={`/committee/meeting/${meetingDate}`}
              className="text-sm font-medium text-blue-700 hover:underline"
            >
              ← 返回 {reviewMeetingDateLabel(meetingDate)}
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">{titleText}</h1>
            <p className="mt-2 text-sm text-slate-600">{companyLabel}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium">
                {applicationStatusLabel(application.status)}
              </span>
              <span className="text-xs text-slate-500">{submissionLabel}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {application.pdfViewUrl ? (
              <a
                href={application.pdfViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-slate-50"
              >
                新分頁開啟計畫書
              </a>
            ) : null}
          </div>
        </header>

        {locked ? (
          <p className="mb-4 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-800">
            此場次評分已由 PO 鎖定，無法再修改。
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">計畫書 PDF</h2>
            <div className="mt-4">
              {application.pdfEmbedUrl ? (
                <CommitteeProposalPdfViewer applicationId={application.id} fallbackViewUrl={application.pdfViewUrl} />
              ) : (
                <p className="text-sm text-slate-500">目前無法載入計畫書 PDF</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm ring-1 ring-violet-50">
            <h2 className="text-base font-semibold text-slate-900">簡報 PDF</h2>
            <p className="mt-1 text-xs text-slate-500">複審簡報（由業者上傳資料夾自動對照）</p>
            <div className="mt-4">
              {hasPresentation ? (
                <CommitteeProposalPdfViewer
                  applicationId={application.id}
                  fallbackViewUrl={null}
                  pdfApiPath={`/api/committee/applications/${application.id}/presentation-pdf`}
                  loadingLabel="簡報 PDF"
                />
              ) : (
                <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500">
                  業者尚未上傳簡報，此欄位暫留空白。
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm ring-1 ring-blue-50">
            <h2 className="text-base font-semibold text-slate-900">100 分制評分表</h2>
            <p className="mt-1 text-sm text-slate-500">儲存送出後狀態為暫存（DRAFT），並導回個人總表。</p>
            <div className="mt-6">
              <CommitteeScoringFormClient
                applicationId={application.id}
                meetingDate={meetingDate}
                initialBreakdown={breakdown}
                initialComment={existingEval?.comment ?? null}
                readOnly={locked}
              />
            </div>
          </section>
    </section>
  );
}
