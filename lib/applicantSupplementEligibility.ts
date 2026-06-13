import { ApplicationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prismaRetry";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";

/** 視為「曾成功送件」的 Prisma Application 狀態（非 DRAFT） */
const SUBMITTED_OR_BEYOND: ApplicationStatus[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.UNDER_REVIEW,
  ApplicationStatus.COMMITTEE_REVIEW,
  ApplicationStatus.REVISE_REQUESTED,
  ApplicationStatus.REVISION_SUBMITTED,
  ApplicationStatus.REVISION_REQUIRED,
  ApplicationStatus.PRE_REVIEW_PASSED,
  ApplicationStatus.REVIEW_PASSED,
  ApplicationStatus.APPROVED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.CLOSED,
];

/**
 * 申請者是否至少有一筆已送件（含後續審查狀態）之 Application。
 * 僅查既有 Prisma，不變更 schema。
 */
export async function hasApplicantEverSubmitted(email: string): Promise<boolean> {
  const trimmed = email.trim();
  if (!trimmed) return false;

  return withPrismaRetry(async () => {
    const user = await prisma.user.findFirst({
      where: { email: { equals: trimmed, mode: "insensitive" } },
      select: { id: true },
    });
    if (!user) return false;

    const hit = await prisma.application.findFirst({
      where: {
        applicantUserId: user.id,
        status: { in: SUBMITTED_OR_BEYOND },
      },
      select: { id: true },
    });
    return Boolean(hit);
  });
}

/** 補件期內，一般申請者是否可進入撰寫／上傳（後台角色不受此限） */
export async function canApplicantAccessSupplementChannel(
  email: string,
  prismaRole: string | null | undefined,
): Promise<boolean> {
  if (isBackofficePrismaRole(prismaRole)) return true;
  return hasApplicantEverSubmitted(email);
}
