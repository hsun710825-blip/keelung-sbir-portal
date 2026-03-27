import { google } from "googleapis";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const DRIVE_FOLDER_ID = "17-pae66IshkXBuOs-bowAkv_PXm3IbtA";

type ServiceAccountJson = {
  client_email: string;
  private_key: string;
};

/** Vercel 環境變數常見：整段被包在引號內，或換行為字元 \n */
function normalizePrivateKey(key: string): string {
  let k = key.trim().replace(/^\uFEFF/, "");
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1);
  }
  return k
    .replace(/\\n/g, "\n")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\r/g, "\n");
}

/**
 * 還原成 OpenSSL 可解的 PEM（修正貼上成單行、多空格、標頭前後雜訊等）。
 * 可緩解：error:1E08010C:DECODER routines::unsupported
 */
function fixPemPrivateKey(pem: string): string {
  let p = pem.trim().replace(/^\uFEFF/, "");
  p = p.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const begin = p.match(/-----BEGIN ([A-Z0-9 ]+)-----/);
  const end = p.match(/-----END ([A-Z0-9 ]+)-----/);
  if (!begin || !end || begin[1].trim() !== end[1].trim()) {
    return p;
  }
  const label = begin[1].trim();
  const startIdx = p.indexOf(begin[0]) + begin[0].length;
  const endIdx = p.indexOf(end[0], startIdx);
  if (endIdx <= startIdx) return p;

  let body = p.slice(startIdx, endIdx).replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(body)) {
    return p;
  }

  const lines = body.match(/.{1,64}/g) ?? [body];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

/** 供 JWT 使用的最終私鑰字串 */
function finalizePrivateKey(raw: string): string {
  return fixPemPrivateKey(normalizePrivateKey(raw));
}

function parseServiceAccountFromEnv(raw: string): ServiceAccountJson {
  const json = JSON.parse(raw) as Partial<ServiceAccountJson>;
  if (!json.client_email || !json.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON: missing client_email or private_key");
  }
  return {
    client_email: json.client_email,
    private_key: finalizePrivateKey(String(json.private_key)),
  };
}

/**
 * 載入與 Drive／Sheets 共用的 Service Account。
 * 優先順序：
 * 1) `GOOGLE_SERVICE_ACCOUNT_JSON`（整份 JSON）
 * 2) `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`（與 Vercel 常見拆欄設定相容）
 * 3) 專案根目錄或 `app/` 下的 `google-credentials.json`（本機）
 */
export async function loadServiceAccount(): Promise<ServiceAccountJson> {
  const fromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (fromEnv) {
    try {
      return parseServiceAccountFromEnv(fromEnv);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Invalid GOOGLE_SERVICE_ACCOUNT_JSON: ${msg}`);
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY?.trim();
  if (email && privateKeyRaw) {
    return { client_email: email, private_key: finalizePrivateKey(privateKeyRaw) };
  }

  const candidates = [
    path.join(process.cwd(), "google-credentials.json"),
    path.join(process.cwd(), "app", "google-credentials.json"),
  ];

  let lastErr: unknown = null;
  for (const p of candidates) {
    try {
      const raw = await readFile(p, "utf-8");
      const json = JSON.parse(raw) as Partial<ServiceAccountJson>;
      if (!json.client_email || !json.private_key) {
        throw new Error(`Invalid service account json at ${p} (missing client_email/private_key)`);
      }
      return {
        client_email: json.client_email,
        private_key: finalizePrivateKey(String(json.private_key)),
      };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(
        "Unable to load service account: set GOOGLE_SERVICE_ACCOUNT_JSON, or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY, or add google-credentials.json locally",
      );
}

export async function getDriveSaClient() {
  const { client_email, private_key } = await loadServiceAccount();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

/** Google Sheets API（與 Drive 相同服務帳戶 JSON，需於試算表「共用」給服務帳戶信箱） */
export async function getSheetsSaClient() {
  const { client_email, private_key } = await loadServiceAccount();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

