import { loadSettlementCommitteeConfig } from "@/lib/settlementConfig";

/** 決算清表正式委員顯示順序（A→B→C） */
export const PRIMARY_REVIEWER_DISPLAY_ORDER = ["陳柏琳", "嚴佳代", "游國治"] as const;

export const PRIMARY_REVIEWER_EMAILS = [
  "berlin.chen.taiwan@gmail.com",
  "hamrater@gmail.com",
  "yukuochih@gmail.com",
] as const;

export type ReviewerUserRef = {
  id: string;
  name: string | null;
  email: string;
};

function normalizeLabel(value: string): string {
  return String(value || "").replace(/\s+/g, "").trim().toLowerCase();
}

function isPrimaryReviewer(member: ReviewerUserRef, slotUserIds: Set<string>): boolean {
  if (slotUserIds.has(member.id)) return true;
  const email = normalizeLabel(member.email);
  if (PRIMARY_REVIEWER_EMAILS.some((e) => normalizeLabel(e) === email)) return true;
  const name = normalizeLabel(member.name || "");
  return PRIMARY_REVIEWER_DISPLAY_ORDER.some((n) => normalizeLabel(n) === name);
}

function primaryRank(member: ReviewerUserRef, slotOrder: string[]): number {
  const idx = slotOrder.indexOf(member.id);
  if (idx >= 0) return idx;

  const email = normalizeLabel(member.email);
  const emailOrder = PRIMARY_REVIEWER_EMAILS.findIndex((e) => normalizeLabel(e) === email);
  if (emailOrder >= 0) return emailOrder;

  const name = normalizeLabel(member.name || "");
  const nameOrder = PRIMARY_REVIEWER_DISPLAY_ORDER.findIndex((n) => normalizeLabel(n) === name);
  if (nameOrder >= 0) return nameOrder;

  return 999;
}

/** 審查進度監看：正式委員置前，其餘為測試委員 */
export async function partitionReviewProgressMembers<T extends ReviewerUserRef>(
  members: T[],
): Promise<{ primary: T[]; test: T[] }> {
  const config = await loadSettlementCommitteeConfig();
  const slotOrder = config.slots.map((s) => s.userId).filter(Boolean);
  const slotUserIds = new Set(slotOrder);

  const primary: T[] = [];
  const test: T[] = [];

  for (const member of members) {
    if (isPrimaryReviewer(member, slotUserIds)) primary.push(member);
    else test.push(member);
  }

  primary.sort((a, b) => primaryRank(a, slotOrder) - primaryRank(b, slotOrder));
  test.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "zh-Hant"));

  return { primary, test };
}
