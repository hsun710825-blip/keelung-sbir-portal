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

export async function assignReviewMeetingsFromAgenda(): Promise<{
  matched: number;
  unmatched: string[];
}> {
  await ensureEvaluationSchema();
  const apps = await prisma.application.findMany({
    where: { status: { in: COMMITTEE_VISIBLE_APPLICATION_STATUSES } },
    select: { id: true, title: true, description: true, submissionMode: true },
  });

  const displayMap = await resolveApplicationDisplayFieldsBatch(
    apps.map((a) => ({ id: a.id, submissionMode: a.submissionMode, description: a.description })),
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

export async function loadMeetingApplications(meetingDate: ReviewMeetingDate) {
  const config = getReviewMeetingConfig(meetingDate);
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
    })),
  );

  const byOrder = new Map<number, (typeof apps)[number]>();
  const extras: typeof apps = [];

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
    .filter(Boolean) as Array<{
    agendaOrder: number;
    agendaTime: string;
    application: (typeof apps)[number];
    companyName: string;
    agendaProject: string;
  }>;

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
