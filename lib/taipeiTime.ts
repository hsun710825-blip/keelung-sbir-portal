/** 前端顯示用：一律以台灣時區（Asia/Taipei）格式化，避免 Vercel / Node 預設 UTC 造成錯覺。 */

export const ASIA_TAIPEI = "Asia/Taipei";

function safeDate(input: Date | string | number): Date | null {
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 例如：2026/03/30 12:34:56（24 小時制，台北時間） */
export function formatTaipeiDateTime(input: Date | string | number): string {
  const d = safeDate(input);
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ASIA_TAIPEI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const m = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  return `${m("year")}/${m("month")}/${m("day")} ${m("hour")}:${m("minute")}:${m("second")}`;
}

/** 系統通知信內文用：`YYYY-MM-DD HH:mm:ss`（Asia/Taipei） */
export function formatTaipeiDateTimeMail(input: Date | string | number): string {
  const d = safeDate(input);
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ASIA_TAIPEI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const m = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  return `${m("year")}-${m("month")}-${m("day")} ${m("hour")}:${m("minute")}:${m("second")}`;
}

/** 僅時分秒，用於「已儲存草稿 (hh:mm:ss)」 */
export function formatTaipeiTimeOnly(input: Date | string | number = new Date()): string {
  const d = safeDate(input);
  if (!d) return "";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: ASIA_TAIPEI,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * 草稿載入時 submittedAt 可能為後端寫入的 ISO 字串（UTC）或先前前端的本地字串；
 * 能解析成 Date 者一律改以台北時間顯示。
 */
export function formatSubmittedAtForDisplay(raw: string | undefined | null): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const s = String(raw).trim();
  const d = safeDate(s);
  if (d) return formatTaipeiDateTime(d);
  return s;
}

/** 版權年份等：與台北日曆年一致（利於 SSR/CSR 對齊） */
export function getTaipeiFullYear(now: Date = new Date()): number {
  const y = new Intl.DateTimeFormat("en-US", {
    timeZone: ASIA_TAIPEI,
    year: "numeric",
  })
    .formatToParts(now)
    .find((p) => p.type === "year")?.value;
  return y ? parseInt(y, 10) : now.getUTCFullYear();
}
