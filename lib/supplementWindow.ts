/**
 * 115 年度補件開放窗口（台北時間）。
 * 僅在此區間內啟用「曾送件申請者」登入與編輯放行邏輯。
 */
export const SUPPLEMENT_WINDOW_START_ISO = "2026-05-20T00:00:00+08:00";
export const SUPPLEMENT_WINDOW_END_ISO = "2026-05-27T23:59:59+08:00";

export function getSupplementWindowStartMs(): number {
  return Date.parse(SUPPLEMENT_WINDOW_START_ISO);
}

export function getSupplementWindowEndMs(): number {
  return Date.parse(SUPPLEMENT_WINDOW_END_ISO);
}

/** 目前是否處於補件開放期（含起訖瞬間） */
export function isWithinSupplementWindow(nowMs: number = Date.now()): boolean {
  return nowMs >= getSupplementWindowStartMs() && nowMs <= getSupplementWindowEndMs();
}
