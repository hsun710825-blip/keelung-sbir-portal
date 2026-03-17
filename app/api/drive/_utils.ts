import { cookies } from "next/headers";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { google } from "googleapis";

const DATA_DIR = path.join(process.cwd(), ".data");
const TOKENS_PATH = path.join(DATA_DIR, "drive-oauth-tokens.json");
const SID_COOKIE = "sbir_sid";

export type StoredToken = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
};

export async function ensureSessionId() {
  const jar = await cookies();
  let sid = jar.get(SID_COOKIE)?.value;
  if (!sid) {
    sid = crypto.randomBytes(16).toString("hex");
    jar.set(SID_COOKIE, sid, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }
  return sid;
}

async function loadAll(): Promise<Record<string, StoredToken>> {
  try {
    const raw = await readFile(TOKENS_PATH, "utf-8");
    return JSON.parse(raw) as Record<string, StoredToken>;
  } catch {
    return {};
  }
}

async function saveAll(data: Record<string, StoredToken>) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(TOKENS_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function getStoredToken(sid: string): Promise<StoredToken | null> {
  const all = await loadAll();
  return all[sid] || null;
}

export async function setStoredToken(sid: string, token: StoredToken) {
  const all = await loadAll();
  all[sid] = token;
  await saveAll(all);
}

export function getOauthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET");
  }
  return new google.auth.OAuth2({
    clientId,
    clientSecret,
    redirectUri: `${baseUrl}/api/drive/callback`,
  });
}

