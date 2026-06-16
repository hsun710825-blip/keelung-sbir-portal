import { REVIEW_MEETING_DATES } from "@/lib/reviewMeetingAgenda";
import { loadMeetingApplications } from "@/lib/committeeMeetingApplications";

export async function loadAllMeetingApplications() {
  const chunks = await Promise.all(REVIEW_MEETING_DATES.map((d) => loadMeetingApplications(d)));
  return chunks.flat();
}
