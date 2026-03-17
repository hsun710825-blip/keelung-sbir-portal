import { NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

type AnyRecord = Record<string, unknown>;
type FileItem = {
  id?: string;
  name?: string;
  status?: string;
  drive?: { id?: string; name?: string; webViewLink?: string; webContentLink?: string } | null;
};

type UploadedImage = {
  id?: string;
  name?: string;
  size?: string;
  url?: string;
  dataUrl?: string;
};

type CompanyProfileDraft = {
  formData: {
    companyName: string;
    establishDate: string;
    taxId: string;
    phone: string;
    fax: string;
    representative: string;
    idNumber: string;
    birthDate: string;
    capital: string;
    mainBusiness: string;
    stockStatus: string;
    lastYearRevenue: string;
    employeeCount: string;
    registeredAddress: string;
    mailingAddress: string;
    awards?: string[];
    awardTechDetails?: string;
    awardOtherDetails?: string;
    companyHistory?: string;
    targetAudience: string;
    salesChannels: string;
  };
  shareholders: Array<{ name: string; shares: string; ratio: string }>;
  opYears: string[];
  opData: Array<{
    product: string;
    y1: { volume: string; sales: string; share: string };
    y2: { volume: string; sales: string; share: string };
    y3: { volume: string; sales: string; share: string };
  }>;
  pastProjects: Array<{
    date: string;
    category: string;
    name: string;
    duration: string;
    year: string;
    grant: string;
    totalBudget: string;
    manYears: string;
  }>;
  futureProjects: Array<{
    organizer: string;
    category: string;
    name: string;
    duration: string;
    year: string;
    grant: string;
    totalBudget: string;
    manYears: string;
  }>;
  images: Record<string, UploadedImage[]>;
};

type PlanContentDraft = {
  formData: {
    background: string;
    industryStatus: string;
    industryTrends: string;
    feasibility: string;
    innovation: string;
    architectureTreeJson: string;
    stepsMethod: string;
    techTransferAnalysis: string;
    ipRisk: string;
  };
  architectureTree?: { id: string; text: string; children: unknown[] };
  competitorRows?: unknown[];
  techTransferRows?: Array<{ item: string; target: string; budget: string; content: string; period: string }>;
  images?: Record<string, UploadedImage[]>;
};

type ExpectedBenefitsDraft = {
  formData: {
    quantitativeNarrative: string;
    qualitativeBenefits: string;
    impactOnCompany: string;
    impactOnIndustry: string;
    valueAdded: string;
    newProducts: string;
    derivedProducts: string;
    rndInvestment: string;
    inducedInvestment: string;
    costReduction: string;
    employment: string;
    newCompany: string;
    inventionPatent: string;
    utilityPatent: string;
    journalPapers: string;
    conferencePapers: string;
  };
};

function asString(v: unknown) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function getFormData(body: AnyRecord) {
  return (body.formData as AnyRecord) || {};
}

function makeSafeFilename(input: string) {
  const raw = String(input || "").trim();
  const cleaned = raw
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/g, "");
  return cleaned ? cleaned.slice(0, 120) : "sbir-plan.pdf";
}

