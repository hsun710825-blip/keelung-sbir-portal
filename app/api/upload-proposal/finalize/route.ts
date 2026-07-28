import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "../../auth/[...nextauth]/authOptions";
import { ensureProjectFolder, ensureUserFolder } from "../../_driveFolders";
import { getDriveOauthClient } from "../../_driveOauth";
import { withGoogleApiRetry } from "../../_googleApiRetry";
import { hasApplicantRevisionAccess } from "@/lib/applicantRevisionAccess";
import {
  finalizeRevisionUploadedFile,
  requireRevisionUploadSession,
  revisionUploadJsonError,
} from "@/lib/applicantRevisionUpload";
import { sanitizeProjectNameForFolder } from "../../../../lib/serverSecurity";
import { googleDriveFileViewUrl } from "../../../../lib/driveLinks";
import { ensureApplicantDbUser, upsertApplicationFromDraftSave } from "../../../../lib/applicantApplicationSync";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim();
    if (!session?.user || !email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as
      | { projectName?: string; submitYear?: string; summary?: string; fileId?: string }
      | null;
    if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    const projectName = sanitizeProjectNameForFolder(body.projectName);
    const fileId = String(body.fileId || "").trim();
    if (!fileId) return NextResponse.json({ ok: false, error: "Missing fileId" }, { status: 400 });

    if (hasApplicantRevisionAccess(email, session.user.role ?? null)) {
      const gate = await requireRevisionUploadSession();
      if (!gate.ok) return revisionUploadJsonError(gate.status, gate.error);
      const drive = getDriveOauthClient();
      const userFolder = await ensureUserFolder(drive, session);
      const projectFolder = await ensureProjectFolder({
        drive,
        userFolderId: userFolder.folderId,
        projectName,
      });
      const result = await finalizeRevisionUploadedFile({
        email: gate.email,
        userName: gate.session.user?.name,
        companyName: gate.entry.companyName,
        projectName,
        submitYear: String(body.submitYear ?? "").trim(),
        summary: String(body.summary ?? "").trim(),
        fileId,
        driveProjectFolderId: projectFolder.folderId,
      });
      if ("error" in result) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, uploadedProposalUrl: result.uploadedProposalUrl });
    }

    const result = await withGoogleApiRetry("upload-proposal.finalize", async () => {
      const drive = getDriveOauthClient();
      const userFolder = await ensureUserFolder(drive, session);
      const projectFolder = await ensureProjectFolder({ drive, userFolderId: userFolder.folderId, projectName });
      const file = await drive.files.get({
        fileId,
        fields: "id,name,mimeType,parents",
        supportsAllDrives: true,
      });
      const parentIds = file.data.parents || [];
      if (!parentIds.includes(projectFolder.folderId)) {
        return { ok: false as const, error: "上傳檔案不屬於目前計畫資料夾。" };
      }
      if (String(file.data.mimeType || "").toLowerCase() !== "application/pdf") {
        return { ok: false as const, error: "上傳檔案格式錯誤，僅接受 PDF。" };
      }
      const uploadedProposalUrl = googleDriveFileViewUrl(fileId) || "";
      const dbUser = await ensureApplicantDbUser(email, session.user?.name);
      await upsertApplicationFromDraftSave({
        applicantUserId: dbUser.id,
        driveProjectFolderId: projectFolder.folderId,
        projectTitle: projectName || "未命名計畫",
        formData: {
          projectName,
          submitYear: String(body.submitYear ?? "").trim(),
          summary: String(body.summary ?? "").trim(),
          submissionMode: "UPLOAD",
          uploadedProposalUrl,
        },
      });
      return { ok: true as const, uploadedProposalUrl };
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, uploadedProposalUrl: result.uploadedProposalUrl });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Upload finalize failed" }, { status: 500 });
  }
}
