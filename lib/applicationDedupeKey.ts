/**
 * 後台案件列表排重：同一 Email + 語意上相同計畫名稱視為同一組。
 * 全形空白等會先正規化，再轉小寫、壓縮空白。
 */
export function normalizePlanTitleForDedupe(raw: string): string {
  let s = String(raw || "")
    .replace(/\u3000/g, " ")
    .trim()
    .toLowerCase();
  s = s.replace(/\s+/g, " ");
  return s;
}
