/** Google Drive 檔案預覽連結（需檔案已共用給檢視者） */
export function googleDriveFileViewUrl(driveFileId: string | null | undefined): string | null {
  const id = String(driveFileId || "").trim();
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/view`;
}
