import { emailHashKey } from "@/app/api/_driveFolders";
import { getDriveOauthClient } from "@/app/api/_driveOauth";
import { getDriveSaClient } from "@/app/api/_driveSa";
import { withGoogleApiRetry } from "@/app/api/_googleApiRetry";
import { normalizeDraftFormDataShape } from "@/lib/draftFormNormalize";
import { findDraftFileIdInFolder, readDraftJsonByFileId } from "@/lib/projectSecurity";
import { prisma } from "@/lib/prisma";
import type { drive_v3 } from "googleapis";

export type OnlineDraftViewPayload =
  | { kind: "upload_mode" }
  | { kind: "error"; status: number; message: string }
  | { kind: "no_draft_file" }
  | { kind: "ok"; draft: Record<string, unknown>; applicationId: string; driveProjectFolderId: string; applicantEmail: string; title: string | null };

async function getAdminDraftDriveClient(): Promise<drive_v3.Drive> {
  try {
    return await getDriveSaClient();
  } catch {
    return getDriveOauthClient();
  }
}

/**
 * 管理員讀取 ONLINE 案件之 Drive 線上草稿（正規化後 formData 形狀）。
 * 供 draft-view API 與批次 PDF 重製共用。
 */
export async function resolveOnlineDraftViewPayload(applicationId: string): Promise<OnlineDraftViewPayload> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      title: true,
      submissionMode: true,
      driveProjectFolderId: true,
      applicant: { select: { email: true } },
    },
  });
  if (!app) {
    return { kind: "error", status: 404, message: "找不到案件" };
  }
  const folderId = app.driveProjectFolderId?.trim();
  if (!folderId) {
    return { kind: "error", status: 400, message: "此案件尚未綁定雲端專案資料夾，無法載入線上草稿" };
  }
  const applicantEmail = app.applicant.email?.trim() || "";
  if (!applicantEmail) {
    return { kind: "error", status: 400, message: "缺少申請人 Email" };
  }

  try {
    return await withGoogleApiRetry("admin.resolveOnlineDraft", async () => {
      const drive = await getAdminDraftDriveClient();
      const key = emailHashKey(applicantEmail);
      const draftFileId = await findDraftFileIdInFolder(drive, folderId, key);
      if (!draftFileId) {
        return { kind: "no_draft_file" };
      }
      const raw = await readDraftJsonByFileId(drive, draftFileId);
      const rec = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>;
      const normalized = normalizeDraftFormDataShape(rec);
      return {
        kind: "ok",
        draft: normalized as Record<string, unknown>,
        applicationId: app.id,
        driveProjectFolderId: folderId,
        applicantEmail,
        title: app.title,
      };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load draft failed";
    return { kind: "error", status: 500, message: msg };
  }
}
