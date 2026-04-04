import type { ApplicationStatus } from "@prisma/client";
import { ApplicationStatus as AS } from "@prisma/client";

/** 退回補件狀態：Textarea placeholder */
export const REVISION_REQUIRED_PLACEHOLDER =
  "請詳細說明需補件或修改之文件與內容...";

/**
 * 依狀態帶入預設說明文字；回傳 null 表示不覆寫目前輸入（非範本狀態）。
 * REVISION_REQUIRED 回傳空字串，僅顯示 placeholder。
 */
export function defaultAdminRemarksForStatus(
  status: ApplicationStatus,
  planTitle: string,
): string | null {
  const t = planTitle.trim() || "（未命名計畫）";
  switch (status) {
    case AS.PRE_REVIEW_PASSED:
      return "恭喜通過初審，複審日期訂於O月O日，請於系統網址首頁下載簡報模板後製做，並於Ｏ月Ｏ日前上傳至系統。";
    case AS.REJECTED:
      return "很遺憾未能通過此次審查。主要原因與未來建議如下：\n1. ...";
    case AS.APPROVED:
      return `${t} 計畫已核定，計畫期程於OOO年OO月OO日至OOO年OO月OO日，請確實依核定計畫內容執行。`;
    case AS.REVISION_REQUIRED:
      return "";
    default:
      return null;
  }
}

export function statusUsesRemarkPlaceholder(status: ApplicationStatus): boolean {
  return status === AS.REVISION_REQUIRED;
}
