/**
 * 將遷移時寫入的 description（多行「鍵：值」）解析為物件，供詳細頁顯示。
 */
export function parseKeyValueDescription(description: string | null | undefined): Record<string, string> {
  const raw = String(description || "").trim();
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^([^:：]+)[:：]\s*(.+)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}
