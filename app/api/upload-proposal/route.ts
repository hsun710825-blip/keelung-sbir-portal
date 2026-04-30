import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getServerSession } from "next-auth";

import { authOptions } from "../auth/[...nextauth]/authOptions";
import { emailHashKey, ensureProjectFolder, ensureUserFolder, getDriveAndSession } from "../_driveFolders";
import { withGoogleApiRetry } from "../_googleApiRetry";
import {
  ensureAllowedUploadExtension,
  ensureAllowedUploadMagic,
  ensureAllowedUploadMime,
  sanitizeProjectNameForFolder,
} from "../../../lib/serverSecurity";
import { googleDriveFileViewUrl } from "../../../lib/driveLinks";
import { assertDraftUnlocked, findDraftFileIdInFolder } from "../../../lib/projectSecurity";
import { ensureApplicantDbUser, upsertApplicationFromDraftSave } from "../../../lib/applicantApplicationSync";

const MAX_PROPOSAL_BYTES = 100 * 1024 * 1024;
const PROPOSAL_FILE_NAME = "uploaded-proposal.pdf";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim();
    if (!session?.user || !email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Missing "file" in formData' }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ ok: false, error: "檔案不可為空。" }, { status: 400 });
    }
    if (file.size > MAX_PROPOSAL_BYTES) {
      return NextResponse.json({ ok: false, error: "PDF 檔案不可超過 100MB。" }, { status: 413 });
    }

    const mimeCheck = ensureAllowedUploadMime(file.type || "");
    if (!mimeCheck.ok || mimeCheck.mimeType !== "application/pdf") {
      return NextResponse.json({ ok: false, error: "僅允許上傳 PDF 檔案。" }, { status: 400 });
    }
    const extCheck = ensureAllowedUploadExtension(file.name, "application/pdf");
    if (!extCheck.ok) {
      return NextResponse.json({ ok: false, error: extCheck.error }, { status: 400 });
    }

    const projectName = sanitizeProjectNameForFolder(form.get("projectName"));
    const submitYear = String(form.get("submitYear") ?? "").trim();
    const summary = String(form.get("summary") ?? "").trim();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const magicCheck = ensureAllowedUploadMagic(bytes, "application/pdf");
    if (!magicCheck.ok) {
      return NextResponse.json({ ok: false, error: magicCheck.error }, { status: 400 });
    }

    const result = await withGoogleApiRetry("upload-proposal.POST", async () => {
      const { drive } = await getDriveAndSession();
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

      const created = await drive.files.create({
        requestBody: {
          name: PROPOSAL_FILE_NAME,
          parents: [projectFolder.folderId],
        },
        media: {
          mimeType: "application/pdf",
          body: Readable.from(Buffer.from(bytes)),
        },
        fields: "id,name,webViewLink",
        supportsAllDrives: true,
      });
      const fileId = created.data.id;
      if (!fileId) throw new Error("Drive did not return file id");
      return { fileId, projectFolderId: projectFolder.folderId };
    });

    const uploadedProposalUrl = googleDriveFileViewUrl(result.fileId) || "";
    const dbUser = await ensureApplicantDbUser(email, session.user?.name);
    await upsertApplicationFromDraftSave({
      applicantUserId: dbUser.id,
      driveProjectFolderId: result.projectFolderId,
      projectTitle: projectName || "未命名計畫",
      formData: {
        projectName,
        submitYear,
        summary,
        submissionMode: "UPLOAD",
        uploadedProposalUrl,
      },
    });

    return NextResponse.json({
      ok: true,
      uploadedProposalUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
