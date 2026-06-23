import type { ApplicationStatus } from "@prisma/client";
import nodemailer from "nodemailer";

import { importantNoticeMailSubject } from "@/lib/importantNoticeMail";

/** 與 mailer.ts 一致，避免 .env UTF-8 在平台解析異常 */
export const SMTP_FROM_NAME = "基隆SBIR系統自動發信通知";

const LINE_OFFICIAL_URL = "https://lin.ee/PY8K7qG";

/** 正式站預設網址；環境變數缺失或無效時寄信按鈕仍須可點 */
const DEFAULT_PUBLIC_SITE_URL = "https://keelungsbir.tw";

/**
 * 寄信與伺服端共用的對外網站網址（絕對路徑、含 http(s)）。
 * - 依序嘗試 NEXT_PUBLIC_BASE_URL、NEXTAUTH_URL、VERCEL_URL（自動補 https://）
 * - 若變數為空白、僅空白字元或無法解析為 URL，則使用 {@link DEFAULT_PUBLIC_SITE_URL}
 */
export function resolvePublicSiteUrl(): string {
  const vercel = process.env.VERCEL_URL?.trim();
  const candidates: (string | undefined)[] = [
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.NEXTAUTH_URL,
    vercel ? `https://${vercel.replace(/^https?:\/\//i, "")}` : undefined,
  ];

  for (const raw of candidates) {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) continue;

    const withScheme = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/+/, "")}`;

    try {
      const u = new URL(withScheme);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      return u.toString();
    } catch {
      continue;
    }
  }

  return DEFAULT_PUBLIC_SITE_URL;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type SmtpMailContext =
  | { mode: "live"; transporter: nodemailer.Transporter; from: { name: string; address: string } }
  | { mode: "mock"; from: { name: string; address: string } };

/**
 * 建立 SMTP 傳送器；未設定完整 SMTP 時回傳 mock（僅 log，不實際寄出）。
 */
export function createSmtpMailContext(): SmtpMailContext {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const address = String(user || "no-reply@localhost").trim();
  const from = { name: SMTP_FROM_NAME, address };
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  if (!host || !user || !pass) {
    return { mode: "mock", from };
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

  return { mode: "live", transporter, from };
}

function portalBaseUrl(): string {
  return resolvePublicSiteUrl();
}

/** 退回補件（REVISION_REQUIRED）專用通知信 */
export const REVISION_REQUIRED_MAIL_SUBJECT =
  "【基隆市 SBIR系統通知】您的提案計畫退回需補件請速閱信件內容";

export const REVISION_REQUIRED_MAIL_INTRO = "您需補件如下說明";

export type StatusUpdateMailContentInput = {
  applicantDisplayName: string;
  planTitle: string;
  statusLabelZh: string;
  adminRemarksText: string;
  /** 僅更新 adminRemarks、狀態未變時使用不同主旨與開頭文案 */
  announcement: "status_changed" | "remarks_only";
  applicationStatus?: ApplicationStatus | string;
};

export type StatusUpdateMailInput = StatusUpdateMailContentInput & { to: string };

export type StatusUpdateMailBodies = {
  subject: string;
  html: string;
  text: string;
  /** 高重要性標頭（Outlook / Gmail 等顯示為重要郵件） */
  highPriority: boolean;
};

function isRevisionRequiredStatus(status: ApplicationStatus | string | undefined): boolean {
  return status === "REVISION_REQUIRED";
}

function isImportantNoticeStatus(status: ApplicationStatus | string | undefined): boolean {
  return status === "IMPORTANT_NOTICE";
}

export function buildStatusUpdateMailBodies(input: StatusUpdateMailContentInput): StatusUpdateMailBodies {
  const { applicantDisplayName, planTitle, statusLabelZh, adminRemarksText, announcement, applicationStatus } =
    input;
  const plan = planTitle.trim() || "未命名計畫";
  const name = applicantDisplayName.trim() || "申請者";
  const remarksBlock = adminRemarksText.trim() || "（管理員未留下額外說明）";
  const portalUrl = portalBaseUrl();
  const revisionRequiredMail = isRevisionRequiredStatus(applicationStatus);
  const importantNoticeMail = isImportantNoticeStatus(applicationStatus);

  const lineText = `如有問題請聯繫《115基隆SBIR幫》Line官方帳號：${LINE_OFFICIAL_URL}`;

  let subject: string;
  let leadText: string;
  let remarksHeading: string;

  if (importantNoticeMail) {
    subject = importantNoticeMailSubject(plan);
    leadText = "";
    remarksHeading = "";
  } else if (revisionRequiredMail) {
    subject = REVISION_REQUIRED_MAIL_SUBJECT;
    leadText =
      announcement === "remarks_only"
        ? `您的計畫「${plan}」目前為退回補件，${REVISION_REQUIRED_MAIL_INTRO}`
        : `您的計畫「${plan}」已退回補件，${REVISION_REQUIRED_MAIL_INTRO}`;
    remarksHeading = REVISION_REQUIRED_MAIL_INTRO;
  } else {
    subject =
      announcement === "remarks_only"
        ? `【基隆市 SBIR】計畫「${plan}」案件狀態已更新`
        : `【基隆市 SBIR】您的計畫書狀態已更新為：${statusLabelZh}`;
    leadText =
      announcement === "remarks_only"
        ? `您的計畫「${plan}」目前狀態仍為「${statusLabelZh}」，管理員已更新說明如下：`
        : `您的計畫「${plan}」狀態已更新為：${statusLabelZh}`;
    remarksHeading = "案件狀態說明";
  }

  const text = importantNoticeMail
    ? [
        remarksBlock,
        "",
        `登入系統：${portalUrl}`,
        "",
        "此信件由系統自動寄出，請勿直接回覆。",
        lineText,
      ].join("\n")
    : [
        `${name} 您好，`,
        "",
        leadText,
        "",
        `── ${remarksHeading} ──`,
        remarksBlock,
        "",
        `登入系統：${portalUrl}`,
        "",
        "此信件由系統自動寄出，請勿直接回覆。",
        lineText,
      ].join("\n");

  const safeName = escapeHtml(name);
  const safePlan = escapeHtml(plan);
  const safeStatus = escapeHtml(statusLabelZh);
  const safeRemarks = escapeHtml(remarksBlock);
  const safePortal = escapeHtml(portalUrl);
  const safeIntro = escapeHtml(REVISION_REQUIRED_MAIL_INTRO);
  const lineHtml = `<p>如有問題請聯繫《115基隆SBIR幫》Line官方帳號：<a href="${escapeHtml(LINE_OFFICIAL_URL)}">${escapeHtml(LINE_OFFICIAL_URL)}</a></p>`;

  const leadHtml = importantNoticeMail
    ? ""
    : revisionRequiredMail
    ? announcement === "remarks_only"
      ? `<p style="margin:0 0 8px;">您的計畫 <strong>${safePlan}</strong> 目前為<strong style="color:#b45309;">退回補件</strong>。</p>
