import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { AttachmentCategory } from "@prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getDriveOauthClient } from "@/app/api/_driveOauth";
import { withGoogleApiRetry } from "@/app/api/_googleApiRetry";
import { absoluteOriginFromRequest } from "@/lib/adminRequestOrigin";
import { resolveOnlineDraftViewPayload } from "@/lib/adminOnlineDraftResolve";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { buildSafeDisplayPdfName, ensureSubmitPdfSizeLimit, sanitizeDeepInput } from "@/lib/serverSecurity";
import { canOperateApplications } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 3;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchPdfBytesWithRetry(opts: {
  origin: string;
  cookieHeader: string | null;
  formData: Record<string, unknown>;
  filename: string;
}): Promise<{ ok: true; bytes: Buffer } | { ok: false; error: string; status: number }> {
  let lastErr = "PDF 產製失敗";
  let lastStatus = 500;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${opts.origin}/api/pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(opts.cookieHeader ? { Cookie: opts.cookieHeader } : {}),
      },
      body: JSON.stringify({
        formData: opts.formData,
        filename: opts.filename,
        __adminRegenerate: true,
      }),
      cache: "no-store",
    });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      const sizeCheck = ensureSubmitPdfSizeLimit(buf.byteLength);
      if (!sizeCheck.ok) {
        return { ok: false, error: sizeCheck.error, status: 413 };
      }
      return { ok: true, bytes: buf };
    }
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    lastErr = String(j?.error || (await res.text().catch(() => "PDF 產製失敗"))).slice(0, 500);
    lastStatus = res.status >= 400 && res.status < 600 ? res.status : 500;
    if (attempt < MAX_ATTEMPTS) {
      await sleep(400 * attempt * attempt);
    }
  }
  return { ok: false, error: lastErr, status: lastStatus };
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim();
  const jwtRole = session?.user?.role ?? null;
  if (!session?.user || !email || !canOperateApplications(jwtRole)) {
    return NextResponse.json({ ok: false, error: "僅限管理員或 PO 人員" }, { status: 403 });
  }

  const operator = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (!operator) {
    return NextResponse.json({ ok: false, error: "找不到操作者帳號" }, { status: 403 });
  }

  const { id: applicationId } = await ctx.params;

  const appRow = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, submissionMode: true },
  });
  if (!appRow) {
    return NextResponse.json({ ok: false, error: "找不到案件" }, { status: 404 });
  }
  if (String(appRow.submissionMode || "").toUpperCase() === "UPLOAD") {
    return NextResponse.json({ ok: false, error: "自行上傳（UPLOAD）模式不可重製線上 PDF" }, { status: 400 });
  }

  const draftState = await resolveOnlineDraftViewPayload(applicationId);
  if (draftState.kind === "upload_mode") {
    return NextResponse.json({ ok: false, error: "UPLOAD 模式不可重製" }, { status: 400 });
  }
  if (draftState.kind === "error") {
    return NextResponse.json({ ok: false, error: draftState.message }, { status: draftState.status });
  }
  if (draftState.kind === "no_draft_file") {
    return NextResponse.json({ ok: false, error: "找不到線上草稿檔，無法重製 PDF" }, { status: 400 });
  }

  const cleanForm = sanitizeDeepInput(draftState.draft) as Record<string, unknown>;
  const projectNameRaw =
    (typeof cleanForm.projectName === "string" && cleanForm.projectName.trim() ? cleanForm.projectName : null) ||
    (draftState.title?.trim() ? draftState.title : null) ||
    "未命名計畫";
  const displayPdfName = buildSafeDisplayPdfName(projectNameRaw);

  const origin = absoluteOriginFromRequest(req);
  const cookieHeader = req.headers.get("cookie");

  const pdfOut = await fetchPdfBytesWithRetry({
    origin,
    cookieHeader,
    formData: cleanForm,
    filename: displayPdfName,
  });
  if (!pdfOut.ok) {
    return NextResponse.json({ ok: false, error: pdfOut.error }, { status: pdfOut.status });
  }

  const latestPdfAtt = await prisma.applicationAttachment.findFirst({
    where: { applicationId, category: AttachmentCategory.DRAFT_PDF },
    orderBy: { createdAt: "desc" },
    select: { id: true, driveFileId: true, fileName: true },
  });

  try {
    await withGoogleApiRetry("admin.regenerateOnlinePdf.drive", async () => {
      const drive = getDriveOauthClient();
      const folderId = draftState.driveProjectFolderId;

      if (latestPdfAtt?.driveFileId) {
        await drive.files.update({
          fileId: latestPdfAtt.driveFileId,
          requestBody: {
            name: displayPdfName,
          },
          media: {
            mimeType: "application/pdf",
            body: Readable.from(pdfOut.bytes),
          },
          fields: "id, name, webViewLink",
          supportsAllDrives: true,
        });
        await prisma.applicationAttachment.update({
          where: { id: latestPdfAtt.id },
          data: {
            fileName: displayPdfName,
            mimeType: "application/pdf",
            sizeBytes: BigInt(pdfOut.bytes.byteLength),
            uploadedByUserId: operator.id,
          },
        });
      } else {
        const res = await drive.files.create({
          requestBody: {
            name: displayPdfName,
            parents: [folderId],
          },
          media: {
            mimeType: "application/pdf",
            body: Readable.from(pdfOut.bytes),
          },
          fields: "id, name, webViewLink",
          supportsAllDrives: true,
        });
        const fid = String(res.data?.id || "");
        if (!fid) throw new Error("Drive 上傳未回傳檔案 id");
        await prisma.applicationAttachment.create({
          data: {
            applicationId,
            uploadedByUserId: operator.id,
            driveFileId: fid,
            fileName: displayPdfName,
            mimeType: "application/pdf",
            sizeBytes: BigInt(pdfOut.bytes.byteLength),
            category: AttachmentCategory.DRAFT_PDF,
          },
        });
      }

      await prisma.application.update({
        where: { id: applicationId },
        data: { updatedAt: new Date() },
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Drive 寫入失敗";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  await writeAuditLog({
    userId: email,
    action: "admin.pdf.regenerate_online",
    targetId: applicationId,
    timestamp: new Date().toISOString(),
    detail: { displayPdfName, bytes: pdfOut.bytes.byteLength },
  });

  return NextResponse.json({
    ok: true,
    fileName: displayPdfName,
    bytes: pdfOut.bytes.byteLength,
    updatedAttachment: !!latestPdfAtt?.driveFileId,
  });
}
