/**
 * 依地址關鍵字比對 6 碼郵遞區號（精簡對照表，可再擴充）。
 * 比對採「由長到短」找最長符合的 鄉鎮市區 關鍵字。
 */

const ENTRIES: Array<{ key: string; zip: string }> = [
  { key: "基隆市仁愛區", zip: "200001" },
  { key: "基隆市信義區", zip: "201001" },
  { key: "基隆市中正區", zip: "202001" },
  { key: "基隆市中山區", zip: "203001" },
  { key: "基隆市安樂區", zip: "204001" },
  { key: "基隆市暖暖區", zip: "205001" },
  { key: "基隆市七堵區", zip: "206001" },
  { key: "台北市中正區", zip: "100001" },
  { key: "台北市大同區", zip: "103001" },
  { key: "台北市中山區", zip: "104001" },
  { key: "台北市松山區", zip: "105001" },
  { key: "台北市大安區", zip: "106001" },
  { key: "台北市萬華區", zip: "108001" },
  { key: "台北市信義區", zip: "110001" },
  { key: "台北市士林區", zip: "111001" },
  { key: "台北市北投區", zip: "112001" },
  { key: "台北市內湖區", zip: "114001" },
  { key: "台北市南港區", zip: "115001" },
  { key: "台北市文山區", zip: "116001" },
  { key: "新北市板橋區", zip: "220001" },
  { key: "新北市三重區", zip: "241001" },
  { key: "新北市中和區", zip: "235001" },
  { key: "新北市永和區", zip: "234001" },
  { key: "新北市新莊區", zip: "242001" },
  { key: "新北市新店區", zip: "231001" },
  { key: "新北市樹林區", zip: "238001" },
  { key: "新北市鶯歌區", zip: "239001" },
  { key: "新北市淡水區", zip: "251001" },
  { key: "新北市汐止區", zip: "221001" },
  { key: "新北市瑞芳區", zip: "224001" },
  { key: "桃園市桃園區", zip: "330001" },
  { key: "桃園市中壢區", zip: "320001" },
  { key: "桃園市平鎮區", zip: "324001" },
  { key: "桃園市八德區", zip: "334001" },
  { key: "桃園市楊梅區", zip: "326001" },
  { key: "桃園市蘆竹區", zip: "338001" },
  { key: "桃園市大園區", zip: "337001" },
  { key: "桃園市龜山區", zip: "333001" },
  { key: "桃園市龍潭區", zip: "325001" },
  { key: "新竹市東區", zip: "300001" },
  { key: "新竹市北區", zip: "300001" },
  { key: "新竹縣竹北市", zip: "302001" },
  { key: "苗栗縣苗栗市", zip: "360001" },
  { key: "台中市中區", zip: "400001" },
  { key: "台中市東區", zip: "401001" },
  { key: "台中市南區", zip: "402001" },
  { key: "台中市西區", zip: "403001" },
  { key: "台中市北區", zip: "404001" },
  { key: "台中市西屯區", zip: "407001" },
  { key: "台中市南屯區", zip: "408001" },
  { key: "台中市北屯區", zip: "406001" },
  { key: "彰化縣彰化市", zip: "500001" },
  { key: "南投縣南投市", zip: "540001" },
  { key: "雲林縣斗六市", zip: "640001" },
  { key: "嘉義市東區", zip: "600001" },
  { key: "嘉義縣太保市", zip: "612001" },
  { key: "台南市中西區", zip: "700001" },
  { key: "台南市東區", zip: "701001" },
  { key: "台南市南區", zip: "702001" },
  { key: "台南市北區", zip: "704001" },
  { key: "台南市安平區", zip: "708001" },
  { key: "台南市安南區", zip: "709001" },
  { key: "高雄市新興區", zip: "800001" },
  { key: "高雄市前金區", zip: "801001" },
  { key: "高雄市苓雅區", zip: "802001" },
  { key: "高雄市鹽埕區", zip: "803001" },
  { key: "高雄市鼓山區", zip: "804001" },
  { key: "高雄市前鎮區", zip: "806001" },
  { key: "高雄市三民區", zip: "807001" },
  { key: "高雄市左營區", zip: "813001" },
  { key: "高雄市楠梓區", zip: "811001" },
  { key: "高雄市小港區", zip: "812001" },
  { key: "屏東縣屏東市", zip: "900001" },
  { key: "宜蘭縣宜蘭市", zip: "260001" },
  { key: "花蓮縣花蓮市", zip: "970001" },
  { key: "台東縣台東市", zip: "950001" },
  { key: "澎湖縣馬公市", zip: "880001" },
  { key: "金門縣金城鎮", zip: "893001" },
  { key: "連江縣南竿鄉", zip: "209001" },
];

const SORTED = [...ENTRIES].sort((a, b) => b.key.length - a.key.length);

/** 若字首已有 3～6 位數字則視為已含郵遞區號 */
export function stripLeadingZip(text: string): string {
  return String(text || "").replace(/^\s*\d{3,6}\s*/, "").trim();
}

export function hasLeadingZip(text: string): boolean {
  return /^\s*\d{6}\b/.test(String(text || ""));
}

export function lookupZip6FromAddress(address: string): string | null {
  const raw = String(address || "").trim();
  if (!raw || hasLeadingZip(raw)) return null;
  const body = stripLeadingZip(raw);
  const compact = body.replace(/\s+/g, "");
  for (const { key, zip } of SORTED) {
    const k = key.replace(/\s+/g, "");
    if (compact.includes(k)) return zip;
  }
  return null;
}
