import { isPastApplicationDeadline } from "@/lib/applicationDeadline";
import { hasApplicantRevisionAccess } from "@/lib/applicantRevisionAllowlistCore";
import { isWithinApplicantRevisionWindow } from "@/lib/applicantRevisionWindow";
import { canApplicantAccessSupplementChannel } from "@/lib/applicantSupplementEligibility";
import { isWithinSupplementWindow } from "@/lib/supplementWindow";

/**
 * 申請者編輯是否應鎖定（授權／時效層）。
 * - 徵件截止前：不鎖
 * - 補件窗口內且曾送件：放行
 * - 修改開放窗口內且白名單：放行
 * - 其餘逾截止：鎖定
 */
export async function isApplicantEditLockedByPolicy(
  applicantEmail: string | null | undefined,
  prismaRole: string | null | undefined,
): Promise<boolean> {
  if (!isPastApplicationDeadline()) return false;

  if (isWithinSupplementWindow()) {
    if (!applicantEmail?.trim()) return true;
    const allowed = await canApplicantAccessSupplementChannel(applicantEmail, prismaRole);
    return !allowed;
  }

  if (isWithinApplicantRevisionWindow()) {
    if (!applicantEmail?.trim()) return true;
    return !hasApplicantRevisionAccess(applicantEmail, prismaRole);
  }

  return true;
}
