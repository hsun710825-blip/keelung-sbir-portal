/**
 * 115 複審後修改開放窗口（台北時間）。
 * 白名單申請者可登入、編輯表單／草稿、送出與重新上傳計畫書。
 */
export const APPLICANT_REVISION_WINDOW_START_ISO = "2026-07-28T00:00:00+08:00";
export const APPLICANT_REVISION_WINDOW_END_ISO = "2026-08-06T23:59:59+08:00";

export function getApplicantRevisionWindowStartMs(): number {
  return Date.parse(APPLICANT_REVISION_WINDOW_START_ISO);
}

export function getApplicantRevisionWindowEndMs(): number {
  return Date.parse(APPLICANT_REVISION_WINDOW_END_ISO);
}

/** 目前是否處於修改開放期（含起訖瞬間） */
export function isWithinApplicantRevisionWindow(nowMs: number = Date.now()): boolean {
  return nowMs >= getApplicantRevisionWindowStartMs() && nowMs <= getApplicantRevisionWindowEndMs();
}
