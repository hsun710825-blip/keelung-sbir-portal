import agendaData from "@/lib/data/reviewMeetingAgenda.json";

export type ReviewMeetingDate = "0622" | "0701";

export type AgendaCase = {
  order: number;
  time: string;
  company: string;
  pi: string;
  project: string;
};

export type ReviewMeetingConfig = {
  label: string;
  dateLabel: string;
  cases: AgendaCase[];
};

const AGENDA = agendaData as Record<ReviewMeetingDate, ReviewMeetingConfig>;

export const REVIEW_MEETING_DATES: ReviewMeetingDate[] = ["0622", "0701"];

export function isReviewMeetingDate(value: string): value is ReviewMeetingDate {
  return value === "0622" || value === "0701";
}

export function getReviewMeetingConfig(date: ReviewMeetingDate): ReviewMeetingConfig {
  return AGENDA[date];
}

export function getAllAgendaCases(): Array<AgendaCase & { meetingDate: ReviewMeetingDate }> {
  const out: Array<AgendaCase & { meetingDate: ReviewMeetingDate }> = [];
  for (const meetingDate of REVIEW_MEETING_DATES) {
    for (const c of AGENDA[meetingDate].cases) {
      out.push({ ...c, meetingDate });
    }
  }
  return out;
}

export function reviewMeetingDateLabel(date: ReviewMeetingDate): string {
  return AGENDA[date].label;
}

export function reviewMeetingAdminLabel(date: ReviewMeetingDate): string {
  return AGENDA[date].dateLabel;
}
