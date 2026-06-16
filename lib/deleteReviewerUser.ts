import { prisma } from "@/lib/prisma";
import { isReviewerRole, normalizeEmailForCompare, SUPER_ADMIN_EMAIL_FORCED } from "@/lib/rbac";
import {
  loadSettlementCommitteeConfig,
  saveSettlementCommitteeConfig,
  type SettlementCommitteeConfig,
} from "@/lib/settlementConfig";

async function clearSettlementSlotsForUserId(userId: string): Promise<void> {
  const config = await loadSettlementCommitteeConfig();
  let changed = false;
  const slots = config.slots.map((slot) => {
    if (slot.userId !== userId) return slot;
    changed = true;
    return { ...slot, userId: "" };
  }) as SettlementCommitteeConfig["slots"];
  if (changed) {
    await saveSettlementCommitteeConfig({ slots });
  }
}

export async function deleteReviewerUserById(
  userId: string,
  operatorUserId: string,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      email: true,
      _count: { select: { applications: true } },
    },
  });

  if (!target) {
    return { ok: false, error: "找不到使用者" };
  }
  if (!isReviewerRole(target.role)) {
    return { ok: false, error: "僅可刪除審查委員帳號" };
  }
  if (normalizeEmailForCompare(target.email) === normalizeEmailForCompare(SUPER_ADMIN_EMAIL_FORCED)) {
    return { ok: false, error: "不可刪除受保護帳號" };
  }
  if (target.id === operatorUserId) {
    return { ok: false, error: "不可刪除自己的帳號" };
  }
  if (target._count.applications > 0) {
    return { ok: false, error: "此帳號仍有申請案件，無法刪除" };
  }

  await prisma.$transaction([
    prisma.evaluation.deleteMany({ where: { committeeId: userId } }),
    prisma.applicationScore.deleteMany({ where: { committeeUserId: userId } }),
    prisma.committeeReviewSession.deleteMany({ where: { committeeId: userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  await clearSettlementSlotsForUserId(userId);

  return { ok: true, email: target.email };
}

export async function clearReviewerScoresByEmails(
  emails: string[],
): Promise<{ deletedEvaluations: number; deletedApplicationScores: number; users: string[] }> {
  const normalized = emails.map((e) => normalizeEmailForCompare(e)).filter(Boolean);
  const users = await prisma.user.findMany({
    where: {
      OR: normalized.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })),
    },
    select: { id: true, email: true },
  });

  if (users.length === 0) {
    return { deletedEvaluations: 0, deletedApplicationScores: 0, users: [] };
  }

  const userIds = users.map((u) => u.id);
  const [evaluations, scores] = await prisma.$transaction([
    prisma.evaluation.deleteMany({ where: { committeeId: { in: userIds } } }),
    prisma.applicationScore.deleteMany({ where: { committeeUserId: { in: userIds } } }),
  ]);

  return {
    deletedEvaluations: evaluations.count,
    deletedApplicationScores: scores.count,
    users: users.map((u) => u.email),
  };
}
