import allowlistData from "@/lib/data/applicantRevisionAllowlist.json";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";
import { isWithinApplicantRevisionWindow } from "@/lib/applicantRevisionWindow";
import { normalizeEmailForCompare } from "@/lib/rbac";
import { sanitizeProjectNameForFolder } from "@/lib/serverSecurity";

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

/** CSV First Name 全文去掉指定後綴後作為公司簡稱 */
export function companyShortNameFromAllowlist(companyName: string): string {
  return String(companyName || "")
    .replace(/股份有限公司/g, "")
    .replace(/有限公司/g, "")
    .replace(/專賣店/g, "")
    .replace(/企業社/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeNameSegment(raw: string): string {
  return sanitizeProjectNameForFolder(raw)
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/g, "")
    .slice(0, 80);
}

/** 檔名：公司簡稱-計畫名稱-修改版.pdf */
export function buildApplicantRevisionProposalFileName(input: {
  companyName: string;
  projectName: string | null | undefined;
}): string {
  const short = sanitizeNameSegment(companyShortNameFromAllowlist(input.companyName)) || "未命名公司";
  const plan = sanitizeNameSegment(input.projectName || "") || "未命名計畫";
  return `${short}-${plan}-修改版.pdf`;
}

/**
 * 修改開放期：白名單申請者可登入並編輯／上傳。
 * 後台角色一律 true；窗口外或非白名單為 false。
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
