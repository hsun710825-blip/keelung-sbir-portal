/**
 * 重新產生白名單業者計畫書，上傳至「115補助修改計畫／重新產生」。
 *
 * ONLINE：
 *   - 僅處理 7/30～今日（台北）期間有送出證據者
 *   - 以 Drive 草稿內層 formData 重產（須 unwrap，不可把外層 envelope 當 formData）
 *   - 套用修正後樹枝圖
 * UPLOAD：複製現有修改版／上傳檔
 *
 * 用法：
 *   PDF_API_BASE=http://127.0.0.1:3000 PDF_REGEN_SCRIPT_SECRET=... \
 *     npx tsx scripts/regen-revision-pdfs-to-regen-folder.ts --dry-run
 *   npx tsx scripts/regen-revision-pdfs-to-regen-folder.ts --execute
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { drive_v3 } from "googleapis";
import { AttachmentCategory } from "@prisma/client";

function loadEnvFiles() {
  for (const name of [".env", ".env.local"]) {
    const p = path.join(process.cwd(), name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
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

const REGEN_FOLDER_NAME = "重新產生";
/** 僅採用此區間內最後送出版本（台北） */
const WINDOW_START_ISO = "2026-07-30T00:00:00+08:00";
const WINDOW_START_MS = Date.parse(WINDOW_START_ISO);

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function parseFlexibleTime(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const direct = Date.parse(s);
  if (Number.isFinite(direct)) return direct;
  // e.g. 2026/08/04 15:23:56（視為台北本地）
  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}T${(m[4] || "0").padStart(2, "0")}:${(m[5] || "0").padStart(2, "0")}:${(m[6] || "0").padStart(2, "0")}+08:00`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function inSubmitWindow(ms: number | null | undefined, endMs: number): boolean {
  if (ms == null || !Number.isFinite(ms)) return false;
  return ms >= WINDOW_START_MS && ms <= endMs;
}

function formLooksFilled(form: Record<string, unknown>): boolean {
  const projectName = String(form.projectName || "").trim();
  const hasPlan = !!(form.planContent && typeof form.planContent === "object");
  const hasBudget = !!(form.humanBudget && typeof form.humanBudget === "object");
  return !!projectName && (hasPlan || hasBudget);
}

async function ensureChildFolder(drive: drive_v3.Drive, parentId: string, name: string): Promise<string> {
  const escaped = name.replace(/'/g, "\\'");
  const listed = await drive.files.list({
    q: `'${parentId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder' and name='${escaped}'`,
    fields: "files(id,name)",
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const existing = listed.data.files?.[0]?.id;
  if (existing) return existing;
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id,name",
    supportsAllDrives: true,
  });
  const id = String(created.data.id || "");
  if (!id) throw new Error(`建立資料夾失敗：${name}`);
  return id;
}

async function deleteFilesWithNameInFolder(drive: drive_v3.Drive, folderId: string, fileName: string) {
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

async function downloadDriveFile(drive: drive_v3.Drive, fileId: string): Promise<Buffer> {
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data as ArrayBuffer);
}

async function findPdfInFolderByName(drive: drive_v3.Drive, folderId: string, fileName: string): Promise<string | null> {
  const escaped = fileName.replace(/'/g, "\\'");
  const listed = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false and mimeType='application/pdf' and name='${escaped}'`,
    fields: "files(id,name)",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return listed.data.files?.[0]?.id || null;
}

async function listProjectFolderPdfsInWindow(
  drive: drive_v3.Drive,
  folderId: string,
  endMs: number,
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
      if ((f.name || "").endsWith("-修改版.pdf")) continue;
      const created = parseFlexibleTime(f.createdTime);
      const modified = parseFlexibleTime(f.modifiedTime);
      const atMs = Math.max(created ?? 0, modified ?? 0) || null;
      if (!inSubmitWindow(atMs, endMs)) continue;
      out.push({ fileId: f.id, name: f.name || "", atMs: atMs! });
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);
  out.sort((a, b) => b.atMs - a.atMs);
  return out;
}

