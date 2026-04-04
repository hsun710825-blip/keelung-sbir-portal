import { createHash } from "node:crypto";

import type { PrismaClient } from "@prisma/client";
import { ApplicationStatus, Role } from "@prisma/client";

const STATUS_DRAFT_CN = "草稿處理中";
const STATUS_SUBMITTED_CN = "已確認送出";

/**
 * 將試算表 K 欄（與其他可能的中文狀態）對應到 Prisma ApplicationStatus。
 */
export function mapSheetStatusToApplicationStatus(raw: string): ApplicationStatus {
  const s = String(raw || "").trim();
  if (!s) return ApplicationStatus.DRAFT;

  if (s === STATUS_DRAFT_CN || s.includes("草稿")) return ApplicationStatus.DRAFT;
  if (s === STATUS_SUBMITTED_CN || s.includes("已確認送出") || s === "已送件") return ApplicationStatus.SUBMITTED;

  const compact = s.replace(/\s/g, "");
  if (compact.includes("審查中") && !compact.includes("委員")) return ApplicationStatus.UNDER_REVIEW;
  if (compact.includes("委員")) return ApplicationStatus.COMMITTEE_REVIEW;
  if (compact.includes("補件") || compact.includes("修訂") || compact.includes("待補")) {
    if (compact.includes("已補") || compact.includes("已送審")) return ApplicationStatus.REVISION_SUBMITTED;
    return ApplicationStatus.REVISE_REQUESTED;
  }
  if (compact.includes("核定") || compact.includes("通過") || compact.includes("核准")) return ApplicationStatus.APPROVED;
  if (compact.includes("未通過") || compact.includes("駁回") || compact.includes("拒絕")) return ApplicationStatus.REJECTED;
  if (compact.includes("結案")) return ApplicationStatus.CLOSED;

  const upper = s.toUpperCase();
  const enumVals = Object.values(ApplicationStatus) as string[];
  if (enumVals.includes(upper)) return upper as ApplicationStatus;

  return ApplicationStatus.DRAFT;
}

/**
 * 解析專案總表常見時間字串（24h 或 上午/下午），失敗則回 null。
 */
export function parseRegistrySheetDate(raw: string): Date | null {
  const t = String(raw || "").trim();
  if (!t) return null;

  const m24 = t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m24) {
    const y = Number(m24[1]);
    const mo = Number(m24[2]);
    const d = Number(m24[3]);
    const h = Number(m24[4]);
    const mi = Number(m24[5]);
    const s = Number(m24[6]);
    const dt = new Date(y, mo - 1, d, h, mi, s);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const m12 = t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(上午|下午)\s*(\d{1,2}):(\d{2}):(\d{2})/);
  if (m12) {
    const y = Number(m12[1]);
    const mo = Number(m12[2]);
    const d = Number(m12[3]);
    const ap = m12[4];
    let h = Number(m12[5]);
    const mi = Number(m12[6]);
    const s = Number(m12[7]);
    if (ap === "下午") {
      if (h !== 12) h += 12;
    } else {
      if (h === 12) h = 0;
    }
    const dt = new Date(y, mo - 1, d, h, mi, s);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const fallback = new Date(t.replace(/\//g, "-"));
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function padSheetRowSignature(cells: string[]): string {
  return cells.slice(0, 12).map((c) => String(c ?? "").trim()).join("\t");
}

/** 依列內容產生穩定 id，重跑遷移時可 upsert 同一筆 */
export function legacyApplicationId(sheetRow1Based: number, cells: string[]): string {
  const sig = padSheetRowSignature(cells);
  const h = createHash("sha256").update(`${sheetRow1Based}|${sig}`).digest("hex").slice(0, 28);
  return `mig_${h}`;
}

function isValidEmail(em: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
}

export type MigrateFromRegistrySheetResult = {
  ok: true;
  rowsRead: number;
  rowsSkipped: number;
  usersCreated: number;
  usersUpdated: number;
  applicationsUpserted: number;
  warnings: string[];
};

/**
 * 以 email upsert User（不分大小寫比對既有列）、以穩定 id upsert Application。
 */
export async function migrateRegistryRowsToPrisma(
  prisma: PrismaClient,
  rows: string[][],
  firstDataRow1Based: number,
): Promise<MigrateFromRegistrySheetResult> {
  const warnings: string[] = [];
  let rowsSkipped = 0;
  let usersCreated = 0;
  let usersUpdated = 0;
  let applicationsUpserted = 0;

  for (let i = 0; i < rows.length; i++) {
    const sheetRow = firstDataRow1Based + i;
    const r = rows[i] || [];
    const cells = [...r.map((c) => String(c ?? "").trim())];
    while (cells.length < 12) cells.push("");

    const emailRaw = cells[0];
    if (!emailRaw || !isValidEmail(emailRaw)) {
      rowsSkipped += 1;
      continue;
    }

    try {
    const loginAtStr = cells[1];
    const taxId = cells[2];
    const companyName = cells[3];
    const projectName = cells[4];
    const driveUrl = cells[9];
    const statusRaw = cells[10];
    const lastUpdateStr = cells[11];

    const displayName = companyName.trim() || null;
    const status = mapSheetStatusToApplicationStatus(statusRaw);

    const createdGuess = parseRegistrySheetDate(loginAtStr);
    const updatedGuess = parseRegistrySheetDate(lastUpdateStr) ?? createdGuess;
    const now = new Date();
    const createdAt = createdGuess ?? now;
    const updatedAt = updatedGuess ?? createdAt;

    const descriptionParts = [
      "【由 Google 專案總表遷入】",
      taxId ? `統編：${taxId}` : "",
      driveUrl ? `Drive：${driveUrl}` : "",
      `試算表列：${sheetRow}`,
    ].filter(Boolean);
    const description = descriptionParts.join("\n");

    const emailLower = emailRaw.trim().toLowerCase();

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: emailRaw, mode: "insensitive" } },
      select: { id: true, email: true, role: true },
    });

    let userId: string;
    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          ...(displayName ? { name: displayName } : {}),
        },
      });
      userId = existingUser.id;
      usersUpdated += 1;
    } else {
      const created = await prisma.user.create({
        data: {
          email: emailLower,
          name: displayName,
          role: Role.USER,
        },
      });
      userId = created.id;
      usersCreated += 1;
    }

    const appId = legacyApplicationId(sheetRow, cells);

    await prisma.application.upsert({
      where: { id: appId },
      create: {
        id: appId,
        applicantUserId: userId,
        title: projectName.trim() || null,
        status,
        description,
        createdAt,
        updatedAt,
      },
      update: {
        applicantUserId: userId,
        title: projectName.trim() || null,
        status,
        description,
        updatedAt,
      },
    });
    applicationsUpserted += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`第 ${sheetRow} 列：${msg}`);
      rowsSkipped += 1;
    }
  }

  return {
    ok: true,
    rowsRead: rows.length,
    rowsSkipped,
    usersCreated,
    usersUpdated,
    applicationsUpserted,
    warnings,
  };
}
