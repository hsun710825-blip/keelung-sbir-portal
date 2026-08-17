/**
 * 唯讀探查：白名單 ONLINE 業者「目前草稿」是否比重產當時縮水。
 *
 * - 盤點「重新產生」資料夾內的 PDF（重產時間點）
 * - 讀各業者 Drive 草稿 draft-<hash>.json 現況
 * - 列出該草稿的 Drive 版本紀錄（revisions），標出重產時間點當下那一版
 * - 以「各區塊 JSON 長度」比較現況 vs 重產版，找出遺失欄位
 *
 * 不寫入任何資料。
 *
 * 用法：npx tsx scripts/probe-online-draft-loss.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { drive_v3 } from "googleapis";

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

/** 用戶指定之「重新產生」資料夾 */
const REGEN_FOLDER_ID = "1xWDa9cYWZv-wxO6N4FwZz_IZJlCcb1Wm";

type AnyRecord = Record<string, unknown>;

type SectionSizes = Record<string, number>;

function sectionSizes(formData: AnyRecord): SectionSizes {
  const out: SectionSizes = {};
  for (const [k, v] of Object.entries(formData || {})) {
    if (v == null) {
      out[k] = 0;
      continue;
    }
    try {
      out[k] = JSON.stringify(v)?.length ?? 0;
    } catch {
      out[k] = -1;
    }
  }
  return out;
}

function totalSize(sizes: SectionSizes): number {
  return Object.values(sizes).reduce((s, n) => s + Math.max(0, n), 0);
}

function diffSections(current: SectionSizes, baseline: SectionSizes) {
  const keys = new Set([...Object.keys(current), ...Object.keys(baseline)]);
  const lost: Array<{ key: string; before: number; after: number }> = [];
  const shrunk: Array<{ key: string; before: number; after: number }> = [];
  for (const k of keys) {
    const before = baseline[k] ?? 0;
    const after = current[k] ?? 0;
    if (before > 0 && after === 0) lost.push({ key: k, before, after });
    else if (before > 0 && after < before * 0.6) shrunk.push({ key: k, before, after });
  }
  lost.sort((a, b) => b.before - a.before);
  shrunk.sort((a, b) => b.before - a.before);
  return { lost, shrunk };
}

