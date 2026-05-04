import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { emailHashKey } from "@/app/api/_driveFolders";
import { getDriveOauthClient } from "@/app/api/_driveOauth";
import { withGoogleApiRetry } from "@/app/api/_googleApiRetry";
import { normalizeDraftFormDataShape } from "@/lib/draftFormNormalize";
import { findDraftFileIdInFolder, readDraftJsonByFileId } from "@/lib/projectSecurity";
import { isBackofficeRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? null;
  if (!session?.user?.email || !isBackofficeRole(role)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: applicationId } = await ctx.params;
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      submissionMode: true,
      driveProjectFolderId: true,
      applicant: { select: { email: true } },
    },
  });
  if (!app) {
    return NextResponse.json({ ok: false, error: "找不到案件" }, { status: 404 });
  }

  if (String(app.submissionMode || "").toUpperCase() === "UPLOAD") {
    return NextResponse.json({ ok: true, draft: null, reason: "UPLOAD_MODE" as const });
  }

  const folderId = app.driveProjectFolderId?.trim();
  if (!folderId) {
    return NextResponse.json({ ok: false, error: "此案件尚未綁定雲端專案資料夾，無法載入線上草稿" }, { status: 400 });
  }

  const applicantEmail = app.applicant.email?.trim() || "";
  if (!applicantEmail) {
    return NextResponse.json({ ok: false, error: "缺少申請人 Email" }, { status: 400 });
  }

  try {
    const payload = await withGoogleApiRetry("admin.draft-view", async () => {
      const drive = getDriveOauthClient();
      const key = emailHashKey(applicantEmail);
      const draftFileId = await findDraftFileIdInFolder(drive, folderId, key);
      if (!draftFileId) {
        return { ok: true as const, draft: null as unknown, reason: "NO_DRAFT_FILE" as const };
      }
      const raw = await readDraftJsonByFileId(drive, draftFileId);
      const rec = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>;
      const normalized = normalizeDraftFormDataShape(rec);
      return { ok: true as const, draft: normalized, reason: null };
    });
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load draft failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
