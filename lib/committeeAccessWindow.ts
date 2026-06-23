import { normalizeEmailForCompare } from "@/lib/rbac";

/** 115 複審：指定委員開放窗口（台北時間）。 */
export const COMMITTEE_ACCESS_OPEN_START_ISO = "2026-07-01T06:00:00+08:00";
export const COMMITTEE_ACCESS_OPEN_END_ISO = "2026-07-01T17:00:00+08:00";

export const RESTRICTED_COMMITTEE_EMAILS = [
  "berlin.chen.taiwan@gmail.com",
  "hamrater@gmail.com",
  "yukuochih@gmail.com",
] as const;

const RESTRICTED_EMAIL_SET = new Set(
  RESTRICTED_COMMITTEE_EMAILS.map((e) => normalizeEmailForCompare(e)),
);

export function isRestrictedCommitteeEmail(email: string | null | undefined): boolean {
  const em = normalizeEmailForCompare(email);
  return em.length > 0 && RESTRICTED_EMAIL_SET.has(em);
}

export function getCommitteeAccessOpenStartMs(): number {
  return Date.parse(COMMITTEE_ACCESS_OPEN_START_ISO);
}

export function getCommitteeAccessOpenEndMs(): number {
  return Date.parse(COMMITTEE_ACCESS_OPEN_END_ISO);
}

/** 指定委員是否處於開放審查時段（含起訖瞬間）。 */
export function isRestrictedCommitteeAccessOpen(nowMs: number = Date.now()): boolean {
  return nowMs >= getCommitteeAccessOpenStartMs() && nowMs <= getCommitteeAccessOpenEndMs();
}

/** 指定委員是否應被時間鎖定（非名單內委員一律 false）。 */
export function isRestrictedCommitteeLocked(
  email: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!isRestrictedCommitteeEmail(email)) return false;
  return !isRestrictedCommitteeAccessOpen(nowMs);
}

export const COMMITTEE_ACCESS_LOCKED_PATH = "/auth/committee-access-locked";

export function isCommitteeAccessLockedPath(path: string): boolean {
  return path === COMMITTEE_ACCESS_LOCKED_PATH || path.startsWith(`${COMMITTEE_ACCESS_LOCKED_PATH}/`);
}
