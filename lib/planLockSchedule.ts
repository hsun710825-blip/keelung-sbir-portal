/**
 * 送件後「鎖定編輯」排程（固定，不允許環境變數覆寫）：
 * 2026/05/05 00:00:00（台灣時間）起，submitted 才鎖定；
 * 在 2026/05/04 23:59:59 前一律不因 submitted 鎖定。
 */
const SUBMIT_LOCK_AT_FIXED = "2026-05-05T00:00:00+08:00";

export function getSubmitLockEffectiveAtMs(): number {
  return Date.parse(SUBMIT_LOCK_AT_FIXED);
}

/** 目前已達「送件後鎖定」生效時間（僅影響 submitted 狀態，不影響刪除／過期鎖定） */
export function isSubmitLockScheduleActiveNow(): boolean {
  return Date.now() >= getSubmitLockEffectiveAtMs();
}
