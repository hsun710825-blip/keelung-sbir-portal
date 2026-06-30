import { normalizeCompanyDisplayName } from "@/lib/companyNameNormalize";

const SUFFIX_RE =
  /(股份有限公司|有限公司|事業有限公司|企業有限公司|有限責任公司|企業社|工作室|工作坊|咖啡店|專賣店|設計屋|食品行|設計有限公司)$/g;

/** 比對用核心字串（試算表簡稱 ↔ 決算清表全名） */
export function normalizeYouthCompanyCore(name: string): string {
  let s = normalizeCompanyDisplayName(name)
    .replace(/\(主提案\)/g, "")
    .trim();
  s = s.replace(SUFFIX_RE, "");
  s = s.replace(/服務業/g, "服務");
  return s.replace(/\s+/g, "").toLowerCase();
}

export function splitSettlementCompanyNames(companyName: string): string[] {
  const raw = normalizeCompanyDisplayName(companyName).trim();
  if (!raw.includes("/")) return [raw];
  return raw
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function youthCompanyCoreMatch(a: string, b: string): boolean {
  const ca = normalizeYouthCompanyCore(a);
  const cb = normalizeYouthCompanyCore(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  const shorter = ca.length <= cb.length ? ca : cb;
  const longer = ca.length > cb.length ? ca : cb;
  if (shorter.length >= 3 && longer.includes(shorter)) return true;
  return false;
}

export function findSheetRowForCompanyName<T extends { companyName: string }>(
  target: string,
  rows: T[],
  used: Set<T>,
): T | null {
  for (const row of rows) {
    if (used.has(row)) continue;
    if (youthCompanyCoreMatch(target, row.companyName)) {
      return row;
    }
  }
  return null;
}
