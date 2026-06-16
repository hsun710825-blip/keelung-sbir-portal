import { AttachmentCategory } from "@prisma/client";

import { resolveApplicationPdfViewUrl } from "@/lib/adminApplicationPdfViewUrl";
import { googleDriveFileViewUrl, extractGoogleDriveFileId } from "@/lib/driveLinks";
import { prisma } from "@/lib/prisma";
import {
  resolveReviewCompleteProposalPdfFileId,
  type ReviewFolderPdfIndex,
} from "@/lib/reviewCompleteProposalPdf";
import { getCachedReviewFolderPdfIndex } from "@/lib/cachedDriveIndexes";

type AttachmentRow = {
  category: AttachmentCategory;
  driveFileId: string | null;
  createdAt: Date;
};

export type ApplicationProposalPdfSource =
  | {
      kind: "drive_file";
      fileId: string;
      externalViewUrl: string | null;
      source: "review_folder" | "uploaded" | "draft_pdf";
    }
  | { kind: "not_found"; externalViewUrl: string | null; source: "none" };

function resolveLegacyPdf(input: {
  submissionMode: string;
  uploadedProposalUrl: string | null | undefined;
  attachments: AttachmentRow[];
}): ApplicationProposalPdfSource {
  const externalViewUrl = resolveApplicationPdfViewUrl({
    submissionMode: input.submissionMode,
    uploadedProposalUrl: input.uploadedProposalUrl,
    attachments: input.attachments,
  });

  const directId = extractGoogleDriveFileId(input.uploadedProposalUrl);
  if (directId) {
    return {
      kind: "drive_file",
      fileId: directId,
      externalViewUrl,
      source: "uploaded",
    };
  }

  const draft = [...input.attachments]
    .filter((a) => a.category === AttachmentCategory.DRAFT_PDF && a.driveFileId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (draft?.driveFileId) {
    return {
      kind: "drive_file",
      fileId: draft.driveFileId,
      externalViewUrl,
      source: "draft_pdf",
    };
  }

  const fromViewUrl = extractGoogleDriveFileId(externalViewUrl);
  if (fromViewUrl) {
    return {
      kind: "drive_file",
      fileId: fromViewUrl,
      externalViewUrl,
      source: "draft_pdf",
    };
  }

  return { kind: "not_found", externalViewUrl, source: "none" };
}

/**
 * 統一解析計畫書 PDF：優先審查完整版資料夾（含補件），否則退回既有 DRAFT_PDF / 上傳檔。
 * 後台、委員與未來需檢視計畫書的頁面請一律使用此函式。
 */
export async function resolveApplicationProposalPdfSource(input: {
  applicationId?: string;
  submissionMode: string;
  uploadedProposalUrl?: string | null;
  attachments?: AttachmentRow[];
  reviewMeetingDate?: string | null;
  reviewAgendaOrder?: number | null;
  title?: string | null;
  companyName?: string | null;
  reviewIndex?: ReviewFolderPdfIndex | null;
}): Promise<ApplicationProposalPdfSource> {
  const attachments = input.attachments ?? [];
  const reviewFileId = await resolveReviewCompleteProposalPdfFileId({
    reviewMeetingDate: input.reviewMeetingDate,
    reviewAgendaOrder: input.reviewAgendaOrder,
    title: input.title,
    companyName: input.companyName,
    index: input.reviewIndex,
  });

  if (reviewFileId) {
    return {
      kind: "drive_file",
      fileId: reviewFileId,
      externalViewUrl: googleDriveFileViewUrl(reviewFileId),
      source: "review_folder",
    };
  }

  return resolveLegacyPdf({
    submissionMode: input.submissionMode,
    uploadedProposalUrl: input.uploadedProposalUrl ?? null,
    attachments,
  });
}

export async function resolveApplicationProposalPdfSourceById(
  applicationId: string,
  reviewIndex?: ReviewFolderPdfIndex | null,
): Promise<ApplicationProposalPdfSource> {
  let row: {
    submissionMode: string;
    uploadedProposalUrl: string | null;
    title: string | null;
    reviewMeetingDate: string | null;
    reviewAgendaOrder: number | null;
    displayCompanyName: string | null;
    attachments: AttachmentRow[];
  } | null = null;

  try {
    row = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        submissionMode: true,
        uploadedProposalUrl: true,
        title: true,
        reviewMeetingDate: true,
        reviewAgendaOrder: true,
        displayCompanyName: true,
        attachments: {
          orderBy: { createdAt: "desc" },
          select: { category: true, driveFileId: true, createdAt: true },
          take: 10,
        },
      },
    });
  } catch {
    const fallback = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        submissionMode: true,
        uploadedProposalUrl: true,
        title: true,
        reviewMeetingDate: true,
        reviewAgendaOrder: true,
        attachments: {
          orderBy: { createdAt: "desc" },
          select: { category: true, driveFileId: true, createdAt: true },
          take: 10,
        },
      },
    });
    row = fallback
      ? {
          ...fallback,
          displayCompanyName: null,
        }
      : null;
  }

  if (!row) {
    return { kind: "not_found", externalViewUrl: null, source: "none" };
  }

  const resolvedReviewIndex = reviewIndex ?? (await getCachedReviewFolderPdfIndex());

  return resolveApplicationProposalPdfSource({
    applicationId,
    submissionMode: row.submissionMode,
    uploadedProposalUrl: row.uploadedProposalUrl,
    attachments: row.attachments,
    reviewMeetingDate: row.reviewMeetingDate,
    reviewAgendaOrder: row.reviewAgendaOrder,
    title: row.title,
    companyName: row.displayCompanyName,
    reviewIndex: resolvedReviewIndex,
  });
}

export async function resolveApplicationProposalPdfViewUrlsBatch(
  apps: Array<{
    id: string;
    submissionMode: string;
    uploadedProposalUrl: string | null;
    title: string | null;
    reviewMeetingDate: string | null;
    reviewAgendaOrder: number | null;
    displayCompanyName: string | null;
    attachments: AttachmentRow[];
  }>,
): Promise<Map<string, string | null>> {
  const reviewIndex = await getCachedReviewFolderPdfIndex();
  const out = new Map<string, string | null>();
  for (const app of apps) {
    const source = await resolveApplicationProposalPdfSource({
      applicationId: app.id,
      submissionMode: app.submissionMode,
      uploadedProposalUrl: app.uploadedProposalUrl,
      attachments: app.attachments,
      reviewMeetingDate: app.reviewMeetingDate,
      reviewAgendaOrder: app.reviewAgendaOrder,
      title: app.title,
      companyName: app.displayCompanyName,
      reviewIndex,
    });
    out.set(
      app.id,
      source.kind === "drive_file" ? source.externalViewUrl : source.externalViewUrl,
    );
  }
  return out;
}
