/**
 * 將 V2（封面＋人力經費）匯入元元／元羽聯合案草稿。
 * 僅寫入 taxikeelung@gmail.com；其他業者不動。
 *
 * 用法（預設 dry-run）：
 *   npx tsx scripts/import-yuanyuan-joint-v2.ts
 *   npx tsx scripts/import-yuanyuan-joint-v2.ts --execute
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { drive_v3 } from "googleapis";
import v2 from "../lib/data/yuanyuanJointV2.json";

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

const TARGET_EMAIL = "taxikeelung@gmail.com";

function budgetSummary(hb: unknown): string {
  if (!hb || typeof hb !== "object") return "(無)";
  const rows = Array.isArray((hb as AnyRecord).budgetRows) ? ((hb as AnyRecord).budgetRows as AnyRecord[]) : [];
  const total = rows.find((r) => String(r.item || "") === "合計" || String(r.subject || "") === "合計");
  const pi = (hb as { piProfile?: { name?: unknown } }).piProfile;
  const people = Array.isArray((hb as AnyRecord).personnelCosts)
    ? ((hb as AnyRecord).personnelCosts as Array<{ name?: unknown }>)
        .map((r) => String(r.name || "").trim())
        .filter(Boolean)
        .join("、")
    : "";
  return `主持人=${String(pi?.name || "") || "—"}；人事=${people || "—"}；合計 gov/self/total=${String(total?.gov ?? "—")}/${String(total?.self ?? "—")}/${String(total?.total ?? "—")}`;
}

async function main() {
  const execute = process.argv.includes("--execute");
  const backupOnly = process.argv.includes("--backup-only");

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

  const user = await withPrismaRetry(() =>
    prisma.user.findFirst({
      where: { email: { equals: TARGET_EMAIL, mode: "insensitive" } },
      select: { id: true, email: true },
    }),
  );
  if (!user) throw new Error(`找不到使用者：${TARGET_EMAIL}`);

  const app = await withPrismaRetry(() =>
    prisma.application.findFirst({
      where: { applicantUserId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, driveProjectFolderId: true, submissionMode: true },
    }),
  );
  if (!app?.driveProjectFolderId) throw new Error(`找不到案件或專案資料夾：${TARGET_EMAIL}`);

  const draftFileId = await findDraftFileIdInFolder(
    drive,
    app.driveProjectFolderId,
    emailHashKey(user.email || TARGET_EMAIL),
  );
  if (!draftFileId) throw new Error(`找不到草稿檔：${TARGET_EMAIL}`);

  console.log(`案件：${app.title} (${app.id}) mode=${app.submissionMode}`);
  console.log(`草稿檔：${draftFileId}`);
  console.log(`模式：${execute ? "execute" : "dry-run"}\n`);

  const curRes = await drive.files.get(
    { fileId: draftFileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  const curText = Buffer.from(curRes.data as ArrayBuffer).toString("utf-8");
  const curJson = JSON.parse(curText) as AnyRecord;
  const curIsEnvelope = !!(curJson.formData && typeof curJson.formData === "object");
  const curForm = (curIsEnvelope ? (curJson.formData as AnyRecord) : curJson) as AnyRecord;
  const existingHb = (curForm.humanBudget && typeof curForm.humanBudget === "object"
    ? (curForm.humanBudget as AnyRecord)
    : {}) as AnyRecord;

  console.log("現況 humanBudget：", budgetSummary(existingHb));
  console.log("現況 jointSecondCompany：", curForm.jointSecondCompany ? JSON.stringify({
    companyName: (curForm.jointSecondCompany as AnyRecord).companyName,
    leaderName: (curForm.jointSecondCompany as AnyRecord).leaderName,
    humanBudget: budgetSummary((curForm.jointSecondCompany as AnyRecord).humanBudget),
  }) : "(無)");

  const nextHb: AnyRecord = {
    ...existingHb,
    ...(v2.firstCompanyPatch as AnyRecord),
    govAllocPct: {
      ...((existingHb.govAllocPct as AnyRecord) || {}),
      ...((v2.firstCompanyPatch as AnyRecord).govAllocPct as AnyRecord),
    },
    techIntroCosts: (v2.firstCompanyPatch as AnyRecord).techIntroCosts,
  };

  const nextJoint = {
    companyName: v2.companyName,
    leaderName: v2.leaderName,
    humanBudget: v2.secondHumanBudget,
  };

  console.log("\n寫入後 humanBudget（元元）：", budgetSummary(nextHb));
  console.log("寫入後 jointSecondCompany（元羽）：", budgetSummary(nextJoint.humanBudget));
  console.log(`第二家名稱／負責人：${nextJoint.companyName}／${nextJoint.leaderName}`);

  const backupDir = path.join(process.cwd(), ".data", "backups");
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(
    backupDir,
    backupOnly ? `draft-${app.id}-current-${stamp}.json` : `draft-${app.id}-joint-v2-${stamp}.json`,
  );

  if (backupOnly) {
    writeFileSync(backupPath, curText, "utf-8");
    console.log(`\n已備份現況草稿（未寫入 Drive）：${backupPath}`);
    return;
  }

  if (!execute) {
    console.log("\ndry-run：未寫入。加上 --execute 才會實際匯入。");
    return;
  }

  writeFileSync(backupPath, curText, "utf-8");
  console.log(`\n已備份現況草稿：${backupPath}`);

  curForm.humanBudget = nextHb;
  curForm.jointSecondCompany = nextJoint;
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

  console.log(`已寫回草稿（${nextText.length} bytes）。請請元元重新登入確認。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
