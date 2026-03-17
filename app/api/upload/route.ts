import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { DRIVE_FOLDER_ID, getDriveOauthClient } from "../_driveOauth";
import { getServerSession } from "next-auth/next";
import type { NextAuthOptions } from "next-auth";

// 專案若已有共用 authOptions，請改成：
// import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
// 這裡用 declare 只為了通過型別檢查，不會產生實際程式碼。
declare const authOptions: NextAuthOptions;

function safeUserKey(session: Awaited<ReturnType<typeof getServerSession>>) {
  const u = session?.user;
  const raw = (u?.email || u?.name || "anonymous").toString().trim();
  if (!raw) return "anonymous";
  return raw
    .replace(/[<>:"/\\|?*\u0000-\u001F\u007F]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

async function ensureUserFolder(drive: ReturnType<typeof getDriveOauthClient>, userKey: string) {
  const q = [
    `'${DRIVE_FOLDER_ID}' in parents`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `name = '${userKey.replace(/'/g, "\\'")}'`,
  ].join(" and ");

  const found = await drive.files.list({
    q,
    fields: "files(id,name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "drive",
  });

  const existing = found.data.files?.[0];
  if (existing?.id) return existing.id;

  const created = await drive.files.create({
    requestBody: {
      name: userKey,
      mimeType: "application/vnd.google-apps.folder",
      parents: [DRIVE_FOLDER_ID],
    },
    fields: "id,name",
    supportsAllDrives: true,
  });

  if (!created.data.id) throw new Error("Failed to create user folder in Drive");
  return created.data.id;
}

export async function POST(req: Request) {
  try {
    // 1. 嚴格身分驗證：無 Session 一律拒絕
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // 2. 解析 FormData
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Missing "file" in formData' }, { status: 400 });
    }

    const overrideName = form.get("filename");
    const filename = typeof overrideName === "string" && overrideName.trim() ? overrideName.trim() : file.name;

    // 3. 初始化 Drive OAuth2 + Drive v3
    const drive = getDriveOauthClient();

    // 4. 依使用者建立/取得專屬子資料夾（資料隔離）
    const userKey = safeUserKey(session);
    const userFolderId = await ensureUserFolder(drive, userKey);

    // 5. 上傳檔案到使用者子資料夾（維持預設 Restricted 權限）
    const bytes = Buffer.from(await file.arrayBuffer());
    const createRes = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [userFolderId],
      },
      media: {
        mimeType: file.type || "application/octet-stream",
        body: Readable.from(bytes),
      },
      fields: "id,name",
      supportsAllDrives: true,
    });

    const fileId = createRes.data.id;
    if (!fileId) throw new Error("Drive did not return file id");

    // 不設定任何 public/anyone 權限，完全依賴 Google Drive 預設 Restricted。

    return NextResponse.json({
      ok: true,
      file: {
        id: fileId,
        name: createRes.data.name ?? filename,
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
          ? `Drive 找不到目標資料夾（多半是 Refresh Token 所屬帳號對 ${DRIVE_FOLDER_ID} 沒有權限）。`
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

import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { DRIVE_FOLDER_ID, getDriveOauthClient } from "../_driveOauth";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Missing "file" in formData' }, { status: 400 });
    }

    // Optional: custom filename
    const overrideName = form.get("filename");
    const filename = typeof overrideName === "string" && overrideName.trim() ? overrideName.trim() : file.name;

    const drive = getDriveOauthClient();

    const bytes = Buffer.from(await file.arrayBuffer());
    const createRes = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: file.type || "application/octet-stream",
        body: Readable.from(bytes),
      },
      fields: "id,name,webViewLink,webContentLink",
      supportsAllDrives: true,
    });

    const fileId = createRes.data.id;
    if (!fileId) throw new Error("Drive did not return file id");

    // Permission: anyone with link can view
    await drive.permissions.create({
      fileId,
      requestBody: { type: "anyone", role: "reader" },
      supportsAllDrives: true,
    });

    const getRes = await drive.files.get({
      fileId,
      fields: "id,name,webViewLink,webContentLink",
      supportsAllDrives: true,
    });

    return NextResponse.json({
      ok: true,
      file: {
        id: getRes.data.id,
        name: getRes.data.name,
        webViewLink: getRes.data.webViewLink,
        webContentLink: getRes.data.webContentLink,
      },
    });
  } catch (e) {
    // Try to extract googleapis error details
    const errObj = e as unknown as {
      code?: number;
      response?: { status?: number; data?: { error?: { message?: string } } };
    };
    const status = errObj?.code || errObj?.response?.status;
    const apiMsg = errObj?.response?.data?.error?.message;
    const msg = apiMsg || (e instanceof Error ? e.message : "Upload failed");

    const hint =
      status === 404
        ? `Drive 找不到目標資料夾（多半是登入的 Drive 帳號沒有權限）。請確認 Refresh Token 所屬帳號對資料夾 ID ${DRIVE_FOLDER_ID} 具備可新增/編輯檔案權限，且該資料夾存在於該帳號的雲端硬碟中。`
        : "請確認已在 .env.local 設定 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、GOOGLE_REFRESH_TOKEN，且 Refresh Token 所屬帳號對目標資料夾具備寫入權限。";
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        hint,
      },
      { status: 500 }
    );
  }
}