function buildContentDisposition(filenameUtf8: string) {
  const name = String(filenameUtf8 || "sbir-plan.pdf").trim() || "sbir-plan.pdf";
  // Header values must be ByteString; keep ASCII fallback in filename=...
  const ascii = name
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/"/g, "")
    .trim()
    .slice(0, 120) || "sbir-plan.pdf";
  const encoded = encodeURIComponent(name).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number) {
  const t = (text || "").replace(/\r\n/g, "\n");
  const lines: string[] = [];
  const paragraphs = t.split("\n");
  for (const p of paragraphs) {
    const words = p.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const cand = line ? `${line} ${w}` : w;
      const width = font.widthOfTextAtSize(cand, fontSize);
      if (width <= maxWidth) {
        line = cand;
      } else {
        if (line) lines.push(line);
        // If a single word is too long, hard break by characters.
        if (font.widthOfTextAtSize(w, fontSize) <= maxWidth) {
          line = w;
        } else {
          let cur = "";
          for (const ch of w) {
            const c2 = cur + ch;
            if (font.widthOfTextAtSize(c2, fontSize) <= maxWidth) cur = c2;
            else {
              if (cur) lines.push(cur);
              cur = ch;
            }
          }
          line = cur;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawTextTopLeft(opts: {
  page: PDFPage;
  x: number;
  y: number;
  text: string;
  size: number;
  font: PDFFont;
  color?: { r: number; g: number; b: number };
}) {
  const { page, x, y, text, size, font } = opts;
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color: rgb(opts.color?.r ?? 0, opts.color?.g ?? 0, opts.color?.b ?? 0),
  });
}

function drawWhiteRect(page: PDFPage, x: number, y: number, w: number, h: number) {
  page.drawRectangle({ x, y, width: w, height: h, color: rgb(1, 1, 1) });
}

function drawWhiteRectPad(page: PDFPage, x: number, y: number, w: number, h: number, pad = 1) {
  drawWhiteRect(page, x - pad, y - pad, w + pad * 2, h + pad * 2);
}

function drawFilledCheckbox(page: PDFPage, x: number, y: number) {
  // x,y are the checkbox glyph baseline from the template text extraction.
  // We cover the hollow glyph and draw a filled square in place.
  const size = 9;
  const yBox = y - 2;
  drawWhiteRect(page, x - 1, yBox - 1, size + 3, size + 3);
  page.drawRectangle({ x, y: yBox, width: size, height: size, color: rgb(0, 0, 0) });
}

function fitFontSizeToWidth(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  let size = fontSize;
  while (size > 6 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  return size;
}

function drawCenteredInBox(opts: {
  page: PDFPage;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  font: PDFFont;
  fontSize: number;
  maxWidthPad?: number;
}) {
  const { page, x, y, width, height, text, font, fontSize } = opts;
  const t = String(text || "").trim();
  if (!t) return;
  const maxW = width - (opts.maxWidthPad ?? 10);
  const size = fitFontSizeToWidth(t, font, fontSize, maxW);
  const w = font.widthOfTextAtSize(t, size);
  const xText = x + (width - w) / 2;
  const yText = y + (height - size) / 2;
  drawTextTopLeft({ page, x: xText, y: yText, text: t, size, font });
}

function drawCenteredInCircle(opts: {
  page: PDFPage;
  cx: number;
  cy: number;
  text: string;
  font: PDFFont;
  fontSize: number;
  maxWidth: number;
}) {
  const { page, cx, cy, text, font, fontSize, maxWidth } = opts;
  const t = String(text || "").trim();
  if (!t) return;
  const size = fitFontSizeToWidth(t, font, fontSize, maxWidth);
  const w = font.widthOfTextAtSize(t, size);
  // Nudge slightly UP for visual centering + more bottom whitespace
  drawTextTopLeft({ page, x: cx - w / 2, y: cy - size / 6, text: t, size, font });
}

function drawRightAlignedText(opts: {
  page: PDFPage;
  xRight: number;
  y: number;
  text: string;
  size: number;
  font: PDFFont;
}) {
  const w = opts.font.widthOfTextAtSize(opts.text, opts.size);
  drawTextTopLeft({ page: opts.page, x: opts.xRight - w, y: opts.y, text: opts.text, size: opts.size, font: opts.font });
}

function drawRightAlignedFit(opts: {
  page: PDFPage;
  xRight: number;
  y: number;
  text: string;
  font: PDFFont;
  fontSize: number;
  maxWidth: number;
}) {
  const t = String(opts.text || "").trim();
  if (!t) return;
  const size = fitFontSizeToWidth(t, opts.font, opts.fontSize, opts.maxWidth);
  drawRightAlignedText({ page: opts.page, xRight: opts.xRight, y: opts.y, text: t, size, font: opts.font });
}

function drawMultilineBoxFit(opts: {
  page: PDFPage;
  x: number;
  yTopFromBottom: number;
  width: number;
  height: number;
  text: string;
  font: PDFFont;
  fontSize: number;
  minFontSize?: number;
  lineHeight: number;
}) {
  const min = opts.minFontSize ?? 7;
  let size = opts.fontSize;
  while (size >= min) {
    const lines = wrapText(opts.text, opts.width, opts.font, size);
    const maxLines = Math.floor(opts.height / opts.lineHeight);
    if (lines.length <= maxLines) break;
    size -= 0.5;
  }
  drawMultilineBox({ ...opts, fontSize: Math.max(min, size) });
}

function flattenTreeText(root: unknown, maxLines = 60) {
  const lines: string[] = [];
  const walk = (node: unknown, depth: number) => {
    if (!node || lines.length >= maxLines) return;
    const obj = typeof node === "object" ? (node as Record<string, unknown>) : null;
    const t = typeof obj?.text === "string" ? obj.text.trim() : "";
    if (t) lines.push(`${"  ".repeat(Math.min(depth, 6))}${t}`);
    const kids = Array.isArray(obj?.children) ? obj.children : [];
    for (const c of kids) {
      if (lines.length >= maxLines) break;
      walk(c, depth + 1);
    }
  };
  walk(root, 0);
  return lines.join("\n");
}

function parseTreeTextFromJson(json: string) {
  const t = String(json || "").trim();
  if (!t) return "";
  try {
    const parsed: unknown = JSON.parse(t);
    return flattenTreeText(parsed, 120);
  } catch {
    return "";
  }
}

function dataUrlToBytes(dataUrl: string) {
  const m = String(dataUrl || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!m) return null;
  const mime = m[1];
  const b64 = m[2];
  const bytes = Uint8Array.from(Buffer.from(b64, "base64"));
  return { mime, bytes };
}

function parseYmd(v: string) {
  // Accept YYYY-MM-DD or YYYY/MM/DD
  const m = String(v || "").match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  return { y, mo, d };
}

function toRocYear(adYear: number) {
  return adYear >= 1912 ? String(adYear - 1911) : String(adYear);
}

function computeProjectMonths(startRaw: string, endRaw: string) {
  const s = parseYmd(startRaw);
  const e = parseYmd(endRaw);
  if (!s || !e) return "";
  const start = new Date(s.y, s.mo - 1, s.d);
  const end = new Date(e.y, e.mo - 1, e.d);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return "";

  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  const endLastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  const isEndLastDay = end.getDate() === endLastDay;
  if (end.getDate() >= start.getDate() || isEndLastDay) months += 1;
  return String(Math.max(0, months));
}

function drawMultilineBox(opts: {
  page: PDFPage;
  x: number;
  yTopFromBottom: number;
  width: number;
  height: number;
  text: string;
  font: PDFFont;
  fontSize: number;
  lineHeight: number;
}) {
  const { page, x, yTopFromBottom, width, height, text, font, fontSize, lineHeight } = opts;
  const lines = wrapText(text, width, font, fontSize);
  const maxLines = Math.floor(height / lineHeight);
  const slice = lines.slice(0, Math.max(0, maxLines));
  for (let i = 0; i < slice.length; i++) {
    const y = yTopFromBottom - i * lineHeight;
    drawTextTopLeft({ page, x, y, text: slice[i], size: fontSize, font });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as AnyRecord | null;
    if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

    const requestedName = typeof body.filename === "string" ? (body.filename as string) : "";
    const filename = makeSafeFilename(requestedName) || "sbir-plan.pdf";

    const formData = getFormData(body);
    const files = (formData.files as FileItem[] | undefined) || [];

    const templatePath = path.join(process.cwd(), "assets", "templates", "115年度SBIR-計畫書格式.pdf");
    const templateBytes = await readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);

    pdfDoc.registerFontkit(fontkit);
    const fontBytes = await readFile(path.join(process.cwd(), "assets", "fonts", "NotoSansTC-Regular.otf"));
    const fontBoldBytes = await readFile(path.join(process.cwd(), "assets", "fonts", "NotoSansTC-Bold.otf"));
    const font = await pdfDoc.embedFont(fontBytes);
    const fontBold = await pdfDoc.embedFont(fontBoldBytes);

    const pages = pdfDoc.getPages();
    const p1 = pages[0];
    const p2 = pages[1];

  // --- Page 1: 封面（座標為「距離上方」yTop，需視版型微調） ---
  const projectCategory = asString(formData.projectCategory);
  const projectName = asString(formData.projectName);
  const startRaw = asString(formData.projectStartDate);
  const endRaw = asString(formData.projectEndDate);
  const months = asString(formData.projectMonths) || computeProjectMonths(startRaw, endRaw);
  const companyName = asString(formData.companyName);
  const leaderName = asString(formData.leaderName);
  const submitYear = asString(formData.submitYear);
  const submitMonth = asString(formData.submitMonth);

  // 勾選框（改成實心正方框）— 版型空心方框座標：技術(220,654)、服務(308,654)
  if (projectCategory.includes("技術")) {
    drawFilledCheckbox(p1, 220, 654);
  }
  if (projectCategory.includes("服務")) {
    drawFilledCheckbox(p1, 308, 654);
  }

  // 申請計畫名稱 — 遮罩掉「＜申請計畫名稱＞」並置中放入
  // 加大遮罩，避免殘留點點底線
  drawWhiteRect(p1, 120, 520, 360, 42);
  drawCenteredInBox({ page: p1, x: 120, y: 520, width: 360, height: 42, text: projectName, font: fontBold, fontSize: 16 });

  // 計畫期間 / 月數 — 錨點：間：自(215,419)、共(270,393)
  const s = parseYmd(startRaw);
  const e = parseYmd(endRaw);
  // 版型圓圈座標（由 PDF 文字抽取）：y=419 xs=[257,285,313,355,383,411]
  if (s) {
    // 遮掉圓圈再填值
    [257, 285, 313].forEach((cx) => drawWhiteRectPad(p1, cx - 12, 419 - 12, 24, 24, 2));
    drawCenteredInCircle({ page: p1, cx: 257, cy: 419, text: toRocYear(s.y), font, fontSize: 10.5, maxWidth: 26 });
    drawCenteredInCircle({ page: p1, cx: 285, cy: 419, text: String(s.mo), font, fontSize: 10.5, maxWidth: 18 });
    drawCenteredInCircle({ page: p1, cx: 313, cy: 419, text: String(s.d), font, fontSize: 10.5, maxWidth: 18 });
  }
  if (e) {
    [355, 383, 411].forEach((cx) => drawWhiteRectPad(p1, cx - 12, 419 - 12, 24, 24, 2));
    drawCenteredInCircle({ page: p1, cx: 355, cy: 419, text: toRocYear(e.y), font, fontSize: 10.5, maxWidth: 26 });
    drawCenteredInCircle({ page: p1, cx: 383, cy: 419, text: String(e.mo), font, fontSize: 10.5, maxWidth: 18 });
    drawCenteredInCircle({ page: p1, cx: 411, cy: 419, text: String(e.d), font, fontSize: 10.5, maxWidth: 18 });
  }
  // (共○個月) 圓圈座標：y=393 x=284
  drawWhiteRectPad(p1, 284 - 12, 393 - 12, 24, 24, 2);
  drawCenteredInCircle({ page: p1, cx: 284, cy: 393, text: months, font, fontSize: 10.5, maxWidth: 26 });

  // 公司名稱 / 負責人 — 錨點：公司名稱：(183,347)、負(183,310)
  drawWhiteRect(p1, 240, 340, 260, 18);
  drawTextTopLeft({ page: p1, x: 245, y: 347, text: companyName, size: 11, font });
  drawWhiteRect(p1, 225, 303, 260, 18);
  drawTextTopLeft({ page: p1, x: 230, y: 310, text: leaderName, size: 11, font });

  // 日期（民國年/月）— 錨點：中(214,201)、年(326,201)、月(368,201)
  // 圓圈座標：y=201 xs=[305,347]
  [305, 347].forEach((cx) => drawWhiteRectPad(p1, cx - 12, 201 - 12, 24, 24, 2));
  drawCenteredInCircle({ page: p1, cx: 305, cy: 201, text: submitYear, font, fontSize: 11, maxWidth: 26 });
  drawCenteredInCircle({ page: p1, cx: 347, cy: 201, text: submitMonth, font, fontSize: 11, maxWidth: 18 });

  // --- Page 2: 摘要表（錨點由 pdf 文字座標取得） ---
  // 標籤錨點：公司名稱(65,679)、設立日期(66,658)、負責人(66,637)、主要營業項目(66,616)
  // 遮罩公司簡介欄位右側空白線/底紋（避免重疊）
  // 注意：不要遮到右側外框線，故縮窄遮罩寬度
  drawWhiteRect(p2, 140, 672, 360, 14);
  drawTextTopLeft({ page: p2, x: 150, y: 679, text: companyName, size: 10.5, font });
  drawWhiteRect(p2, 140, 651, 360, 14);
  drawTextTopLeft({ page: p2, x: 150, y: 658, text: asString(formData.foundingDate), size: 10.5, font });
  drawWhiteRect(p2, 140, 630, 360, 14);
  drawTextTopLeft({ page: p2, x: 150, y: 637, text: leaderName, size: 10.5, font });
  drawWhiteRect(p2, 165, 609, 335, 14);
  drawTextTopLeft({ page: p2, x: 170, y: 616, text: asString(formData.mainBusinessItems), size: 10.5, font });

  // --- Page 3: 目錄（自動產生，不保留原 PDF 版型） ---
  // Replace template page index 2 with a new page.
  if (pdfDoc.getPageCount() >= 3) {
    pdfDoc.removePage(2);
  }
  const toc = pdfDoc.insertPage(2);
  const { width: tw, height: th } = toc.getSize();
  toc.drawText("目 錄", { x: tw / 2 - fontBold.widthOfTextAtSize("目 錄", 18) / 2, y: th - 90, size: 18, font: fontBold, color: rgb(0, 0, 0) });

  const tocItems: Array<{ label: string; page: number; indent?: number }> = [
    { label: "壹、公司概況", page: 4 },
    { label: "一、基本資料", page: 4, indent: 1 },
    { label: "二、公司營運及財務狀況", page: 5, indent: 1 },
    { label: "三、曾經參與政府相關研發計畫之實績", page: 6, indent: 1 },
    { label: "貳、計畫內容與實施方式", page: 7 },
    { label: "一、背景與說明", page: 7, indent: 1 },
    { label: "二、國內外產業現況、發展趨勢及競爭力分析", page: 7, indent: 1 },
    { label: "三、創新性說明", page: 8, indent: 1 },
    { label: "四、計畫架構與實施方式", page: 9, indent: 1 },
    { label: "參、預期效益", page: 10 },
    { label: "肆、預定進度及查核點", page: 11 },
    { label: "伍、人力及經費需求表", page: 12 },
    { label: "陸、附件", page: 14 },
  ];

  const leftX = 78;
  const rightX = tw - 78;
  const dotFontSize = 12;
  const dotW = font.widthOfTextAtSize(".", dotFontSize);
  const dotsColor = rgb(0.55, 0.55, 0.55);
  let yT = th - 150;
  const tocLineH = 20;
  for (const it of tocItems) {
    if (yT < 80) break;
    const indent = (it.indent || 0) * 18;
    const labelX = leftX + indent;
    toc.drawText(it.label, { x: labelX, y: yT, size: 12, font, color: rgb(0, 0, 0) });
    const pageStr = String(it.page);
    const pageW = font.widthOfTextAtSize(pageStr, 12);
    toc.drawText(pageStr, { x: rightX - pageW, y: yT, size: 12, font, color: rgb(0, 0, 0) });

    // dynamic dotted leader between label and page number
    const labelW = font.widthOfTextAtSize(it.label, 12);
    const dotsStart = labelX + labelW + 10;
    const dotsEnd = rightX - pageW - 10;
    if (dotsEnd > dotsStart) {
      const count = Math.max(0, Math.floor((dotsEnd - dotsStart) / dotW));
      if (count > 0) {
        toc.drawText(".".repeat(Math.min(count, 200)), { x: dotsStart, y: yT, size: dotFontSize, font, color: dotsColor });
      }
    }
    yT -= tocLineH;
  }

  // 計畫內容摘要(標籤 84,558) / 計畫創新重點(標籤 84,533)
  // 這兩行在版型上是「單行填寫區」：不再用白底遮（避免破壞線條），改成縮字塞進一行
  {
    const t1 = asString(formData.summary);
    const size1 = fitFontSizeToWidth(t1, font, 10, 350);
    drawTextTopLeft({ page: p2, x: 210, y: 558, text: t1, size: size1, font });
    const t2 = asString(formData.innovationFocus);
    const size2 = fitFontSizeToWidth(t2, font, 10, 350);
    drawTextTopLeft({ page: p2, x: 210, y: 533, text: t2, size: size2, font });
  }

  drawMultilineBoxFit({
    page: p2,
    // 執行優勢(標籤 64,482) 下方大區塊
    x: 90,
    yTopFromBottom: 458,
    width: 470,
    height: 92,
    text: asString(formData.executionAdvantage),
    font,
    fontSize: 10,
    minFontSize: 7,
    lineHeight: 14,
  });

  // 量化效益（10項）
  const b = (k: string) => asString(formData[k]);
  // 單位座標（由版型抓取）：千元(168,381) 項(357,381) 項(524,381)
  // 表格線不可被遮到：移除白底遮罩，僅縮字+靠右
  drawRightAlignedFit({ page: p2, xRight: 163, y: 381, text: b("benefitValue") || "0", font, fontSize: 10, maxWidth: 50 });
  drawRightAlignedFit({ page: p2, xRight: 352, y: 381, text: b("benefitNewProduct") || "0", font, fontSize: 10, maxWidth: 50 });
  drawRightAlignedFit({ page: p2, xRight: 519, y: 381, text: b("benefitDerivedProduct") || "0", font, fontSize: 10, maxWidth: 50 });

  // 千元(185,361) 千元(346,361) 千元(513,361)
  drawRightAlignedFit({ page: p2, xRight: 180, y: 361, text: b("benefitAdditionalRnD") || "0", font, fontSize: 10, maxWidth: 55 });
  drawRightAlignedFit({ page: p2, xRight: 341, y: 361, text: b("benefitInvestment") || "0", font, fontSize: 10, maxWidth: 55 });
  drawRightAlignedFit({ page: p2, xRight: 508, y: 361, text: b("benefitCostReduction") || "0", font, fontSize: 10, maxWidth: 55 });

  // 人(174,341) 家(324,341) 件(480,341)
  drawRightAlignedFit({ page: p2, xRight: 169, y: 341, text: b("benefitEmployment") || "0", font, fontSize: 10, maxWidth: 50 });
  drawRightAlignedFit({ page: p2, xRight: 319, y: 341, text: b("benefitNewCompany") || "0", font, fontSize: 10, maxWidth: 50 });
  drawRightAlignedFit({ page: p2, xRight: 475, y: 341, text: b("benefitInventionPatent") || "0", font, fontSize: 10, maxWidth: 55 });

  // 件(185,321)
  drawRightAlignedFit({ page: p2, xRight: 180, y: 321, text: b("benefitUtilityPatent") || "0", font, fontSize: 10, maxWidth: 55 });

  drawMultilineBoxFit({
    page: p2,
    // 非量化效益(標籤 85,271) 下方大區塊
    x: 90,
    yTopFromBottom: 245,
    width: 470,
    height: 130,
    text: asString(formData.qualitativeBenefits),
    font,
    fontSize: 10,
    minFontSize: 7,
    lineHeight: 14,
  });

  // --- Page 4: 壹、公司概況 / 一、基本資料（填入 Tab3） ---
  // After TOC insertion, template page 4 should still be at index 3.
  const companyProfile = (formData.companyProfile as CompanyProfileDraft | null) || null;
  const cpImgs = companyProfile?.images || {};

  if (companyProfile?.formData && pdfDoc.getPageCount() >= 4) {
    const p4 = pdfDoc.getPage(3);
    const { height: h4 } = p4.getSize();
    const c = companyProfile.formData;

    // Coordinates from template page 4:
    // 公司名稱(70,660) 設立日期(393,660)
    // 統一編號(70,638) 聯絡電話(235,638) 傳真號碼(393,638)
    // 負責人(76,615) 身分證字號(229,615) 出生年月日(393,615)
    // 實收資本額(64,587) 主要營業項目(306,587)
    // 股票上市狀況 checkboxes at y=559: □ at x=160,226,292,376
    // 前一年度營業額(51,536) 員工人數(318,536)
    // 公司登記地址(57,514) 通訊地址(70,491)
    drawTextTopLeft({ page: p4, x: 130, y: 660, text: asString(c.companyName), size: 10.5, font });
    drawTextTopLeft({ page: p4, x: 450, y: 660, text: asString(c.establishDate), size: 10.5, font });

    drawTextTopLeft({ page: p4, x: 130, y: 638, text: asString(c.taxId), size: 10.5, font });
    drawTextTopLeft({ page: p4, x: 295, y: 638, text: asString(c.phone), size: 10.5, font });
    drawTextTopLeft({ page: p4, x: 450, y: 638, text: asString(c.fax), size: 10.5, font });

    drawTextTopLeft({ page: p4, x: 130, y: 615, text: asString(c.representative), size: 10.5, font });
    drawTextTopLeft({ page: p4, x: 310, y: 615, text: asString(c.idNumber), size: 10.5, font });
    drawTextTopLeft({ page: p4, x: 470, y: 615, text: asString(c.birthDate), size: 10.5, font });

    drawRightAlignedFit({ page: p4, xRight: 200, y: 587, text: asString(c.capital), font, fontSize: 10.5, maxWidth: 85 });
    drawTextTopLeft({ page: p4, x: 390, y: 587, text: asString(c.mainBusiness), size: 10.5, font });

    const stock = asString(c.stockStatus);
    if (stock) {
      const map: Record<string, { x: number; y: number }> = {
        上市: { x: 160, y: 559 },
        上櫃: { x: 226, y: 559 },
        公開發行: { x: 292, y: 559 },
        未公開發行: { x: 376, y: 559 },
      };
      const hit = map[stock];
      if (hit) drawFilledCheckbox(p4, hit.x, hit.y);
    }

    drawRightAlignedFit({ page: p4, xRight: 240, y: 536, text: asString(c.lastYearRevenue), font, fontSize: 10.5, maxWidth: 110 });
    drawRightAlignedFit({ page: p4, xRight: 410, y: 536, text: asString(c.employeeCount), font, fontSize: 10.5, maxWidth: 70 });

    drawTextTopLeft({ page: p4, x: 160, y: 514, text: asString(c.registeredAddress), size: 10, font });
    drawTextTopLeft({ page: p4, x: 160, y: 491, text: asString(c.mailingAddress), size: 10, font });

    // 獲得獎項（checkboxes on page 4）
    const awards = Array.isArray(c.awards) ? c.awards : [];
    const awardBoxes: Record<string, { x: number; y: number }> = {
      "年度通過研發管理制度評鑑": { x: 148, y: 440 },
      "年度產業科技發展獎": { x: 340, y: 440 },
      "年度國家品質獎": { x: 148, y: 425 },
      // Template likely has a checkbox for this at ~x=340,y=425 (not captured by dump), still mark it.
      "年度中小企業磐石獎": { x: 340, y: 425 },
      // Other/none are free-text/extra checkbox further down; leave as text to avoid misplacement.
    };
    for (const a of awards) {
      const hit = awardBoxes[String(a)];
      if (hit) drawFilledCheckbox(p4, hit.x, hit.y);
    }

    // (三) 公司沿革文字區（座標以模板實測區塊近似，避免覆蓋上方表格）
    if (c.companyHistory) {
      drawMultilineBoxFit({
        page: p4,
        x: 70,
        yTopFromBottom: 365,
        width: 470,
        height: 110,
        text: asString(c.companyHistory),
        font,
        fontSize: 10,
        minFontSize: 7,
        lineHeight: 14,
      });
      const imgs = Array.isArray(cpImgs.companyHistory) ? cpImgs.companyHistory : [];
      if (imgs.length) {
        const first = imgs[0];
        const decoded = first.dataUrl ? dataUrlToBytes(first.dataUrl) : null;
        if (decoded) {
          try {
            const embedded =
              decoded.mime.includes("png") ? await pdfDoc.embedPng(decoded.bytes) : await pdfDoc.embedJpg(decoded.bytes);
            const box = { x: 70, yTop: 365, width: 470, height: 110 };
            const thumbW = 80;
            const thumbH = 60;
            const scale = Math.min(thumbW / embedded.width, thumbH / embedded.height);
            const w = embedded.width * scale;
            const imgH = embedded.height * scale;
            const xImg = box.x + box.width - w - 8;
            const yImgTop = h4 - box.yTop + 8;
            p4.drawImage(embedded, {
              x: xImg,
              y: yImgTop - imgH,
              width: w,
              height: imgH,
            });
          } catch {
            // ignore image embed failure for this field
          }
        }
      }
    }
  }

  // --- Page 5: 二、公司營運及財務狀況 + 三、研發計畫實績（同頁下半部表格） ---
  if (companyProfile && pdfDoc.getPageCount() >= 5) {
    const p5 = pdfDoc.getPage(4);
    const { height: h5 } = p5.getSize();
    const c = companyProfile.formData;

    // (一) 主要服務或產品目標客群 (label at y~733)
    drawMultilineBoxFit({
      page: p5,
      x: 75,
      yTopFromBottom: 710,
      width: 470,
      height: 55,
      text: asString(c.targetAudience),
      font,
      fontSize: 10,
      minFontSize: 7,
      lineHeight: 14,
    });

    // (二) 銷售通路說明 (label at y~678)
    const taImgs = Array.isArray(cpImgs.targetAudience) ? cpImgs.targetAudience : [];
    if (taImgs.length) {
      const first = taImgs[0];
      const decoded = first.dataUrl ? dataUrlToBytes(first.dataUrl) : null;
      if (decoded) {
        try {
          const embedded =
            decoded.mime.includes("png") ? await pdfDoc.embedPng(decoded.bytes) : await pdfDoc.embedJpg(decoded.bytes);
          const box = { x: 75, yTop: 710, width: 470, height: 55 };
          const thumbW = 70;
          const thumbH = 45;
          const scale = Math.min(thumbW / embedded.width, thumbH / embedded.height);
          const w = embedded.width * scale;
          const imgH = embedded.height * scale;
          const xImg = box.x + box.width - w - 6;
          const yImgTop = h5 - box.yTop + 6;
          p5.drawImage(embedded, {
            x: xImg,
            y: yImgTop - imgH,
            width: w,
            height: imgH,
          });
        } catch {
          // ignore
        }
      }
    }

    drawMultilineBoxFit({
      page: p5,
      x: 75,
      yTopFromBottom: 655,
      width: 470,
      height: 45,
      text: asString(c.salesChannels),
      font,
      fontSize: 10,
      minFontSize: 7,
      lineHeight: 14,
    });

    const scImgs = Array.isArray(cpImgs.salesChannels) ? cpImgs.salesChannels : [];
    if (scImgs.length) {
      const first = scImgs[0];
      const decoded = first.dataUrl ? dataUrlToBytes(first.dataUrl) : null;
      if (decoded) {
        try {
          const embedded =
            decoded.mime.includes("png") ? await pdfDoc.embedPng(decoded.bytes) : await pdfDoc.embedJpg(decoded.bytes);
          const box = { x: 75, yTop: 655, width: 470, height: 45 };
          const thumbW = 70;
          const thumbH = 40;
          const scale = Math.min(thumbW / embedded.width, thumbH / embedded.height);
          const w = embedded.width * scale;
          const imgH = embedded.height * scale;
          const xImg = box.x + box.width - w - 6;
          const yImgTop = h5 - box.yTop + 6;
          p5.drawImage(embedded, {
            x: xImg,
            y: yImgTop - imgH,
            width: w,
            height: imgH,
          });
        } catch {
          // ignore
        }
      }
    }

    // (三) 經營狀況表格：填前三列產品/服務（最多 3 列）
    const years = (companyProfile.opYears || []).slice(0, 3);
    // header year label anchors: 民國 at x 179/319/459 y 581; write year numbers near them
    const yearXs = [205, 345, 485];
    years.forEach((yy, i) => {
      const yText = String(yy || "").trim();
      if (!yText) return;
      drawTextTopLeft({ page: p5, x: yearXs[i], y: 581, text: yText, size: 10, font });
    });

    const opRows = companyProfile.opData || [];
    const rowY0 = 545; // first data row baseline
    const rowH = 22;
    const col = {
      product: 60,
      y1: { volume: 140, salesRight: 198, shareRight: 236 },
      y2: { volume: 276, salesRight: 336, shareRight: 374 },
      y3: { volume: 414, salesRight: 474, shareRight: 512 },
    };
    for (let i = 0; i < Math.min(3, opRows.length); i++) {
      const r = opRows[i] || {};
      const y = rowY0 - i * rowH;
      const product = asString(r.product);
      if (product) {
        const size = fitFontSizeToWidth(product, font, 9.5, 75);
        drawTextTopLeft({ page: p5, x: col.product, y, text: product, size, font });
      }
      const y1 = r.y1 || {};
      const y2 = r.y2 || {};
      const y3 = r.y3 || {};
      const drawVol = (x: number, v: unknown) => {
        const t = asString(v);
        if (!t) return;
        const size = fitFontSizeToWidth(t, font, 9.5, 34);
        drawTextTopLeft({ page: p5, x, y, text: t, size, font });
      };
      const drawNumR = (xRight: number, v: unknown, maxW: number) => {
        const t = asString(v);
        if (!t) return;
        drawRightAlignedFit({ page: p5, xRight, y, text: t, font, fontSize: 9.5, maxWidth: maxW });
      };
      drawVol(col.y1.volume, y1.volume);
      drawNumR(col.y1.salesRight, y1.sales, 56);
      drawNumR(col.y1.shareRight, y1.share, 32);
      drawVol(col.y2.volume, y2.volume);
      drawNumR(col.y2.salesRight, y2.sales, 56);
      drawNumR(col.y2.shareRight, y2.share, 32);
      drawVol(col.y3.volume, y3.volume);
      drawNumR(col.y3.salesRight, y3.sales, 56);
      drawNumR(col.y3.shareRight, y3.share, 32);
    }

    // 三、近3年曾參與政府其他相關計畫（同頁下半部）
    // Table header anchors indicate three year groups: 114/113/112; fill up to 3 rows
    const past = companyProfile.pastProjects || [];
    const pastY0 = 248;
    const pastRowH = 18;
    const xPast = { date: 52, category: 108, name: 166, duration: 226, manYears: 512 };
    const yearGroups: Record<string, { govRight: number; totalRight: number }> = {
      "114": { govRight: 308, totalRight: 346 },
      "113": { govRight: 384, totalRight: 422 },
      "112": { govRight: 459, totalRight: 497 },
    };
    for (let i = 0; i < Math.min(3, past.length); i++) {
      const r = past[i] || {};
      const y = pastY0 - i * pastRowH;
      drawTextTopLeft({ page: p5, x: xPast.date, y, text: asString(r.date), size: 9.5, font });
      drawTextTopLeft({ page: p5, x: xPast.category, y, text: asString(r.category), size: 9.5, font });
      drawTextTopLeft({ page: p5, x: xPast.name, y, text: asString(r.name), size: 9.5, font });
      drawTextTopLeft({ page: p5, x: xPast.duration, y, text: asString(r.duration), size: 9.5, font });
      const yr = asString(r.year);
      const g = yearGroups[yr];
      if (g) {
        drawRightAlignedFit({ page: p5, xRight: g.govRight, y, text: asString(r.grant), font, fontSize: 9.5, maxWidth: 30 });
        drawRightAlignedFit({ page: p5, xRight: g.totalRight, y, text: asString(r.totalBudget), font, fontSize: 9.5, maxWidth: 30 });
      }
      drawRightAlignedFit({ page: p5, xRight: xPast.manYears + 18, y, text: asString(r.manYears), font, fontSize: 9.5, maxWidth: 34 });
    }

    // (二) 本年度欲申請政府其他相關計畫（下半部第二表）
    const future = companyProfile.futureProjects || [];
    const futY0 = 144;
    const futRowH = 18;
    const xF = { organizer: 60, category: 122, name: 176, duration: 336, manYears: 512 };
    for (let i = 0; i < Math.min(2, future.length); i++) {
      const r = future[i] || {};
      const y = futY0 - i * futRowH;
      drawTextTopLeft({ page: p5, x: xF.organizer, y, text: asString(r.organizer), size: 9.5, font });
      drawTextTopLeft({ page: p5, x: xF.category, y, text: asString(r.category), size: 9.5, font });
      drawTextTopLeft({ page: p5, x: xF.name, y, text: asString(r.name), size: 9.5, font });
      drawTextTopLeft({ page: p5, x: xF.duration, y, text: asString(r.duration), size: 9.5, font });
      // 115 year group: use right-aligned at approximate columns
      drawRightAlignedFit({ page: p5, xRight: 462, y, text: asString(r.grant), font, fontSize: 9.5, maxWidth: 34 });
      drawRightAlignedFit({ page: p5, xRight: 500, y, text: asString(r.totalBudget), font, fontSize: 9.5, maxWidth: 34 });
      drawRightAlignedFit({ page: p5, xRight: xF.manYears + 18, y, text: asString(r.manYears), font, fontSize: 9.5, maxWidth: 34 });
    }
  }

  // --- Page 6-8: 貳、計畫內容與實施方式（Tab4）+ 參、預期效益（Tab5，部分在 page 8） ---
  const planContent = (formData.planContent as PlanContentDraft | null) || null;
  const pcImgs = planContent?.images || {};
  const expectedBenefits = (formData.expectedBenefits as ExpectedBenefitsDraft | null) || null;

  // After TOC insertion, template page 6 should be at index 5.
  if (planContent?.formData && pdfDoc.getPageCount() >= 6) {
    const p6 = pdfDoc.getPage(5);
    const { height: h6 } = p6.getSize();
    const t = planContent.formData;

    // Page 6 boxes (approximate, aligned to template text anchors from dump_template_coords.mjs)
    drawMultilineBoxFit({
      page: p6,
      x: 70,
      yTopFromBottom: 692,
      width: 470,
      height: 135,
      text: asString(t.background),
      font,
      fontSize: 10,
      minFontSize: 7,
      lineHeight: 14,
    });

    // Industry status + trends (merged)
    const bgImgs = Array.isArray(pcImgs.background) ? pcImgs.background : [];
    if (bgImgs.length) {
      const first = bgImgs[0];
      const decoded = first.dataUrl ? dataUrlToBytes(first.dataUrl) : null;
      if (decoded) {
        try {
          const embedded =
            decoded.mime.includes("png") ? await pdfDoc.embedPng(decoded.bytes) : await pdfDoc.embedJpg(decoded.bytes);
          const box = { x: 70, yTop: 692, width: 470, height: 135 };
          const thumbW = 80;
          const thumbH = 60;
          const scale = Math.min(thumbW / embedded.width, thumbH / embedded.height);
          const w = embedded.width * scale;
          const imgH = embedded.height * scale;
          const xImg = box.x + box.width - w - 8;
          const yImgTop = h6 - box.yTop + 8;
          p6.drawImage(embedded, {
            x: xImg,
            y: yImgTop - imgH,
            width: w,
            height: imgH,
          });
        } catch {
          // ignore
        }
      }
    }

    drawMultilineBoxFit({
      page: p6,
      x: 70,
      yTopFromBottom: 548,
      width: 470,
      height: 190,
      text: [asString(t.industryStatus), asString(t.industryTrends)].filter(Boolean).join("\n\n"),
      font,
      fontSize: 10,
      minFontSize: 7,
      lineHeight: 14,
    });

    const isImgs = Array.isArray(pcImgs.industryStatus) ? pcImgs.industryStatus : [];
    const itImgs = Array.isArray(pcImgs.industryTrends) ? pcImgs.industryTrends : [];
    const mergedImgs = [...isImgs, ...itImgs];
    if (mergedImgs.length) {
      const first = mergedImgs[0];
      const decoded = first.dataUrl ? dataUrlToBytes(first.dataUrl) : null;
      if (decoded) {
        try {
          const embedded =
            decoded.mime.includes("png") ? await pdfDoc.embedPng(decoded.bytes) : await pdfDoc.embedJpg(decoded.bytes);
          const box = { x: 70, yTop: 548, width: 470, height: 190 };
          const thumbW = 90;
          const thumbH = 70;
          const scale = Math.min(thumbW / embedded.width, thumbH / embedded.height);
          const w = embedded.width * scale;
          const imgH = embedded.height * scale;
          const xImg = box.x + box.width - w - 8;
          const yImgTop = h6 - box.yTop + 10;
          p6.drawImage(embedded, {
            x: xImg,
            y: yImgTop - imgH,
            width: w,
            height: imgH,
          });
        } catch {
          // ignore
        }
      }
    }

    // Feasibility
    drawMultilineBoxFit({
      page: p6,
      x: 70,
      yTopFromBottom: 300,
      width: 470,
      height: 135,
      text: asString(t.feasibility),
      font,
      fontSize: 10,
      minFontSize: 7,
      lineHeight: 14,
    });

    // Innovation
    const feasImgs = Array.isArray(pcImgs.feasibility) ? pcImgs.feasibility : [];
    if (feasImgs.length) {
      const first = feasImgs[0];
      const decoded = first.dataUrl ? dataUrlToBytes(first.dataUrl) : null;
      if (decoded) {
        try {
          const embedded =
            decoded.mime.includes("png") ? await pdfDoc.embedPng(decoded.bytes) : await pdfDoc.embedJpg(decoded.bytes);
          const box = { x: 70, yTop: 300, width: 470, height: 135 };
          const thumbW = 80;
          const thumbH = 60;
          const scale = Math.min(thumbW / embedded.width, thumbH / embedded.height);
          const w = embedded.width * scale;
          const imgH = embedded.height * scale;
          const xImg = box.x + box.width - w - 8;
          const yImgTop = h6 - box.yTop + 8;
          p6.drawImage(embedded, {
            x: xImg,
            y: yImgTop - imgH,
            width: w,
            height: imgH,
          });
        } catch {
          // ignore
        }
      }
    }

    drawMultilineBoxFit({
      page: p6,
      x: 70,
      yTopFromBottom: 140,
      width: 470,
      height: 85,
      text: asString(t.innovation),
      font,
      fontSize: 10,
      minFontSize: 7,
      lineHeight: 14,
    });
    const innovImgs = Array.isArray(pcImgs.innovation) ? pcImgs.innovation : [];
    if (innovImgs.length) {
      const first = innovImgs[0];
      const decoded = first.dataUrl ? dataUrlToBytes(first.dataUrl) : null;
      if (decoded) {
        try {
          const embedded =
            decoded.mime.includes("png") ? await pdfDoc.embedPng(decoded.bytes) : await pdfDoc.embedJpg(decoded.bytes);
          const box = { x: 70, yTop: 140, width: 470, height: 85 };
          const thumbW = 70;
          const thumbH = 50;
          const scale = Math.min(thumbW / embedded.width, thumbH / embedded.height);
          const w = embedded.width * scale;
          const imgH = embedded.height * scale;
          const xImg = box.x + box.width - w - 8;
          const yImgTop = h6 - box.yTop + 8;
          p6.drawImage(embedded, {
            x: xImg,
            y: yImgTop - imgH,
            width: w,
            height: imgH,
          });
        } catch {
          // ignore
        }
      }
    }
  }

  // Page 7 (index 6): architecture tree + steps + tech transfer
  if (planContent?.formData && pdfDoc.getPageCount() >= 7) {
    const p7 = pdfDoc.getPage(6);
    const { height: h7 } = p7.getSize();
    const t = planContent.formData;
    const treeText =
      parseTreeTextFromJson(asString(t.architectureTreeJson)) ||
      flattenTreeText(planContent.architectureTree, 120) ||
      "";

    // (一) 樹枝圖區塊
    drawMultilineBoxFit({
      page: p7,
      x: 70,
      yTopFromBottom: 710,
      width: 470,
      height: 270,
      text: treeText,
      font,
      fontSize: 10,
      minFontSize: 7,
      lineHeight: 14,
    });

    const archImgs = Array.isArray(pcImgs.architectureTree) ? pcImgs.architectureTree : [];
    if (archImgs.length) {
      const first = archImgs[0];
      const decoded = first.dataUrl ? dataUrlToBytes(first.dataUrl) : null;
      if (decoded) {
        try {
          const embedded =
            decoded.mime.includes("png") ? await pdfDoc.embedPng(decoded.bytes) : await pdfDoc.embedJpg(decoded.bytes);
          const box = { x: 70, yTop: 710, width: 470, height: 270 };
          const thumbW = 100;
          const thumbH = 80;
          const scale = Math.min(thumbW / embedded.width, thumbH / embedded.height);
          const w = embedded.width * scale;
          const imgH = embedded.height * scale;
          const xImg = box.x + box.width - w - 8;
          const yImgTop = h7 - box.yTop + 10;
          p7.drawImage(embedded, {
            x: xImg,
            y: yImgTop - imgH,
            width: w,
            height: imgH,
          });
        } catch {
          // ignore
        }
      }
    }

    // (二) 實施方式（流程/驗證）
    drawMultilineBoxFit({
      page: p7,
      x: 70,
      yTopFromBottom: 405,
      width: 470,
      height: 125,
      text: asString(t.stepsMethod),
      font,
      fontSize: 10,
      minFontSize: 7,
      lineHeight: 14,
    });
    const stepImgs = Array.isArray(pcImgs.stepsMethod) ? pcImgs.stepsMethod : [];
    if (stepImgs.length) {
      const first = stepImgs[0];
      const decoded = first.dataUrl ? dataUrlToBytes(first.dataUrl) : null;
      if (decoded) {
        try {
          const embedded =
            decoded.mime.includes("png") ? await pdfDoc.embedPng(decoded.bytes) : await pdfDoc.embedJpg(decoded.bytes);
          const box = { x: 70, yTop: 405, width: 470, height: 125 };
          const thumbW = 80;
          const thumbH = 60;
          const scale = Math.min(thumbW / embedded.width, thumbH / embedded.height);
          const w = embedded.width * scale;
          const imgH = embedded.height * scale;
          const xImg = box.x + box.width - w - 8;
          const yImgTop = h7 - box.yTop + 8;
          p7.drawImage(embedded, {
            x: xImg,
            y: yImgTop - imgH,
            width: w,
            height: imgH,
          });
        } catch {
          // ignore
        }
      }
    }

    // (三) 技術移轉來源分析表（3 列）
    const rows = Array.isArray(planContent.techTransferRows) ? planContent.techTransferRows : [];
    const rowY = { "技術及智慧財產權移轉": 185, "委託研究": 169, "委託勞務": 153 } as const;
    for (const r of rows.slice(0, 3)) {
      const y = rowY[r.item as keyof typeof rowY];
      if (!y) continue;
      drawTextTopLeft({ page: p7, x: 200, y, text: asString(r.target), size: 9.5, font });
      drawRightAlignedFit({ page: p7, xRight: 360, y, text: asString(r.budget), font, fontSize: 9.5, maxWidth: 70 });
      drawTextTopLeft({ page: p7, x: 368, y, text: asString(r.content), size: 9.5, font });
      drawTextTopLeft({ page: p7, x: 510, y, text: asString(r.period), size: 9.5, font });
    }

    // (四) 技轉/合作方式補充說明（底部文字區）
    drawMultilineBoxFit({
      page: p7,
      x: 70,
      yTopFromBottom: 112,
      width: 470,
      height: 62,
      text: asString(t.techTransferAnalysis),
      font,
      fontSize: 10,
      minFontSize: 7,
      lineHeight: 14,
    });
    const ttImgs = Array.isArray(pcImgs.techTransferAnalysis) ? pcImgs.techTransferAnalysis : [];
    if (ttImgs.length) {
      const first = ttImgs[0];
      const decoded = first.dataUrl ? dataUrlToBytes(first.dataUrl) : null;
      if (decoded) {
        try {
          const embedded =
            decoded.mime.includes("png") ? await pdfDoc.embedPng(decoded.bytes) : await pdfDoc.embedJpg(decoded.bytes);
          const box = { x: 70, yTop: 112, width: 470, height: 62 };
          const thumbW = 70;
          const thumbH = 45;
          const scale = Math.min(thumbW / embedded.width, thumbH / embedded.height);
          const w = embedded.width * scale;
          const imgH = embedded.height * scale;
          const xImg = box.x + box.width - w - 8;
          const yImgTop = h7 - box.yTop + 6;
          p7.drawImage(embedded, {
            x: xImg,
            y: yImgTop - imgH,
            width: w,
            height: imgH,
          });
        } catch {
          // ignore
        }
      }
    }
  }

  // Page 8 (index 7): 智財/專利檢索 + 預期效益文字區（與 Tab5 對應）
  if (pdfDoc.getPageCount() >= 8) {
    const p8 = pdfDoc.getPage(7);
    const { height: h8 } = p8.getSize();

    if (planContent?.formData?.ipRisk) {
      drawMultilineBoxFit({
        page: p8,
        x: 70,
        yTopFromBottom: 758,
        width: 470,
        height: 125,
        text: asString(planContent.formData.ipRisk),
        font,
        fontSize: 10,
        minFontSize: 7,
        lineHeight: 14,
      });
      const ipImgs = Array.isArray(pcImgs.ipRisk) ? pcImgs.ipRisk : [];
      if (ipImgs.length) {
        const first = ipImgs[0];
        const decoded = first.dataUrl ? dataUrlToBytes(first.dataUrl) : null;
        if (decoded) {
          try {
            const embedded =
              decoded.mime.includes("png") ? await pdfDoc.embedPng(decoded.bytes) : await pdfDoc.embedJpg(decoded.bytes);
            const box = { x: 70, yTop: 758, width: 470, height: 125 };
            const thumbW = 80;
            const thumbH = 60;
            const scale = Math.min(thumbW / embedded.width, thumbH / embedded.height);
            const w = embedded.width * scale;
            const imgH = embedded.height * scale;
            const xImg = box.x + box.width - w - 8;
            const yImgTop = h8 - box.yTop + 8;
            p8.drawImage(embedded, {
              x: xImg,
              y: yImgTop - imgH,
              width: w,
              height: imgH,
            });
          } catch {
            // ignore
          }
        }
      }
    }

    const eb = expectedBenefits?.formData;
    if (eb) {
      // 量化效益分析（敘述）
      drawMultilineBoxFit({
        page: p8,
        x: 70,
        yTopFromBottom: 675,
        width: 470,
        height: 155,
        text: asString(eb.quantitativeNarrative),
        font,
        fontSize: 10,
        minFontSize: 7,
        lineHeight: 14,
      });

      // 非量化效益
      drawMultilineBoxFit({
        page: p8,
        x: 70,
        yTopFromBottom: 510,
        width: 470,
        height: 120,
        text: asString(eb.qualitativeBenefits),
        font,
        fontSize: 10,
        minFontSize: 7,
        lineHeight: 14,
      });

      // 完成後影響（先塞入剩餘區塊，若溢出留待後續頁補強）
      drawMultilineBoxFit({
        page: p8,
        x: 70,
        yTopFromBottom: 385,
        width: 470,
        height: 140,
        text: [asString(eb.impactOnCompany), asString(eb.impactOnIndustry)].filter(Boolean).join("\n\n"),
        font,
        fontSize: 10,
        minFontSize: 7,
        lineHeight: 14,
      });
    }
  }

  // --- 附件附錄頁：把 Drive 連結列出 ---
  const appendix = pdfDoc.addPage();
  const { height: ah } = appendix.getSize();
  appendix.drawText("附件附錄（Drive 連結彙整）", { x: 56, y: ah - 56, size: 14, font: fontBold, color: rgb(0, 0, 0) });
  const startY = ah - 86;
  let y = startY;
  const lineH = 16;
  if (!files.length) {
    appendix.drawText("（尚未上傳附件）", { x: 56, y, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
  } else {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const name = `${i + 1}. ${f.name || "未命名檔案"}`;
      const link = f.drive?.webViewLink || "";
      appendix.drawText(name, { x: 56, y, size: 11, font, color: rgb(0, 0, 0) });
      y -= lineH;
      if (link) {
        appendix.drawText(link, { x: 72, y, size: 9.5, font, color: rgb(0.15, 0.35, 0.9) });
        y -= lineH;
      }
      y -= 4;
      if (y < 56) break;
    }
  }

    const out = await pdfDoc.save();
    return new NextResponse(Buffer.from(out), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": buildContentDisposition(filename),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PDF generation failed";
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        hint: "若是特定欄位內容造成失敗，請先嘗試移除特殊符號或超長內容再試；我也可以依錯誤訊息精準修正。",
      },
      { status: 500 }
    );
  }
}

