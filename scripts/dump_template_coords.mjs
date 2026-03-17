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
    const [a, b, c, d, e, f] = it.transform;
    out.push({ s, x: Math.round(e), y: Math.round(f) });
  }
  out.sort((p, q) => q.y - p.y || p.x - q.x);
  return out;
}

console.log("pages", doc.numPages);

// Page 4 in PDF is pageNum=4 (1-indexed)
const keys = [
  "公司名稱",
  "設立日期",
  "統一編號",
  "聯絡電話",
  "傳真號碼",
  "負責人",
  "身分證字號",
  "出生年月日",
  "實收資本額",
  "主要營業項目",
  "股票上市狀況",
  "前一年度營業額",
  "員工人數",
  "公司登記地址",
  "通訊地址",
  "研發成果",
  "獲得獎項",
];

const page4 = await dumpPage(4, (s) => keys.some((k) => s.includes(k)) || ["□", "上市", "上櫃", "公開發行", "未公開發行"].includes(s));
console.log("\n-- page 4 hits --");
console.log(page4);

// Page 5: 公司營運及財務狀況
const keys5 = [
  "主要服務",
  "銷售通路",
  "經營狀況",
  "金額單位",
  "申請人主要",
  "產品/服務項目",
  "民國",
  "產量",
  "銷售額",
  "市場占有率",
  "合 計",
  "年度營業額",
  "年度研發費用",
  "(B)/(A)",
];
const page5 = await dumpPage(5, (s) => keys5.some((k) => s.includes(k)));
console.log("\n-- page 5 hits --");
console.log(page5);

// Page 6: 曾經參與政府相關研發計畫之實績
const keys6 = [
  "近3年",
  "核定日期",
  "計畫類別",
  "計畫名稱",
  "計畫執行期間",
  "年度",
  "年度計畫經費",
  "政府",
  "補助",
  "款",
  "計畫",
  "總經",
  "費",
  "計畫人",
  "年數",
  "本年度",
  "主辦",
  "單位",
];
const page6 = await dumpPage(6, (s) => keys6.some((k) => s.includes(k)));
console.log("\n-- page 6 hits --");
console.log(page6.slice(0, 160));

// Page 7-9: 貳、計畫內容與實施方式
const keys7 = [
  "貳",
  "計畫內容與實施方式",
  "背景",
  "說明",
  "國內外",
  "產業現況",
  "發展趨勢",
  "競爭力",
  "分析",
  "創新性",
  "計畫架構",
  "樹枝圖",
  "實施方式",
  "技術移轉",
  "智慧財產權",
  "委託研究",
  "委託勞務",
];
for (const p of [7, 8, 9]) {
  const hits = await dumpPage(p, (s) => keys7.some((k) => s.includes(k)) || s === "□");
  console.log(`\n-- page ${p} hits --`);
  console.log(hits.slice(0, 220));
}

// Page 10: 參、預期效益
const keys10 = ["參", "預期效益", "量化", "非量化", "對公司", "對產業", "增加產值", "投入研發", "促成投資", "降低成本"];
const page10 = await dumpPage(10, (s) => keys10.some((k) => s.includes(k)));
console.log("\n-- page 10 hits --");
console.log(page10.slice(0, 220));

// Page 11: 肆、預定進度及查核點
const keys11 = ["肆", "預定進度", "查核點", "預定進度表", "計畫權重", "預定投入人月", "月份"];
const page11 = await dumpPage(11, (s) => keys11.some((k) => s.includes(k)) || s === "□");
console.log("\n-- page 11 hits --");
console.log(page11.slice(0, 260));

// Page 12-13: 伍、人力及經費需求表
const keys12 = ["伍", "人力", "經費", "需求表", "總表", "政府補助款", "自籌款", "合計", "百分比", "經費需求總表"];
for (const p of [12, 13]) {
  const hits = await dumpPage(p, (s) => keys12.some((k) => s.includes(k)) || s === "□");
  console.log(`\n-- page ${p} hits --`);
  console.log(hits.slice(0, 260));
}

// Find where "核定日期" appears (past projects table)
const findNeedles = ["核定日期", "近3年曾經參與政府其他相關計畫", "本年度欲申請政府其他相關計畫"];
console.log("\n-- find needles --");
for (let p = 1; p <= doc.numPages; p++) {
  const hits = await dumpPage(p, (s) => findNeedles.some((k) => s.includes(k)));
  if (hits.length) console.log({ page: p, hits });
}

