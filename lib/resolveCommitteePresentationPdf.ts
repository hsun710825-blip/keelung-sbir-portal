import { AttachmentCategory } from "@prisma/client";

import { extractGoogleDriveFileId } from "@/lib/driveLinks";
import { prisma } from "@/lib/prisma";

export type CommitteePresentationPdfSource =
  | { kind: "drive_file"; fileId: string }
  | { kind: "not_found" };

export async function resolveCommitteePresentationPdfSource(
  applicationId: string,
): Promise<CommitteePresentationPdfSource> {
  let attachments: Array<{ category: AttachmentCategory; driveFileId: string | null; fileName: string }> = [];

  try {
    const row = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        attachments: {
          orderBy: { createdAt: "desc" },
          select: { category: true, driveFileId: true, fileName: true },
        },
      },
    });
    attachments = row?.attachments ?? [];
  } catch {
    return { kind: "not_found" };
  }

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

export function presentationPdfEmbedPath(applicationId: string): string {
  return `/api/committee/applications/${applicationId}/presentation-pdf`;
}
