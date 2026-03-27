/** 西元 yyyy-mm-dd ↔ 民國年 工具 */

export function isoDateToRocParts(iso: string): { rocY: number; month: number; day: number } | null {
  const s = String(iso || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const rocY = d.getFullYear() - 1911;
  if (rocY < 1) return null;
  return { rocY, month: d.getMonth() + 1, day: d.getDate() };
}

export function rocYmdToIso(rocY: number, month: number, day: number): string {
  const adY = rocY + 1911;
  return `${adY}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 民國O年O月O日 */
export function formatRocDateLongFromIso(iso: string): string {
  const p = isoDateToRocParts(iso);
  if (!p) return "";
  return `民國${p.rocY}年${p.month}月${p.day}日`;
}

/** 產生民國年選項：民國 50 年（1961）起至今年+1 */
export function rocYearOptions(): number[] {
  const max = new Date().getFullYear() - 1911 + 1;
  const min = 50;
  const list: number[] = [];
  for (let y = min; y <= max; y++) list.push(y);
  return list;
}