<p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#b45309;">${safeIntro}</p>`
      : `<p style="margin:0 0 8px;">您的計畫 <strong>${safePlan}</strong> 已<strong style="color:#b45309;">退回補件</strong>。</p>
<p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#b45309;">${safeIntro}</p>`
    : announcement === "remarks_only"
      ? `<p style="margin:0 0 8px;">您的計畫 <strong>${safePlan}</strong> 目前狀態仍為：<strong style="color:#0369a1;">${safeStatus}</strong>，管理員已更新說明如下：</p>`
      : `<p style="margin:0 0 8px;">您的計畫 <strong>${safePlan}</strong> 狀態已更新為：<strong style="color:#0369a1;">${safeStatus}</strong></p>`;

  const remarksBoxTitle = importantNoticeMail
    ? ""
    : revisionRequiredMail
      ? safeIntro
      : "案件狀態說明";

  const remarksHtml = importantNoticeMail
    ? `<div style="margin:0;font-size:14px;color:#1e293b;white-space:pre-wrap;">${safeRemarks}</div>`
    : `<div style="margin-top:20px;padding:16px 18px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;">
<p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;">${remarksBoxTitle}</p>
<div style="margin:0;font-size:14px;color:#422006;white-space:pre-wrap;">${safeRemarks}</div>
</div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body style="font-family:'Noto Sans TC',sans-serif;line-height:1.65;color:#1e293b;background:#f8fafc;padding:24px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
<tr><td style="padding:20px 24px;background:linear-gradient(90deg,#0f172a,#1e3a5f);color:#fff;font-size:18px;font-weight:600;">基隆市 SBIR 計畫申請系統</td></tr>
<tr><td style="padding:24px;">
${importantNoticeMail ? "" : `<p style="margin:0 0 12px;">${safeName} 您好，</p>`}
${leadHtml}
${remarksHtml}
<p style="margin:24px 0 8px;"><a href="${safePortal}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;">前往系統首頁</a></p>
<p style="margin:0;font-size:12px;color:#64748b;">此信件由系統自動寄出，請勿直接回覆。</p>
${lineHtml}
</td></tr></table>
</body></html>`;

  return { subject, html, text, highPriority: revisionRequiredMail || importantNoticeMail };
}

export type StatusUpdateMailResult = {
  mock: boolean;
  messageId?: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * 狀態更新通知信（HTML + 純文字）。未設定 SMTP 時僅 console 模擬。
 */
export async function sendStatusUpdateEmail(input: StatusUpdateMailInput): Promise<StatusUpdateMailResult> {
  const { to } = input;
  if (!to?.trim()) {
    throw new Error("缺少收件人信箱");
  }

  const { subject, html, text, highPriority } = buildStatusUpdateMailBodies(input);
  const ctx = createSmtpMailContext();

  if (ctx.mode === "mock") {
    console.warn(
      "[mail] 未設定 SMTP_HOST / SMTP_USER / SMTP_PASS，狀態通知信未實際寄出（僅 log）。",
    );
    console.log(
      "[mail:mock] status update",
      JSON.stringify({ to, subject, text, highPriority }, null, 2),
    );
    return { mock: true, subject, html, text };
  }

  const info = await ctx.transporter.sendMail({
    from: ctx.from,
    to: to.trim(),
    subject,
    text,
    html,
    ...(highPriority
      ? {
          priority: "high" as const,
          headers: {
            Importance: "high",
            "X-Priority": "1",
            "X-MSMail-Priority": "High",
            Priority: "urgent",
          },
        }
      : {}),
  });

  return { mock: false, messageId: info.messageId, subject, html, text };
}
