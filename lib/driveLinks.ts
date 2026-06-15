/** Google Drive 檔案預覽連結（需檔案已共用給檢視者） */
export function googleDriveFileViewUrl(driveFileId: string | null | undefined): string | null {
  const id = String(driveFileId || "").trim();
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/view`;
}

/** Google Drive 內嵌預覽（部分情境比 /view 更適合 iframe，仍可能被 Drive 阻擋） */
export function googleDriveFilePreviewUrl(driveFileId: string | null | undefined): string | null {
  const id = String(driveFileId || "").trim();
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/preview`;
}

/** 從 Drive 分享／檢視網址解析 file id */
export function extractGoogleDriveFileId(url: string | null | undefined): string | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  const dMatch = raw.match(/\/file\/d\/([^/?#]+)/i);
  if (dMatch?.[1]) return dMatch[1];
  const idMatch = raw.match(/[?&]id=([^&]+)/i);
  if (idMatch?.[1]) return idMatch[1];
  return null;
}
