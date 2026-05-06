import { getApplicationDeadlineMs, isPastApplicationDeadline } from "./applicationDeadline";

/**
 * 舊版「送件後另行鎖定」已廢止：編輯可否完全依徵件截止日（applicationDeadline，115 年公告至 5/15 23:59 台北）。
 * 保留以下 export 供可能的外部／舊引用；語意已等同「是否已逾徵件截止」。
 */
export function getSubmitLockEffectiveAtMs(): number {
  return getApplicationDeadlineMs();
}

/** @deprecated 請優先使用 isPastApplicationDeadline；語意：徵件截止後應鎖定編輯。 */
export function isSubmitLockScheduleActiveNow(): boolean {
  return isPastApplicationDeadline();
}
