import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getServerSession } from "next-auth";
import type { drive_v3 } from "googleapis";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getDriveOauthAuthClient, getDriveOauthClient } from "@/app/api/_driveOauth";
import { withGoogleApiRetry } from "@/app/api/_googleApiRetry";
import {
  APPLICANT_REVISION_AUG13_SUBFOLDER_NAME,
  APPLICANT_REVISION_UPLOAD_FOLDER_ID,
  buildApplicantRevisionProposalFileName,
  findApplicantRevisionAllowlistEntry,
  hasApplicantRevisionAccess,
} from "@/lib/applicantRevisionAccess";
import { googleDriveFileViewUrl } from "@/lib/driveLinks";
import { ensureApplicantDbUser, upsertApplicationFromDraftSave } from "@/lib/applicantApplicationSync";

/** 進程內快取「8/13後重新修改」資料夾 id，避免每次上傳都 list */
let cachedAug13RevisionFolderId: string | null = null;

async function getOauthAccessToken(): Promise<string> {
  const authClient = getDriveOauthAuthClient();
  const tokenObj = await authClient.getAccessToken();
  const accessToken = tokenObj?.token;
  if (!accessToken) throw new Error("Unable to get Google OAuth access token");
  return accessToken;
}

async function deleteFilesWithNameInFolder(
  drive: drive_v3.Drive,
  folderId: string,
  fileName: string,
): Promise<void> {
  const escaped = fileName.replace(/'/g, "\\'");
  const oldFiles = await drive.files.list({
    q: `'${folderId}' in parents and name='${escaped}' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 20,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  for (const old of oldFiles.data.files ?? []) {
    if (!old.id) continue;
    await drive.files.delete({ fileId: old.id, supportsAllDrives: true });
  }
}

/**
 * 解析本次修改上傳目標：根資料夾下「8/13後重新修改」（不存在則建立）。
 * 根目錄既有修改版不回溯搬移。
 */
export async function resolveApplicantRevisionUploadFolderId(
  drive: drive_v3.Drive = getDriveOauthClient(),
): Promise<string> {
  if (cachedAug13RevisionFolderId) return cachedAug13RevisionFolderId;

  const parentId = APPLICANT_REVISION_UPLOAD_FOLDER_ID;
  const name = APPLICANT_REVISION_AUG13_SUBFOLDER_NAME;
  const escaped = name.replace(/'/g, "\\'");

  const listed = await drive.files.list({
    q: `'${parentId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder' and name='${escaped}'`,
    fields: "files(id,name)",
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const existing = listed.data.files?.[0]?.id;
  if (existing) {
    cachedAug13RevisionFolderId = existing;
    return existing;
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id,name",
    supportsAllDrives: true,
  });
  const id = String(created.data.id || "");
  if (!id) throw new Error(`建立資料夾失敗：${name}`);
  cachedAug13RevisionFolderId = id;
  return id;
}

export async function requireRevisionUploadSession() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim();
  if (!session?.user || !email) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  const role = session.user.role ?? null;
  if (!hasApplicantRevisionAccess(email, role)) {
    return { ok: false as const, status: 403, error: "目前不在修改開放期，或帳號未在開放名單內。" };
  }
  const entry = findApplicantRevisionAllowlistEntry(email);
  if (!entry) {
    return { ok: false as const, status: 403, error: "帳號未在開放名單內。" };
  }
  return { ok: true as const, session, email, entry };
}

/**
 * 修改版上傳必須使用 OAuth（有儲存配額的帳號）。
 * 不可用 Service Account：個人雲端硬碟資料夾會回 403「Service Accounts do not have storage quota」。
 */
export async function createRevisionResumableUpload(input: {
  companyName: string;
  projectName: string;
  fileSize: number;
}): Promise<{ uploadUrl: string; fileName: string; folderId: string }> {
  const fileName = buildApplicantRevisionProposalFileName({
    companyName: input.companyName,
    projectName: input.projectName,
  });

  const folderId = await withGoogleApiRetry("revisionUpload.prepare", async () => {
    const drive = getDriveOauthClient();
    const targetFolderId = await resolveApplicantRevisionUploadFolderId(drive);
    await deleteFilesWithNameInFolder(drive, targetFolderId, fileName);
    return targetFolderId;
  });

  const accessToken = await getOauthAccessToken();
  const initRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "application/pdf",
        "X-Upload-Content-Length": String(input.fileSize),
      },
      body: JSON.stringify({
        name: fileName,
        mimeType: "application/pdf",
        parents: [folderId],
      }),
    },
  );
  if (!initRes.ok) {
    const txt = await initRes.text().catch(() => "");
    throw new Error(`Google resumable init failed (${initRes.status}): ${txt || "unknown"}`);
  }
  const uploadUrl = initRes.headers.get("Location") || "";
  if (!uploadUrl) throw new Error("Google resumable session missing Location");
  return { uploadUrl, fileName, folderId };
}

export async function uploadRevisionProposalBytes(input: {
  companyName: string;
  projectName: string;
  bytes: Uint8Array;
}): Promise<{ fileId: string; fileName: string; uploadedProposalUrl: string; folderId: string }> {
  const fileName = buildApplicantRevisionProposalFileName({
    companyName: input.companyName,
    projectName: input.projectName,
  });

  const { fileId, folderId } = await withGoogleApiRetry("revisionUpload.create", async () => {
    const drive = getDriveOauthClient();
    const targetFolderId = await resolveApplicantRevisionUploadFolderId(drive);
    await deleteFilesWithNameInFolder(drive, targetFolderId, fileName);
    const created = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [targetFolderId],
      },
      media: {
        mimeType: "application/pdf",
        body: Readable.from(Buffer.from(input.bytes)),
      },
      fields: "id,name,webViewLink",
      supportsAllDrives: true,
    });
    const id = created.data.id;
    if (!id) throw new Error("Drive did not return file id");
    return { fileId: id, folderId: targetFolderId };
  });

  return {
    fileId,
    fileName,
    folderId,
    uploadedProposalUrl: googleDriveFileViewUrl(fileId) || "",
  };
}

export async function finalizeRevisionUploadedFile(input: {
  email: string;
  userName?: string | null;
  companyName: string;
  projectName: string;
  submitYear?: string;
  summary?: string;
  fileId: string;
  /** 申請人既有專案資料夾（勿使用共用修改版資料夾，避免互相覆寫 Application） */
  driveProjectFolderId: string;
}): Promise<{ uploadedProposalUrl: string } | { error: string }> {
  const expectedName = buildApplicantRevisionProposalFileName({
    companyName: input.companyName,
    projectName: input.projectName,
  });

  const checked = await withGoogleApiRetry("revisionUpload.finalize", async () => {
    const drive = getDriveOauthClient();
    const folderId = await resolveApplicantRevisionUploadFolderId(drive);
    const file = await drive.files.get({
      fileId: input.fileId,
      fields: "id,name,mimeType,parents",
      supportsAllDrives: true,
    });
    const parentIds = file.data.parents || [];
    if (!parentIds.includes(folderId)) {
      return { ok: false as const, error: "上傳檔案不屬於修改版資料夾。" };
    }
    if (String(file.data.mimeType || "").toLowerCase() !== "application/pdf") {
      return { ok: false as const, error: "上傳檔案格式錯誤，僅接受 PDF。" };
    }
    if (String(file.data.name || "") !== expectedName) {
      await drive.files.update({
        fileId: input.fileId,
        requestBody: { name: expectedName },
        supportsAllDrives: true,
      });
    }
    return { ok: true as const };
  });

  if (!checked.ok) return { error: checked.error };

  const uploadedProposalUrl = googleDriveFileViewUrl(input.fileId) || "";
  const dbUser = await ensureApplicantDbUser(input.email, input.userName);
  await upsertApplicationFromDraftSave({
    applicantUserId: dbUser.id,
    driveProjectFolderId: input.driveProjectFolderId,
    projectTitle: input.projectName || "未命名計畫",
    formData: {
      projectName: input.projectName,
      submitYear: String(input.submitYear ?? "").trim(),
      summary: String(input.summary ?? "").trim(),
      submissionMode: "UPLOAD",
      uploadedProposalUrl,
    },
  });
  return { uploadedProposalUrl };
}

export function revisionUploadJsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}
