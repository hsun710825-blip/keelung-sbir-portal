/**
 * 修改版計畫書上傳成功後，推播給專案辦公室手機（LINE Messaging API）。
 * 失敗只記 log，不影響業者上傳結果。
 */

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
export const REVISION_UPLOAD_FOLDER_URL =
  "https://drive.google.com/drive/folders/1XrBEtsRrtIbmhNoY7ov0E2gDhsHN52l7";

export type RevisionUploadNotifyInput = {
  companyName: string;
  projectName: string;
  fileName: string;
  fileUrl?: string;
  applicantEmail?: string;
  mode?: "UPLOAD" | "ONLINE";
};

function taipeiNow(): string {
  return new Date().toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });
}

export async function pushLineToPo(text: string): Promise<boolean> {
  const token = String(process.env.LINE_CHANNEL_ACCESS_TOKEN || "").trim();
  const userId = String(process.env.LINE_NOTIFY_USER_ID || "").trim();
  if (!token || !userId) {
    console.warn("[poRevisionUploadNotify] LINE 環境變數未設定，略過推播。");
    return false;
  }

  const res = await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text: text.slice(0, 4900) }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(
      `[poRevisionUploadNotify] LINE 推播失敗 (${res.status}): ${body.slice(0, 300)}`,
    );
    return false;
  }
  return true;
}

function buildText(input: RevisionUploadNotifyInput): string {
  const lines = [
    "【基隆SBIR】業者已上傳修改版計畫書",
    "",
    `公司：${input.companyName || "（未填）"}`,
    `計畫：${input.projectName || "（未填）"}`,
    `檔名：${input.fileName || "（未填）"}`,
    `方式：${input.mode === "ONLINE" ? "系統線上撰寫送出" : "上傳 PDF"}`,
    `時間：${taipeiNow()}`,
  ];
  if (input.applicantEmail) lines.push(`帳號：${input.applicantEmail}`);
  if (input.fileUrl) lines.push(`檔案：${input.fileUrl}`);
  lines.push(`資料夾：${REVISION_UPLOAD_FOLDER_URL}`);
  return lines.join("\n");
}

export async function notifyPoRevisionUploaded(input: RevisionUploadNotifyInput): Promise<void> {
  await pushLineToPo(buildText(input));
}

/** 上傳成功後呼叫；內部捕捉錯誤，不拋出。 */
export function notifyPoRevisionUploadedSafe(input: RevisionUploadNotifyInput): void {
  void notifyPoRevisionUploaded(input).catch((err) => {
    console.warn(
      "[poRevisionUploadNotify] LINE 推播例外:",
      err instanceof Error ? err.message : String(err),
    );
  });
}
