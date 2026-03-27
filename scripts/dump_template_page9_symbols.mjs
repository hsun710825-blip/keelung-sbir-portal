import fs from "node:fs";
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const TEMPLATE = new URL("../assets/templates/115年度SBIR-計畫書格式.pdf", import.meta.url);
const data = new Uint8Array(fs.readFileSync(TEMPLATE));
const doc = await pdfjs.getDocument({ data }).promise;

const pageNum = 9;
const page = await doc.getPage(pageNum);
const tc = await page.getTextContent();

const interesting = new Set(["*", "■", "●", "□"]);
const hits = [];
for (const it of tc.items) {
  const s = (it.str || "").trim();
  if (!interesting.has(s)) continue;
  const [a, b, c, d, e, f] = it.transform;
  hits.push({ s, x: Math.round(e), y: Math.round(f) });
}

hits.sort((p, q) => q.y - p.y || q.x - p.x);
console.log("page", pageNum, "hits", hits.length, "doc pages", doc.numPages);
console.log(hits);

