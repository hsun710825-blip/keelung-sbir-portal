import { COMMITTEE_VISIBLE_APPLICATION_STATUSES } from "@/lib/committeeApplicationStatuses";
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
  const byOrder = new Map<number, MeetingAppRecord>();
  const extras: MeetingAppRecord[] = [];

  for (const app of apps) {
    if (app.reviewAgendaOrder != null) {
      byOrder.set(app.reviewAgendaOrder, app);
    } else {
      extras.push(app);
    }
  }

  const ordered = config.cases
    .map((c) => {
      const app = byOrder.get(c.order);
      if (!app) return null;
      const display = displayMap.get(app.id);
      const companyName = display?.companyName?.trim() || c.company;
      return {
        agendaOrder: c.order,
        agendaTime: c.time,
        application: app,
        companyName,
        agendaProject: c.project,
      };
    })
    .filter(Boolean) as MeetingApplicationRow[];

  for (const app of extras) {
    const display = displayMap.get(app.id);
    ordered.push({
      agendaOrder: app.reviewAgendaOrder ?? 999,
      agendaTime: "—",
      application: app,
      companyName: display?.companyName?.trim() || "—",
      agendaProject: app.title?.trim() || "—",
    });
  }

  ordered.sort((a, b) => a.agendaOrder - b.agendaOrder);
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
