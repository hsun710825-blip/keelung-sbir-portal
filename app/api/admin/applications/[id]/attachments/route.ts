import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { AttachmentCategory } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getDriveOauthClient } from "@/app/api/_driveOauth";
import { withGoogleApiRetry } from "@/app/api/_googleApiRetry";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  ensureAllowedUploadExtension,
  ensureAllowedUploadMagic,
  ensureAllowedUploadMime,
} from "@/lib/serverSecurity";
import { canOperateApplications } from "@/lib/rbac";

const ADMIN_UPLOAD_PREFIX = "[管理員補件]_";
const MAX_BATCH_BYTES = 20 * 1024 * 1024;

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

function safeBasename(name: string): string {
  const base = String(name || "").replace(/[/\\]/g, "_").trim() || "file.pdf";
  return base.slice(0, 180);
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
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, driveProjectFolderId: true },
  });
  if (!app) {
    return NextResponse.json({ ok: false, error: "找不到案件" }, { status: 404 });
  }
  const folderId = app.driveProjectFolderId?.trim();
  if (!folderId) {
    return NextResponse.json({ ok: false, error: "案件缺少雲端專案資料夾，無法上傳" }, { status: 400 });
  }

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: "請至少選擇一個 PDF 檔案" }, { status: 400 });
  }

  let total = 0;
  for (const f of files) {
    total += f.size;
  }
  if (total > MAX_BATCH_BYTES) {
    return NextResponse.json({ ok: false, error: "本次上傳總容量不可超過 20MB" }, { status: 413 });
  }

  const created: Array<{ id: string; fileName: string; driveFileId: string }> = [];

  try {
    await withGoogleApiRetry("admin.attachments", async () => {
      const drive = getDriveOauthClient();
      for (const file of files) {
        const mimeCheck = ensureAllowedUploadMime(file.type || "");
        if (!mimeCheck.ok || mimeCheck.mimeType !== "application/pdf") {
          throw new Error("僅允許上傳 PDF（application/pdf）");
        }
        const extCheck = ensureAllowedUploadExtension(file.name, mimeCheck.mimeType);
        if (!extCheck.ok) {
          throw new Error(extCheck.error);
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        const magicCheck = ensureAllowedUploadMagic(bytes, mimeCheck.mimeType);
        if (!magicCheck.ok) {
          throw new Error(magicCheck.error);
        }
        const displayName = `${ADMIN_UPLOAD_PREFIX}${safeBasename(file.name)}`;
        const createRes = await drive.files.create({
          requestBody: {
            name: displayName,
            parents: [folderId],
          },
          media: {
            mimeType: "application/pdf",
            body: Readable.from(Buffer.from(bytes)),
          },
          fields: "id,name",
          supportsAllDrives: true,
        });
        const fileId = createRes.data.id;
        if (!fileId) throw new Error("Drive 未回傳檔案 id");

        const row = await prisma.applicationAttachment.create({
          data: {
            applicationId: app.id,
            uploadedByUserId: operator.id,
            driveFileId: fileId,
            fileName: displayName,
            mimeType: "application/pdf",
            sizeBytes: BigInt(bytes.byteLength),
            category: AttachmentCategory.OTHER,
          },
        });
        created.push({ id: row.id, fileName: displayName, driveFileId: fileId });
      }
    });

    await writeAuditLog({
      userId: email,
      action: "admin.attachment.upload",
      targetId: applicationId,
      timestamp: new Date().toISOString(),
      detail: { count: created.length, attachmentIds: created.map((c) => c.id) },
    });

    return NextResponse.json({ ok: true, uploaded: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
