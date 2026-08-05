/**
 * 將白名單業者於 7/30–8/5（台北時間）期間送出的計畫書 PDF，
 * 複製到「115補助修改計畫」資料夾（檔名：公司簡稱-計畫名稱-修改版.pdf）。
 *
 * - 僅處理此區間內有送出／產生新 PDF 證據的案件
 * - 使用 Drive copy（複製），不移動原檔
 * - 更早送出的原始申請維持不變
 *
 * 用法：
 *   npm run revision:copy-submitted -- --dry-run
 *   npm run revision:copy-submitted -- --execute
 *   npm run revision:copy-submitted -- --execute --force
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { drive_v3 } from "googleapis";
import { ApplicationStatus, AttachmentCategory } from "@prisma/client";

/** 必須在載入 prisma 模組前執行（PrismaClient 會讀取 DATABASE_URL） */
function loadEnvFiles() {
  for (const name of [".env", ".env.local"]) {
    const p = path.join(process.cwd(), name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] == null || process.env[key] === "") {
        process.env[key] = val;
      }
    }
  }
}
loadEnvFiles();

/** 使用者指定：僅複製此區間送出的修改版（台北時間） */
const COPY_WINDOW_START_ISO = "2026-07-30T00:00:00+08:00";
const COPY_WINDOW_END_ISO = "2026-08-05T23:59:59.999+08:00";
const COPY_WINDOW_START_MS = Date.parse(COPY_WINDOW_START_ISO);
const COPY_WINDOW_END_MS = Date.parse(COPY_WINDOW_END_ISO);
const COPY_WINDOW_START_DATE = new Date(COPY_WINDOW_START_MS);
const COPY_WINDOW_END_DATE = new Date(COPY_WINDOW_END_MS);

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function inCopyWindow(ms: number | null | undefined): boolean {
  if (ms == null || !Number.isFinite(ms)) return false;
  return ms >= COPY_WINDOW_START_MS && ms <= COPY_WINDOW_END_MS;
}

