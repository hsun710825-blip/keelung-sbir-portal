import { AttachmentCategory } from "@prisma/client";

import { resolveApplicationPdfViewUrl } from "@/lib/adminApplicationPdfViewUrl";
import { extractGoogleDriveFileId } from "@/lib/driveLinks";
import { prisma } from "@/lib/prisma";

export type CommitteeProposalPdfSource =
  | { kind: "drive_file"; fileId: string; externalViewUrl: string | null }
  | { kind: "not_found"; externalViewUrl: string | null };

export async function resolveCommitteeProposalPdfSource(
  applicationId: string,
): Promise<CommitteeProposalPdfSource> {
  let row: {
    submissionMode: string;
    uploadedProposalUrl: string | null;
    attachments: Array<{
      category: AttachmentCategory;
      driveFileId: string | null;
      createdAt: Date;
    }>;
  } | null = null;

  try {
    row = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        submissionMode: true,
        uploadedProposalUrl: true,
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
      },
    });
    row = fallback ? { ...fallback, attachments: [] } : null;
  }

  if (!row) return { kind: "not_found", externalViewUrl: null };

  const externalViewUrl = resolveApplicationPdfViewUrl({
    submissionMode: row.submissionMode,
    uploadedProposalUrl: row.uploadedProposalUrl,
    attachments: row.attachments ?? [],
  });

  const directId = extractGoogleDriveFileId(row.uploadedProposalUrl);
  if (directId) {
    return { kind: "drive_file", fileId: directId, externalViewUrl };
  }

  const draft = [...(row.attachments ?? [])]
    .filter((a) => a.category === AttachmentCategory.DRAFT_PDF && a.driveFileId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (draft?.driveFileId) {
    return { kind: "drive_file", fileId: draft.driveFileId, externalViewUrl };
  }

  const fromViewUrl = extractGoogleDriveFileId(externalViewUrl);
  if (fromViewUrl) {
    return { kind: "drive_file", fileId: fromViewUrl, externalViewUrl };
  }

  return { kind: "not_found", externalViewUrl };
}