async function main() {
  const { getDriveOauthClient } = await import("../app/api/_driveOauth");
  const { withGoogleApiRetry } = await import("../app/api/_googleApiRetry");
  const {
    APPLICANT_REVISION_UPLOAD_FOLDER_ID,
    buildApplicantRevisionProposalFileName,
    getApplicantRevisionAllowlist,
  } = await import("../lib/applicantRevisionAccess");
  const { resolveOnlineDraftViewPayload } = await import("../lib/adminOnlineDraftResolve");
  const { extractGoogleDriveFileId } = await import("../lib/driveLinks");
  const { prisma } = await import("../lib/prisma");
  const { withPrismaRetry } = await import("../lib/prismaRetry");
  const { extractFormDataFromDraftPayload } = await import("../lib/resolveApplicationDisplayFields");
  const { buildSafeDisplayPdfName, sanitizeDeepInput } = await import("../lib/serverSecurity");

  const dryRun = !hasFlag("--execute");
  const endMs = Date.now();
  const pdfApiBase = (process.env.PDF_API_BASE || "http://127.0.0.1:3000").replace(/\/$/, "");
  const scriptSecret = process.env.PDF_REGEN_SCRIPT_SECRET?.trim() || "";

  console.log(`PDF_API_BASE=${pdfApiBase}`);
  console.log(`送出窗口（台北）：${WINDOW_START_ISO} ～ now`);
  console.log(`模式：${dryRun ? "dry-run" : "execute"}`);
  if (!scriptSecret) {
    console.warn("警告：未設定 PDF_REGEN_SCRIPT_SECRET，連續呼叫 /api/pdf 可能觸發限流。");
  }

  const allowlist = getApplicantRevisionAllowlist();
  const drive = getDriveOauthClient();

  const regenFolderId = await withGoogleApiRetry("regenFolder.ensure", () =>
    ensureChildFolder(drive, APPLICANT_REVISION_UPLOAD_FOLDER_ID, REGEN_FOLDER_NAME),
  );
  console.log(`目標資料夾「${REGEN_FOLDER_NAME}」id=${regenFolderId}\n`);

  let okCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const entry of allowlist) {
    const label = entry.companyName;
    try {
      const user = await withPrismaRetry(() =>
        prisma.user.findFirst({
          where: { email: { equals: entry.email, mode: "insensitive" } },
          select: { id: true, email: true },
        }),
      );
      if (!user) {
        console.log(`SKIP  ${label} — 找不到使用者`);
        skipCount += 1;
        continue;
      }

      const app = await withPrismaRetry(() =>
        prisma.application.findFirst({
          where: { applicantUserId: user.id },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            title: true,
            submissionMode: true,
            uploadedProposalUrl: true,
            driveProjectFolderId: true,
            attachments: {
              where: { category: AttachmentCategory.DRAFT_PDF },
              orderBy: { createdAt: "desc" },
              take: 5,
              select: { driveFileId: true, fileName: true, createdAt: true, category: true },
            },
          },
        }),
      );
      if (!app) {
        console.log(`SKIP  ${label} — 找不到案件`);
        skipCount += 1;
        continue;
      }

      const targetName = buildApplicantRevisionProposalFileName({
        companyName: entry.companyName,
        projectName: app.title || "",
      });
      const mode = String(app.submissionMode || "").toUpperCase();

      let pdfBytes: Buffer | null = null;
      let source = "";

      if (mode === "ONLINE") {
        // 區間內最後送出證據：專案資料夾 PDF／DRAFT_PDF／uploaded
        const candidates: Array<{ fileId: string; source: string; atMs: number }> = [];
        for (const a of app.attachments) {
          if (!a.driveFileId) continue;
          const atMs = a.createdAt.getTime();
          if (!inSubmitWindow(atMs, endMs)) continue;
          candidates.push({ fileId: a.driveFileId, source: "draft_pdf", atMs });
        }
        const uploadId = extractGoogleDriveFileId(app.uploadedProposalUrl);
        if (uploadId) {
          try {
            const meta = await drive.files.get({
              fileId: uploadId,
              fields: "id,createdTime,modifiedTime",
              supportsAllDrives: true,
            });
            const created = parseFlexibleTime(meta.data.createdTime);
            const modified = parseFlexibleTime(meta.data.modifiedTime);
            const atMs = Math.max(created ?? 0, modified ?? 0) || null;
            if (inSubmitWindow(atMs, endMs)) {
              candidates.push({ fileId: uploadId, source: "uploaded", atMs: atMs! });
            }
          } catch {
            /* ignore */
          }
        }
        if (app.driveProjectFolderId) {
          const folderPdfs = await withGoogleApiRetry(`regen.listFolder:${label}`, () =>
            listProjectFolderPdfsInWindow(drive, app.driveProjectFolderId!, endMs),
          );
          for (const f of folderPdfs) {
            candidates.push({ fileId: f.fileId, source: "project_folder", atMs: f.atMs });
          }
        }
        candidates.sort((a, b) => b.atMs - a.atMs);
        const lastSubmit = candidates[0] || null;
        if (!lastSubmit) {
          console.log(`SKIP  ${label} — 7/30～今日無送出 PDF 證據`);
          skipCount += 1;
          continue;
        }

        const draftState = await resolveOnlineDraftViewPayload(app.id);
        if (draftState.kind !== "ok") {
          console.log(`FAIL  ${label} — ONLINE 草稿不可用：${draftState.kind}`);
          failCount += 1;
          continue;
        }

        const flatForm = extractFormDataFromDraftPayload(draftState.draft);
        const cleanForm = sanitizeDeepInput(flatForm) as Record<string, unknown>;
        if (!formLooksFilled(cleanForm)) {
          console.log(`FAIL  ${label} — 草稿 unwrap 後內容為空，拒絕重產空白 PDF`);
          failCount += 1;
          continue;
        }

        const submittedAtMs = parseFlexibleTime(String(cleanForm.submittedAt || ""));
        if (submittedAtMs != null && !inSubmitWindow(submittedAtMs, endMs)) {
          console.log(
            `SKIP  ${label} — 草稿 submittedAt 不在窗口：${cleanForm.submittedAt}`,
          );
          skipCount += 1;
          continue;
        }

        const projectNameRaw =
          (typeof cleanForm.projectName === "string" && cleanForm.projectName.trim()
            ? cleanForm.projectName
            : null) ||
          (draftState.title?.trim() ? draftState.title : null) ||
          app.title ||
          "未命名計畫";
        const displayPdfName = buildSafeDisplayPdfName(projectNameRaw);

        if (dryRun) {
          console.log(
            `WOULD_REGEN_ONLINE  ${targetName}  app=${app.id}  lastSubmit=${lastSubmit.source}@${new Date(lastSubmit.atMs).toISOString()}  project=${projectNameRaw}`,
          );
          okCount += 1;
          continue;
        }

        let lastErr = "PDF 產製失敗";
        for (let attempt = 1; attempt <= 3; attempt++) {
          const res = await fetch(`${pdfApiBase}/api/pdf`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              formData: cleanForm,
              filename: displayPdfName,
              pdfVariant: "revision",
              ...(scriptSecret ? { __scriptRegenerate: scriptSecret } : {}),
            }),
          });
          if (res.ok) {
            pdfBytes = Buffer.from(await res.arrayBuffer());
            source = `online_regen:${displayPdfName};lastSubmit=${lastSubmit.source}@${new Date(lastSubmit.atMs).toISOString()}`;
            break;
          }
          lastErr = `${res.status} ${await res.text().catch(() => "")}`.slice(0, 300);
          if (attempt < 3) await sleep(800 * attempt * attempt);
        }
        if (!pdfBytes) {
          console.log(`FAIL  ${label} — 重產失敗：${lastErr}`);
          failCount += 1;
          continue;
        }
        // 空白殼通常只有少數頁；完整計畫書遠多於此
        const { PDFDocument } = await import("pdf-lib");
        const probeDoc = await PDFDocument.load(pdfBytes);
        const pageCount = probeDoc.getPageCount();
        if (pageCount < 10) {
          console.log(
            `FAIL  ${label} — 產出品僅 ${pageCount} 頁（${pdfBytes.byteLength} bytes），疑似空白，不上傳`,
          );
          failCount += 1;
          continue;
        }
      } else {
        const existingInRevision = await findPdfInFolderByName(
          drive,
          APPLICANT_REVISION_UPLOAD_FOLDER_ID,
          targetName,
        );
        let fileId = existingInRevision;
        if (!fileId) {
          fileId = extractGoogleDriveFileId(app.uploadedProposalUrl);
        }
        if (!fileId) {
          fileId = app.attachments.find((a) => a.driveFileId)?.driveFileId || null;
        }
        if (!fileId) {
          console.log(`FAIL  ${label} — UPLOAD 找不到可複製的計畫書 PDF`);
          failCount += 1;
          continue;
        }
        if (dryRun) {
          console.log(`WOULD_COPY_UPLOAD  ${targetName}  from=${fileId}`);
          okCount += 1;
          continue;
        }
        pdfBytes = await withGoogleApiRetry(`regen.download:${label}`, () =>
          downloadDriveFile(drive, fileId!),
        );
        source = `upload_copy:${fileId}`;
      }

      if (!pdfBytes) {
        console.log(`FAIL  ${label} — 無 PDF bytes`);
        failCount += 1;
        continue;
      }

      await withGoogleApiRetry(`regen.upload:${targetName}`, async () => {
        await deleteFilesWithNameInFolder(drive, regenFolderId, targetName);
        await drive.files.create({
          requestBody: {
            name: targetName,
            parents: [regenFolderId],
          },
          media: {
            mimeType: "application/pdf",
            body: Readable.from(pdfBytes!),
          },
          fields: "id,name",
          supportsAllDrives: true,
        });
      });

      console.log(`OK  ${targetName}  (${source})  ${pdfBytes.byteLength} bytes`);
      okCount += 1;
      await sleep(400);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`FAIL  ${label} — ${msg}`);
      failCount += 1;
    }
  }

  console.log(
    `\n完成：成功 ${okCount}、略過 ${skipCount}、失敗 ${failCount}（allowlist ${allowlist.length}）`,
  );
  if (dryRun) {
    console.log("確認後加上 --execute；ONLINE 需本機或指定 PDF_API_BASE 可呼叫 /api/pdf。");
  } else {
    console.log(`Drive 資料夾：https://drive.google.com/drive/folders/${regenFolderId}`);
  }

  await prisma.$disconnect().catch(() => undefined);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
