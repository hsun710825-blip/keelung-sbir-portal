import { Role } from "@prisma/client";

import type { PersonalScoreRow } from "@/components/committee/CommitteePersonalScoreTable";
import { loadMeetingApplications } from "@/lib/committeeMeetingApplications";
import { sessionStatusLabel } from "@/lib/committeeScoringRubric";
import { getOrCreateReviewSession, isMeetingLockedForCommittee } from "@/lib/committeeReviewSession";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";
import { prisma } from "@/lib/prisma";
import type { ReviewMeetingDate } from "@/lib/reviewMeetingAgenda";

export async function loadCommitteePersonalScores(committeeId: string, meetingDate: ReviewMeetingDate) {
  await ensureEvaluationSchema();

  const [meetingApps, evaluations, session, locked] = await Promise.all([
    loadMeetingApplications(meetingDate),
    prisma.evaluation.findMany({
      where: { committeeId, meetingDate },
      select: {
        applicationId: true,
        score: true,
        status: true,
        comment: true,
        rank: true,
      },
    }),
    getOrCreateReviewSession(committeeId, meetingDate),
    isMeetingLockedForCommittee(committeeId, meetingDate),
  ]);

  const evalByApp = new Map(evaluations.map((e) => [e.applicationId, e]));

  const scored: PersonalScoreRow[] = meetingApps
    .map((row) => {
      const ev = evalByApp.get(row.application.id);
      if (!ev) return null;
      return {
        applicationId: row.application.id,
        title: row.application.title?.trim() || row.agendaProject,
        companyName: row.companyName,
        totalScore: ev.score,
        rank: null as number | null,
        status: locked ? "LOCKED" : ev.status,
        comment: ev.comment,
      };
    })
    .filter(Boolean) as PersonalScoreRow[];

  scored.sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
  scored.forEach((row, idx) => {
    row.rank = idx + 1;
  });

  if (scored.length > 0) {
    await Promise.all(
      scored.map((row) =>
        prisma.evaluation.updateMany({
          where: { committeeId, applicationId: row.applicationId },
          data: { rank: row.rank },
        }),
      ),
    );
  }

  return {
    rows: scored,
    sessionStatus: sessionStatusLabel(session.status),
    canEdit: !locked,
    totalCases: meetingApps.length,
    scoredCount: scored.length,
  };
}

export async function loadReviewProgressForAdmin(meetingDate: ReviewMeetingDate) {
  await ensureEvaluationSchema();

  const [committeeMembers, meetingApps, evaluations, sessions] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: [Role.REVIEWER, Role.COMMITTEE] } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    loadMeetingApplications(meetingDate),
    prisma.evaluation.findMany({
      where: { meetingDate },
      select: {
        applicationId: true,
        committeeId: true,
        score: true,
        status: true,
        comment: true,
      },
    }),
    prisma.committeeReviewSession.findMany({
      where: { meetingDate },
      select: {
        committeeId: true,
        status: true,
        submittedAt: true,
        lockedAt: true,
      },
    }),
  ]);

  const sessionByCommittee = new Map(sessions.map((s) => [s.committeeId, s]));
  const evalMap = new Map<string, (typeof evaluations)[number]>();
  for (const ev of evaluations) {
    evalMap.set(`${ev.committeeId}:${ev.applicationId}`, ev);
  }

  return {
    committeeMembers,
    meetingApps,
    sessionByCommittee,
    evalMap,
    totalCases: meetingApps.length,
  };
}
