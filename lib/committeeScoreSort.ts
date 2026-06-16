import type { CommitteeScoreBreakdown } from "@/lib/committeeScoringRubric";
import { BASE_SCORE_FIELDS, BONUS_SCORE_FIELDS } from "@/lib/committeeScoringRubric";

/** 同分時依權重由高至低比較各細項分數 */
const TIE_BREAK_KEYS: Array<keyof CommitteeScoreBreakdown> = [
  "methodology",
  "innovation",
  "teamAbility",
  "benefit",
  ...BONUS_SCORE_FIELDS.map((f) => f.key),
];

export function compareScoreBreakdownTieBreak(
  a: CommitteeScoreBreakdown | null,
  b: CommitteeScoreBreakdown | null,
): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  for (const key of TIE_BREAK_KEYS) {
    const diff = (b[key] ?? 0) - (a[key] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function compareByTotalThenBreakdown(input: {
  totalA: number;
  totalB: number;
  breakdownA: CommitteeScoreBreakdown | null;
  breakdownB: CommitteeScoreBreakdown | null;
}): number {
  const scoreDiff = input.totalB - input.totalA;
  if (scoreDiff !== 0) return scoreDiff;
  return compareScoreBreakdownTieBreak(input.breakdownA, input.breakdownB);
}

/** 序位加總愈小愈前；同序位時總分愈高愈前 */
export function compareByRankSumThenTotal(input: {
  rankSumA: number | null;
  rankSumB: number | null;
  totalA: number | null;
  totalB: number | null;
}): number {
  const a = input.rankSumA;
  const b = input.rankSumB;
  if (a == null && b == null) return (input.totalB ?? 0) - (input.totalA ?? 0);
  if (a == null) return 1;
  if (b == null) return -1;
  if (a !== b) return a - b;
  return (input.totalB ?? 0) - (input.totalA ?? 0);
}

export const TEMPLATE_COMMITTEE_MEMBER_NAMES = ["游國治", "陳柏琳", "嚴佳代"] as const;
