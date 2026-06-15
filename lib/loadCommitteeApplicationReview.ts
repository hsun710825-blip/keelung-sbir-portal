import type { ApplicationStatus, AttachmentCategory } from "@prisma/client";

import { resolveApplicationPdfViewUrl } from "@/lib/adminApplicationPdfViewUrl";
import { prisma } from "@/lib/prisma";

export type CommitteeApplicationReviewData = {
  id: string;
  title: string | null;
  status: ApplicationStatus;
  submissionMode: string;
  uploadedProposalUrl: string | null;
  periodYear: number | null;
  applicant: { name: string | null; email: string };
  pdfViewUrl: string | null;
  pdfAttachmentsLoaded: boolean;
};

type PdfAttachmentRow = {
  category: AttachmentCategory;
  driveFileId: string | null;
  createdAt: Date;
};

const applicationReviewSelect = {
  id: true,
  title: true,
  status: true,
  submissionMode: true,
  uploadedProposalUrl: true,
  periodYear: true,
  applicant: {
    select: { name: true, email: true },
  },
} as const;

export async function loadCommitteeApplicationReview(
  applicationId: string,
): Promise<CommitteeApplicationReviewData | null> {
  let core: {
    id: string;
    title: string | null;
    status: ApplicationStatus;
    submissionMode: string;
    uploadedProposalUrl: string | null;
    periodYear: number | null;
    applicant: { name: string | null; email: string };
  } | null = null;

  let attachments: PdfAttachmentRow[] = [];
  let pdfAttachmentsLoaded = false;

  try {
    const row = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        ...applicationReviewSelect,
        attachments: {
          orderBy: { createdAt: "desc" },
          select: { category: true, driveFileId: true, createdAt: true },
          take: 10,
        },
      },
    });
    if (!row) return null;
    core = row;
    attachments = row.attachments;
    pdfAttachmentsLoaded = true;
  } catch (error) {
    console.error("[committee/application] load with attachments failed:", error);
    core = await prisma.application.findUnique({
      where: { id: applicationId },
      select: applicationReviewSelect,
    });
    attachments = [];
    pdfAttachmentsLoaded = false;
  }

  if (!core) return null;

  const pdfViewUrl = resolveApplicationPdfViewUrl({
    submissionMode: core.submissionMode,
    uploadedProposalUrl: core.uploadedProposalUrl,
    attachments,
  });

  return {
    ...core,
    pdfViewUrl,
    pdfAttachmentsLoaded,
  };
}
