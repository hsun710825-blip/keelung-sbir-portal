import { getDriveOauthClient } from "@/app/api/_driveOauth";
import { getDriveSaClient } from "@/app/api/_driveSa";
import { withGoogleApiRetry } from "@/app/api/_googleApiRetry";

export async function downloadDriveFileBytes(fileId: string): Promise<Buffer> {
  const attempts: Array<() => Promise<Buffer>> = [
    async () => {
      const drive = await getDriveSaClient();
      const dl = await withGoogleApiRetry(`committee.pdf.sa.${fileId}`, () =>
        drive.files.get(
          { fileId, alt: "media", supportsAllDrives: true },
          { responseType: "arraybuffer" },
        ),
      );
      return Buffer.from(dl.data as ArrayBuffer);
    },
    async () => {
      const drive = getDriveOauthClient();
      const dl = await withGoogleApiRetry(`committee.pdf.oauth.${fileId}`, () =>
        drive.files.get(
          { fileId, alt: "media", supportsAllDrives: true },
          { responseType: "arraybuffer" },
        ),
      );
      return Buffer.from(dl.data as ArrayBuffer);
    },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("無法從 Google Drive 讀取 PDF");
}
