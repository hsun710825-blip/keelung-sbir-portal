import fs from "node:fs";
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const TEMPLATE = new URL("../assets/templates/115年度SBIR-計畫書格式.pdf", import.meta.url);
const data = new Uint8Array(fs.readFileSync(TEMPLATE));
const doc = await pdfjs.getDocument({ data }).promise;

async function dumpPage(pageNum, predicate) {
  const page = await doc.getPage(pageNum);
  const tc = await page.getTextContent();
  const out = [];
  for (const it of tc.items) {
    const s = (it.str || "").trim();
    if (!s) continue;
    if (!predicate(s)) continue;
    const t = it.transform;
    out.push({ s, x: Math.round(t[4]), y: Math.round(t[5]) });
  }
  out.sort((a, b) => b.y - a.y || a.x - b.x);
  return out;
}

const keys = [
  "公司名稱",
  "負 責 人",
  "負",
  "責",
  "人",
  "中 華 民 國",
  "中",
  "華",
  "民",
  "國",
  "年",
  "月",
  "計 畫 期 間",
  "計",
  "畫",
  "期",
  "間",
  "自",
  "至",
  "止",
  "＜申請計畫名稱＞",
  "(共○個月)",
  "○",
  "□",
];

const hits = await dumpPage(1, (s) => keys.some((k) => s.includes(k)));
console.log(hits);

