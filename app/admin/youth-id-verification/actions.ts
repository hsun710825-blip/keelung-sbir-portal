"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";
import { isReviewerRole } from "@/lib/rbac";
import { savePoYouthPerson } from "@/lib/youthId/persistence";

export type SaveYouthVerificationState = { ok?: boolean; error?: string };

function parseQualifies(raw: string): boolean | null {
  if (raw === "yes") return true;
  if (raw === "no") return false;
  return null;
}

export async function saveYouthVerificationRowAction(
  _prev: SaveYouthVerificationState,
  formData: FormData,
): Promise<SaveYouthVerificationState> {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? null;
  if (!session?.user?.email || !isBackofficePrismaRole(role) || isReviewerRole(role)) {
    return { error: "無權限" };
  }

  const applicationId = String(formData.get("applicationId") ?? "").trim();
  if (!applicationId) return { error: "缺少 applicationId" };

  const personCount = parseInt(String(formData.get("personCount") ?? "0"), 10);
  if (!Number.isFinite(personCount) || personCount < 1) return { error: "負責人資料不完整" };

  try {
    for (let i = 0; i < personCount; i++) {
      const responsibleName = String(formData.get(`person_${i}_name`) ?? "").trim() || null;
      const registeredCity = String(formData.get(`person_${i}_city`) ?? "").trim() || null;
      const ageRaw = String(formData.get(`person_${i}_age`) ?? "").trim();
      const age = ageRaw ? parseInt(ageRaw, 10) : null;
      const qualifies = parseQualifies(String(formData.get(`person_${i}_qualifies`) ?? ""));
      const driveFileId = String(formData.get(`person_${i}_driveFileId`) ?? "").trim() || null;

      await savePoYouthPerson(applicationId, i, {
        responsibleName,
        registeredCity,
        age: Number.isFinite(age) ? age : null,
        qualifies,
        sourceDriveFileId: driveFileId,
      });
    }
    revalidatePath("/admin/youth-id-verification");
    revalidatePath(`/committee/application/${applicationId}`);
    return { ok: true };
  } catch (error) {
    console.error("[saveYouthVerificationRowAction]", error);
    return { error: "儲存失敗" };
  }
}
