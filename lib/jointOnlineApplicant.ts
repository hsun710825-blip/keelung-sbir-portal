import { normalizeEmailForCompare } from "@/lib/rbac";

/** 系統撰寫聯合案：僅這些帳號顯示「第二家公司／經費」區塊。 */
export const JOINT_ONLINE_APPLICANT_EMAILS = ["taxikeelung@gmail.com"] as const;

export function hasJointOnlineApplicantAccess(email: string | null | undefined): boolean {
  const key = normalizeEmailForCompare(email);
  if (!key) return false;
  return JOINT_ONLINE_APPLICANT_EMAILS.some((e) => normalizeEmailForCompare(e) === key);
}

export type JointSecondCompanyDraft = {
  companyName: string;
  leaderName: string;
  humanBudget?: unknown;
};

export function hasJointSecondCompanyData(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const rec = input as Record<string, unknown>;
  if (String(rec.companyName ?? "").trim() || String(rec.leaderName ?? "").trim()) return true;
  const hb = rec.humanBudget;
  if (!hb || typeof hb !== "object") return false;
  const profile = (hb as { piProfile?: { name?: unknown } }).piProfile;
  if (String(profile?.name ?? "").trim()) return true;
  const rows = Array.isArray((hb as { budgetRows?: unknown[] }).budgetRows)
    ? ((hb as { budgetRows: Array<{ gov?: unknown; self?: unknown }> }).budgetRows)
    : [];
  return rows.some((r) => String(r?.gov ?? "").replace(/[0,\s]/g, "") || String(r?.self ?? "").replace(/[0,\s]/g, ""));
}
