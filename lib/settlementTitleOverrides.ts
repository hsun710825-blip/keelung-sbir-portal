import { normalizeCompanyDisplayName } from "@/lib/companyNameNormalize";

/** 決算清表專用計畫名稱覆寫（不影響委員介面、議程表、申請案件 title）。 */
const SETTLEMENT_TITLE_BY_COMPANY: Record<string, string> = {
  囍集有限公司: "智慧海況判讀與港灣數位服務平台建構計畫",
};

export function resolveSettlementDisplayTitle(input: {
  companyName: string;
  applicationTitle: string | null | undefined;
  agendaProject: string;
}): string {
  const companyKey = normalizeCompanyDisplayName(input.companyName) || input.companyName.trim();
  const override = SETTLEMENT_TITLE_BY_COMPANY[companyKey];
  if (override) return override;
  return input.applicationTitle?.trim() || input.agendaProject;
}
