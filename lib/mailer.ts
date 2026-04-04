import { formatTaipeiDateTimeMail } from "./taipeiTime";
import { createSmtpMailContext, escapeHtml, resolvePublicSiteUrl } from "./mail";

const LINE_OFFICIAL_URL = "https://lin.ee/PY8K7qG";

type SubmitMailInput = {
  to: string;
  projectName: string;
  /** ISO 字串；內文會轉成台北時間 YYYY-MM-DD HH:mm:ss */
  submittedAtIso: string;
};

function formatSubmitSuccessMail(input: SubmitMailInput) {
  const { to, projectName, submittedAtIso } = input;
  const planTitle = projectName || "未命名計畫";
  const sentAtDisplay = formatTaipeiDateTimeMail(submittedAtIso) || submittedAtIso;
  const portalUrl = resolvePublicSiteUrl();

  const subject = `【SBIR 系統通知】計畫書已成功送出：${planTitle}`;
  const lineText = `如有問題請聯繫《115基隆SBIR幫》Line官方帳號連結如右→ ${LINE_OFFICIAL_URL}`;
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
<p><a href="${safePortalUrl}" target="_blank" rel="noopener noreferrer">👉 點此登入基隆 SBIR 系統</a></p>
<p>此信件由系統自動寄出，請勿直接回覆。</p>
${lineHtml}
</body></html>`;

  return { subject, text, html };
}

export async function sendSubmitSuccessEmail(input: SubmitMailInput) {
  const { to } = input;
  if (!to) return;

  const { subject, text, html } = formatSubmitSuccessMail(input);
  const ctx = createSmtpMailContext();

  if (ctx.mode === "mock") {
    console.warn(
      "[mail:mock] 未設定 SMTP_HOST / SMTP_USER / SMTP_PASS，未實際寄信。請於部署環境設定後重新送件測試。",
    );
    console.log(
      "[mail:mock] submit success",
      JSON.stringify(
        {
          to,
          from: `${ctx.from.name} <${ctx.from.address}>`,
          subject,
          text,
        },
        null,
        2,
      ),
    );
    return;
  }

  await ctx.transporter.sendMail({
    from: ctx.from,
    to,
    subject,
    text,
    html,
  });
}
