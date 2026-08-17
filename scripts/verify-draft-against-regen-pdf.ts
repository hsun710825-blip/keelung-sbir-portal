/**
 * 唯讀交叉核對：重產 PDF 的內文是否仍能在「目前草稿」中找到。
 *
 * 用於 Drive 版本紀錄已被清除、無法回溯比對的案件。
 * 作法：抽出 PDF 文字 → 去空白 → 以固定長度視窗比對草稿全文，算覆蓋率。
 * 覆蓋率需與「已確認完好」的對照組相近；明顯偏低即代表草稿內容缺漏。
 *
 * 用法：npx tsx scripts/verify-draft-against-regen-pdf.ts
 */
import { existsSync, readFileSync } from "node:fs";
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

const REGEN_FOLDER_ID = "1xWDa9cYWZv-wxO6N4FwZz_IZJlCcb1Wm";

/** 待驗證（無版本可回溯）＋對照組（已確認與重產一致） */
const TARGETS = ["智勝生技有限公司"];
const CONTROLS = ["碩品創研事業有限公司", "穎創資訊服務有限公司", "海育資訊有限公司"];

type AnyRecord = Record<string, unknown>;

function collectText(input: unknown, out: string[]): void {
  if (input == null) return;
  if (typeof input === "string") {
    if (input.startsWith("data:")) return;
    out.push(input);
    return;
  }
  if (typeof input === "number" || typeof input === "boolean") {
    out.push(String(input));
    return;
  }
  if (Array.isArray(input)) {
    for (const v of input) collectText(v, out);
    return;
  }
  if (typeof input === "object") {
    for (const v of Object.values(input as AnyRecord)) collectText(v, out);
  }
}

function normalize(s: string): string {
  return s.replace(/\s+/g, "").replace(/[，。、；：（）()【】「」．・,.;:]/g, "");
}

async function extractPdfText(bytes: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    for (const it of tc.items as Array<{ str?: string }>) {
      if (it.str) parts.push(it.str);
    }
  }
  return parts.join("");
}

function coverage(pdfText: string, draftText: string, window = 24) {
  const p = normalize(pdfText);
  const d = normalize(draftText);
  let hit = 0;
  let total = 0;
  const misses: string[] = [];
  for (let i = 0; i + window <= p.length; i += window) {
    const chunk = p.slice(i, i + window);
    if (!/[\u4e00-\u9fff]/.test(chunk)) continue;
    total += 1;
    if (d.includes(chunk)) hit += 1;
    else if (misses.length < 12) misses.push(chunk);
  }
  return { hit, total, pct: total ? Math.round((hit / total) * 1000) / 10 : null, misses };
}

