import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "../../auth/[...nextauth]/authOptions";
import { emailHashKey, ensureProjectFolder, ensureUserFolder } from "../../_driveFolders";
import { getDriveOauthAuthClient, getDriveOauthClient } from "../../_driveOauth";
import { withGoogleApiRetry } from "../../_googleApiRetry";
import { sanitizeProjectNameForFolder } from "../../../../lib/serverSecurity";
import { assertDraftUnlocked, findDraftFileIdInFolder } from "../../../../lib/projectSecurity";

const MAX_PROPOSAL_BYTES = 100 * 1024 * 1024;
const PROPOSAL_FILE_NAME = "uploaded-proposal.pdf";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim();
    if (!session?.user || !email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as
      | { projectName?: string; fileSize?: number; mimeType?: string }
      | null;
    if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    const projectName = sanitizeProjectNameForFolder(body.projectName);
    const fileSize = Number(body.fileSize) || 0;
    const mimeType = String(body.mimeType || "").trim().toLowerCase();
    if (mimeType !== "application/pdf") {
      return NextResponse.json({ ok: false, error: "僅允許上傳 PDF 檔案。" }, { status: 400 });
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_PROPOSAL_BYTES) {
      return NextResponse.json({ ok: false, error: "PDF 檔案不可超過 100MB。" }, { status: 413 });
    }

    const result = await withGoogleApiRetry("upload-proposal.session", async () => {
      const drive = getDriveOauthClient();
      const userFolder = await ensureUserFolder(drive, session);
      const projectFolder = await ensureProjectFolder({ drive, userFolderId: userFolder.folderId, projectName });
      const draftFileId = await findDraftFileIdInFolder(drive, projectFolder.folderId, emailHashKey(email));
      await assertDraftUnlocked(drive, draftFileId, "Plan is locked");

      const oldFiles = await drive.files.list({
        q: `'${projectFolder.folderId}' in parents and name='${PROPOSAL_FILE_NAME}' and trashed=false`,
        fields: "files(id,name)",
        pageSize: 20,
        spaces: "drive",
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });
      for (const old of oldFiles.data.files ?? []) {
        if (!old.id) continue;
        await drive.files.delete({ fileId: old.id, supportsAllDrives: true });
      }

      const authClient = getDriveOauthAuthClient();
      const tokenObj = await authClient.getAccessToken();
      const accessToken = tokenObj?.token;
      if (!accessToken) throw new Error("Unable to get Google access token");
      const initRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink&supportsAllDrives=true",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": "application/pdf",
            "X-Upload-Content-Length": String(fileSize),
          },
          body: JSON.stringify({
            name: PROPOSAL_FILE_NAME,
            mimeType: "application/pdf",
            parents: [projectFolder.folderId],
          }),
        }
      );
      if (!initRes.ok) {
        const txt = await initRes.text().catch(() => "");
        throw new Error(`Google resumable init failed (${initRes.status}): ${txt || "unknown"}`);
      }
      const uploadUrl = initRes.headers.get("Location") || "";
      if (!uploadUrl) throw new Error("Google resumable session missing Location");
      return { uploadUrl };
    });

    return NextResponse.json({ ok: true, uploadUrl: result.uploadUrl });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Upload session failed" }, { status: 500 });
  }
}

