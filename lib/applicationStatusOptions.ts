import type { ApplicationStatus } from "@prisma/client";
import { ApplicationStatus as AS } from "@prisma/client";

/** 下拉選單顯示順序 */
export const APPLICATION_STATUS_OPTIONS: ApplicationStatus[] = [
  AS.DRAFT,
  AS.SUBMITTED,
  AS.UNDER_REVIEW,
  AS.COMMITTEE_REVIEW,
  AS.REVISE_REQUESTED,
  AS.REVISION_SUBMITTED,
  AS.REVISION_REQUIRED,
  AS.PRE_REVIEW_PASSED,
  AS.APPROVED,
  AS.REJECTED,
  AS.CLOSED,
];

export function isApplicationStatusString(v: string): v is ApplicationStatus {
  return (APPLICATION_STATUS_OPTIONS as string[]).includes(v);
}
