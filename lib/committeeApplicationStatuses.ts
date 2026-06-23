import { ApplicationStatus } from "@prisma/client";

/**
 * 委員／決算清表／審查場次可見狀態。
 * IMPORTANT_NOTICE：已寄簡報異動等重要通知，審查流程仍進行中，須維持可評分與清表可見。
 */
export const COMMITTEE_VISIBLE_APPLICATION_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.PRE_REVIEW_PASSED,
  ApplicationStatus.COMMITTEE_REVIEW,
  ApplicationStatus.IMPORTANT_NOTICE,
  ApplicationStatus.APPROVED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.CLOSED,
];

export function isCommitteeVisibleStatus(status: ApplicationStatus): boolean {
  return COMMITTEE_VISIBLE_APPLICATION_STATUSES.includes(status);
}
