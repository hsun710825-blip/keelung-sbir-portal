import { getSheetsSaClient } from "@/app/api/_driveSa";
import { withGoogleApiRetry } from "@/app/api/_googleApiRetry";

import { YOUTH_ID_SPREADSHEET_ID } from "@/lib/youthId/constants";
import type { YouthSheetRow } from "@/lib/youthId/types";

function escapeSheetName(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map((h) => String(h || "").trim().replace(/\s+/g, ""));
  for (const alias of aliases) {
    const key = alias.trim().replace(/\s+/g, "");
    const idx = normalized.findIndex((h) => h === key || h.includes(key));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseDriveFileId(url: string | null | undefined): string | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  const openMatch = raw.match(/[?&]id=([^&]+)/);
  if (openMatch) return openMatch[1];
  const pathMatch = raw.match(/\/d\/([^/]+)/);
  if (pathMatch) return pathMatch[1];
  return null;
}

/** 僅讀取公司名稱與證件上傳連結（查證欄位由證件 OCR 或 PO 手動維護） */
export async function loadYouthIdSheetRows(): Promise<{
  sheetName: string;
  headers: string[];
  rows: YouthSheetRow[];
}> {
  const sheets = await getSheetsSaClient();
  const meta = await withGoogleApiRetry("youthId.sheets.meta", () =>
    sheets.spreadsheets.get({
      spreadsheetId: YOUTH_ID_SPREADSHEET_ID,
      fields: "sheets.properties.title",
    }),
  );
  const sheetName =
    process.env.YOUTH_ID_SHEET_NAME?.trim() ||
    meta.data.sheets?.[0]?.properties?.title ||
    "表單回覆 1";

  const valuesRes = await withGoogleApiRetry("youthId.sheets.values", () =>
    sheets.spreadsheets.values.get({
      spreadsheetId: YOUTH_ID_SPREADSHEET_ID,
      range: `${escapeSheetName(sheetName)}!A:Z`,
    }),
  );
  const allRows = valuesRes.data.values ?? [];
  if (allRows.length < 2) {
    return { sheetName, headers: [], rows: [] };
  }

  const headers = (allRows[0] ?? []).map((h) => String(h ?? ""));
  const companyIdx = findColumnIndex(headers, ["申請企業名稱", "公司名稱", "企業名稱"]);
  const emailIdx = findColumnIndex(headers, ["電子郵件地址", "Email", "電子郵件"]);
  const uploadIdx = findColumnIndex(headers, ["負責人身分證正反面檔案上傳", "身分證", "檔案上傳"]);

  const rows: YouthSheetRow[] = [];
  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i] ?? [];
    const companyName = companyIdx >= 0 ? String(row[companyIdx] ?? "").trim() : "";
    if (!companyName) continue;
    const uploadUrl = uploadIdx >= 0 ? String(row[uploadIdx] ?? "").trim() : "";
    rows.push({
      rowIndex: i + 1,
      companyName,
      email: emailIdx >= 0 ? String(row[emailIdx] ?? "").trim() || null : null,
      uploadUrl: uploadUrl || null,
      uploadDriveFileId: parseDriveFileId(uploadUrl),
    });
  }

  return { sheetName, headers, rows };
}
