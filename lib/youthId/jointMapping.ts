import { youthCompanyCoreMatch, splitSettlementCompanyNames } from "@/lib/youthId/companyMatch";

/** 聯合提案：決算清表僅顯示主公司名時，第二家試算表公司名 */
const JOINT_SECOND_SHEET_BY_PRIMARY: Array<{ primary: string; second: string; titleHint?: string }> = [
  { primary: "海格創藝有限公司", second: "嘿路島民工作室", titleHint: "八斗" },
];

export function resolveJointSheetCompanyTargets(
  settlementCompanyName: string,
  planTitle: string,
  isJoint: boolean,
): string[] {
  if (!isJoint) {
    const single = splitSettlementCompanyNames(settlementCompanyName);
    return single.length > 0 ? single : [settlementCompanyName];
  }

  const segments = splitSettlementCompanyNames(settlementCompanyName);
  if (segments.length >= 2) return segments;

  const main = segments[0] || settlementCompanyName;
  for (const rule of JOINT_SECOND_SHEET_BY_PRIMARY) {
    if (!youthCompanyCoreMatch(main, rule.primary)) continue;
    if (rule.titleHint && !planTitle.includes(rule.titleHint)) continue;
    return [main, rule.second];
  }
  return [main];
}
