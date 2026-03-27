import type { sheets_v4 } from "googleapis";
import { getSheetsSaClient } from "./_driveSa";
import { withGoogleApiRetry } from "./_googleApiRetry";

type AnyRecord = Record<string, unknown>;

/** 試算表 ID（從網址 .../spreadsheets/d/<ID>/edit 取得） */
function getSpreadsheetId(): string | null {
  const id =
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ||
    process.env.GOOGLE_SHEET_ID?.trim();
  return id || null;
}

/** 工作表分頁名稱（須與 Google Sheets 底部分頁標籤完全一致） */
function getSheetName(): string {
  return (process.env.GOOGLE_SHEETS_REGISTRY_SHEET_NAME || "專案總表").trim() || "專案總表";
}

/** 資料從第幾列開始（預設第 2 列：第 1 列為標題列） */
function getFirstDataRow(): number {
  const n = parseInt(process.env.GOOGLE_SHEETS_FIRST_DATA_ROW || "2", 10);
  return Number.isFinite(n) && n >= 1 ? n : 2;
}

/** 將工作表名稱包成 A1 表示法可安全使用的字串 */
function escapeSheetNameForRange(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

const STATUS_DRAFT = "草稿處理中";
const STATUS_SUBMITTED = "已確認送出";

/**
 * 是否啟用「專案總表」同步：未設定 GOOGLE_SHEETS_SPREADSHEET_ID／GOOGLE_SHEET_ID 時略過。
 */
export function isRegistrySheetEnabled() {
  return Boolean(getSpreadsheetId());
}

/**
 * 從前端 formData 取出要寫入試算表 C～I 欄的欄位。
 * C：統一編號、D：公司名稱、E：計畫名稱、F：負責人、G：計畫主持人、H：聯絡人、I：聯絡電話
 */
export function pickRegistryFieldsFromFormData(formData: AnyRecord | null | undefined) {
  if (!formData || typeof formData !== "object") {
    return {
      taxId: "",
      companyName: "",
      projectName: "",
      responsiblePerson: "",
      planHost: "",
      contactPerson: "",
      phone: "",
    };
  }
  const cp = (formData.companyProfile as { formData?: AnyRecord } | undefined)?.formData;
  const hb = formData.humanBudget as { piProfile?: AnyRecord; team?: Array<AnyRecord> } | undefined;

  const taxId = String(cp?.taxId ?? "").trim();
  const companyName = String(formData.companyName ?? cp?.companyName ?? "").trim();
  const projectName = String(formData.projectName ?? "").trim();
  const responsiblePerson = String(formData.leaderName ?? cp?.representative ?? "").trim();
  const planHost = String(hb?.piProfile?.name ?? responsiblePerson).trim();
  const teamFirst = Array.isArray(hb?.team) && hb.team.length > 0 ? String(hb.team[0]?.name ?? "").trim() : "";
  const contactPerson =
    teamFirst || String(cp?.representative ?? "").trim() || responsiblePerson || planHost;
  const phone = String(cp?.phone ?? "").trim();

  return { taxId, companyName, projectName, responsiblePerson, planHost, contactPerson, phone };
}

/** Vercel 預設為 UTC；總表時間改以台灣時區顯示（可環境變數覆寫） */
function getRegistryTimeZone() {
  return (process.env.GOOGLE_SHEETS_TIMEZONE || "Asia/Taipei").trim() || "Asia/Taipei";
}

function formatNowForCell() {
  const d = new Date();
  const tz = getRegistryTimeZone();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const y = map.year ?? "";
  const m = map.month ?? "";
  const day = map.day ?? "";
  const h = map.hour ?? "";
  const min = map.minute ?? "";
  const s = map.second ?? "";
  return `${y}/${m}/${day} ${h}:${min}:${s}`;
}

/** 使用者專屬資料夾的瀏覽連結（與前端 Drive 介面一致） */
export function userFolderWebLink(folderId: string) {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

/**
 * A 欄比對 email，取「最後一筆」列號（同一帳號可有多列登入紀錄；草稿／送出只更新最新一列）。
 */
async function findLatestRowByEmail(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  email: string,
): Promise<number | null> {
  const sheet = getSheetName();
  const startRow = getFirstDataRow();
  const range = `${escapeSheetNameForRange(sheet)}!A${startRow}:A`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const cols = res.data.values || [];
  const normalized = email.trim().toLowerCase();
  let last: number | null = null;
  for (let i = 0; i < cols.length; i++) {
    const cell = String(cols[i]?.[0] ?? "").trim().toLowerCase();
    if (cell === normalized) {
      last = startRow + i;
    }
  }
  return last;
}

/**
 * 動作 A：每次登入皆新增一列（B＝本次登入時間、J～L＝資料夾／狀態／最後更新）。
 * 同一帳號可有多列，供後台檢視每次登入時間；暫存／送出會更新該 email「最底下一列」。
 */
export async function ensureRegistryRowForLogin(opts: {
  email: string;
  userFolderId: string;
}): Promise<{ ok: true; row: number; created: boolean } | { ok: false; skipped: true } | { ok: false; error: string }> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    return { ok: false, skipped: true };
  }
  const email = opts.email.trim();
  if (!email) {
    return { ok: false, error: "缺少 email" };
  }

  try {
    return await withGoogleApiRetry("sheets.ensureRegistryRowForLogin", async () => {
    const sheets = await getSheetsSaClient();
    const sheet = getSheetName();
    const folderUrl = userFolderWebLink(opts.userFolderId);
    const now = formatNowForCell();

    // 每次登入 append 一列（B 必為本次 Asia/Taipei 時間）
    const row: (string | number)[] = [
      email, // A 登入帳號
      now, // B 登入時間（本次登入）
      "", // C 統編
      "", // D 公司
      "", // E 計畫名稱
      "", // F 負責人
      "", // G 計畫主持人
      "", // H 聯絡人
      "", // I 電話
      folderUrl, // J Drive 連結
      STATUS_DRAFT, // K 狀態
      now, // L 最後更新
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${escapeSheetNameForRange(sheet)}!A:L`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    const newRowNum = await findLatestRowByEmail(sheets, spreadsheetId, email);
    return { ok: true, row: newRowNum ?? 0, created: true };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[registrySheet] ensureRegistryRowForLogin failed:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * 動作 B：暫存更新 — 依 email 找到「最後一列」，更新 C～I（表單欄位）、K（維持草稿狀態，若已送出則不改狀態）、L（最後更新時間）。
 * J 欄（Drive 連結）保留不覆寫。
 */
export async function updateRegistryFromFormData(email: string, formData: AnyRecord | null | undefined) {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return { ok: false as const, skipped: true };

  const em = email.trim();
  if (!em) return { ok: false, error: "缺少 email" };

  try {
    return await withGoogleApiRetry("sheets.updateRegistryFromFormData", async () => {
    const sheets = await getSheetsSaClient();
    const sheet = getSheetName();
    const row = await findLatestRowByEmail(sheets, spreadsheetId, em);
    if (row == null) {
      console.warn("[registrySheet] updateRegistryFromFormData: row not found for", em);
      return { ok: false, error: "找不到對應列，請先完成登入註冊（/api/registry/ensure）" };
    }

    const { taxId, companyName, projectName, responsiblePerson, planHost, contactPerson, phone } = pickRegistryFieldsFromFormData(formData);
    const now = formatNowForCell();

    // 讀取目前 K 欄狀態：已確認送出者不再被草稿儲存改回草稿
    const statusRange = `${escapeSheetNameForRange(sheet)}!K${row}`;
    const st = await sheets.spreadsheets.values.get({ spreadsheetId, range: statusRange });
    const currentStatus = String(st.data.values?.[0]?.[0] ?? "").trim();
    const nextStatus = currentStatus === STATUS_SUBMITTED ? STATUS_SUBMITTED : STATUS_DRAFT;

    const dataRange = `${escapeSheetNameForRange(sheet)}!C${row}:I${row}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: dataRange,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[taxId, companyName, projectName, responsiblePerson, planHost, contactPerson, phone]] },
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${escapeSheetNameForRange(sheet)}!K${row}:L${row}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[nextStatus, now]] },
    });

    return { ok: true as const, row };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[registrySheet] updateRegistryFromFormData failed:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * 動作 C：確認送出 — K 欄改為「已確認送出」，L 欄為最後更新時間；並可再次寫入 C～I 以確保與送出內容一致。
 */
export async function markRegistrySubmitted(email: string, formData: AnyRecord | null | undefined) {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return { ok: false as const, skipped: true };

  const em = email.trim();
  if (!em) return { ok: false, error: "缺少 email" };

  try {
    return await withGoogleApiRetry("sheets.markRegistrySubmitted", async () => {
    const sheets = await getSheetsSaClient();
    const sheet = getSheetName();
    const row = await findLatestRowByEmail(sheets, spreadsheetId, em);
    if (row == null) {
      console.warn("[registrySheet] markRegistrySubmitted: row not found for", em);
      return { ok: false, error: "找不到對應列" };
    }

    const { taxId, companyName, projectName, responsiblePerson, planHost, contactPerson, phone } = pickRegistryFieldsFromFormData(formData);
    const now = formatNowForCell();

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${escapeSheetNameForRange(sheet)}!C${row}:I${row}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[taxId, companyName, projectName, responsiblePerson, planHost, contactPerson, phone]] },
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${escapeSheetNameForRange(sheet)}!K${row}:L${row}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[STATUS_SUBMITTED, now]] },
    });

    return { ok: true as const, row };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[registrySheet] markRegistrySubmitted failed:", msg);
    return { ok: false, error: msg };
  }
}
