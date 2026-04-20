import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import crypto from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/authOptions";
import { DRIVE_FOLDER_ID, getDriveOauthClient } from "../_driveOauth";
import { ensureProjectFolder, ensureUserFolder } from "../_driveFolders";
import { updateRegistryFromFormData } from "../_registrySheet";
import { withGoogleApiRetry } from "../_googleApiRetry";
import { sanitizeDeepInput, sanitizeProjectNameForFolder } from "../../../lib/serverSecurity";
import {
  assertDraftUnlocked,
  extractLockStateFromDraft,
  findDraftFileIdInFolder as findDraftInProjectFolder,
  readDraftJsonByFileId,
} from "../../../lib/projectSecurity";
import { writeAuditLog } from "../../../lib/audit";
import {
  ensureApplicantDbUser,
  upsertApplicationFromDraftSave,
} from "../../../lib/applicantApplicationSync";

type DraftKeys = {
  // 以登入者 email hash 作為草稿識別鍵，避免直接暴露可猜測識別資訊。
  emailKey: string;
};

function getDraftKeysByEmail(email: string): DraftKeys {
  const emailKey = crypto.createHash("sha256").update(email).digest("hex").slice(0, 32);
  return { emailKey };
}

function draftName(key: string) {
  return `draft-${key}.json`;
}

type DriveClient = ReturnType<typeof getDriveOauthClient>;

async function findDraftFileId(drive: DriveClient, sid: string) {
  const name = draftName(sid);
  const res = await drive.files.list({
    q: `'${DRIVE_FOLDER_ID}' in parents and name='${name.replace(/'/g, "\\'")}' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 1,
    spaces: "drive",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id || null;
}

async function findLatestDraftFileIdAnywhere(drive: DriveClient, key: string) {
  const name = draftName(key);
  const res = await drive.files.list({
    q: `name='${name.replace(/'/g, "\\'")}' and trashed=false`,
    fields: "files(id,name,modifiedTime)",
    pageSize: 50,
    spaces: "drive",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
  });
  const files = res.data.files || [];
  // Some Drive accounts/queries may ignore orderBy; sort client-side for robustness.
  files.sort((a, b) => String(b.modifiedTime || "").localeCompare(String(a.modifiedTime || "")));
  return files[0]?.id || null;
}

async function isOwnedByUserFolder(drive: DriveClient, fileId: string, userFolderId: string) {
  let currentId: string | null = fileId;
  for (let i = 0; i < 20 && currentId; i++) {
    const res = await drive.files.get({
      fileId: currentId,
      fields: "id,parents",
      supportsAllDrives: true,
    });
    const parents = (res.data.parents || []) as string[];
    if (parents.includes(userFolderId)) return true;
    currentId = parents[0] || null;
  }
  return false;
}

