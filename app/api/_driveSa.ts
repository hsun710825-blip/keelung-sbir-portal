import { google } from "googleapis";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const DRIVE_FOLDER_ID = "17-pae66IshkXBuOs-bowAkv_PXm3IbtA";

type ServiceAccountJson = {
  client_email: string;
  private_key: string;
};

async function loadServiceAccount(): Promise<ServiceAccountJson> {
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
      return { client_email: json.client_email, private_key: json.private_key };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Unable to read google-credentials.json");
}

export async function getDriveSaClient() {
  const { client_email, private_key } = await loadServiceAccount();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

