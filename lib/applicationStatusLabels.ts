import type { ApplicationStatus } from "@prisma/client";

const LABELS: Record<ApplicationStatus, string> = {
  DRAFT: "草稿",
  SUBMITTED: "已送件",
  UNDER_REVIEW: "形式審查中",
  COMMITTEE_REVIEW: "審查中",
  REVISE_REQUESTED: "待補件／修訂",
  REVISION_SUBMITTED: "已補件送審",
  REVISION_REQUIRED: "退回補件",
  PRE_REVIEW_PASSED: "初審通過",
  REVIEW_PASSED: "審查通過",
  APPROVED: "已核定",
  REJECTED: "未通過",
  CLOSED: "結案",
};

export function applicationStatusLabel(status: ApplicationStatus): string {
  return LABELS[status] ?? status;
}