async function main() {
  const { getDriveOauthClient } = await import("../app/api/_driveOauth");
  const { getDriveSaClient } = await import("../app/api/_driveSa");
  const { emailHashKey } = await import("../app/api/_driveFolders");
  const { findDraftFileIdInFolder } = await import("../lib/projectSecurity");
  const { extractFormDataFromDraftPayload } = await import("../lib/resolveApplicationDisplayFields");
  const { getApplicantRevisionAllowlist } = await import("../lib/applicantRevisionAccess");
  const { prisma } = await import("../lib/prisma");
  const { withPrismaRetry } = await import("../lib/prismaRetry");

  async function getDrive(): Promise<drive_v3.Drive> {
    try {
      return await getDriveSaClient();
    } catch {
      return getDriveOauthClient();
    }
  }
  const drive = await getDrive();
  const oauthDrive = getDriveOauthClient();

  // 1) 盤點重產資料夾
  const regenFiles: Array<{ id: string; name: string; createdTime: string; modifiedTime: string }> = [];
  {
    let pageToken: string | undefined;
    do {
      const res = await oauthDrive.files.list({
        q: `'${REGEN_FOLDER_ID}' in parents and trashed=false`,
        fields: "nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,size)",
        pageSize: 200,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        orderBy: "name",
      });
      for (const f of res.data.files ?? []) {
        regenFiles.push({
          id: String(f.id || ""),
          name: String(f.name || ""),
          createdTime: String(f.createdTime || ""),
          modifiedTime: String(f.modifiedTime || ""),
        });
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
  }

  const regenTimes = regenFiles
    .map((f) => Date.parse(f.createdTime))
    .filter((n) => Number.isFinite(n));
  const regenAtMs = regenTimes.length ? Math.max(...regenTimes) : null;

  console.log(`重產資料夾檔案數：${regenFiles.length}`);
  if (regenAtMs) console.log(`重產時間（最後一檔 createdTime）：${new Date(regenAtMs).toISOString()}`);
  console.log("");

  const allowlist = getApplicantRevisionAllowlist();
  const report: AnyRecord[] = [];

  for (const entry of allowlist) {
    const label = entry.companyName;
    const row: AnyRecord = { companyName: label, email: entry.email };
    try {
      const user = await withPrismaRetry(() =>
        prisma.user.findFirst({
          where: { email: { equals: entry.email, mode: "insensitive" } },
          select: { id: true, email: true },
        }),
      );
      if (!user) {
        row.status = "no_user";
        console.log(`SKIP  ${label} — 找不到使用者`);
        report.push(row);
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
            driveProjectFolderId: true,
            updatedAt: true,
          },
        }),
      );
      if (!app) {
        row.status = "no_application";
        console.log(`SKIP  ${label} — 找不到案件`);
        report.push(row);
        continue;
      }

      row.applicationId = app.id;
      row.title = app.title;
      row.submissionMode = app.submissionMode;
      row.driveProjectFolderId = app.driveProjectFolderId;
      row.appUpdatedAt = app.updatedAt?.toISOString?.() ?? null;

      const isUploadMode = String(app.submissionMode || "").toUpperCase() === "UPLOAD";
      if (!app.driveProjectFolderId) {
        row.status = "no_project_folder";
        console.log(`FAIL  ${label} — 無專案資料夾`);
        report.push(row);
        continue;
      }

      const key = emailHashKey(user.email || entry.email);
      const draftFileId = await findDraftFileIdInFolder(drive, app.driveProjectFolderId, key);
      if (!draftFileId) {
        row.status = "no_draft_file";
        console.log(`FAIL  ${label} — 找不到草稿檔`);
        report.push(row);
        continue;
      }
      row.draftFileId = draftFileId;

      // 目前草稿
      const cur = await drive.files.get(
        { fileId: draftFileId, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" },
      );
      const curText = Buffer.from(cur.data as ArrayBuffer).toString("utf-8");
      let curForm: AnyRecord = {};
      try {
        curForm = extractFormDataFromDraftPayload(JSON.parse(curText) as AnyRecord);
      } catch {
        curForm = {};
      }
      const curSizes = sectionSizes(curForm);
      row.currentBytes = curText.length;
      row.currentSections = curSizes;
      row.currentTotal = totalSize(curSizes);

      // 版本紀錄
      let revisions: Array<{ id: string; modifiedTime: string; size: number }> = [];
      try {
        const revRes = await oauthDrive.revisions.list({
          fileId: draftFileId,
          fields: "revisions(id,modifiedTime,size,keepForever)",
          pageSize: 200,
        });
        revisions = (revRes.data.revisions ?? []).map((r) => ({
          id: String(r.id || ""),
          modifiedTime: String(r.modifiedTime || ""),
          size: Number(r.size || 0),
        }));
      } catch (e) {
        row.revisionsError = e instanceof Error ? e.message : String(e);
      }
      row.revisionCount = revisions.length;
      row.revisions = revisions.map((r) => ({ id: r.id, at: r.modifiedTime, size: r.size }));

      // 找出重產時間點之前最後一版（即重產所用內容）
      let baselineRev: { id: string; modifiedTime: string; size: number } | null = null;
      if (regenAtMs) {
        const before = revisions
          .filter((r) => {
            const ms = Date.parse(r.modifiedTime);
            return Number.isFinite(ms) && ms <= regenAtMs;
          })
          .sort((a, b) => Date.parse(b.modifiedTime) - Date.parse(a.modifiedTime));
        baselineRev = before[0] || null;
      }
      // 後備：取歷史最大版本
      const biggestRev = [...revisions].sort((a, b) => b.size - a.size)[0] || null;
      row.baselineRevision = baselineRev;
      row.biggestRevision = biggestRev;

      async function loadRevisionForm(revId: string): Promise<AnyRecord | null> {
        try {
          const r = await oauthDrive.revisions.get(
            { fileId: draftFileId!, revisionId: revId, alt: "media" },
            { responseType: "arraybuffer" },
          );
          const text = Buffer.from(r.data as ArrayBuffer).toString("utf-8");
          return extractFormDataFromDraftPayload(JSON.parse(text) as AnyRecord);
        } catch {
          return null;
        }
      }

      const baseForm = baselineRev ? await loadRevisionForm(baselineRev.id) : null;
      const bigForm =
        biggestRev && biggestRev.id !== baselineRev?.id ? await loadRevisionForm(biggestRev.id) : null;

      const baseSizes = baseForm ? sectionSizes(baseForm) : null;
      const bigSizes = bigForm ? sectionSizes(bigForm) : null;
      row.baselineSections = baseSizes;
      row.baselineTotal = baseSizes ? totalSize(baseSizes) : null;
      row.biggestTotal = bigSizes ? totalSize(bigSizes) : null;

      const cmp = baseSizes ? diffSections(curSizes, baseSizes) : null;
      row.lost = cmp?.lost ?? [];
      row.shrunk = cmp?.shrunk ?? [];

      const lostCount = (cmp?.lost.length ?? 0) + (cmp?.shrunk.length ?? 0);
      row.status = lostCount > 0 ? "DATA_LOSS" : baseSizes ? "ok" : "no_baseline";

      const baseTotalTxt = row.baselineTotal == null ? "n/a" : String(row.baselineTotal);
      const tag = lostCount > 0 ? "LOSS " : baseSizes ? "OK   " : "NOBASE";
      console.log(
        `${tag} ${label}${isUploadMode ? "（UPLOAD）" : ""} — now=${row.currentTotal} base=${baseTotalTxt} revs=${revisions.length}` +
          (lostCount > 0
            ? ` 缺:${(cmp?.lost ?? []).map((x) => x.key).join(",") || "-"} 縮:${(cmp?.shrunk ?? []).map((x) => x.key).join(",") || "-"}`
            : ""),
      );
    } catch (e) {
      row.status = "error";
      row.error = e instanceof Error ? e.message : String(e);
      console.log(`ERR   ${label} — ${row.error}`);
    }
    report.push(row);
  }

  const outDir = path.join(process.cwd(), ".data");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "online-draft-loss-report.json");
  writeFileSync(
    outPath,
    JSON.stringify({ regenFolderId: REGEN_FOLDER_ID, regenAtMs, regenFiles, report }, null, 2),
    "utf-8",
  );
  console.log(`\n報告：${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
