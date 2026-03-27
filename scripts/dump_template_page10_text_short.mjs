import fs from "node:fs";
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const TEMPLATE = new URL("../assets/templates/115年度SBIR-計畫書格式.pdf", import.meta.url);
const data = new Uint8Array(fs.readFileSync(TEMPLATE));
const doc = await pdfjs.getDocument({ data }).promise;

const pageNum = 10;
const page = await doc.getPage(pageNum);
const tc = await page.getTextContent();

const items = [];
for (const it of tc.items) {
  const s = (it.str || "").trim();
  if (!s) continue;
  if (s.length > 6) continue;
  const [a, b, c, d, e, f] = it.transform;
  items.push({ s, x: Math.round(e), y: Math.round(f) });
}

// Print items sorted by y descending, x ascending
items.sort((p, q) => q.y - p.y || p.x - p.x);
console.log("page", pageNum, "short text hits", items.length);
console.log(items);

