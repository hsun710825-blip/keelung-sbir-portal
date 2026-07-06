import { ApplicationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";
import { withPrismaRetry } from "@/lib/prismaRetry";

/** 複審階段：僅 COMMITTEE_REVIEW 申請者可登入申請人入口 */
export async function hasApplicantCommitteeReviewAccess(
  email: string,
  prismaRole: string | null | undefined,
): Promise<boolean> {
  if (isBackofficePrismaRole(prismaRole)) return true;

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
        status: ApplicationStatus.COMMITTEE_REVIEW,
      },
      select: { id: true },
    });
    return Boolean(hit);
  });
}
