import type { ReviewMeetingDate } from "@/lib/reviewMeetingAgenda";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";
import { prisma } from "@/lib/prisma";

export async function getOrCreateReviewSession(committeeId: string, meetingDate: ReviewMeetingDate) {
  await ensureEvaluationSchema();
  return prisma.committeeReviewSession.upsert({
    where: {
      committeeId_meetingDate: { committeeId, meetingDate },
    },
    create: { committeeId, meetingDate, status: "ACTIVE" },
    update: {},
  });
}

export async function listReviewSessionsForCommittee(
  committeeId: string,
  meetingDates: ReviewMeetingDate[],
) {
  await ensureEvaluationSchema();
  if (meetingDates.length === 0) return [];
  return prisma.committeeReviewSession.findMany({
    where: { committeeId, meetingDate: { in: meetingDates } },
    select: { meetingDate: true, status: true },
  });
}

export async function getMeetingLockMap(
  committeeId: string,
  meetingDates: ReviewMeetingDate[],
): Promise<Map<ReviewMeetingDate, boolean>> {
  await ensureEvaluationSchema();
  const out = new Map<ReviewMeetingDate, boolean>();
  for (const meetingDate of meetingDates) {
    out.set(meetingDate, false);
  }
  if (meetingDates.length === 0) return out;

  const sessions = await prisma.committeeReviewSession.findMany({
    where: { committeeId, meetingDate: { in: meetingDates } },
    select: { meetingDate: true, status: true },
  });
  for (const session of sessions) {
    const meetingDate = session.meetingDate as ReviewMeetingDate;
    out.set(
      meetingDate,
      String(session.status || "").toUpperCase() === "LOCKED_BY_PO",
    );
  }
  return out;
}

export async function isMeetingLockedForCommittee(
  committeeId: string,
  meetingDate: ReviewMeetingDate,
): Promise<boolean> {
  const lockMap = await getMeetingLockMap(committeeId, [meetingDate]);
  return lockMap.get(meetingDate) ?? false;
}
