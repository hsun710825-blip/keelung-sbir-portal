import nodemailer from "nodemailer";

import { formatTaipeiDateTimeMail } from "./taipeiTime";

/** 寄件顯示名稱寫在程式碼中，避免 .env 內 UTF-8 經平台解析後造成收件端亂碼 */
const SMTP_FROM_NAME = "基隆SBIR系統自動發信通知";

const LINE_OFFICIAL_URL = "https://lin.ee/PY8K7qG";

type SubmitMailInput = {
  to: string;
  projectName: string;
  /** ISO 字串；內文會轉成台北時間 YYYY-MM-DD HH:mm:ss */
  submittedAtIso: string;
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatSubmitSuccessMail(input: SubmitMailInput) {
  const { to, projectName, submittedAtIso } = input;
  const planTitle = projectName || "未命名計畫";
  const sentAtDisplay = formatTaipeiDateTimeMail(submittedAtIso) || submittedAtIso;
  const portalUrl = String(
    process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      "https://keelungsbir.tw"
  ).trim();

  const subject = `【SBIR 系統通知】計畫書已成功送出：${planTitle}`;
  const lineText =
    `如有問題請聯繫《115基隆SBIR幫》Line官方帳號連結如右→ ${LINE_OFFICIAL_URL}`;
  const lineHtml = `<p>如有問題請聯繫《115基隆SBIR幫》Line官方帳號連結如右→ <a href="${LINE_OFFICIAL_URL}">${LINE_OFFICIAL_URL}</a></p>`;

  const text = [
    "您好，",
    "",
    "您的 SBIR 計畫書已完成送出，系統通知如下：",
    `- 申請帳號：${to}`,
    `- 計畫名稱：${planTitle}`,
    `- 送出時間：${sentAtDisplay}`,
    "- 計畫書檔案：為保護貴公司的商業機密與資訊安全，本通知信不夾帶實體檔案。請您隨時登入『基隆 SBIR 計畫申請系統』，於系統內檢視或下載完整的 PDF 計畫書。",
    `👉 點此登入基隆 SBIR 系統：${portalUrl}`,
    "",
    "此信件由系統自動寄出，請勿直接回覆。",
    "",
    lineText,
  ].join("\n");

  const safeTo = escapeHtml(to);
  const safePlan = escapeHtml(planTitle);
  const safeSent = escapeHtml(sentAtDisplay);
  const safePortalUrl = escapeHtml(portalUrl);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body style="font-family:sans-serif;line-height:1.6;color:#333;">
<p>您好，</p>
<p>您的 SBIR 計畫書已完成送出，系統通知如下：</p>
<ul>
<li>申請帳號：${safeTo}</li>
<li>計畫名稱：${safePlan}</li>
<li>送出時間：${safeSent}</li>
<li>計畫書檔案：為保護貴公司的商業機密與資訊安全，本通知信不夾帶實體檔案。請您隨時登入『基隆 SBIR 計畫申請系統』，於系統內檢視或下載完整的 PDF 計畫書。</li>
</ul>
<p><a href="${safePortalUrl}">👉 點此登入基隆 SBIR 系統</a></p>
<p>此信件由系統自動寄出，請勿直接回覆。</p>
${lineHtml}
</body></html>`;

  return { subject, text, html };
}

export async function sendSubmitSuccessEmail(input: SubmitMailInput) {
  const { to } = input;
  if (!to) return;

  const { subject, text, html } = formatSubmitSuccessMail(input);
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const address = String(user || "no-reply@localhost").trim();
  const from = { name: SMTP_FROM_NAME, address };
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  // 若未配置真實 SMTP，不會寄到信箱；僅在伺服器日誌輸出（Vercel → Functions → Logs）
  if (!host || !user || !pass) {
    console.warn(
      "[mail:mock] 未設定 SMTP_HOST / SMTP_USER / SMTP_PASS，未實際寄信。請於部署環境設定後重新送件測試。"
    );
    console.log(
      "[mail:mock] submit success",
      JSON.stringify(
        {
          to,
          from: `${from.name} <${from.address}>`,
          subject,
          text,
        },
        null,
        2
      )
    );
    return;
  }

  const isGmailHost = /^smtp\.(gmail|googlemail)\.com$/i.test(String(host).trim());

  const transporter = isGmailHost
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
        connectionTimeout: 25_000,
        greetingTimeout: 15_000,
        socketTimeout: 25_000,
      })
    : nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        ...(port === 587 && !secure ? { requireTLS: true } : {}),
        tls: { minVersion: "TLSv1.2" as const },
        connectionTimeout: 25_000,
        greetingTimeout: 15_000,
        socketTimeout: 25_000,
      });

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}
