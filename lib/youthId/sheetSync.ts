import { getSheetsSaClient } from "@/app/api/_driveSa";
import { withGoogleApiRetry } from "@/app/api/_googleApiRetry";

import { YOUTH_ID_SPREADSHEET_ID } from "@/lib/youthId/constants";
import type { YouthSheetRow } from "@/lib/youthId/types";

function escapeSheetName(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

function headerKey(h: string): string {
  return String(h || "")
    .trim()
    .replace(/\s+/g, "");
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(headerKey);
  for (const alias of aliases) {
    const idx = normalized.findIndex((h) => h === headerKey(alias) || h.includes(headerKey(alias)));
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

function parseQualifies(raw: string): boolean | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^(是|Y|yes|true|符合|合格|✓)$/i.test(t)) return true;
  if (/^(否|N|no|false|不符合|不合格|×)$/i.test(t)) return false;
  if (t.includes("符合") && !t.includes("不")) return true;
  if (t.includes("不符合") || t.includes("不符")) return false;
  return null;
}

function parseAge(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = parseInt(t.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 && n < 120 ? n : null;
}

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

  const headers = (allRows[0] ?? []).map((h: unknown) => String(h ?? ""));
  const companyIdx = findColumnIndex(headers, ["申請企業名稱", "公司名稱", "企業名稱"]);
  const emailIdx = findColumnIndex(headers, ["電子郵件地址", "Email", "電子郵件"]);
  const uploadIdx = findColumnIndex(headers, ["負責人身分證正反面檔案上傳", "身分證", "檔案上傳"]);
  const nameIdx = findColumnIndex(headers, ["負責人姓名", "負責人", "負責人名稱"]);
  const cityIdx = findColumnIndex(headers, ["設籍縣市", "戶籍縣市", "縣市", "設籍"]);
  const ageIdx = findColumnIndex(headers, ["年齡"]);
  const qualifiesIdx = findColumnIndex(headers, ["是否符合", "是否符合青年", "青年資格", "是否符合青年創業"]);

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
      fields: {
        responsibleName: nameIdx >= 0 ? String(row[nameIdx] ?? "").trim() || null : null,
        registeredCity: cityIdx >= 0 ? String(row[cityIdx] ?? "").trim() || null : null,
        age: ageIdx >= 0 ? parseAge(String(row[ageIdx] ?? "")) : null,
        qualifies: qualifiesIdx >= 0 ? parseQualifies(String(row[qualifiesIdx] ?? "")) : null,
      },
    });
  }

  return { sheetName, headers, rows };
}
