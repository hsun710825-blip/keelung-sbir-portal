import type { CommitteeScoreBreakdown } from "@/lib/committeeScoringRubric";
import { parseScoresJson } from "@/lib/committeeScoringRubric";
import { compareByTotalThenBreakdown } from "@/lib/committeeScoreSort";
import { loadAllMeetingApplications } from "@/lib/loadAllMeetingApplications";
import { sessionStatusLabel } from "@/lib/committeeScoringRubric";
import { getOrCreateReviewSession, isMeetingLockedForCommittee } from "@/lib/committeeReviewSession";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";
import { prisma } from "@/lib/prisma";
import { REVIEW_MEETING_DATES } from "@/lib/reviewMeetingAgenda";

export type CombinedPersonalScoreRow = {
  applicationId: string;
  title: string;
  companyName: string;
  meetingDate: string;
  agendaOrder: number;
  isJoint: boolean;
  totalScore: number;
  rank: number | null;
  status: string;
  comment: string | null;
  breakdown: CommitteeScoreBreakdown | null;
};

function isJointApp(reviewProposalType: string | null | undefined): boolean {
  return String(reviewProposalType || "").toUpperCase() === "JOINT";
}

function sortAndRankRows(rows: CombinedPersonalScoreRow[]): CombinedPersonalScoreRow[] {
  const sorted = [...rows].sort((a, b) =>
    compareByTotalThenBreakdown({
      totalA: a.totalScore,
      totalB: b.totalScore,
      breakdownA: a.breakdown,
      breakdownB: b.breakdown,
    }),
  );
  sorted.forEach((row, idx) => {
    row.rank = idx + 1;
  });
  return sorted;
}

export async function loadCombinedCommitteePersonalScores(committeeId: string) {
  await ensureEvaluationSchema();

  const [allApps, evaluations, sessions, locked0622, locked0701] = await Promise.all([
    loadAllMeetingApplications(),
    prisma.evaluation.findMany({
      where: { committeeId },
      select: {
        applicationId: true,
        score: true,
        status: true,
        comment: true,
        rank: true,
        scoresJson: true,
        meetingDate: true,
      },
    }),
    Promise.all(REVIEW_MEETING_DATES.map((d) => getOrCreateReviewSession(committeeId, d))),
    isMeetingLockedForCommittee(committeeId, "0622"),
    isMeetingLockedForCommittee(committeeId, "0701"),
  ]);

  const anyLocked = locked0622 || locked0701;
  const evalByApp = new Map(evaluations.map((e) => [e.applicationId, e]));

  const regular: CombinedPersonalScoreRow[] = [];
  const joint: CombinedPersonalScoreRow[] = [];

  for (const row of allApps) {
    const ev = evalByApp.get(row.application.id);
    if (!ev) continue;
    const jointCase = isJointApp(row.application.reviewProposalType);
    const item: CombinedPersonalScoreRow = {
      applicationId: row.application.id,
      title: row.application.title?.trim() || row.agendaProject,
      companyName: row.companyName,
      meetingDate: row.application.reviewMeetingDate || "",
      agendaOrder: row.agendaOrder,
      isJoint: jointCase,
      totalScore: ev.score,
      rank: null,
      status: anyLocked ? "LOCKED" : ev.status,
      comment: ev.comment,
      breakdown: parseScoresJson(ev.scoresJson),
    };
    if (jointCase) joint.push(item);
    else regular.push(item);
  }

  const regularRows = sortAndRankRows(regular);
  const jointRows = sortAndRankRows(joint);

  const allScored = [...regularRows, ...jointRows];
  if (allScored.length > 0) {
    await Promise.all(
      allScored.map((row) =>
        prisma.evaluation.updateMany({
          where: { committeeId, applicationId: row.applicationId },
          data: { rank: row.rank },
        }),
      ),
    );
  }

  const sessionLabels = sessions.map((s) => sessionStatusLabel(s.status)).join(" / ");

  return {
    regularRows,
    jointRows,
    sessionStatus: sessionLabels,
    canEdit: !anyLocked,
    totalCases: allApps.length,
    scoredCount: allScored.length,
  };
}

export async function loadReviewProgressForAdmin(meetingDate: import("@/lib/reviewMeetingAgenda").ReviewMeetingDate) {
  const { Role } = await import("@prisma/client");
  const { loadMeetingApplications } = await import("@/lib/committeeMeetingApplications");
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
