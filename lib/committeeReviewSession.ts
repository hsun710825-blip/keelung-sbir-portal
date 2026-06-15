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

export async function isMeetingLockedForCommittee(
  committeeId: string,
  meetingDate: ReviewMeetingDate,
): Promise<boolean> {
  await ensureEvaluationSchema();
  const session = await prisma.committeeReviewSession.findUnique({
    where: { committeeId_meetingDate: { committeeId, meetingDate } },
    select: { status: true },
  });
  return String(session?.status || "").toUpperCase() === "LOCKED_BY_PO";
}