async function assertFileOwnershipOrThrow(drive: DriveClient, fileId: string, userFolderId: string) {
  // IDOR 防護：檔案若不在當前使用者資料夾祖先鏈上，一律阻擋。
  const owned = await isOwnedByUserFolder(drive, fileId, userFolderId);
  if (!owned) {
    const err = new Error("Forbidden");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}

export async function GET() {
  try {
    return await withGoogleApiRetry("draft.GET", async () => {
    // 權限邊界：草稿讀取僅允許已登入使用者。
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim();
    if (!session?.user || !email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { emailKey } = getDraftKeysByEmail(email);
    const drive = getDriveOauthClient();
    const userFolder = await ensureUserFolder(drive, session);

    const emailFileIdLatest = await findLatestDraftFileIdAnywhere(drive, emailKey);
    const emailFileIdLegacy = await findDraftFileId(drive, emailKey);
    const candidateIds = [emailFileIdLatest, emailFileIdLegacy].filter(Boolean) as string[];
    let fileId: string | null = null;
    for (const id of candidateIds) {
      if (await isOwnedByUserFolder(drive, id, userFolder.folderId)) {
        fileId = id;
        break;
      }
    }
    if (!fileId) {
      return NextResponse.json({ ok: true, draft: null, meta: { emailKey } });
    }

    await assertFileOwnershipOrThrow(drive, fileId, userFolder.folderId);
    const parsed = await readDraftJsonByFileId(drive, fileId);
    // 狀態鎖定：軟刪除/已送出/過期資料不可作為可編輯草稿返回前端。
    const lock = extractLockStateFromDraft(parsed);
    if (lock.isDeleted) {
      return NextResponse.json({ ok: true, draft: null, meta: { emailKey, usedFileId: fileId, deleted: true } });
    }

    return NextResponse.json({ ok: true, draft: parsed, meta: { emailKey, usedFileId: fileId, lock } });
    });
  } catch (e) {
    const errObj = e as unknown as {
      code?: number;
      response?: { status?: number; data?: { error?: { message?: string } } };
      status?: number;
    };
    const status = errObj?.status || errObj?.code || errObj?.response?.status;
    const apiMsg = errObj?.response?.data?.error?.message;
    const msg = apiMsg || (e instanceof Error ? e.message : "Load draft failed");
    return NextResponse.json(
      {
        ok: false,
        draft: null,
        error: msg,
      },
      { status: status && status >= 400 && status < 600 ? status : 500 }
    );
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim();
  if (!session?.user || !email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { emailKey: key } = getDraftKeysByEmail(email);
  // 進入儲存層前做遞迴字串淨化（XSS 風險降低）。
  const payload = sanitizeDeepInput({ ...body, updatedAt: new Date().toISOString() });

  try {
    type SaveResult = {
      file: { id?: string | null; name?: string | null; webViewLink?: string | null };
      folderMeta: { user?: { id: string; name: string }; project?: { id: string; name: string } } | null;
    };

    const saveResult = (await withGoogleApiRetry("draft.POST", async () => {
      const drive = getDriveOauthClient();

      let parentId = DRIVE_FOLDER_ID;
      let folderMeta: SaveResult["folderMeta"] = null;
      const userFolder = await ensureUserFolder(drive, session);
      const projectName = sanitizeProjectNameForFolder(payload?.formData?.projectName);
      const projectFolder = await ensureProjectFolder({ drive, userFolderId: userFolder.folderId, projectName });
      parentId = projectFolder.folderId;
      folderMeta = {
        user: { id: userFolder.folderId, name: userFolder.folderName },
        project: { id: projectFolder.folderId, name: projectFolder.folderName },
      };

      const name = draftName(key);
      const bytes = Buffer.from(JSON.stringify(payload, null, 2), "utf-8");
      const existingId =
        parentId === DRIVE_FOLDER_ID ? await findDraftFileId(drive, key) : await findDraftInProjectFolder(drive, parentId, key);

      if (existingId) {
        await assertFileOwnershipOrThrow(drive, existingId, userFolder.folderId);
        // 鎖定檢查：submitted/expired/deleted 草稿不可更新。
        await assertDraftUnlocked(drive, existingId, "Plan is locked");
        const res = await drive.files.update({
          fileId: existingId,
          media: {
            mimeType: "application/json; charset=utf-8",
            body: Readable.from(bytes),
          },
          fields: "id,name,webViewLink",
          supportsAllDrives: true,
        });
        return { file: res.data!, folderMeta };
      }

      const res = await drive.files.create({
        requestBody: {
          name,
          parents: [parentId],
          mimeType: "application/json",
        },
        media: {
          mimeType: "application/json; charset=utf-8",
          body: Readable.from(bytes),
        },
        fields: "id,name,webViewLink",
        supportsAllDrives: true,
      });
      return { file: res.data!, folderMeta };
    })) as SaveResult;
    const { file, folderMeta } = saveResult;

    const projectFolderId = folderMeta?.project?.id;
    if (projectFolderId && payload?.formData) {
      try {
        const dbUser = await ensureApplicantDbUser(email, session.user?.name);
        const projectTitle =
          typeof (payload.formData as Record<string, unknown>)?.projectName === "string"
            ? String((payload.formData as Record<string, unknown>).projectName).trim()
            : "";
        await upsertApplicationFromDraftSave({
          applicantUserId: dbUser.id,
          driveProjectFolderId: projectFolderId,
          projectTitle: projectTitle || "未命名計畫",
          formData: payload.formData as Record<string, unknown>,
        });
      } catch (dbErr) {
        console.error("[draft.POST] Drive 已寫入，但 Prisma 同步失敗（ensureApplicantDbUser / upsertApplicationFromDraftSave 內含重試）", dbErr);
        throw dbErr;
      }
    }

    const mail = session?.user?.email?.trim();
    if (mail && payload?.formData) {
      void updateRegistryFromFormData(mail, payload.formData as Record<string, unknown>).catch(() => {});
    }

    // 稽核軌跡：記錄草稿寫入操作，供後續責任追蹤。
    await writeAuditLog({
      userId: email,
      action: "draft.save",
      targetId: String(file.id || "draft"),
      timestamp: new Date().toISOString(),
      detail: { projectFolderId: folderMeta?.project?.id || null },
    });
    return NextResponse.json({ ok: true, file, folder: folderMeta });
  } catch (e) {
    const errObj = e as unknown as { code?: number; response?: { status?: number; data?: { error?: { message?: string } } } };
    const status = (e as Error & { status?: number })?.status || errObj?.code || errObj?.response?.status;
    const apiMsg = errObj?.response?.data?.error?.message;
    const msg = apiMsg || (e instanceof Error ? e.message : "Save draft failed");
    const hint =
      status === 404
        ? `Drive 找不到目標資料夾（多半是登入的 Drive 帳號沒有權限）。請確認 Refresh Token 所屬帳號對資料夾 ID ${DRIVE_FOLDER_ID} 具備可新增/編輯檔案權限，且該資料夾存在於該帳號的雲端硬碟中。`
        : "請確認已在 .env.local 設定 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、GOOGLE_REFRESH_TOKEN，且 Refresh Token 所屬帳號對目標資料夾具備寫入權限。";
    return NextResponse.json({ ok: false, error: msg, hint }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim();
    if (!session?.user || !email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { emailKey } = getDraftKeysByEmail(email);
    const drive = getDriveOauthClient();
    const userFolder = await ensureUserFolder(drive, session);
    const body = await req.json().catch(() => ({}));
    const projectName = sanitizeProjectNameForFolder((body as Record<string, unknown>)?.projectName);
    const projectFolder = await ensureProjectFolder({ drive, userFolderId: userFolder.folderId, projectName });
    const fileId = await findDraftInProjectFolder(drive, projectFolder.folderId, emailKey);
    if (!fileId) return NextResponse.json({ ok: true, deleted: false });
    await assertFileOwnershipOrThrow(drive, fileId, userFolder.folderId);
    // 鎖定狀態下不可刪除，避免繞過送件凍結機制。
    await assertDraftUnlocked(drive, fileId, "Plan is locked");
    const existingDraft = await readDraftJsonByFileId(drive, fileId);
    // 軟刪除：標記欄位而非實體刪檔，避免不可逆資料遺失。
    const softDeleted = {
      ...existingDraft,
      deletedAt: new Date().toISOString(),
      isDeleted: true,
    };
    await drive.files.update({
      fileId,
      media: {
        mimeType: "application/json; charset=utf-8",
        body: Readable.from(Buffer.from(JSON.stringify(softDeleted, null, 2), "utf-8")),
      },
      fields: "id,name",
      supportsAllDrives: true,
    });
    await writeAuditLog({
      userId: email,
      action: "draft.soft_delete",
      targetId: fileId,
      timestamp: new Date().toISOString(),
      detail: { projectFolderId: projectFolder.folderId },
    });
    return NextResponse.json({ ok: true, deleted: true });
  } catch (e) {
    const status = (e as Error & { status?: number })?.status || 500;
    const msg = e instanceof Error ? e.message : "Delete draft failed";
    return NextResponse.json({ ok: false, error: msg }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}