async function main() {
  const { getDriveOauthClient } = await import("../app/api/_driveOauth");
  const { getDriveSaClient } = await import("../app/api/_driveSa");
  const { emailHashKey } = await import("../app/api/_driveFolders");
  const { findDraftFileIdInFolder } = await import("../lib/projectSecurity");
  const { extractFormDataFromDraftPayload } = await import("../lib/resolveApplicationDisplayFields");
  const { getApplicantRevisionAllowlist, companyShortNameFromAllowlist } = await import(
    "../lib/applicantRevisionAccess"
  );
  const { extractGoogleDriveFileId } = await import("../lib/driveLinks");
  const { prisma } = await import("../lib/prisma");
  const { withPrismaRetry } = await import("../lib/prismaRetry");

  let drive: drive_v3.Drive;
  try {
    drive = await getDriveSaClient();
  } catch {
    drive = getDriveOauthClient();
  }
  const oauthDrive = getDriveOauthClient();

  const regen = await oauthDrive.files.list({
    q: `'${REGEN_FOLDER_ID}' in parents and trashed=false and mimeType='application/pdf'`,
    fields: "files(id,name,size,createdTime)",
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const regenFiles = (regen.data.files ?? []).map((f) => ({
    id: String(f.id || ""),
    name: String(f.name || ""),
  }));

  const allowlist = getApplicantRevisionAllowlist();

  async function checkCompany(companyName: string, tag: string) {
    const entry = allowlist.find((e) => e.companyName === companyName);
    if (!entry) {
      console.log(`${tag} ${companyName} — 不在白名單`);
      return;
    }
    const short = companyShortNameFromAllowlist(entry.companyName);
    const pdfFile = regenFiles.find((f) => f.name.startsWith(`${short}-`));
    if (!pdfFile) {
      console.log(`${tag} ${companyName} — 重產資料夾找不到對應 PDF（short=${short}）`);
      return;
    }

    const user = await withPrismaRetry(() =>
      prisma.user.findFirst({
        where: { email: { equals: entry.email, mode: "insensitive" } },
        select: { id: true, email: true },
      }),
    );
    const app = user
      ? await withPrismaRetry(() =>
          prisma.application.findFirst({
            where: { applicantUserId: user.id },
            orderBy: { updatedAt: "desc" },
            select: { id: true, driveProjectFolderId: true },
          }),
        )
      : null;
    if (!app?.driveProjectFolderId || !user) {
      console.log(`${tag} ${companyName} — 找不到案件`);
      return;
    }

    const draftFileId = await findDraftFileIdInFolder(
      drive,
      app.driveProjectFolderId,
      emailHashKey(user.email || entry.email),
    );
    if (!draftFileId) {
      console.log(`${tag} ${companyName} — 找不到草稿檔`);
      return;
    }

    const draftRes = await drive.files.get(
      { fileId: draftFileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" },
    );
    const draftJson = JSON.parse(Buffer.from(draftRes.data as ArrayBuffer).toString("utf-8")) as AnyRecord;
    const form = extractFormDataFromDraftPayload(draftJson);
    const texts: string[] = [];
    collectText(form, texts);
    const draftText = texts.join("");

    const pdfRes = await oauthDrive.files.get(
      { fileId: pdfFile.id, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" },
    );
    const pdfText = await extractPdfText(Buffer.from(pdfRes.data as ArrayBuffer));

    const cov = coverage(pdfText, draftText);
    console.log(
      `${tag} ${companyName} — 覆蓋率 ${cov.pct}%（${cov.hit}/${cov.total} 段）  pdf=${pdfFile.name}`,
    );
    if (cov.misses.length) {
      console.log(`      未對到樣本：${cov.misses.slice(0, 5).join(" / ")}`);
    }
  }

  console.log("=== 待驗證（無版本可回溯） ===");
  for (const name of TARGETS) await checkCompany(name, "TARGET ");
  console.log("\n=== 對照組（已確認與重產一致） ===");
  for (const name of CONTROLS) await checkCompany(name, "CONTROL");

  // UPLOAD 模式：確認上傳檔仍在
  console.log("\n=== UPLOAD 模式上傳檔存活檢查 ===");
  for (const entry of allowlist) {
    const user = await withPrismaRetry(() =>
      prisma.user.findFirst({
        where: { email: { equals: entry.email, mode: "insensitive" } },
        select: { id: true },
      }),
    );
    if (!user) continue;
    const app = await withPrismaRetry(() =>
      prisma.application.findFirst({
        where: { applicantUserId: user.id },
        orderBy: { updatedAt: "desc" },
        select: { submissionMode: true, uploadedProposalUrl: true },
      }),
    );
    if (!app || String(app.submissionMode || "").toUpperCase() !== "UPLOAD") continue;
    const fileId = extractGoogleDriveFileId(app.uploadedProposalUrl);
    if (!fileId) {
      console.log(`WARN  ${entry.companyName} — 無 uploadedProposalUrl`);
      continue;
    }
    try {
      const meta = await oauthDrive.files.get({
        fileId,
        fields: "id,name,size,trashed",
        supportsAllDrives: true,
      });
      console.log(
        `OK    ${entry.companyName} — ${meta.data.name}（${meta.data.size} bytes${meta.data.trashed ? "，已刪除" : ""}）`,
      );
    } catch (e) {
      console.log(`FAIL  ${entry.companyName} — 上傳檔讀取失敗：${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
