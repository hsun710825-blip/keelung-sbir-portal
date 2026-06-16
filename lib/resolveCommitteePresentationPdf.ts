import { AttachmentCategory } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  buildPresentationFolderIndex,
  resolvePresentationPdfFileId,
  type PresentationFolderIndex,
} from "@/lib/reviewPresentationPdf";
import { resolveApplicationDisplayFields } from "@/lib/resolveApplicationDisplayFields";

export type CommitteePresentationPdfSource =
  | { kind: "drive_file"; fileId: string }
  | { kind: "not_found" };

function resolveLegacyPresentationAttachment(
  attachments: Array<{ category: AttachmentCategory; driveFileId: string | null; fileName: string }>,
): CommitteePresentationPdfSource {
  const presentation = attachments.find(
    (a) =>
      a.category === AttachmentCategory.PRESENTATION_PDF ||
      /簡報/i.test(a.fileName) ||
      /presentation/i.test(a.fileName),
  );
  if (presentation?.driveFileId) {
    return { kind: "drive_file", fileId: presentation.driveFileId };
  }

  const anyPdf = attachments.find((a) => a.driveFileId && /\.pdf$/i.test(a.fileName));
  if (anyPdf?.driveFileId && /簡報|presentation/i.test(anyPdf.fileName)) {
    return { kind: "drive_file", fileId: anyPdf.driveFileId };
  }

  return { kind: "not_found" };
}

export async function resolveCommitteePresentationPdfSource(
  applicationId: string,
  presentationIndex?: PresentationFolderIndex | null,
): Promise<CommitteePresentationPdfSource> {
  let row: {
    title: string | null;
    description: string | null;
    submissionMode: string;
    reviewMeetingDate: string | null;
    reviewAgendaOrder: number | null;
    displayCompanyName: string | null;
    attachments: Array<{ category: AttachmentCategory; driveFileId: string | null; fileName: string }>;
  } | null = null;

  try {
    row = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        title: true,
        description: true,
        submissionMode: true,
        reviewMeetingDate: true,
        reviewAgendaOrder: true,
        displayCompanyName: true,
        attachments: {
          orderBy: { createdAt: "desc" },
          select: { category: true, driveFileId: true, fileName: true },
        },
      },
    });
  } catch {
    const fallback = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        title: true,
        description: true,
        submissionMode: true,
        reviewMeetingDate: true,
        reviewAgendaOrder: true,
        attachments: {
          orderBy: { createdAt: "desc" },
          select: { category: true, driveFileId: true, fileName: true },
        },
      },
    });
    row = fallback ? { ...fallback, displayCompanyName: null } : null;
  }

  if (!row) return { kind: "not_found" };

  const companyName =
    row.displayCompanyName?.trim() ||
    (
      await resolveApplicationDisplayFields({
        id: applicationId,
        submissionMode: row.submissionMode,
        description: row.description,
      })
    ).companyName;

  const index = presentationIndex ?? (await buildPresentationFolderIndex());
  const folderFileId = await resolvePresentationPdfFileId({
    reviewMeetingDate: row.reviewMeetingDate,
    reviewAgendaOrder: row.reviewAgendaOrder,
    title: row.title,
    companyName,
    index,
  });

  if (folderFileId) {
    return { kind: "drive_file", fileId: folderFileId };
  }

  return resolveLegacyPresentationAttachment(row.attachments);
}

export function presentationPdfEmbedPath(applicationId: string): string {
  return `/api/committee/applications/${applicationId}/presentation-pdf`;
}
