/** 公司名稱顯示正規化（已知錯字修正） */
export function normalizeCompanyDisplayName(name: string | null | undefined): string {
  const raw = String(name || "").trim();
  if (!raw) return "";
  return raw.replace(/浚沿/g, "浚研");
}

export function normalizeCompanyForMatch(name: string): string {
  return normalizeCompanyDisplayName(name)
    .replace(/\(主提案\)/g, "")
    .split("/")[0]
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}
