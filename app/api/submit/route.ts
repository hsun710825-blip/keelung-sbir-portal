import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { DRIVE_FOLDER_ID, getDriveOauthClient } from "../_driveOauth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

  // Expect { pdfBase64, filename? }
  const pdfBase64 = body.pdfBase64 as string | undefined;
  if (!pdfBase64) return NextResponse.json({ ok: false, error: "Missing pdfBase64" }, { status: 400 });
  const filename = (body.filename as string | undefined) || "sbir-plan.pdf";

  try {
    const drive = getDriveOauthClient();
    const pdfBytes = Buffer.from(pdfBase64, "base64");

    const res = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: "application/pdf",
        body: Readable.from(pdfBytes),
      },
      fields: "id, name, webViewLink",
      supportsAllDrives: true,
    });

    return NextResponse.json({ ok: true, file: res.data });
  } catch (e) {
    const errObj = e as unknown as { code?: number; response?: { status?: number; data?: { error?: { message?: string } } } };
    const status = errObj?.code || errObj?.response?.status;
    const apiMsg = errObj?.response?.data?.error?.message;
    const msg = apiMsg || (e instanceof Error ? e.message : "Upload failed");
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        hint:
          status === 404
            ? `Drive 找不到目標資料夾（多半是登入的 Drive 帳號沒有權限）。請確認 Refresh Token 所屬帳號對資料夾 ID ${DRIVE_FOLDER_ID} 具備可新增/編輯檔案權限，且該資料夾存在於該帳號的雲端硬碟中。`
            : "請確認已在 .env.local 設定 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、GOOGLE_REFRESH_TOKEN，且 Refresh Token 所屬帳號對目標資料夾具備寫入權限。",
      },
      { status: 500 }
    );
  }
}

