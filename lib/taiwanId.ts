/** 台灣身分證字號檢核（依專案指定演算法） */
export function checkTaiwanNationalId(id: string): boolean {
  const trimmed = String(id || "").trim().toUpperCase();
  const pattern = /^[A-Z]{1}[1-2]{1}[0-9]{8}$/;
  if (!pattern.test(trimmed)) return false;
  const city = "ABCDEFGHJKLMNPQRSTUVXYWZIO";
  const cityCode = city.indexOf(trimmed[0]!) + 10;
  const a1 = Math.floor(cityCode / 10);
  const a2 = cityCode % 10;
  const n = trimmed.substring(1).split("").map(Number);
  const sum =
    a1 +
    a2 * 9 +
    n[0]! * 8 +
    n[1]! * 7 +
    n[2]! * 6 +
    n[3]! * 5 +
    n[4]! * 4 +
    n[5]! * 3 +
    n[6]! * 2 +
    n[7]! * 1 +
    n[8]! * 1;
  return sum % 10 === 0;
}

export const MOBILE_TW_PATTERN = /^09\d{8}$/;
