import { isPastApplicationDeadline } from "@/lib/applicationDeadline";
import { canApplicantAccessSupplementChannel } from "@/lib/applicantSupplementEligibility";
import { isWithinSupplementWindow } from "@/lib/supplementWindow";

/**
 * 申請者編輯是否應鎖定（授權／時效層）。
 * 保留原「逾徵件截止」邏輯；補件窗口內且曾送件者放行。
 */
export async function isApplicantEditLockedByPolicy(
  applicantEmail: string | null | undefined,
  prismaRole: string | null | undefined,
): Promise<boolean> {
  if (!isPastApplicationDeadline()) return false;
  if (!isWithinSupplementWindow()) return true;
  if (!applicantEmail?.trim()) return true;
  const allowed = await canApplicantAccessSupplementChannel(applicantEmail, prismaRole);
  return !allowed;
}
