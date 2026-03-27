import fs from "node:fs";
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const TEMPLATE = new URL("../assets/templates/115年度SBIR-計畫書格式.pdf", import.meta.url);
const data = new Uint8Array(fs.readFileSync(TEMPLATE));
const doc = await pdfjs.getDocument({ data }).promise;

async function dumpPage(pageNum, needles) {
  const page = await doc.getPage(pageNum);
  const tc = await page.getTextContent();
  const out = [];
  for (const it of tc.items) {
    const s = (it.str || "").trim();
    if (!s) continue;
    if (!needles.some((k) => (k instanceof RegExp ? k.test(s) : s.includes(k)))) continue;
    const [a, b, c, d, e, f] = it.transform;
    out.push({ s, x: Math.round(e), y: Math.round(f) });
  }
  out.sort((p, q) => q.y - p.y || p.x - q.x);
  return out;
}

console.log("pages", doc.numPages);

const pages = [
  {
    p: 9,
    name: "肆-預定進度表",
    needles: [
      "肆",
      "預定進度表",
      "月份",
      "進度",
      "工作項目",
      "權重",
      "投入",
      "人月",
      "累計進度",
      "百分比",
      "註：",
      /\d+月$/,
      /^\d+月/,
      /年度$/,
      "*",
      "100%",
    ],
  },
  {
    p: 10,
    name: "肆-查核點說明",
    needles: ["預定查核點", "查核點編號", "KPI", "量化說明", "起訖時間", "分配權重", "計畫人員", "編號", "合計", "註："],
  },
  {
    p: 11,
    name: "伍-人力經費(1)",
    needles: ["伍", "人力", "經費", "需求表", "計畫主持人", "姓名", "稱謂", "身份證", "出生", "學歷", "經歷", "曾參與計畫", "公司名稱：", "編", "號"],
  },
  {
    p: 12,
    name: "伍-經費需求總表",
    needles: ["經費需求總表", "計畫總經費預算表", "會計科目", "政府", "補助款", "自籌款", "合計", "比例", "人事費", "消耗性", "研發設備使用費", "研發設備維護費", "技術移轉費", "百分比"],
  },
  {
    p: 13,
    name: "伍-人事費/材料/設備",
    needles: ["（一）人事費", "計畫人員", "顧問", "消耗性器材", "研發設備使用費", "已有設備", "計畫新增設備", "設備名稱", "財產編號", "投入", "月數", "合 計", "註："],
  },
  {
    p: 14,
    name: "陸-附件/切結",
    needles: ["陸", "附件", "切結書", "立書公司", "負 責 人", "公司印鑑", "負責人簽章", "中 華 民 國", "年", "月", "日"],
  },
];

for (const it of pages) {
  const hits = await dumpPage(it.p, it.needles);
  console.log(`\n-- page ${it.p} ${it.name} hits --`);
  console.log(hits.slice(0, 260));
}

