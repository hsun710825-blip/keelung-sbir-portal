import {
  APPLICANT_REVISION_AUG13_SUBFOLDER_NAME,
  APPLICANT_REVISION_UPLOAD_FOLDER_ID,
  DEEP_REVIEW_REFS_FOLDER_ID,
  DEEP_REVIEW_REFS_FOLDER_NAME,
  findApplicantRevisionAllowlistEntry,
  getApplicantRevisionAllowlist,
  hasApplicantRevisionAccess,
  isApplicantRevisionAllowlisted,
  type ApplicantRevisionAllowlistEntry,
} from "@/lib/applicantRevisionAllowlistCore";
import { sanitizeProjectNameForFolder } from "@/lib/serverSecurity";

export type { ApplicantRevisionAllowlistEntry };
export {
  APPLICANT_REVISION_AUG13_SUBFOLDER_NAME,
  APPLICANT_REVISION_UPLOAD_FOLDER_ID,
  DEEP_REVIEW_REFS_FOLDER_ID,
  DEEP_REVIEW_REFS_FOLDER_NAME,
  findApplicantRevisionAllowlistEntry,
  getApplicantRevisionAllowlist,
  hasApplicantRevisionAccess,
  isApplicantRevisionAllowlisted,
};

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
