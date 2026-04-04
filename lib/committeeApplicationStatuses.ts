import { ApplicationStatus } from "@prisma/client";

/**
 * 委員總表可見：初審通過（PRE_REVIEW_PASSED）及之後審查／結案階段。
 */
export const COMMITTEE_VISIBLE_APPLICATION_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.PRE_REVIEW_PASSED,
  ApplicationStatus.COMMITTEE_REVIEW,
  ApplicationStatus.APPROVED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.CLOSED,
];

export function isCommitteeVisibleStatus(status: ApplicationStatus): boolean {
  return COMMITTEE_VISIBLE_APPLICATION_STATUSES.includes(status);
}
