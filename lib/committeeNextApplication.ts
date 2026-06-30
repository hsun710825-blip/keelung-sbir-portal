import { loadMeetingApplications } from "@/lib/committeeMeetingApplications";
import type { ReviewMeetingDate } from "@/lib/reviewMeetingAgenda";

/** 依議程順序取得下一案 applicationId；若已是最後一案則回傳 null。 */
export async function findNextMeetingApplicationId(
  meetingDate: ReviewMeetingDate,
  currentApplicationId: string,
): Promise<string | null> {
  const rows = await loadMeetingApplications(meetingDate);
  const idx = rows.findIndex((row) => row.application.id === currentApplicationId);
  if (idx < 0 || idx >= rows.length - 1) return null;
  return rows[idx + 1].application.id;
}
