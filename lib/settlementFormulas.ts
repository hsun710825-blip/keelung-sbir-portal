/** 決算清表計算（對應 115決算清表-0624.xlsx 公式） */

export function round0(n: number): number {
  return Math.round(n);
}

/** 經費欄位：有小數四捨五入為整數（千円） */
export function roundFunding(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return round0(value);
}

/** 建議補助：ROUND(申請總經費 × 補助比例係數, 0) */
export function computeSuggestedSubsidyFromTier(
  appliedTotal: number | null,
  tierRate: number | null,
): number | null {
  if (appliedTotal == null || tierRate == null) return null;
  if (!Number.isFinite(appliedTotal) || !Number.isFinite(tierRate)) return null;
  return round0(appliedTotal * tierRate);
}

/** 建議自籌：預設同申請自籌（=F） */
export function computeSuggestedSelfFund(appliedSelfFund: number | null): number | null {
  return roundFunding(appliedSelfFund);
}

/** 建議總經費：ROUND(建議補助+建議自籌, 0) */
export function computeSuggestedTotal(
  suggestedSubsidy: number | null,
  suggestedSelfFund: number | null,
): number | null {
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

/** Excel 0% 格式：整數百分比 */
export function formatRatioPercent(ratio: number | null): string {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  return `${Math.round(ratio * 100)}%`;
}

export function formatTierRatePercent(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function formatFundingAmount(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(roundFunding(value));
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
  const appliedSubsidy = roundFunding(input.appliedSubsidy);
  const appliedSelfFund = roundFunding(input.appliedSelfFund);
  const appliedTotal =
    roundFunding(input.appliedTotal) ??
    (appliedSubsidy != null && appliedSelfFund != null
      ? round0(appliedSubsidy + appliedSelfFund)
      : null);

  const tierRate = input.tierRate;
  let suggestedSubsidy = roundFunding(input.storedSuggestedSubsidy);
  if (suggestedSubsidy == null && tierRate != null) {
    suggestedSubsidy = computeSuggestedSubsidyFromTier(appliedTotal, tierRate);
  }
  let suggestedSelfFund = roundFunding(input.storedSuggestedSelfFund);
  if (suggestedSelfFund == null) {
    suggestedSelfFund = computeSuggestedSelfFund(appliedSelfFund);
  }
  let suggestedTotal = roundFunding(input.storedSuggestedTotal);
  if (suggestedTotal == null) {
    suggestedTotal = computeSuggestedTotal(suggestedSubsidy, suggestedSelfFund);
  }

  return {
    appliedSubsidy,
    appliedSelfFund,
    appliedTotal,
    suggestedSubsidy,
    suggestedSelfFund,
    suggestedTotal,
    subsidyGradeRatio: tierRate,
    subsidyRatio: computeAppliedSubsidyRatio(suggestedSubsidy, appliedSubsidy),
    totalSubsidyRatio: computeTotalSubsidyRatio(suggestedSubsidy, suggestedTotal),
  };
}

/** 儲存前：依公式重算建議經費（四捨五入） */
export function computeSettlementSavePayload(input: {
  appliedSubsidy: number | null;
  appliedSelfFund: number | null;
  appliedTotal: number | null;
  tierRate: number | null;
}) {
  const funding = resolveSuggestedFunding({
    ...input,
    storedSuggestedSubsidy: null,
    storedSuggestedSelfFund: null,
    storedSuggestedTotal: null,
  });
  return {
    settlementAppliedSubsidy: funding.appliedSubsidy,
    settlementAppliedSelfFund: funding.appliedSelfFund,
    settlementAppliedTotal: funding.appliedTotal,
    settlementSuggestedSubsidy: funding.suggestedSubsidy,
    settlementSuggestedSelfFund: funding.suggestedSelfFund,
    settlementSuggestedTotal: funding.suggestedTotal,
    settlementSubsidyTierRate: input.tierRate,
  };
}