function parseDriveTime(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

async function main() {
  const { getDriveOauthClient } = await import("../app/api/_driveOauth");
  const { withGoogleApiRetry } = await import("../app/api/_googleApiRetry");
  const {
    APPLICANT_REVISION_UPLOAD_FOLDER_ID,
    buildApplicantRevisionProposalFileName,
    getApplicantRevisionAllowlist,
  } = await import("../lib/applicantRevisionAccess");
  const { extractGoogleDriveFileId } = await import("../lib/driveLinks");
  const { prisma } = await import("../lib/prisma");
  const { withPrismaRetry } = await import("../lib/prismaRetry");
  const { normalizeEmailForCompare } = await import("../lib/rbac");

  const dryRun = !hasFlag("--execute");
  const force = hasFlag("--force");

  console.log(
    `複製窗口（台北）：${COPY_WINDOW_START_ISO} ～ ${COPY_WINDOW_END_ISO}`,
  );
  if (dryRun) {
    console.log("模式：dry-run（僅預覽，不加 --execute 不會寫入 Drive）\n");
  } else {
    console.log(`模式：execute${force ? " + force" : ""}\n`);
  }

  async function listRevisionFolderNames(drive: drive_v3.Drive): Promise<Set<string>> {
    const names = new Set<string>();
    let pageToken: string | undefined;
    do {
      const res = await drive.files.list({
        q: `'${APPLICANT_REVISION_UPLOAD_FOLDER_ID}' in parents and trashed=false and mimeType='application/pdf'`,
        fields: "nextPageToken,files(id,name)",
        pageSize: 100,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      for (const f of res.data.files ?? []) {
        if (f.name) names.add(f.name);
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
    return names;
  }

  async function deleteFilesWithNameInFolder(
    drive: drive_v3.Drive,
    folderId: string,
    fileName: string,
  ): Promise<void> {
    const escaped = fileName.replace(/'/g, "\\'");
    const oldFiles = await drive.files.list({
      q: `'${folderId}' in parents and name='${escaped}' and trashed=false`,
      fields: "files(id,name)",
      pageSize: 20,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const old of oldFiles.data.files ?? []) {
      if (!old.id) continue;
      await drive.files.delete({ fileId: old.id, supportsAllDrives: true });
    }
  }

  async function listProjectFolderPdfsInWindow(
    drive: drive_v3.Drive,
    folderId: string,
  ): Promise<Array<{ fileId: string; name: string; atMs: number }>> {
    const out: Array<{ fileId: string; name: string; atMs: number }> = [];
    let pageToken: string | undefined;
    do {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false and mimeType='application/pdf'`,
        fields: "nextPageToken,files(id,name,createdTime,modifiedTime)",
        pageSize: 100,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        orderBy: "modifiedTime desc",
      });
      for (const f of res.data.files ?? []) {
        if (!f.id) continue;
        const created = parseDriveTime(f.createdTime);
        const modified = parseDriveTime(f.modifiedTime);
        const atMs = Math.max(created ?? 0, modified ?? 0) || null;
        if (!inCopyWindow(atMs)) continue;
        out.push({ fileId: f.id, name: f.name || "", atMs: atMs! });
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
    out.sort((a, b) => b.atMs - a.atMs);
    return out;
  }

  async function getDriveFileTimeInWindow(
    drive: drive_v3.Drive,
    fileId: string,
  ): Promise<number | null> {
    try {
      const file = await drive.files.get({
        fileId,
        fields: "id,createdTime,modifiedTime",
        supportsAllDrives: true,
      });
      const created = parseDriveTime(file.data.createdTime);
      const modified = parseDriveTime(file.data.modifiedTime);
      const atMs = Math.max(created ?? 0, modified ?? 0) || null;
      return inCopyWindow(atMs) ? atMs : null;
    } catch {
      return null;
    }
  }

  type ResolvedPdf = {
    fileId: string;
    source: "uploaded" | "draft_pdf" | "project_folder";
    atMs: number;
  };

  async function resolveWindowSubmittedPdf(input: {
    drive: drive_v3.Drive;
    uploadedProposalUrl: string | null;
    driveProjectFolderId: string | null;
    attachments: Array<{ category: AttachmentCategory; driveFileId: string | null; createdAt: Date }>;
  }): Promise<ResolvedPdf | null> {
    const candidates: ResolvedPdf[] = [];

    for (const a of input.attachments) {
      if (a.category !== AttachmentCategory.DRAFT_PDF || !a.driveFileId) continue;
      const atMs = a.createdAt.getTime();
      if (!inCopyWindow(atMs)) continue;
      candidates.push({ fileId: a.driveFileId, source: "draft_pdf", atMs });
    }

    const uploadId = extractGoogleDriveFileId(input.uploadedProposalUrl);
    if (uploadId) {
      const atMs = await getDriveFileTimeInWindow(input.drive, uploadId);
      if (atMs != null) {
        candidates.push({ fileId: uploadId, source: "uploaded", atMs });
      }
    }

    if (input.driveProjectFolderId) {
      const folderPdfs = await listProjectFolderPdfsInWindow(input.drive, input.driveProjectFolderId);
      for (const f of folderPdfs) {
        if (f.name.endsWith("-修改版.pdf")) continue;
        candidates.push({ fileId: f.fileId, source: "project_folder", atMs: f.atMs });
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.atMs - a.atMs);
    return candidates[0]!;
  }

  const allowlist = getApplicantRevisionAllowlist();
  const byEmail = new Map(allowlist.map((e) => [normalizeEmailForCompare(e.email), e]));

  const users = await withPrismaRetry(() =>
    prisma.user.findMany({
      where: {
        OR: allowlist.map((e) => ({
          email: { equals: e.email, mode: "insensitive" as const },
        })),
      },
      select: { id: true, email: true },
    }),
  );
  const userIds = users.map((u) => u.id);

  const apps = userIds.length
    ? await withPrismaRetry(() =>
        prisma.application.findMany({
          where: { applicantUserId: { in: userIds } },
          select: {
            id: true,
            title: true,
            submissionMode: true,
            uploadedProposalUrl: true,
            driveProjectFolderId: true,
            status: true,
            updatedAt: true,
            applicant: { select: { email: true } },
            attachments: {
              orderBy: { createdAt: "desc" },
              select: { category: true, driveFileId: true, createdAt: true },
              take: 50,
            },
            statusHistory: {
              where: {
                toStatus: ApplicationStatus.SUBMITTED,
                createdAt: { gte: COPY_WINDOW_START_DATE, lte: COPY_WINDOW_END_DATE },
              },
              select: { id: true, createdAt: true, note: true },
              orderBy: { createdAt: "desc" },
              take: 5,
            },
          },
          orderBy: { updatedAt: "desc" },
        }),
      )
    : [];

  const latestByEmail = new Map<string, (typeof apps)[number]>();
  for (const app of apps) {
    const key = normalizeEmailForCompare(app.applicant.email);
    if (!key || !byEmail.has(key)) continue;
    if (!latestByEmail.has(key)) latestByEmail.set(key, app);
  }

  const drive = getDriveOauthClient();
  const existingNames = await withGoogleApiRetry("revisionFolder.list", () => listRevisionFolderNames(drive));

  let copied = 0;
  let skipped = 0;
  let missing = 0;
  let outOfWindow = 0;

  for (const entry of allowlist) {
    const key = normalizeEmailForCompare(entry.email);
    const app = latestByEmail.get(key);

    if (!app) {
      console.log(`MISSING_APP  ${entry.companyName} <${entry.email}> — 資料庫找不到案件`);
      missing += 1;
      continue;
    }

    const hasSubmitInWindow = (app.statusHistory?.length ?? 0) > 0;
    const pdf = await resolveWindowSubmittedPdf({
      drive,
      uploadedProposalUrl: app.uploadedProposalUrl,
      driveProjectFolderId: app.driveProjectFolderId,
      attachments: app.attachments,
    });

    const targetName = buildApplicantRevisionProposalFileName({
      companyName: entry.companyName,
      projectName: app.title || "",
    });

    if (!pdf) {
      console.log(
        `SKIP_OUT_OF_WINDOW  ${entry.companyName} | ${app.title || "(無標題)"} | mode=${app.submissionMode} — 7/30–8/5 無送出／新 PDF 證據`,
      );
      outOfWindow += 1;
      continue;
    }

    if (existingNames.has(targetName) && !force) {
      console.log(
        `SKIP_EXISTS  ${targetName}  (來源 ${pdf.source} ${pdf.fileId} @ ${new Date(pdf.atMs).toISOString()})`,
      );
      skipped += 1;
      continue;
    }

    console.log(
      `${dryRun ? "WOULD_COPY" : "COPY"}  ${targetName}\n` +
        `           from ${pdf.source}:${pdf.fileId} @ ${new Date(pdf.atMs).toISOString()}` +
        `  app=${app.id} submitInWindow=${hasSubmitInWindow}`,
    );

    if (!dryRun) {
      await withGoogleApiRetry(`revision.copy:${targetName}`, async () => {
        if (force) {
          await deleteFilesWithNameInFolder(drive, APPLICANT_REVISION_UPLOAD_FOLDER_ID, targetName);
        }
        await drive.files.copy({
          fileId: pdf.fileId,
          requestBody: {
            name: targetName,
            parents: [APPLICANT_REVISION_UPLOAD_FOLDER_ID],
          },
          fields: "id,name",
          supportsAllDrives: true,
        });
      });
      existingNames.add(targetName);
    }
    copied += 1;
  }

  console.log(
    `\n完成：${dryRun ? "將複製" : "已複製"} ${copied}、略過已存在 ${skipped}、區間外略過 ${outOfWindow}、缺案 ${missing}`,
  );
  if (dryRun) {
    console.log("確認無誤後加上 --execute 執行實際複製；若要覆蓋已有修改版再加 --force。");
  }

  await prisma.$disconnect().catch(() => undefined);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
