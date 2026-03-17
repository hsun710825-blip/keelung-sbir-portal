import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { DRIVE_FOLDER_ID, getDriveOauthClient } from "../_driveOauth";

const SID_COOKIE = "sbir_sid";

async function ensureSessionId() {
  const jar = await cookies();
  const existing = jar.get(SID_COOKIE)?.value;
  if (existing) return existing;
  const sid = crypto.randomBytes(16).toString("hex");
  jar.set(SID_COOKIE, sid, { httpOnly: true, sameSite: "lax", path: "/" });
  return sid;
}

function draftName(sid: string) {
  return `draft-${sid}.json`;
}

type DriveClient = ReturnType<typeof getDriveOauthClient>;

async function findDraftFileId(drive: DriveClient, sid: string) {
  const name = draftName(sid);
  const res = await drive.files.list({
    q: `'${DRIVE_FOLDER_ID}' in parents and name='${name.replace(/'/g, "\\'")}' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id || null;
}

export async function GET() {
  try {
    const sid = await ensureSessionId();
    const drive = getDriveOauthClient();
    const fileId = await findDraftFileId(drive, sid);
    if (!fileId) return NextResponse.json({ ok: true, draft: null });

    const dl = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );
    const raw = Buffer.from(dl.data as ArrayBuffer).toString("utf-8");
    return NextResponse.json({ ok: true, draft: JSON.parse(raw) });
  } catch {
    return NextResponse.json({ ok: true, draft: null });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

  const payload = { ...body, updatedAt: new Date().toISOString() };
  const sid = await ensureSessionId();

  try {
    const drive = getDriveOauthClient();
    const name = draftName(sid);
    const bytes = Buffer.from(JSON.stringify(payload, null, 2), "utf-8");
    const existingId = await findDraftFileId(drive, sid);

    if (existingId) {
      const res = await drive.files.update({
        fileId: existingId,
        media: {
          mimeType: "application/json; charset=utf-8",
          body: Readable.from(bytes),
        },
        fields: "id,name,webViewLink",
        supportsAllDrives: true,
      });
      return NextResponse.json({ ok: true, file: res.data });
    }

    const res = await drive.files.create({
      requestBody: {
        name,
        parents: [DRIVE_FOLDER_ID],
        mimeType: "application/json",
      },
      media: {
        mimeType: "application/json; charset=utf-8",
        body: Readable.from(bytes),
      },
      fields: "id,name,webViewLink",
      supportsAllDrives: true,
    });

    return NextResponse.json({ ok: true, file: res.data });
  } catch (e) {
    const errObj = e as unknown as { code?: number; response?: { status?: number; data?: { error?: { message?: string } } } };
    const status = errObj?.code || errObj?.response?.status;
    const apiMsg = errObj?.response?.data?.error?.message;
    const msg = apiMsg || (e instanceof Error ? e.message : "Save draft failed");
    const hint =
      status === 404
        ? `Drive 找不到目標資料夾（多半是登入的 Drive 帳號沒有權限）。請確認 Refresh Token 所屬帳號對資料夾 ID ${DRIVE_FOLDER_ID} 具備可新增/編輯檔案權限，且該資料夾存在於該帳號的雲端硬碟中。`
        : "請確認已在 .env.local 設定 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、GOOGLE_REFRESH_TOKEN，且 Refresh Token 所屬帳號對目標資料夾具備寫入權限。";
    return NextResponse.json({ ok: false, error: msg, hint }, { status: 500 });
  }
}

