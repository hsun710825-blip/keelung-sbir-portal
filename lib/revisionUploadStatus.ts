import { getDriveOauthClient } from "@/app/api/_driveOauth";
import {
  companyShortNameFromAllowlist,
  getApplicantRevisionAllowlist,
} from "@/lib/applicantRevisionAccess";
import { resolveApplicantRevisionUploadFolderId } from "@/lib/applicantRevisionUpload";
import { REVISION_UPLOAD_FOLDER_URL, pushLineToPo } from "@/lib/poRevisionUploadNotify";

export type RevisionUploadStatusRow = {
  companyName: string;
  email: string;
  shortName: string;
  uploaded: boolean;
  matchedFileName: string | null;
};

export type RevisionUploadStatus = {
  checkedAt: string;
  folderId: string;
  fileCount: number;
  uploaded: RevisionUploadStatusRow[];
  missing: RevisionUploadStatusRow[];
};

async function listRevisionFolderFileNames(folderId: string): Promise<string[]> {
  const drive = getDriveOauthClient();
  const names: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "nextPageToken,files(id,name,mimeType)",
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      const name = String(f.name || "").trim();
      if (!name) continue;
      const mime = String(f.mimeType || "");
      if (mime === "application/vnd.google-apps.folder") continue;
      const isPdf = mime === "application/pdf" || name.toLowerCase().endsWith(".pdf");
      if (!isPdf) continue;
      if (!name.includes("修改版")) continue;
      names.push(name);
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);
  return names;
}

function matchFile(fileNames: string[], companyName: string, shortName: string): string | null {
  const needles = [shortName, companyName].filter((x) => x.length >= 2);
  for (const fileName of fileNames) {
    if (needles.some((n) => fileName.includes(n))) return fileName;
  }
  return null;
}

export async function getRevisionUploadStatus(): Promise<RevisionUploadStatus> {
  const drive = getDriveOauthClient();
  const folderId = await resolveApplicantRevisionUploadFolderId(drive);
  const fileNames = await listRevisionFolderFileNames(folderId);
  const rows: RevisionUploadStatusRow[] = getApplicantRevisionAllowlist().map((entry) => {
    const shortName = companyShortNameFromAllowlist(entry.companyName) || entry.companyName;
    const matchedFileName = matchFile(fileNames, entry.companyName, shortName);
    return {
      companyName: entry.companyName,
      email: entry.email,
      shortName,
      uploaded: Boolean(matchedFileName),
      matchedFileName,
    };
  });

  return {
    checkedAt: new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }),
    folderId,
    fileCount: fileNames.length,
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
