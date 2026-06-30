import { COMMITTEE_VISIBLE_APPLICATION_STATUSES } from "@/lib/committeeApplicationStatuses";
import { resolveAgendaPlacement } from "@/lib/agendaMatchedApplication";
import { prisma } from "@/lib/prisma";
import {
  getReviewMeetingConfig,
  REVIEW_MEETING_DATES,
  type ReviewMeetingDate,
} from "@/lib/reviewMeetingAgenda";
import { resolveApplicationDisplayFieldsBatch } from "@/lib/resolveApplicationDisplayFields";

type MeetingAppRecord = Awaited<ReturnType<typeof prisma.application.findMany>>[number] & {
  applicant: { name: string | null; email: string };
};

export type MeetingApplicationRow = {
  agendaOrder: number;
  agendaTime: string;
  application: MeetingAppRecord;
  companyName: string;
  agendaProject: string;
};

export function buildMeetingRowsForDate(
  meetingDate: ReviewMeetingDate,
  apps: MeetingAppRecord[],
  displayMap: Map<string, { companyName: string }>,
): MeetingApplicationRow[] {
  const config = getReviewMeetingConfig(meetingDate);
  const ordered: MeetingApplicationRow[] = [];

  for (const c of config.cases) {
    const app =
      apps.find(
        (candidate) =>
          candidate.reviewMeetingDate === meetingDate && candidate.reviewAgendaOrder === c.order,
      ) ??
      apps.find((candidate) => {
        const companyName = displayMap.get(candidate.id)?.companyName?.trim() || "";
        const placement = resolveAgendaPlacement({
          title: candidate.title,
          companyName,
        });
        return placement?.meetingDate === meetingDate && placement.agendaOrder === c.order;
      });
    if (!app) continue;

    const display = displayMap.get(app.id);
    const companyName = display?.companyName?.trim() || c.company;
    ordered.push({
      agendaOrder: c.order,
      agendaTime: c.time,
      application: app,
      companyName,
      agendaProject: c.project,
    });
  }

  return ordered;
}

export async function loadAllMeetingApplications(): Promise<MeetingApplicationRow[]> {
  const apps = await prisma.application.findMany({
    where: {
      status: { in: COMMITTEE_VISIBLE_APPLICATION_STATUSES },
      reviewMeetingDate: { in: [...REVIEW_MEETING_DATES] },
    },
    include: {
      applicant: { select: { name: true, email: true } },
    },
  });

  const displayMap = await resolveApplicationDisplayFieldsBatch(
    apps.map((a) => ({
      id: a.id,
      submissionMode: a.submissionMode,
      description: a.description,
      displayCompanyName: a.displayCompanyName,
    })),
  );

  const out: MeetingApplicationRow[] = [];
  for (const meetingDate of REVIEW_MEETING_DATES) {
    const meetingApps = apps.filter((app) => app.reviewMeetingDate === meetingDate);
    out.push(...buildMeetingRowsForDate(meetingDate, meetingApps, displayMap));
  }
  return out;
}
