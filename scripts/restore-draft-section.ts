/**
 * 從 Drive 草稿版本紀錄還原指定區塊（外科式，僅覆蓋指定 key，其餘保留現況）。
 *
 * 用法（預設 dry-run）：
 *   npx tsx scripts/restore-draft-section.ts --email=xxx@gmail.com --sections=companyProfile
 *   npx tsx scripts/restore-draft-section.ts --email=xxx@gmail.com --sections=companyProfile --before=2026-08-16T14:40:00Z --execute
 *
 * 還原前會把現況草稿備份到 .data/backups/。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
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

type AnyRecord = Record<string, unknown>;

function argValue(name: string): string {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : "";
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function sizeOf(v: unknown): number {
  if (v == null) return 0;
  try {
    return JSON.stringify(v)?.length ?? 0;
  } catch {
    return -1;
  }
}

async function main() {
  const email = argValue("email").toLowerCase();
  const sections = argValue("sections")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const beforeIso = argValue("before");
  const execute = hasFlag("--execute");

  if (!email || sections.length === 0) {
    console.error("需要 --email 與 --sections（逗號分隔）");
    process.exit(1);
  }
  const beforeMs = beforeIso ? Date.parse(beforeIso) : Date.now();
  if (!Number.isFinite(beforeMs)) {
    console.error(`--before 時間格式錯誤：${beforeIso}`);
    process.exit(1);
  }

  const { getDriveOauthClient } = await import("../app/api/_driveOauth");
  const { getDriveSaClient } = await import("../app/api/_driveSa");
  const { emailHashKey } = await import("../app/api/_driveFolders");
  const { findDraftFileIdInFolder } = await import("../lib/projectSecurity");
  const { prisma } = await import("../lib/prisma");
  const { withPrismaRetry } = await import("../lib/prismaRetry");

  let drive: drive_v3.Drive;
  try {
    drive = await getDriveSaClient();
  } catch {
    drive = getDriveOauthClient();
  }
  const oauthDrive = getDriveOauthClient();

  const user = await withPrismaRetry(() =>
    prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true },
    }),
  );
  if (!user) throw new Error(`找不到使用者：${email}`);

  const app = await withPrismaRetry(() =>
    prisma.application.findFirst({
      where: { applicantUserId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, driveProjectFolderId: true, submissionMode: true },
    }),
  );
  if (!app?.driveProjectFolderId) throw new Error(`找不到案件或專案資料夾：${email}`);

  const draftFileId = await findDraftFileIdInFolder(
    drive,
    app.driveProjectFolderId,
    emailHashKey(user.email || email),
  );
  if (!draftFileId) throw new Error(`找不到草稿檔：${email}`);

  console.log(`案件：${app.title} (${app.id})`);
  console.log(`草稿檔：${draftFileId}`);
  console.log(`還原區塊：${sections.join(", ")}`);
  console.log(`來源版本上限時間：${new Date(beforeMs).toISOString()}`);
  console.log(`模式：${execute ? "execute" : "dry-run"}\n`);

  // 現況
  const curRes = await drive.files.get(
    { fileId: draftFileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  const curText = Buffer.from(curRes.data as ArrayBuffer).toString("utf-8");
  const curJson = JSON.parse(curText) as AnyRecord;
  const curIsEnvelope = !!(curJson.formData && typeof curJson.formData === "object");
  const curForm = (curIsEnvelope ? (curJson.formData as AnyRecord) : curJson) as AnyRecord;

  // 版本清單
  const revRes = await oauthDrive.revisions.list({
    fileId: draftFileId,
    fields: "revisions(id,modifiedTime,size)",
    pageSize: 200,
  });
  const revisions = (revRes.data.revisions ?? [])
    .map((r) => ({ id: String(r.id || ""), at: String(r.modifiedTime || ""), size: Number(r.size || 0) }))
    .filter((r) => r.id)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  // 找出「時間上限之前、該區塊有內容且最大」的版本
  let picked: { id: string; at: string; size: number; form: AnyRecord } | null = null;
  for (const rev of revisions) {
    const ms = Date.parse(rev.at);
    if (!Number.isFinite(ms) || ms > beforeMs) continue;
    let form: AnyRecord | null = null;
    try {
      const r = await oauthDrive.revisions.get(
        { fileId: draftFileId, revisionId: rev.id, alt: "media" },
        { responseType: "arraybuffer" },
      );
      const txt = Buffer.from(r.data as ArrayBuffer).toString("utf-8");
      const j = JSON.parse(txt) as AnyRecord;
      form = (j.formData && typeof j.formData === "object" ? (j.formData as AnyRecord) : j) as AnyRecord;
    } catch {
      continue;
    }
    const allPresent = sections.every((k) => sizeOf(form?.[k]) > sizeOf(curForm[k]));
    if (allPresent) {
      picked = { id: rev.id, at: rev.at, size: rev.size, form: form! };
      break;
    }
  }

  if (!picked) {
    console.log("找不到可用的來源版本（該區塊在歷史版本中並未比現況更完整）。");
    return;
  }

  console.log(`來源版本：${picked.at} (id=${picked.id}, size=${picked.size})`);
  for (const k of sections) {
    console.log(`  ${k}: 現況 ${sizeOf(curForm[k])} → 還原 ${sizeOf(picked.form[k])}`);
  }

  if (!execute) {
    console.log("\ndry-run：未寫入。加上 --execute 才會實際還原。");
    return;
  }

  // 備份現況
  const backupDir = path.join(process.cwd(), ".data", "backups");
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `draft-${app.id}-${stamp}.json`);
  writeFileSync(backupPath, curText, "utf-8");
  console.log(`\n已備份現況草稿：${backupPath}`);

  for (const k of sections) {
    curForm[k] = picked.form[k];
  }
  const nextJson = curIsEnvelope ? { ...curJson, formData: curForm } : curForm;
  const nextText = JSON.stringify(nextJson, null, 2);

  await drive.files.update({
    fileId: draftFileId,
    media: {
      mimeType: "application/json; charset=utf-8",
      body: Readable.from(Buffer.from(nextText, "utf-8")),
    },
    fields: "id,size,modifiedTime",
    supportsAllDrives: true,
  });

  console.log(`已寫回草稿（${nextText.length} bytes）。請請該業者重新登入確認。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
