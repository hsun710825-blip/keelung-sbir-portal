"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";
import { prisma } from "@/lib/prisma";
import { canOperateApplications } from "@/lib/rbac";
import {
  loadSettlementCommitteeConfig,
  saveSettlementCommitteeConfig,
  type SettlementCommitteeConfig,
} from "@/lib/settlementConfig";

export type SettlementActionState = { error?: string; message?: string };

export async function saveSettlementRowAction(
  _prev: SettlementActionState,
  formData: FormData,
): Promise<SettlementActionState> {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? null;
  if (!canOperateApplications(role)) return { error: "僅限管理員" };

  const applicationId = String(formData.get("applicationId") || "").trim();
  if (!applicationId) return { error: "缺少案件 ID" };

  const parseOptionalInt = (key: string) => {
    const t = String(formData.get(key) || "").trim();
    if (!t) return null;
    const n = parseInt(t, 10);
    return Number.isInteger(n) && n >= 0 ? n : null;
  };

  await ensureEvaluationSchema();

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      settlementSuggestedSubsidy: parseOptionalInt("suggestedSubsidy"),
      settlementSuggestedSelfFund: parseOptionalInt("suggestedSelfFund"),
      settlementSuggestedTotal: parseOptionalInt("suggestedTotal"),
    },
  });

  revalidatePath("/admin/settlement");
  return { message: "已儲存" };
}

export async function saveSettlementCommitteeConfigAction(
  _prev: SettlementActionState,
  formData: FormData,
): Promise<SettlementActionState> {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? null;
  if (!canOperateApplications(role)) return { error: "僅限管理員" };

  const current = await loadSettlementCommitteeConfig();
  const slots = current.slots.map((slot, i) => {
    const userId = String(formData.get(`slot${i}UserId`) || "").trim();
    const displayName = String(formData.get(`slot${i}DisplayName`) || "").trim();
    return {
      userId,
      displayName: displayName || slot.displayName,
    };
  }) as SettlementCommitteeConfig["slots"];

  await saveSettlementCommitteeConfig({ slots });
  revalidatePath("/admin/settlement");
  return { message: "委員設定已儲存" };
}
