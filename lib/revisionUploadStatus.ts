import { getDriveOauthClient } from "@/app/api/_driveOauth";
import { withGoogleApiRetry } from "@/app/api/_googleApiRetry";
import {
  APPLICANT_REVISION_UPLOAD_FOLDER_ID,
  companyShortNameFromAllowlist,
  getApplicantRevisionAllowlist,
} from "@/lib/applicantRevisionAccess";
import { resolveApplicantRevisionUploadFolderId } from "@/lib/applicantRevisionUpload";
import { REVISION_UPLOAD_FOLDER_URL, pushLineToPo } from "@/lib/poRevisionUploadNotify";

export type RevisionUploadFile = {
  name: string;
  url: string | null;
  modifiedTime: string | null;
};

export type RevisionUploadStatusRow = {
  companyName: string;
  email: string;
  shortName: string;
  uploaded: boolean;
  matchedFileName: string | null;
  matchedFile: RevisionUploadFile | null;
  /** 8/13 前放在根資料夾的舊修改版（本次仍算尚未上傳） */
  legacyFile: RevisionUploadFile | null;
};

export type RevisionUploadStatus = {
  checkedAt: string;
  folderId: string;
  fileCount: number;
  /** 資料夾內對不到任何白名單公司的檔名，供 PO 人工確認 */
  unmatchedFileNames: string[];
  uploaded: RevisionUploadStatusRow[];
  missing: RevisionUploadStatusRow[];
};

async function listRevisionFolderFiles(folderId: string): Promise<RevisionUploadFile[]> {
  const drive = getDriveOauthClient();
  const files: RevisionUploadFile[] = [];
  let pageToken: string | undefined;
  do {
    const res = await withGoogleApiRetry("revisionUploadStatus.list", () =>
      drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: "nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)",
        pageSize: 100,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      }),
    );
    for (const f of res.data.files ?? []) {
      const name = String(f.name || "").trim();
      if (!name) continue;
      const mime = String(f.mimeType || "");
      if (mime === "application/vnd.google-apps.folder") continue;
      const isPdf = mime === "application/pdf" || name.toLowerCase().endsWith(".pdf");
      if (!isPdf) continue;
      if (!name.includes("修改版")) continue;
      files.push({
        name,
        url: f.webViewLink ? String(f.webViewLink) : null,
        modifiedTime: f.modifiedTime ? String(f.modifiedTime) : null,
      });
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);
  return files;
}

function matchFile(
  files: RevisionUploadFile[],
  companyName: string,
  shortName: string,
): RevisionUploadFile | null {
  const needles = [shortName, companyName].filter((x) => x.length >= 2);
  for (const file of files) {
    if (needles.some((n) => file.name.includes(n))) return file;
  }
  return null;
}

export async function getRevisionUploadStatus(): Promise<RevisionUploadStatus> {
  const drive = getDriveOauthClient();
  const folderId = await withGoogleApiRetry("revisionUploadStatus.resolveFolder", () =>
    resolveApplicantRevisionUploadFolderId(drive),
  );
  const files = await listRevisionFolderFiles(folderId);
  const legacyFiles =
    folderId === APPLICANT_REVISION_UPLOAD_FOLDER_ID
      ? []
      : await listRevisionFolderFiles(APPLICANT_REVISION_UPLOAD_FOLDER_ID).catch(() => []);

  const matchedNames = new Set<string>();
  const rows: RevisionUploadStatusRow[] = getApplicantRevisionAllowlist().map((entry) => {
    const shortName = companyShortNameFromAllowlist(entry.companyName) || entry.companyName;
    const matchedFile = matchFile(files, entry.companyName, shortName);
    if (matchedFile) matchedNames.add(matchedFile.name);
    return {
      companyName: entry.companyName,
      email: entry.email,
      shortName,
      uploaded: Boolean(matchedFile),
      matchedFileName: matchedFile?.name ?? null,
      matchedFile,
      legacyFile: matchedFile ? null : matchFile(legacyFiles, entry.companyName, shortName),
    };
  });

  return {
    checkedAt: new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }),
    folderId,
    fileCount: files.length,
    unmatchedFileNames: files.map((f) => f.name).filter((name) => !matchedNames.has(name)),
    uploaded: rows.filter((r) => r.uploaded),
    missing: rows.filter((r) => !r.uploaded),
  };
}

export function buildMissingUploadReminderText(status: RevisionUploadStatus): string {
  const total = status.uploaded.length + status.missing.length;
  const lines = [
    "【基隆SBIR】修改版計畫書尚未上傳名單",
    `檢查時間：${status.checkedAt}`,
    `已上傳 ${status.uploaded.length}／${total} 家；尚未上傳 ${status.missing.length} 家`,
    "",
  ];

  if (status.missing.length === 0) {
    lines.push("15 家都已上傳修改版計畫書。");
  } else {
    lines.push("尚未上傳：");
    status.missing.forEach((row, i) => {
      lines.push(`${i + 1}. ${row.companyName}`);
    });
  }

  if (status.uploaded.length > 0) {
    lines.push("");
    lines.push("已上傳：");
    for (const row of status.uploaded) {
      lines.push(`- ${row.companyName}`);
    }
  }

  lines.push("");
  lines.push(`資料夾：${REVISION_UPLOAD_FOLDER_URL}`);
  lines.push("回傳期限：8/19（三）");
  return lines.join("\n");
}

export async function sendMissingRevisionUploadReminder(): Promise<{
  ok: boolean;
  status: RevisionUploadStatus;
}> {
  const status = await getRevisionUploadStatus();
  const ok = await pushLineToPo(buildMissingUploadReminderText(status));
  return { ok, status };
}
