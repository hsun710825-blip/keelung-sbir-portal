import { AttachmentCategory } from "@prisma/client";

import { googleDriveFileViewUrl } from "@/lib/driveLinks";

type Att = { category: AttachmentCategory; driveFileId: string | null; createdAt: Date };

/**
 * 管理員檢視用：優先使用已存雲端完整 URL；否則以 DRAFT_PDF 的 Drive file id 組 view 連結。
 */
export function resolveApplicationPdfViewUrl(input: {
  submissionMode: string;
  uploadedProposalUrl: string | null | undefined;
  attachments: Att[];
}): string | null {
  const direct = String(input.uploadedProposalUrl || "").trim();
  if (direct) return direct;
  const mode = String(input.submissionMode || "ONLINE").toUpperCase();
  if (mode === "UPLOAD") return null;
  const draft = [...input.attachments]
    .filter((a) => a.category === AttachmentCategory.DRAFT_PDF && a.driveFileId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return googleDriveFileViewUrl(draft?.driveFileId ?? null);
}
