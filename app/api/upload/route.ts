import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/authOptions";
import { emailHashKey, ensureProjectFolder, ensureUserFolder, getDriveAndSession } from "../_driveFolders";
import { withGoogleApiRetry } from "../_googleApiRetry";
import {
  buildSafeUploadFilename,
  ensureAllowedUploadMime,
  ensureFileSizeLimit,
  sanitizeProjectNameForFolder,
} from "../../../lib/serverSecurity";
import { assertDraftUnlocked, findDraftFileIdInFolder } from "../../../lib/projectSecurity";
import { writeAuditLog } from "../../../lib/audit";

export async function POST(req: Request) {
  try {
    // 1) 權限驗證：無 Session 一律拒絕，避免未授權檔案寫入。
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // 2) 檔案上傳基礎驗證：必須存在 file 欄位。
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Missing "file" in formData' }, { status: 400 });
    }

    // 3) 白名單驗證：僅接受安全 MIME（不可只靠副檔名判斷）。
    const mimeCheck = ensureAllowedUploadMime(file.type || "");
    if (!mimeCheck.ok) {
      return NextResponse.json({ ok: false, error: mimeCheck.error, allowed: mimeCheck.allowed }, { status: 400 });
    }
    // 4) 單檔容量限制：防止大檔濫用資源。
    const sizeCheck = ensureFileSizeLimit(file.size);
    if (!sizeCheck.ok) {
      return NextResponse.json({ ok: false, error: sizeCheck.error, maxBytes: sizeCheck.maxBytes }, { status: 413 });
    }
    // 5) 安全檔名：以 UUID 重命名，防止 path traversal / 惡意命名。
    const filename = buildSafeUploadFilename(mimeCheck.mimeType);
    const projectName = sanitizeProjectNameForFolder(form.get("projectName"));

    const { fileId, fileName, userFolder, projectFolder } = await withGoogleApiRetry("upload.POST", async () => {
      const { drive } = await getDriveAndSession();
      const userFolder = await ensureUserFolder(drive, session);
      const projectFolder = await ensureProjectFolder({ drive, userFolderId: userFolder.folderId, projectName });
      // 6) 狀態鎖定：已送出/已刪除/過期計畫禁止再上傳附件。
      const draftFileId = await findDraftFileIdInFolder(drive, projectFolder.folderId, emailHashKey(session.user?.email || ""));
      await assertDraftUnlocked(drive, draftFileId, "Plan is locked");
      const bytes = Buffer.from(await file.arrayBuffer());
      const createRes = await drive.files.create({
        requestBody: {
          name: filename,
          parents: [projectFolder.folderId],
        },
        media: {
          mimeType: mimeCheck.mimeType,
          body: Readable.from(bytes),
        },
        fields: "id,name",
        supportsAllDrives: true,
      });
      const fileId = createRes.data.id;
      if (!fileId) throw new Error("Drive did not return file id");
      return {
        fileId,
        fileName: createRes.data.name ?? filename,
        userFolder,
        projectFolder,
      };
    });

    // 7) 稽核紀錄：保留誰在何時上傳了哪個附件。
    await writeAuditLog({
      userId: session.user.email || "unknown",
      action: "attachment.upload",
      targetId: String(fileId),
      timestamp: new Date().toISOString(),
      detail: { projectFolderId: projectFolder.folderId, mimeType: mimeCheck.mimeType, size: file.size },
    });

    return NextResponse.json({
      ok: true,
      file: {
        id: fileId,
        name: fileName,
      },
      folder: {
        user: { name: userFolder.folderName, id: userFolder.folderId },
        project: { name: projectFolder.folderName, id: projectFolder.folderId },
      },
    });
  } catch (e) {
    const errObj = e as unknown as {
      code?: number;
      response?: { status?: number; data?: { error?: { message?: string } } };
    };
    const status = errObj?.code || errObj?.response?.status;
    const apiMsg = errObj?.response?.data?.error?.message;
    const msg = apiMsg || (e instanceof Error ? e.message : "Upload failed");

    const hint =
      status === 401
        ? "請先登入後再執行檔案上傳。"
        : status === 404
          ? `Drive 找不到目標資料夾（多半是 Refresh Token 所屬帳號對目標資料夾沒有權限或資料夾不存在）。`
          : "請確認已在 .env.local 設定 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、GOOGLE_REFRESH_TOKEN，且 Refresh Token 所屬帳號對目標資料夾具備寫入權限。";

    return NextResponse.json(
      {
        ok: false,
        error: msg,
        hint,
      },
      { status: status && status >= 400 && status < 600 ? status : 500 }
    );
  }
}
