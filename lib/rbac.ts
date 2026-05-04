import type { Role } from "@prisma/client";

/** 程式強制為 SUPER_ADMIN 的 Google 帳號（不分大小寫） */
export const SUPER_ADMIN_EMAIL_FORCED = "52828plus@gmail.com";

export function normalizeEmailForCompare(email: string | null | undefined): string {
  return String(email || "").trim().toLowerCase();
}

export function isBackofficeRole(role: string | Role | null | undefined): boolean {
  const r = String(role || "");
  return r === "SUPER_ADMIN" || r === "ADMIN" || r === "GOV" || r === "REVIEWER" || r === "COMMITTEE";
}

export function isReviewerRole(role: string | Role | null | undefined): boolean {
  const r = String(role || "");
  return r === "REVIEWER" || r === "COMMITTEE";
}

export function isSuperAdminRole(role: string | Role | null | undefined): boolean {
  return String(role || "") === "SUPER_ADMIN";
}

export function isPoStaffRole(role: string | Role | null | undefined): boolean {
  return String(role || "") === "ADMIN";
}

export function isGovReadOnlyRole(role: string | Role | null | undefined): boolean {
  return String(role || "") === "GOV";
}

/** 後台可變更案件狀態／刪除／補件等營運動作 */
export function canOperateApplications(role: string | Role | null | undefined): boolean {
  return isSuperAdminRole(role) || isPoStaffRole(role);
}

export function canManageBackofficeAccounts(role: string | Role | null | undefined): boolean {
  return isSuperAdminRole(role);
}

export function roleDisplayLabel(role: Role | string | null | undefined): string {
  const r = String(role || "");
  if (r === "SUPER_ADMIN") return "管理員";
  if (r === "ADMIN") return "PO人員";
  if (r === "GOV") return "市府人員";
  if (r === "REVIEWER" || r === "COMMITTEE") return "審查委員";
  if (r === "USER") return "一般使用者";
  return r || "—";
}
