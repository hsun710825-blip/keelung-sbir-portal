import { COMMITTEE_VISIBLE_APPLICATION_STATUSES } from "@/lib/committeeApplicationStatuses";
import { matchApplicationToAgenda } from "@/lib/matchApplicationToAgenda";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";
import { prisma } from "@/lib/prisma";
import {
  getReviewMeetingConfig,
  isAgendaJointProposal,
  type ReviewMeetingDate,
} from "@/lib/reviewMeetingAgenda";
import { resolveApplicationDisplayFieldsBatch } from "@/lib/resolveApplicationDisplayFields";
import { buildMeetingRowsForDate, type MeetingApplicationRow } from "@/lib/loadAllMeetingApplications";

export async function assignReviewMeetingsFromAgenda(): Promise<{
  matched: number;
  unmatched: string[];
}> {
  await ensureEvaluationSchema();
  const apps = await prisma.application.findMany({
    where: { status: { in: COMMITTEE_VISIBLE_APPLICATION_STATUSES } },
    select: { id: true, title: true, description: true, submissionMode: true, displayCompanyName: true },
  });

  const displayMap = await resolveApplicationDisplayFieldsBatch(
    apps.map((a) => ({ id: a.id, submissionMode: a.submissionMode, description: a.description, displayCompanyName: a.displayCompanyName ?? null })),
  );

  let matched = 0;
  const unmatched: string[] = [];

  for (const app of apps) {
    const companyName = displayMap.get(app.id)?.companyName || "";
    const hit = matchApplicationToAgenda({ title: app.title, companyName });
    if (!hit) {
      unmatched.push(app.title?.trim() || app.id);
      continue;
    }
    await prisma.application.update({
      where: { id: app.id },
      data: {
        reviewMeetingDate: hit.meetingDate,
        reviewAgendaOrder: hit.order,
        reviewProposalType: isAgendaJointProposal(hit.agendaCase) ? "JOINT" : "STANDARD",
      },
    });
    matched += 1;
  }

  return { matched, unmatched };
}

export async function loadMeetingApplications(meetingDate: ReviewMeetingDate): Promise<MeetingApplicationRow[]> {
  const apps = await prisma.application.findMany({
    where: {
      status: { in: COMMITTEE_VISIBLE_APPLICATION_STATUSES },
      reviewMeetingDate: meetingDate,
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

  return buildMeetingRowsForDate(meetingDate, apps, displayMap);
}
