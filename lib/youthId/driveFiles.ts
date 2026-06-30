import { getDriveSaClient } from "@/app/api/_driveSa";

import { youthCompanyCoreMatch, normalizeYouthCompanyCore } from "@/lib/youthId/companyMatch";
import { YOUTH_ID_DRIVE_FOLDER_ID } from "@/lib/youthId/constants";
import type { YouthDriveFile } from "@/lib/youthId/types";

async function listAllInFolder(drive: Awaited<ReturnType<typeof getDriveSaClient>>, folderId: string) {
  const out: YouthDriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "nextPageToken, files(id,name,mimeType)",
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      if (!f.id || !f.name) continue;
      if (f.mimeType === "application/vnd.google-apps.folder") {
        const nested = await listAllInFolder(drive, f.id);
        out.push(...nested);
      } else {
        out.push({ id: f.id, name: f.name, mimeType: f.mimeType || "application/octet-stream" });
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

export async function loadYouthIdDriveFiles(): Promise<YouthDriveFile[]> {
  const drive = await getDriveSaClient();
  return listAllInFolder(drive, YOUTH_ID_DRIVE_FOLDER_ID);
}

export function findDriveFileForCompany(companyName: string, files: YouthDriveFile[]): YouthDriveFile | null {
  let best: YouthDriveFile | null = null;
  let bestScore = 0;
  for (const file of files) {
    if (!youthCompanyCoreMatch(companyName, file.name)) continue;
    const score = normalizeYouthCompanyCore(file.name).length;
    if (score > bestScore) {
      best = file;
      bestScore = score;
    }
  }
  return best;
}

export async function downloadDriveFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const drive = await getDriveSaClient();
  const meta = await drive.files.get({
    fileId,
    fields: "mimeType,name",
    supportsAllDrives: true,
  });
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return {
    buffer: Buffer.from(res.data as ArrayBuffer),
    mimeType: meta.data.mimeType || "application/octet-stream",
  };
}
