/**
 * 115 年度 SBIR 徵件截止（台北時間，與機關公告一致）。
 * 前後端「是否已逾徵件截止」應以此為唯一依據，勿再依草稿 JSON 內舊的 expiresAt 鎖定。
 */
export const APPLICATION_DEADLINE_ISO = "2026-05-15T23:59:59+08:00";

export function getApplicationDeadlineMs(): number {
  return Date.parse(APPLICATION_DEADLINE_ISO);
}

/** 已超過徵件截止時間（截止前草稿與已送件皆可編輯；逾時後由 API／前端鎖定） */
export function isPastApplicationDeadline(nowMs: number = Date.now()): boolean {
  return nowMs > getApplicationDeadlineMs();
}
