import allowlistData from "@/lib/data/applicantRevisionAllowlist.json";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";
import { isWithinApplicantRevisionWindow } from "@/lib/applicantRevisionWindow";
import { normalizeEmailForCompare } from "@/lib/rbac";

export type ApplicantRevisionAllowlistEntry = {
  companyName: string;
  email: string;
};

const ENTRIES = allowlistData as ApplicantRevisionAllowlistEntry[];

const BY_EMAIL = new Map(
  ENTRIES.map((e) => [normalizeEmailForCompare(e.email), e] as const),
);

/** 重新上傳計畫書目標資料夾（修改版專用） */
export const APPLICANT_REVISION_UPLOAD_FOLDER_ID = "1M6EzztAjjv7DyHgnTndK8f0-iHE7SsGQ";

export function getApplicantRevisionAllowlist(): ApplicantRevisionAllowlistEntry[] {
  return ENTRIES;
}

export function findApplicantRevisionAllowlistEntry(
  email: string | null | undefined,
): ApplicantRevisionAllowlistEntry | null {
  const key = normalizeEmailForCompare(email);
  if (!key) return null;
  return BY_EMAIL.get(key) ?? null;
}

export function isApplicantRevisionAllowlisted(email: string | null | undefined): boolean {
  return findApplicantRevisionAllowlistEntry(email) != null;
}

/**
 * 修改開放期：白名單申請者可登入並編輯／上傳。
 * 後台角色一律 true；窗口外或非白名單為 false。
 * （Edge-safe：供 middleware 即時重算，不依賴可能過期的 JWT 旗標）
 */
export function hasApplicantRevisionAccess(
  email: string,
  prismaRole: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (isBackofficePrismaRole(prismaRole)) return true;
  if (!isWithinApplicantRevisionWindow(nowMs)) return false;
  return isApplicantRevisionAllowlisted(email);
}
