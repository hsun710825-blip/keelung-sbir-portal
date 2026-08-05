/**
 * 將修改開放期白名單業者「先前送出」的計畫書 PDF，複製到
 * 「115補助修改計畫」資料夾（檔名：公司簡稱-計畫名稱-修改版.pdf）。
 *
 * 注意：使用 Drive copy（複製），不會移動原檔，以免後台／委員既有連結失效。
 *
 * 用法（本機需有 .env / .env.local）：
 *   npx tsx --env-file=.env --env-file=.env.local scripts/copy-submitted-pdfs-to-revision-folder.ts --dry-run
 *   npx tsx --env-file=.env --env-file=.env.local scripts/copy-submitted-pdfs-to-revision-folder.ts --execute
 *   … --execute --force   # 已有同名修改版時先刪再建
 */
import type { drive_v3 } from "googleapis";
import { AttachmentCategory } from "@prisma/client";

import { getDriveOauthClient } from "../app/api/_driveOauth";
import { withGoogleApiRetry } from "../app/api/_googleApiRetry";
import {
  APPLICANT_REVISION_UPLOAD_FOLDER_ID,
  buildApplicantRevisionProposalFileName,
  getApplicantRevisionAllowlist,
} from "../lib/applicantRevisionAccess";
import { extractGoogleDriveFileId } from "../lib/driveLinks";
import { prisma } from "../lib/prisma";
import { withPrismaRetry } from "../lib/prismaRetry";
import { normalizeEmailForCompare } from "../lib/rbac";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
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

/** 優先：申請人上傳 URL → 送出時 DRAFT_PDF 附件（即先前送出那份） */
function resolveSubmittedPdfFileId(app: {
  uploadedProposalUrl: string | null;
  attachments: Array<{ category: AttachmentCategory; driveFileId: string | null; createdAt: Date }>;
}): { fileId: string; source: "uploaded" | "draft_pdf" } | null {
  const fromUpload = extractGoogleDriveFileId(app.uploadedProposalUrl);
  if (fromUpload) return { fileId: fromUpload, source: "uploaded" };

  const draft = [...app.attachments]
    .filter((a) => a.category === AttachmentCategory.DRAFT_PDF && a.driveFileId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (draft?.driveFileId) return { fileId: draft.driveFileId, source: "draft_pdf" };
  return null;
}

async function main() {
  const dryRun = !hasFlag("--execute");
  const force = hasFlag("--force");

  if (dryRun) {
    console.log("模式：dry-run（僅預覽，不加 --execute 不會寫入 Drive）\n");
  } else {
    console.log(`模式：execute${force ? " + force" : ""}\n`);
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
            status: true,
            updatedAt: true,
            applicant: { select: { email: true } },
            attachments: {
              orderBy: { createdAt: "desc" },
              select: { category: true, driveFileId: true, createdAt: true },
              take: 20,
            },
          },
          orderBy: { updatedAt: "desc" },
        }),
      )
    : [];

  // 每位申請人取最新一筆案件
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

  for (const entry of allowlist) {
    const key = normalizeEmailForCompare(entry.email);
    const app = latestByEmail.get(key);
    const targetName = buildApplicantRevisionProposalFileName({
      companyName: entry.companyName,
      projectName: app?.title || "",
    });

    if (!app) {
      console.log(`MISSING_APP  ${entry.companyName} <${entry.email}> — 資料庫找不到案件`);
      missing += 1;
      continue;
    }

    const pdf = resolveSubmittedPdfFileId(app);
    if (!pdf) {
      console.log(
        `MISSING_PDF  ${entry.companyName} | ${app.title || "(無標題)"} | mode=${app.submissionMode} — 無 uploadedProposalUrl / DRAFT_PDF`,
      );
      missing += 1;
      continue;
    }

    if (existingNames.has(targetName) && !force) {
      console.log(`SKIP_EXISTS  ${targetName}  (來源 ${pdf.source} ${pdf.fileId})`);
      skipped += 1;
      continue;
    }

    console.log(
      `${dryRun ? "WOULD_COPY" : "COPY"}  ${targetName}\n` +
        `           from ${pdf.source}:${pdf.fileId}  app=${app.id}  status=${app.status}`,
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
    `\n完成：${dryRun ? "將複製" : "已複製"} ${copied}、略過已存在 ${skipped}、缺檔/缺案 ${missing}`,
  );
  if (dryRun) {
    console.log("確認無誤後加上 --execute 執行實際複製；若要覆蓋已有修改版再加 --force。");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
