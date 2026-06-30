/** 決算清表計算（對應 115決算清表-0624.xlsx 公式） */

export function round0(n: number): number {
  return Math.round(n);
}

/** 建議補助：ROUND(申請總經費 × 補助比例係數, 0) */
export function computeSuggestedSubsidyFromTier(appliedTotal: number | null, tierRate: number | null): number | null {
  if (appliedTotal == null || tierRate == null) return null;
  if (!Number.isFinite(appliedTotal) || !Number.isFinite(tierRate)) return null;
  return round0(appliedTotal * tierRate);
}

/** 建議自籌：預設同申請自籌（=F） */
export function computeSuggestedSelfFund(
  appliedSelfFund: number | null,
  storedSuggested: number | null,
): number | null {
  if (storedSuggested != null) return storedSuggested;
  return appliedSelfFund;
}

/** 建議總經費：ROUND(建議補助+建議自籌, 0) */
export function computeSuggestedTotal(
  suggestedSubsidy: number | null,
  suggestedSelfFund: number | null,
  storedTotal: number | null,
): number | null {
  if (storedTotal != null) return storedTotal;
  if (suggestedSubsidy == null || suggestedSelfFund == null) return null;
  return round0(suggestedSubsidy + suggestedSelfFund);
}

/** 補助款比例 O = H/E */
export function computeAppliedSubsidyRatio(
  suggestedSubsidy: number | null,
  appliedSubsidy: number | null,
): number | null {
  if (suggestedSubsidy == null || appliedSubsidy == null || appliedSubsidy === 0) return null;
  return suggestedSubsidy / appliedSubsidy;
}

/** 總補助比例 P = H/J */
export function computeTotalSubsidyRatio(
  suggestedSubsidy: number | null,
  suggestedTotal: number | null,
): number | null {
  if (suggestedSubsidy == null || suggestedTotal == null || suggestedTotal === 0) return null;
  return suggestedSubsidy / suggestedTotal;
}

export function formatRatioPercent(ratio: number | null, digits = 1): string {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatTierRate(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return String(rate);
}

/** 依平均分對應補助比例係數（無手動 R 時匯出用） */
export function gradeRatioFromAvgScore(avgScore: number | null): number | null {
  if (avgScore == null || !Number.isFinite(avgScore)) return null;
  if (avgScore >= 90) return 0.45;
  if (avgScore >= 80) return 0.35;
  if (avgScore >= 70) return 0.21;
  return null;
}

export function resolveSuggestedFunding(input: {
  appliedSubsidy: number | null;
  appliedSelfFund: number | null;
  appliedTotal: number | null;
  tierRate: number | null;
  storedSuggestedSubsidy: number | null;
  storedSuggestedSelfFund: number | null;
  storedSuggestedTotal: number | null;
}) {
  let suggestedSubsidy = input.storedSuggestedSubsidy;
  if (suggestedSubsidy == null) {
    suggestedSubsidy = computeSuggestedSubsidyFromTier(input.appliedTotal, input.tierRate);
  }
  const suggestedSelfFund = computeSuggestedSelfFund(
    input.appliedSelfFund,
    input.storedSuggestedSelfFund,
  );
  const suggestedTotal = computeSuggestedTotal(
    suggestedSubsidy,
    suggestedSelfFund,
    input.storedSuggestedTotal,
  );
  return {
    suggestedSubsidy,
    suggestedSelfFund,
    suggestedTotal,
    subsidyGradeRatio: input.tierRate,
    subsidyRatio: computeAppliedSubsidyRatio(suggestedSubsidy, input.appliedSubsidy),
    totalSubsidyRatio: computeTotalSubsidyRatio(suggestedSubsidy, suggestedTotal),
  };
}
