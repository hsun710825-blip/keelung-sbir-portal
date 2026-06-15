import type { ApplicationStatus } from "@prisma/client";
import { ApplicationStatus as AS } from "@prisma/client";

import { applicationStatusLabel } from "@/lib/applicationStatusLabels";

/** 總表篩選「審查中」：含形式審查與委員審查階段 */
export const ADMIN_REVIEW_IN_PROGRESS_STATUSES: ApplicationStatus[] = [
  AS.UNDER_REVIEW,
  AS.COMMITTEE_REVIEW,
];

/** 案件總表「案件狀態」篩選（含全部與複合「審查中」） */
export type AdminCaseListStatusFilter = "ALL" | "REVIEW_IN_PROGRESS" | ApplicationStatus;

export const ADMIN_CASE_LIST_STATUS_FILTER_OPTIONS: {
  value: AdminCaseListStatusFilter;
  label: string;
}[] = [
  { value: "ALL", label: "全部" },
  { value: AS.DRAFT, label: "草稿中（DRAFT）" },
  { value: AS.SUBMITTED, label: "已送出（SUBMITTED）" },
  { value: AS.PRE_REVIEW_PASSED, label: "初審通過（PRE_REVIEW_PASSED）" },
  { value: "REVIEW_IN_PROGRESS", label: "審查中" },
  { value: AS.REVIEW_PASSED, label: "審查通過（REVIEW_PASSED）" },
  { value: AS.APPROVED, label: "已核定（APPROVED）" },
  { value: AS.CLOSED, label: "結案（CLOSED）" },
];

/** 案件詳情「案件狀態」下拉選項（完整狀態機） */
export const APPLICATION_STATUS_OPTIONS: ApplicationStatus[] = [
  AS.DRAFT,
  AS.SUBMITTED,
  AS.UNDER_REVIEW,
  AS.REVISION_REQUIRED,
  AS.REVISE_REQUESTED,
  AS.REVISION_SUBMITTED,
  AS.PRE_REVIEW_PASSED,
  AS.COMMITTEE_REVIEW,
  AS.REVIEW_PASSED,
  AS.APPROVED,
  AS.REJECTED,
  AS.CLOSED,
];

export function applicationStatusOptionLabel(status: ApplicationStatus): string {
  return `${applicationStatusLabel(status)} (${status})`;
}

export function isApplicationStatusString(v: string): v is ApplicationStatus {
  return (APPLICATION_STATUS_OPTIONS as string[]).includes(v);
}

export function matchesAdminCaseListStatusFilter(
  status: ApplicationStatus,
  filter: AdminCaseListStatusFilter,
): boolean {
  if (filter === "ALL") return true;
  if (filter === "REVIEW_IN_PROGRESS") {
    return ADMIN_REVIEW_IN_PROGRESS_STATUSES.includes(status);
  }
  return status === filter;
}
