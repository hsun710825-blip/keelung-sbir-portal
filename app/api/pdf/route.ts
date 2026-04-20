import { NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import fs from "node:fs";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getServerSession } from "next-auth";
import { getDriveOauthClient } from "../_driveOauth";
import { authOptions } from "../auth/[...nextauth]/authOptions";
import { withGoogleApiRetry } from "../_googleApiRetry";
import { renderSummaryPageBuffer, renderTreeBranchPageBuffer, type PdfTreeNodeData } from "../../../components/PdfSummaryPage";
import { formatRocDateLongFromIso } from "../../../lib/dateRoc";
import {
  BUDGET_SUMMARY_TABLE_NOTE,
  CONSUMABLES_TABLE_NOTE,
  EQUIPMENT_USE_TABLE_NOTE,
  EXPECTED_BENEFITS_HINT,
  HUMAN_TEAM_TABLE_NOTE,
  PERSONNEL_FEE_TABLE_NOTE,
  SCHEDULE_PROGRESS_WRITE_HINT,
  SCHEDULE_KPI_TABLE_NOTE,
  SCHEDULE_PROGRESS_TABLE_NOTE,
} from "../../../lib/sbirAppendixNotes";
import { writeAuditLog } from "../../../lib/audit";

type AnyRecord = Record<string, unknown>;
type FileItem = {
  id?: string;
  name?: string;
  status?: string;
  drive?: { id?: string; name?: string; webViewLink?: string; webContentLink?: string } | null;
  attachmentIndex?: 1 | 2 | 3 | 4 | 5;
};

type UploadedImage = {
  id?: string;
  name?: string;
  size?: string;
  url?: string;
  dataUrl?: string;
};

// PDF API 限流視窗：用於保護伺服器，避免預覽/下載按鈕被連點造成 CPU 風暴。
const PDF_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const PDF_RATE_LIMIT_MAX = 2;
const pdfRateLimiter = new Map<string, number[]>();

function getClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",").map((s) => s.trim()).filter(Boolean)[0];
  return first || "unknown-ip";
}

function consumePdfRateLimit(key: string) {
  const now = Date.now();
  const hits = (pdfRateLimiter.get(key) || []).filter((ts) => now - ts < PDF_RATE_LIMIT_WINDOW_MS);
  if (hits.length >= PDF_RATE_LIMIT_MAX) {
    pdfRateLimiter.set(key, hits);
    return false;
  }
  hits.push(now);
  pdfRateLimiter.set(key, hits);
  return true;
}

type CompanyProfileDraft = {
  formData: {
    companyName: string;
    establishDate: string;
    taxId: string;
    phone: string;
    mobilePhone?: string;
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
  architectureTree?: { id: string; text: string; weight?: string; execUnit?: string; children: unknown[] };
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

type ScheduleCheckpointsDraft = {
  rows: Array<{
    id: string;
    item: string;
    weight: string;
    manMonths: string;
    months: Record<string, boolean>;
  }>;
  kpis: Array<{
    code: string;
    description: string;
    period: string;
    weight: string;
    staffCode: string;
  }>;
  notes?: { progressNote?: string; kpiNote?: string };
  testReportImages?: Array<{ id: string; name: string; size: string; url: string }>;
};

type HumanBudgetDraft = {
  piProfile?: {
    name?: string;
    salutation?: string;
    id?: string;
    birth?: string;
    applicant?: string;
    title?: string;
    outsideYears?: string;
    insideYears?: string;
    field?: string;
    achievements?: string;
  };
  piEducation?: Array<{ school: string; time: string; degree: string; dept: string }>;
  piExperience?: Array<{ org: string; time: string; dept: string; title: string }>;
  piProjects?: Array<{ org: string; time: string; name: string; task: string }>;
  team?: Array<{
    no: string;
    name: string;
    title: string;
    education: string;
    experience: string;
    achievements: string;
    years: string;
    tasks: string;
    months: string;
  }>;
  manpowerStats?: Array<{
    company: string;
    phd: string;
    master: string;
    bachelor: string;
    junior: string;
    male: string;
    female: string;
    avgAge: string;
    avgYears: string;
    toHire: string;
  }>;
  budgetRows?: Array<{ subject: string; item: string; gov: string; self: string; total: string; ratio: string }>;
  personnelCosts?: Array<{ name: string; avgSalary: string; manMonths: string; cost: string }>;
  consultantCosts?: Array<{ name: string; avgSalary: string; manMonths: string; cost: string }>;
  consumables?: Array<{ item: string; unit: string; qty: string; price: string; total: string }>;
  equipments?: {
    existing: Array<{ name: string; assetId: string; valueA: string; countB: string; remainingYears: string; monthlyFee: string; months: string; total: string }>;
    new: Array<{ name: string; assetId: string; valueA: string; countB: string; remainingYears: string; monthlyFee: string; months: string; total: string }>;
  };
  equipmentMaintenanceCosts?: Array<{ item: string; gov: string; self: string }>;
  techIntroCosts?: {
    buy?: Array<{ item: string; gov: string; self: string }>;
    research?: Array<{ item: string; gov: string; self: string }>;
    service?: Array<{ item: string; gov: string; self: string }>;
    design?: Array<{ item: string; gov: string; self: string }>;
  };
};

function asString(v: unknown) {
  const raw = typeof v === "string" ? v : v == null ? "" : String(v);
  // Remove control chars that can break PDF text encoding/extraction (keep newlines).
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    // Some inputs may contain BOM/zero-width chars that render as tofu/garbage in certain viewers.
    .replace(/[\uFEFF\u200B-\u200D\u2060]/g, "");
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

function normalizePdfMultilineText(input: unknown): string {
  return String(input ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
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
  const t = normalizePdfMultilineText(text).trim();
  if (!t) return;
  const drawColor = rgb(opts.color?.r ?? 0, opts.color?.g ?? 0, opts.color?.b ?? 0);
  const lines = t.split("\n");
  const lineHeight = Math.max(size * 1.25, size + 1.5);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    page.drawText(line, {
      x,
      y: y - i * lineHeight,
      size,
      font,
      color: drawColor,
    });
  }
}

function drawWhiteRect(page: PDFPage, x: number, y: number, w: number, h: number) {
  page.drawRectangle({ x, y, width: w, height: h, color: rgb(1, 1, 1) });
}

function drawWhiteRectInset(page: PDFPage, x: number, y: number, w: number, h: number, inset = 1) {
  drawWhiteRect(page, x + inset, y + inset, Math.max(0, w - inset * 2), Math.max(0, h - inset * 2));
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

function pageDrawMark(page: PDFPage, cx: number, yBaseline: number) {
  const size = 6;
  page.drawRectangle({ x: cx - size / 2, y: yBaseline - 3, width: size, height: size, color: rgb(0, 0, 0) });
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
  // When content is long, we prefer fitting into existing template pages (avoid truncation)
  // by allowing smaller font sizes than the caller's minFontSize.
  // This provides "auto pagination"-like behavior without shifting page indices.
  const min = opts.minFontSize ?? 7;
  const lowerBound = Math.min(min, 5);
  let size = opts.fontSize;
  while (size >= lowerBound) {
    const lines = wrapText(opts.text, opts.width, opts.font, size);
    const maxLines = Math.floor(opts.height / opts.lineHeight);
    if (lines.length <= maxLines) break;
    size -= 0.5;
  }
  drawMultilineBox({ ...opts, fontSize: Math.max(lowerBound, size) });
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

function parseTreeFromJson(json: string) {
  const t = String(json || "").trim();
  if (!t) return null;
  try {
    const parsed: unknown = JSON.parse(t);
    return parsed && typeof parsed === "object" ? (parsed as AnyRecord) : null;
  } catch {
    return null;
  }
}

function asTreeNode(v: unknown): { text: string; weight: string; execUnit: string; children: unknown[] } | null {
  if (!v || typeof v !== "object") return null;
  const o = v as AnyRecord;
  const text = asString(o.text);
  const weight = asString(o.weight);
  const execUnit = asString(o.execUnit);
  const children = Array.isArray(o.children) ? (o.children as unknown[]) : [];
  return { text, weight, execUnit, children };
}

type TreeNodeView = { text: string; weight: string; execUnit: string; children: unknown[] };

function toPdfTreeNodeData(node: TreeNodeView): PdfTreeNodeData {
  const children = node.children.map(asTreeNode).filter(Boolean) as TreeNodeView[];
  const mapped = children.map((c) => toPdfTreeNodeData(c));
  const base: PdfTreeNodeData = {
    name: asString(node.text),
    unit: asString(node.execUnit),
    weight: asString(node.weight),
  };
  if (mapped.length > 0) base.children = mapped;
  return base;
}

function drawLine(page: PDFPage, x1: number, y1: number, x2: number, y2: number, thickness = 1) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: rgb(0, 0, 0) });
}

function drawTreeNodeLabel(opts: {
  page: PDFPage;
  x: number;
  y: number;
  node?: { text: string; weight: string; execUnit: string } | null;
  font: PDFFont;
  bold?: PDFFont;
  maxHeight?: number;
  compact?: boolean;
  mergeMetaLine?: boolean;
  scale?: number;
  maxWidth?: number;
  drawMask?: boolean;
  maskPadding?: number;
  maskOnly?: boolean;
  textOnly?: boolean;
}) {
  const { page, x, y, node, font } = opts;
  if (!node) return;
  const t = asString(node.text);
  const w = asString(node.weight);
  const u = asString(node.execUnit);
  const metaLine = w || u ? `權重：${w || "0"}%${u ? `(${u})` : ""}` : "";
  const lines = [t, opts.mergeMetaLine ? metaLine : (w ? `權重：${w}%` : ""), opts.mergeMetaLine ? "" : (u ? `執行單位：${u}` : "")]
    .filter(Boolean);
  if (!lines.length) return;

  const maxH = Math.max(12, opts.maxHeight ?? 40);
  const maxW = Math.max(36, opts.maxWidth ?? 9999);
  const compact = Boolean(opts.compact);
  const scale = Math.max(0.68, Math.min(1, opts.scale ?? 1));
  let size = (compact ? 8.5 : 10) * scale;
  let lineHeight = (compact ? 9.5 : 13) * scale;
  let shown = [...lines];

  while (shown.length * lineHeight > maxH && shown.length > 1) shown.pop();
  const measureLine = (line: string, idx: number, s: number) => {
    const f = idx === 0 ? (opts.bold ?? font) : font;
    const lineSize = idx === 0 ? s : Math.max(6.5, s - 0.8);
    return f.widthOfTextAtSize(line, lineSize);
  };
  const widestLine = (s: number) => shown.reduce((m, line, idx) => Math.max(m, measureLine(line, idx, s)), 0);
  while ((shown.length * lineHeight > maxH || widestLine(size) > maxW) && size > 6.5) {
    size -= 0.5;
    lineHeight = Math.max(7.5, size + 1.3);
    while (shown.length * lineHeight > maxH && shown.length > 1) shown.pop();
  }
  if (shown.length < lines.length && shown.length > 0) {
    shown[shown.length - 1] = `${shown[shown.length - 1]}…`;
  }
  while (widestLine(size) > maxW && shown.length > 1) {
    shown.pop();
    if (shown.length > 0) shown[shown.length - 1] = `${shown[shown.length - 1]}…`;
  }

  const renderedW = widestLine(size);
  const renderedH = Math.max(1, shown.length) * lineHeight;
  if (opts.drawMask !== false && !opts.textOnly) {
    const pad = Math.max(1.5, opts.maskPadding ?? 2);
    page.drawRectangle({
      x: x - pad,
      y: y - renderedH - pad + 1,
      width: renderedW + pad * 2,
      height: renderedH + pad * 2,
      color: rgb(1, 1, 1),
    });
  }
  if (opts.maskOnly) return;

  shown.forEach((line, idx) => {
    drawTextTopLeft({
      page,
      x,
      y: y - idx * lineHeight,
      text: line,
      size: idx === 0 ? size : Math.max(6.5, size - 0.8),
      font: idx === 0 ? (opts.bold ?? font) : font,
    });
  });
}

function drawDynamicTreeDiagram(opts: {
  page: PDFPage;
  root: TreeNodeView;
  font: PDFFont;
  fontBold: PDFFont;
  leftX: number;
  midX: number;
  rightX: number;
  yTop: number;
  yBottom: number;
  minBranchGap?: number;
  minDepthGapX?: number;
}): { usedBranches: number; hiddenBranches: number } {
  const { page, root, font, fontBold, leftX, midX, rightX, yTop, yBottom } = opts;
  const firstLevel = root.children.map(asTreeNode).filter(Boolean) as TreeNodeView[];
  const minBranchGap = Math.max(18, opts.minBranchGap ?? 24);
  const minDepthGapX = Math.max(80, opts.minDepthGapX ?? 104);
  const availableH = Math.max(60, yTop - yBottom);
  const allBranches = firstLevel.length > 0 ? firstLevel : [{ text: "（未填寫分項）", weight: "", execUnit: "", children: [] as unknown[] }];
  const renderRoot: TreeNodeView = { text: root.text, weight: root.weight, execUnit: root.execUnit, children: allBranches };

  type PositionedNode = { node: TreeNodeView; depth: number; leafIndex: number; y: number };
  const positioned: PositionedNode[] = [];
  const edges: Array<{ from: PositionedNode; to: PositionedNode }> = [];
  let leafCursor = 0;
  let maxDepth = 0;

  const walk = (n: TreeNodeView, depth: number, parent: PositionedNode | null): PositionedNode => {
    maxDepth = Math.max(maxDepth, depth);
    const kids = n.children.map(asTreeNode).filter(Boolean) as TreeNodeView[];
    let current: PositionedNode;
    if (!kids.length) {
      current = { node: n, depth, leafIndex: leafCursor++, y: 0 };
      positioned.push(current);
    } else {
      const childPos = kids.map((k) => walk(k, depth + 1, null));
      const avgLeaf = childPos.reduce((s, p) => s + p.leafIndex, 0) / childPos.length;
      current = { node: n, depth, leafIndex: avgLeaf, y: 0 };
      positioned.push(current);
      childPos.forEach((c) => edges.push({ from: current, to: c }));
    }
    if (parent) edges.push({ from: parent, to: current });
    return current;
  };
  walk(renderRoot, 0, null);

  const leafCount = Math.max(1, leafCursor);
  const top = yTop - 8;
  const bottom = yBottom + 8;
  const step = leafCount <= 1 ? 0 : (top - bottom) / Math.max(1, leafCount - 1);
  const usableW = Math.max(120, rightX - leftX - 10);
  const computedDepthGap = maxDepth <= 0 ? usableW : usableW / Math.max(1, maxDepth);
  const depthGap = Math.max(minDepthGapX, computedDepthGap);
  const requiredW = maxDepth * depthGap;
  const baseLeftX = Math.max(36, requiredW > usableW ? rightX - requiredW : leftX);

  positioned.forEach((p) => {
    p.y = leafCount <= 1 ? (top + bottom) / 2 : top - p.leafIndex * step;
  });

  const depthMap = new Map<number, PositionedNode[]>();
  positioned.forEach((p) => {
    const arr = depthMap.get(p.depth) ?? [];
    arr.push(p);
    depthMap.set(p.depth, arr);
  });
  depthMap.forEach((arr) => arr.sort((a, b) => b.y - a.y));

  const depthTightRatio = maxDepth > 0 ? usableW / Math.max(1, maxDepth * minDepthGapX) : 1;
  const textScale = Math.max(0.68, Math.min(1, depthTightRatio));
  const metrics = new Map<PositionedNode, { x: number; y: number; anchorOutX: number; anchorInX: number; lineY: number; slotH: number }>();

  positioned.forEach((p) => {
    const x = baseLeftX + p.depth * depthGap;
    const group = depthMap.get(p.depth) ?? [p];
    const idx = group.indexOf(p);
    const prev = idx > 0 ? group[idx - 1]!.y : p.y + minBranchGap;
    const next = idx < group.length - 1 ? group[idx + 1]!.y : p.y - minBranchGap;
    const slotH = Math.max(14, (prev - next) * 0.7);
    const compact = slotH < 30;
    const maxLabelW = Math.max(48, depthGap - 28);
    const lineY = p.y - Math.max(6, 9 * textScale);
    const columnStart = baseLeftX + p.depth * depthGap;
    const columnEnd = columnStart + depthGap;
    metrics.set(p, {
      x,
      y: p.y + Math.max(10, 15 * textScale),
      // Keep connectors column-based (not text-width-based), so edges never disappear.
      anchorOutX: Math.min(columnEnd - 20, columnStart + Math.max(28, depthGap * 0.44)),
      anchorInX: Math.max(columnStart - 14, columnStart - Math.max(14, depthGap * 0.12)),
      lineY,
      slotH,
    });
  });

  // Pass 1: draw node masks first so lines are never hidden by masks.
  positioned.forEach((p) => {
    const m = metrics.get(p);
    if (!m) return;
    drawTreeNodeLabel({
      page,
      x: m.x,
      y: m.y,
      node: { text: p.node.text, weight: p.node.weight, execUnit: p.node.execUnit },
      font,
      bold: p.depth <= 1 ? fontBold : undefined,
      maxHeight: Math.min(34, m.slotH),
      compact: m.slotH < 30,
      mergeMetaLine: true,
      scale: textScale,
      maxWidth: Math.max(44, depthGap - 34),
      drawMask: true,
      maskPadding: 1.5,
      maskOnly: true,
    });
  });

  // Pass 2: draw edges on top of mask.
  edges.forEach(({ from, to }) => {
    const fm = metrics.get(from);
    const tm = metrics.get(to);
    if (!fm || !tm) return;
    const startX = fm.anchorOutX;
    const endX = tm.anchorInX;
    const y1 = fm.lineY;
    const y2 = tm.lineY;
    // Never drop an edge: clamp to a minimum visible elbow/segment even in tight space.
    const sX = Math.min(startX, endX - 20);
    const eX = Math.max(endX, sX + 14);
    const elbowX = Math.max(sX + 8, Math.min(eX - 6, sX + Math.max(10, (eX - sX) * 0.45)));
    drawLine(page, sX, y1, elbowX, y1, 1.4);
    if (Math.abs(y2 - y1) > 0.5) drawLine(page, elbowX, y1, elbowX, y2, 1.4);
    drawLine(page, elbowX, y2, eX, y2, 1.4);
    drawLine(page, eX, y2, eX + 8, y2, 1.4);
  });

  // Pass 3: draw node text above edges.
  positioned.forEach((p) => {
    const m = metrics.get(p);
    if (!m) return;
    drawTreeNodeLabel({
      page,
      x: m.x,
      y: m.y,
      node: { text: p.node.text, weight: p.node.weight, execUnit: p.node.execUnit },
      font,
      bold: p.depth <= 1 ? fontBold : undefined,
      maxHeight: Math.min(34, m.slotH),
      compact: m.slotH < 30,
      mergeMetaLine: true,
      scale: textScale,
      maxWidth: Math.max(44, depthGap - 34),
      drawMask: false,
      textOnly: true,
    });
  });
  return { usedBranches: allBranches.length, hiddenBranches: 0 };
}

function drawSectionPageNumbers(pdfDoc: PDFDocument, font: PDFFont, startPageIndex: number) {
  const pages = pdfDoc.getPages();
  let n = 1;
  for (let i = startPageIndex; i < pages.length; i++) {
    const p = pages[i]!;
    const { width, height } = p.getSize();
    const label = String(n++);
    const size = 10;
    const w = font.widthOfTextAtSize(label, size);
    // Bottom-center page numbers
    p.drawText(label, { x: width / 2 - w / 2, y: 26, size, font, color: rgb(0, 0, 0) });
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

function guessMimeByName(name: string) {
  const n = String(name || "").toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".jfif")) return "image/jpeg";
  return "";
}

async function appendDriveAttachments(opts: { pdfDoc: PDFDocument; files: FileItem[]; fontBold: PDFFont }) {
  const { pdfDoc, files, fontBold } = opts;
  const drive = getDriveOauthClient();

  for (const f of files) {
    const id = f.drive?.id;
    if (!id) continue;
    const name = f.drive?.name || f.name || "attachment";
    const mime = guessMimeByName(name);
    if (!mime) continue;

    try {
      const dl = await withGoogleApiRetry(`pdf.drive.get.${id}`, () =>
        drive.files.get(
          { fileId: id, alt: "media", supportsAllDrives: true },
          { responseType: "arraybuffer" },
        ),
      );
      const bytes = Buffer.from(dl.data as ArrayBuffer);

      if (mime === "application/pdf") {
        const src = await PDFDocument.load(bytes);
        const copied = await pdfDoc.copyPages(src, src.getPageIndices());
        const attachmentLabel =
          f.attachmentIndex === 1
            ? "附件一"
            : f.attachmentIndex === 2
              ? "附件二"
              : f.attachmentIndex === 3
                ? "附件三"
                : f.attachmentIndex === 4
                  ? "附件四"
                  : f.attachmentIndex === 5
                    ? "附件五"
                  : "";

        copied.forEach((p, idx) => {
          if (idx === 0 && attachmentLabel) {
            const { height } = p.getSize();
            p.drawText(attachmentLabel, { x: 56, y: height - 28, size: 14, font: fontBold, color: rgb(0, 0, 0) });
          }
          pdfDoc.addPage(p);
        });
        continue;
      }

      if (mime === "image/png" || mime === "image/jpeg") {
        const embedded = mime === "image/png" ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const margin = 36;
        const maxW = width - margin * 2;
        const maxH = height - margin * 2;
        const scale = Math.min(maxW / embedded.width, maxH / embedded.height);
        const w = embedded.width * scale;
        const h = embedded.height * scale;
        page.drawImage(embedded, {
          x: (width - w) / 2,
          y: (height - h) / 2,
          width: w,
          height: h,
        });
      }
    } catch {
      // Ignore attachment failures; links remain listed in appendix.
    }
  }
}

async function drawImageGridInBox(opts: {
  pdfDoc: PDFDocument;
  page: PDFPage;
  pageHeight: number;
  images: UploadedImage[];
  box: { x: number; yTopFromBottom: number; width: number; height: number };
  columns?: number;
  gap?: number;
}) {
  const { pdfDoc, page, pageHeight, box } = opts;
  const images = (opts.images || []).filter((x) => x && (x.dataUrl || x.url));
  if (images.length === 0) return;

  const cols = Math.max(1, opts.columns ?? 3);
  const gap = Math.max(4, opts.gap ?? 8);
  const cellW = (box.width - gap * (cols - 1)) / cols;
  const cellH = cellW * 0.75; // 4:3-ish thumbnails
  const rows = Math.max(1, Math.floor((box.height + gap) / (cellH + gap)));
  const max = Math.min(images.length, rows * cols);

  for (let i = 0; i < max; i++) {
    const img = images[i];
    const decoded = img.dataUrl ? dataUrlToBytes(img.dataUrl) : null;
    if (!decoded) continue;
    try {
      const embedded = decoded.mime.includes("png") ? await pdfDoc.embedPng(decoded.bytes) : await pdfDoc.embedJpg(decoded.bytes);
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = box.x + c * (cellW + gap);
      const yTop = box.yTopFromBottom - r * (cellH + gap);
      const yFromBottom = pageHeight - yTop;
      const scale = Math.min(cellW / embedded.width, cellH / embedded.height);
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      page.drawImage(embedded, {
        x: x + (cellW - w) / 2,
        y: yFromBottom + (cellH - h) / 2,
        width: w,
        height: h,
      });
    } catch {
      // ignore
    }
  }
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
    const session = await getServerSession(authOptions);
    const userKey = session?.user?.email?.trim() || session?.user?.name || "anonymous";
    const ip = getClientIp(req);
    if (!consumePdfRateLimit(`${userKey}:${ip}`)) {
      return NextResponse.json({ ok: false, error: "Too many PDF requests, please retry later." }, { status: 429 });
    }

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
    // Use bundled fonts first so local/dev/prod render metrics are consistent.
    // NOTE: Avoid TTC collections; pdf-lib/fontkit prefers single-font TTF/OTF files.
    const bundledRegularTtf = path.join(process.cwd(), "assets", "fonts", "NotoSansTC-Regular.ttf");
    const bundledBoldTtf = path.join(process.cwd(), "assets", "fonts", "NotoSansTC-Bold.ttf");
    const bundledRegularOtf = path.join(process.cwd(), "assets", "fonts", "NotoSansTC-Regular.otf");
    const bundledBoldOtf = path.join(process.cwd(), "assets", "fonts", "NotoSansTC-Bold.otf");
    const winRegularTtf = "C:\\\\Windows\\\\Fonts\\\\msjh.ttf";
    const winBoldTtf = "C:\\\\Windows\\\\Fonts\\\\msjhbd.ttf";
    const winFallbackTtf = "C:\\\\Windows\\\\Fonts\\\\kaiu.ttf";

    // For maximum viewer compatibility, prefer TTF when available.
    const regularPath = [bundledRegularTtf, bundledRegularOtf, winRegularTtf, winFallbackTtf].find((p) => fs.existsSync(p));

    // If Bold TTF doesn't exist, fall back to Regular TTF instead of OTF.
    const boldPath = [bundledBoldTtf, bundledBoldOtf, bundledRegularTtf, bundledRegularOtf, winBoldTtf, winFallbackTtf].find((p) => fs.existsSync(p));

    if (!regularPath || !boldPath) {
      throw new Error("Missing CJK font files for PDF generation");
    }

    const fontBytes = await readFile(regularPath);
    const fontBoldBytes = await readFile(boldPath);
    // Keep full glyph set to avoid any missing characters in exported text.
    const font = await pdfDoc.embedFont(fontBytes, { subset: false });
    // Viewer compatibility:
    // Some environments/viewers (especially after Drive download/re-save) may mishandle bold embedded fonts.
    // To keep headings/cover readable, use the same font instance for "bold" rendering.
    // (We still read the bold font bytes so the app doesn't depend on existence order.)
    const fontBold = font;

    const pages = pdfDoc.getPages();
    const p1 = pages[0];
    const p2 = pages[1];

    // For dynamic TOC/page numbering (filled after we insert TOC and section pages).
    let tocPageRef: PDFPage | null = null;
    let p4Ref: PDFPage | null = null;
    let p5Ref: PDFPage | null = null;
    let p6Ref: PDFPage | null = null;
    let p7Ref: PDFPage | null = null;
    let p8Ref: PDFPage | null = null;
    let p9Ref: PDFPage | null = null;
    let p11Ref: PDFPage | null = null;
    let attachmentsSectionRef: PDFPage | null = null;

  // --- Page 1: 封面（座標為「距離上方」yTop，需視版型微調） ---
  const projectCategory = asString(formData.projectCategory);
  const projectName = asString(formData.projectName);
  const startRaw = asString(formData.projectStartDate);
  const endRaw = asString(formData.projectEndDate);
  const months = asString(formData.projectMonths) || computeProjectMonths(startRaw, endRaw);
  const companyProfile = (formData.companyProfile as CompanyProfileDraft | null) || null;
  const companyName = asString(formData.companyName) || asString(companyProfile?.formData?.companyName);
  const leaderName = asString(formData.leaderName) || asString(companyProfile?.formData?.representative);
  const now = new Date();
  const fallbackSubmitYear = toRocYear(now.getFullYear());
  const fallbackSubmitMonth = String(now.getMonth() + 1);
  const submitYear = asString(formData.submitYear) || fallbackSubmitYear;
  const submitMonth = asString(formData.submitMonth) || fallbackSubmitMonth;
  const schedule = (formData.scheduleCheckpoints as ScheduleCheckpointsDraft | null) || null;

  // 勾選框（改成實心正方框）— 版型空心方框座標：技術(220,654)、服務(308,654)
  if (projectCategory.includes("技術")) {
    drawFilledCheckbox(p1, 220, 654);
  }
  if (projectCategory.includes("服務")) {
    drawFilledCheckbox(p1, 308, 654);
  }

  // 申請計畫名稱 — 遮罩掉「＜申請計畫名稱＞」並改成置中/逐行向下
  // 加大遮罩，避免殘留點點底線
  {
    const boxX = 120;
    const boxY = 520;
    const boxW = 360;
    const boxH = 42;
    const padX = 12;
    const maxLines = 2; // 封面標題盡量維持在一組兩列以免擠壓下方
    drawWhiteRect(p1, boxX, boxY, boxW, boxH);

    // Auto-reduce font size if wrapping would exceed allowed lines.
    let fontSize = 16;
    const availableW = boxW - padX * 2;
    while (fontSize >= 11) {
      const testLines = wrapText(projectName, availableW, fontBold, fontSize);
      if (testLines.length <= maxLines) break;
      fontSize -= 0.5;
    }

    const lines = wrapText(projectName, availableW, fontBold, fontSize).slice(0, maxLines);
    const lineHeight = fontSize * 1.18;
    const totalTextHeight = (lines.length - 1) * lineHeight + fontSize;
    // Empirically: move a bit downward to match template baseline visually.
    const verticalNudge = -6;
    const yFirst = boxY + (boxH - totalTextHeight) / 2 + verticalNudge;
    for (let i = 0; i < lines.length; i++) {
      const w = fontBold.widthOfTextAtSize(lines[i], fontSize);
      drawTextTopLeft({
        page: p1,
        x: boxX + (boxW - w) / 2,
        y: yFirst + i * lineHeight,
        text: lines[i],
        size: fontSize,
        font: fontBold,
      });
    }
  }

  // 計畫期間 / 月數
  // 原版型是「圓圈填數字 + 年/月/日」；實務上容易與字型/遮罩互相干擾，
  // 這裡改成：把整段欄位清空後，直接以完整日期字串印上去，確保不會出現括號/冒號/被切字。
  const s = parseYmd(startRaw);
  const e = parseYmd(endRaw);
  if (s && e) {
    const planMonths = months || computeProjectMonths(startRaw, endRaw) || "";
    const planPeriodText = `計畫期間：${toRocYear(s.y)}年${s.mo}月${s.d}日至${toRocYear(e.y)}年${e.mo}月${e.d}日止（共${planMonths}個月）`;
    // 清掉「計畫期間」兩行區塊後重印，避免殘留模板字樣/（共○個月）造成怪字。
    drawWhiteRect(p1, 120, 372, 480, 84);
    const size = fitFontSizeToWidth(planPeriodText, font, 10.5, 400);
    drawTextTopLeft({ page: p1, x: 160, y: 419, text: planPeriodText, size, font });
  }

  // 公司名稱 / 負責人 — 整區白底雙層遮罩再畫「標籤：＋數值」，消除背景雜訊
  const coverLeft = 94;
  const coverW = 432;
  const coverY1 = 326;
  const coverY2 = 288;
  const coverH = 32;
  drawWhiteRect(p1, coverLeft, coverY2, coverW, coverY1 - coverY2 + coverH);
  drawWhiteRect(p1, coverLeft, coverY2, coverW, coverY1 - coverY2 + coverH);
  drawCenteredInBox({ page: p1, x: coverLeft, y: 334, width: coverW, height: 22, text: `公司名稱：${companyName || ""}`, font, fontSize: 11 });
  drawCenteredInBox({ page: p1, x: coverLeft, y: 297, width: coverW, height: 22, text: `負責人：${leaderName || ""}`, font, fontSize: 11 });

  // 日期（民國年/月）— 錨點：中(214,201)、年(326,201)、月(368,201)
  // 圓圈座標：y=201 xs=[305,347]
  // Avoid circle masking glitches (sometimes leaves stray ')' depending on viewer/font).
  // Clear the whole bottom date line and redraw as plain text.
  {
    drawWhiteRect(p1, 160, 186, 320, 40);
    const dt = `中 華 民 國 ${submitYear} 年 ${submitMonth} 月`;
    const w = font.widthOfTextAtSize(dt, 12);
    drawTextTopLeft({ page: p1, x: p1.getSize().width / 2 - w / 2, y: 201, text: dt, size: 12, font });
  }

  // --- Page 2: 摘要表 + Page 3: 目錄（必須在 flow 前完成，否則 flow 第一頁會被 remove(2) 刪掉） ---
  drawTextTopLeft({ page: p2, x: 150, y: 679, text: companyName, size: 10.5, font });
  drawTextTopLeft({ page: p2, x: 150, y: 658, text: asString(formData.foundingDate), size: 10.5, font });
  drawTextTopLeft({ page: p2, x: 150, y: 637, text: leaderName, size: 10.5, font });
  drawTextTopLeft({ page: p2, x: 170, y: 616, text: asString(formData.mainBusinessItems), size: 10.5, font });
  if (pdfDoc.getPageCount() >= 3) {
    pdfDoc.removePage(2);
  }
  const toc = pdfDoc.insertPage(2);
  tocPageRef = toc;
  const { width: tw, height: th } = toc.getSize();
  toc.drawText("目 錄", { x: tw / 2 - fontBold.widthOfTextAtSize("目 錄", 18) / 2, y: th - 90, size: 18, font: fontBold, color: rgb(0, 0, 0) });
  const leftX = 78;
  const rightX = tw - 78;
  const dotFontSize = 12;
  const dotW = font.widthOfTextAtSize(".", dotFontSize);
  const dotsColor = rgb(0.55, 0.55, 0.55);
  let yT = th - 150;
  const tocLineH = 20;
  for (const it of [{ label: "壹、公司概況", indent: 0 }, { label: "一、基本資料", indent: 1 }, { label: "二、公司營運及財務狀況", indent: 1 }, { label: "三、曾經參與政府相關研發計畫之實績", indent: 1 }, { label: "貳、計畫內容與實施方式", indent: 0 }, { label: "一、背景與說明", indent: 1 }, { label: "二、國內外產業現況、發展趨勢及競爭力分析", indent: 1 }, { label: "三、創新性說明", indent: 1 }, { label: "四、計畫架構與實施方式", indent: 1 }, { label: "參、預期效益", indent: 0 }, { label: "肆、預定進度及查核點", indent: 0 }, { label: "伍、人力及經費需求表", indent: 0 }, { label: "陸、附件", indent: 0 }]) {
    if (yT < 80) break;
    const indent = (it.indent || 0) * 18;
    toc.drawText(it.label, { x: leftX + indent, y: yT, size: 12, font, color: rgb(0, 0, 0) });
    yT -= tocLineH;
  }

  // --- From 壹 onwards: flow-based content（在 TOC 之後跑，此時僅 3 頁） ---
  while (pdfDoc.getPageCount() > 3) pdfDoc.removePage(3);

  const pageSize = p2.getSize();
  const M = { left: 60, right: 60, top: 70, bottom: 70 };
  const contentW = pageSize.width - M.left - M.right;
  const lineH = 14;
  let cur = pdfDoc.addPage([pageSize.width, pageSize.height]);
  let y = pageSize.height - M.top;

  const newPage = () => {
    cur = pdfDoc.addPage([pageSize.width, pageSize.height]);
    y = pageSize.height - M.top;
  };

  const ensure = (need: number) => {
    if (y - need < M.bottom) newPage();
  };

  const drawHeading = (t: string) => {
    ensure(30);
    cur.drawText(t, { x: M.left, y, size: 16, font: fontBold, color: rgb(0, 0, 0) });
    y -= 26;
  };

  const drawSubHeading = (t: string) => {
    const lines = wrapText(asString(t), contentW, fontBold, 12.5);
    for (const ln of lines) {
      ensure(22);
      cur.drawText(ln, { x: M.left, y, size: 12.5, font: fontBold, color: rgb(0, 0, 0) });
      y -= 20;
    }
  };

  const drawPara = (t: string) => {
    const text = asString(t);
    if (!text) return;
    const lines = wrapText(text, contentW, font, 10.5);
    for (const ln of lines) {
      ensure(lineH + 2);
      cur.drawText(ln, { x: M.left, y, size: 10.5, font, color: rgb(0, 0, 0) });
      y -= lineH;
    }
    y -= 8;
  };

  const drawKV = (label: string, value: string) => {
    const v = asString(value);
    if (!v) return;
    ensure(lineH + 4);
    const l = `${label}：`;
    cur.drawText(l, { x: M.left, y, size: 10.5, font: fontBold, color: rgb(0, 0, 0) });
    const lx = M.left + fontBold.widthOfTextAtSize(l, 10.5) + 6;
    const lines = wrapText(v, contentW - (lx - M.left), font, 10.5);
    cur.drawText(lines[0] || "", { x: lx, y, size: 10.5, font, color: rgb(0, 0, 0) });
    y -= lineH;
    for (let i = 1; i < lines.length; i++) {
      ensure(lineH + 2);
      cur.drawText(lines[i]!, { x: lx, y, size: 10.5, font, color: rgb(0, 0, 0) });
      y -= lineH;
    }
    y -= 4;
  };

  const drawTableFlow = (
    headers: string[],
    rows: string[][],
    colWidths?: number[],
    opts?: { topDownText?: boolean }
  ) => {
    const colCount = headers.length;
    const totalW = contentW;
    const w = colWidths && colWidths.length === colCount ? colWidths : Array.from({ length: colCount }, () => totalW / colCount);
    const baseRowH = 18;
    const cellLineH = 15;
    const headerLinesByCol = headers.map((h, i) => wrapText(h ?? "", (w[i] ?? totalW / colCount) - 8, fontBold, 9.5).slice(0, 4));
    const maxHeaderLines = Math.max(1, ...headerLinesByCol.map((ls) => ls.length || 1));
    const headerH = 12 + maxHeaderLines * cellLineH;
    const rowHeights: number[] = [];
    for (const row of rows) {
      let maxLines = 1;
      for (let c = 0; c < colCount; c++) {
        const lines = wrapText(row[c] ?? "", (w[c] ?? totalW / colCount) - 8, font, 9);
        maxLines = Math.max(maxLines, Math.min(lines.length, 30));
      }
      rowHeights.push(
        opts?.topDownText
          ? 12 + maxLines * cellLineH // top-down 模式需預留上下邊距，避免壓線/超框
          : baseRowH + (maxLines - 1) * cellLineH
      );
    }
    const totalRowH = rowHeights.reduce((a, b) => a + b, 0);
    ensure(headerH + totalRowH + 30);
    const tableTop = y;
    const x0 = M.left;
    let x = x0;
    cur.drawLine({ start: { x: x0, y: tableTop }, end: { x: x0 + totalW, y: tableTop }, thickness: 0.5, color: rgb(0, 0, 0) });
    for (let c = 0; c < colCount; c++) {
      const cw = w[c]!;
      const lines = headerLinesByCol[c] ?? [""];
      const headerContentH = (lines.length || 1) * cellLineH;
      const topPad = Math.max(4, (headerH - headerContentH) / 2);
      for (let li = 0; li < lines.length; li++) {
        cur.drawText(lines[li]!, { x: x + 4, y: tableTop - (topPad + (li + 1) * cellLineH), size: 9.5, font: fontBold, color: rgb(0, 0, 0) });
      }
      x += cw;
    }
    y -= headerH;
    cur.drawLine({ start: { x: x0, y }, end: { x: x0 + totalW, y }, thickness: 0.5, color: rgb(0, 0, 0) });
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri]!;
      const rh = rowHeights[ri] ?? baseRowH;
      y -= rh;
      ensure(rh + 10);
      x = x0;
      for (let c = 0; c < colCount; c++) {
        const cw = w[c]!;
        const cellLines = wrapText(row[c] ?? "", cw - 8, font, 9).slice(0, 30);
        const numLines = cellLines.length || 1;
        const contentH = numLines * cellLineH;
        const topPad = opts?.topDownText ? 6 : Math.max(6, (rh - contentH) / 2);
        for (let li = 0; li < cellLines.length; li++) {
          const yy =
            opts?.topDownText
              ? y + rh - topPad - (li + 1) * cellLineH
              : y + topPad + li * cellLineH;
          cur.drawText(cellLines[li]!, { x: x + 4, y: yy, size: 9, font, color: rgb(0, 0, 0) });
        }
        x += cw;
      }
      cur.drawLine({ start: { x: x0, y }, end: { x: x0 + totalW, y }, thickness: 0.5, color: rgb(0, 0, 0) });
    }
    const tableBottom = y;
    x = x0;
    for (let c = 0; c < colCount; c++) {
      cur.drawLine({ start: { x, y: tableTop }, end: { x, y: tableBottom }, thickness: 0.5, color: rgb(0, 0, 0) });
      x += w[c]!;
    }
    cur.drawLine({ start: { x: x0 + totalW, y: tableTop }, end: { x: x0 + totalW, y: tableBottom }, thickness: 0.5, color: rgb(0, 0, 0) });
    y -= 28;
  };

  const drawParaThenImages = async (text: string, images: unknown[], caption = "說明圖片") => {
    drawPara(text);
    const imgs = Array.isArray(images) ? (images as UploadedImage[]) : [];
    if (imgs.length === 0) {
      drawPara("無");
      return;
    }

    ensure(26);
    cur.drawText(caption, { x: M.left, y, size: 10.5, font: fontBold, color: rgb(0, 0, 0) });
    y -= 18;

    const gap = 8;
    const cols = 2;
    const cellW = (contentW - gap * (cols - 1)) / cols;
    const cellH = cellW * 0.68;
    for (let i = 0; i < imgs.length; i += cols) {
      const rowImgs = imgs.slice(i, i + cols);
      ensure(cellH + 12);
      const rowBottom = y - cellH;
      for (let c = 0; c < rowImgs.length; c++) {
        const img = rowImgs[c]!;
        const decoded = img.dataUrl ? dataUrlToBytes(img.dataUrl) : null;
        if (!decoded) continue;
        try {
          const embedded = decoded.mime.includes("png") ? await pdfDoc.embedPng(decoded.bytes) : await pdfDoc.embedJpg(decoded.bytes);
          const scale = Math.min(cellW / embedded.width, cellH / embedded.height);
          const w = embedded.width * scale;
          const h = embedded.height * scale;
          const x = M.left + c * (cellW + gap) + (cellW - w) / 2;
          const yy = rowBottom + (cellH - h) / 2;
          cur.drawImage(embedded, { x, y: yy, width: w, height: h });
        } catch {
          // ignore invalid image
        }
      }
      y = rowBottom - 10;
    }
  };

  const drawPiProfileTable = (
    pi: AnyRecord,
    edu: AnyRecord[],
    exp: AnyRecord[],
    projs: AnyRecord[]
  ) => {
    const leftW = contentW * 0.15;
    const rightW = contentW - leftW;
    const basicCols = [contentW * 0.15, contentW * 0.35, contentW * 0.15, contentW * 0.35];
    const secCols = [rightW * 0.3, rightW * 0.2, rightW * 0.2, rightW * 0.3];
    const rowH = 18;
    const pad = 4;
    const x0 = M.left;
    const xR = x0 + contentW;

    const eduRows = edu.length ? edu.slice(0, 3).map((r) => [asString(r.school), asString(r.time), asString(r.degree), asString(r.dept)]) : [["", "", "", ""]];
    const expRows = exp.length ? exp.slice(0, 3).map((r) => [asString(r.org), asString(r.time), asString(r.dept), asString(r.title)]) : [["", "", "", ""]];
    const prjRows = projs.length ? projs.slice(0, 3).map((r) => [asString(r.org), asString(r.time), asString(r.name), asString(r.task)]) : [["", "", "", ""]];

    const achievementsText = asString(pi.achievements);
    const achValueColW = Math.max(8, xR - (x0 + leftW) - pad * 2);
    const achLines = wrapText(achievementsText, achValueColW, font, 9);
    const achLineStep = 10.5;
    const achRowH = Math.max(rowH, pad * 2 + achLines.length * achLineStep + 2);

    const totalRows = 6 + (1 + eduRows.length) + (1 + expRows.length) + (1 + prjRows.length);
    const totalH = totalRows * rowH + (achRowH - rowH);
    ensure(totalH + 24);
    const top = y;
    const bottom = top - totalH;
    cur.drawRectangle({ x: x0, y: bottom, width: contentW, height: totalH, borderColor: rgb(0, 0, 0), borderWidth: 0.5 });

    const drawCell = (txt: string, x1: number, x2: number, y1: number, y2: number, bold = false, center = false) => {
      const f = bold ? fontBold : font;
      const size = 9;
      const lines = wrapText(asString(txt), Math.max(8, x2 - x1 - pad * 2), f, size).slice(0, 3);
      const blockH = lines.length * 10.5;
      const baseY = y2 + (y1 - y2 - blockH) / 2 + blockH - 8;
      for (let i = 0; i < lines.length; i++) {
        const w = f.widthOfTextAtSize(lines[i]!, size);
        cur.drawText(lines[i]!, {
          x: center ? x1 + (x2 - x1 - w) / 2 : x1 + pad,
          y: baseY - i * 10.5,
          size,
          font: f,
          color: rgb(0, 0, 0),
        });
      }
    };

    let rowOff = 0;
    const y1 = () => top - rowOff;
    const y2 = () => y1() - rowH;
    const drawH = () => {
      if (rowOff > 0) cur.drawLine({ start: { x: x0, y: y1() }, end: { x: xR, y: y1() }, thickness: 0.5, color: rgb(0, 0, 0) });
    };
    const drawBasic = (a: string, b: string, c: string, d: string) => {
      drawH();
      const bx = [x0, x0 + basicCols[0]!, x0 + basicCols[0]! + basicCols[1]!, x0 + basicCols[0]! + basicCols[1]! + basicCols[2]!, xR];
      cur.drawLine({ start: { x: bx[1]!, y: y1() }, end: { x: bx[1]!, y: y2() }, thickness: 0.5, color: rgb(0, 0, 0) });
      cur.drawLine({ start: { x: bx[2]!, y: y1() }, end: { x: bx[2]!, y: y2() }, thickness: 0.5, color: rgb(0, 0, 0) });
      cur.drawLine({ start: { x: bx[3]!, y: y1() }, end: { x: bx[3]!, y: y2() }, thickness: 0.5, color: rgb(0, 0, 0) });
      drawCell(a, bx[0]!, bx[1]!, y1(), y2(), true, true);
      drawCell(b, bx[1]!, bx[2]!, y1(), y2());
      drawCell(c, bx[2]!, bx[3]!, y1(), y2(), true, true);
      drawCell(d, bx[3]!, bx[4]!, y1(), y2());
      rowOff += rowH;
    };

    drawBasic("姓名", asString(pi.name), "稱謂", `□先生  □女士  □其他：${asString(pi.salutation)}`);
    drawBasic("身分證字號", asString(pi.id), "出生年月日", asString(pi.birth));
    drawBasic("申請人名稱", asString(pi.applicant), "職稱", asString(pi.title));
    drawBasic("單位外年資", asString(pi.outsideYears), "單位年資", asString(pi.insideYears));

    // 專業領域/重要成就改為 15% + 85%
    const drawTwoCol = (k: string, v: string) => {
      drawH();
      const split = x0 + leftW;
      cur.drawLine({ start: { x: split, y: y1() }, end: { x: split, y: y2() }, thickness: 0.5, color: rgb(0, 0, 0) });
      drawCell(k, x0, split, y1(), y2(), true, true);
      drawCell(v, split, xR, y1(), y2());
      rowOff += rowH;
    };
    const drawTwoColTallValue = (k: string, v: string, valueRowH: number) => {
      drawH();
      const split = x0 + leftW;
      const yt = y1();
      const yb = yt - valueRowH;
      cur.drawLine({ start: { x: split, y: yt }, end: { x: split, y: yb }, thickness: 0.5, color: rgb(0, 0, 0) });
      drawCell(k, x0, split, yt, yb, true, true);
      const f = font;
      const size = 9;
      const lines = wrapText(asString(v), Math.max(8, xR - split - pad * 2), f, size);
      const blockH = lines.length * achLineStep;
      const baseY = yb + (yt - yb - blockH) / 2 + blockH - 8;
      for (let i = 0; i < lines.length; i++) {
        cur.drawText(lines[i]!, {
          x: split + pad,
          y: baseY - i * achLineStep,
          size,
          font: f,
          color: rgb(0, 0, 0),
        });
      }
      rowOff += valueRowH;
    };
    drawTwoCol("專業領域", asString(pi.field));
    drawTwoColTallValue("重要成就", achievementsText, achRowH);

    const drawSection = (leftTitle: string, header: [string, string, string, string], rows: string[][]) => {
      const sectionRows = 1 + rows.length;
      const secTop = y1();
      const secBottom = secTop - rowH * sectionRows;
      const split = x0 + leftW;
      cur.drawLine({ start: { x: split, y: secTop }, end: { x: split, y: secBottom }, thickness: 0.5, color: rgb(0, 0, 0) });
      drawCell(leftTitle, x0, split, secTop, secBottom, true, true);

      let rr = 0;
      const rowTop = () => secTop - rr * rowH;
      const rowBottom = () => rowTop() - rowH;
      const rx = [split, split + secCols[0]!, split + secCols[0]! + secCols[1]!, split + secCols[0]! + secCols[1]! + secCols[2]!, xR];
      const drawRightRow = (vals: [string, string, string, string], isHeader = false) => {
        if (!(rowOff === 0 && rr === 0)) cur.drawLine({ start: { x: split, y: rowTop() }, end: { x: xR, y: rowTop() }, thickness: 0.5, color: rgb(0, 0, 0) });
        cur.drawLine({ start: { x: rx[1]!, y: rowTop() }, end: { x: rx[1]!, y: rowBottom() }, thickness: 0.5, color: rgb(0, 0, 0) });
        cur.drawLine({ start: { x: rx[2]!, y: rowTop() }, end: { x: rx[2]!, y: rowBottom() }, thickness: 0.5, color: rgb(0, 0, 0) });
        cur.drawLine({ start: { x: rx[3]!, y: rowTop() }, end: { x: rx[3]!, y: rowBottom() }, thickness: 0.5, color: rgb(0, 0, 0) });
        drawCell(vals[0], rx[0]!, rx[1]!, rowTop(), rowBottom(), isHeader, true);
        drawCell(vals[1], rx[1]!, rx[2]!, rowTop(), rowBottom(), isHeader, true);
        drawCell(vals[2], rx[2]!, rx[3]!, rowTop(), rowBottom(), isHeader, true);
        drawCell(vals[3], rx[3]!, rx[4]!, rowTop(), rowBottom(), isHeader, true);
        rr += 1;
      };
      drawRightRow(header, true);
      rows.forEach((rw) => drawRightRow([asString(rw[0]), asString(rw[1]), asString(rw[2]), asString(rw[3])], false));
      // 明確補上左側跨行標題區塊下邊線，避免視覺缺線
      cur.drawLine({ start: { x: x0, y: secBottom }, end: { x: split, y: secBottom }, thickness: 0.5, color: rgb(0, 0, 0) });
      rowOff += rowH * sectionRows;
    };

    drawSection("學歷", ["學校(大專以上)", "時間", "學位", "科系"], eduRows);
    drawSection("經歷", ["事業單位", "時間", "部門", "職稱"], expRows);
    drawSection("曾參與計畫\n(無可免填)", ["事業單位", "時間", "計畫名稱", "主要任務"], prjRows);

    y = bottom - 24;
  };

  const drawTeamProfileTable = (rows: string[][]) => {
    const headers = [
      "編號",
      "姓名（必填）",
      "職稱",
      "最高學歷（學校系所）",
      "主要經歷（公司名稱/時間）",
      "主要重要成就",
      "本業年資",
      "參與分項計畫及工作項目",
      "投入月數",
    ];
    const w = [contentW * 0.05, contentW * 0.1, contentW * 0.1, contentW * 0.15, contentW * 0.15, contentW * 0.15, contentW * 0.08, contentW * 0.14, contentW * 0.08];
    const x: number[] = [M.left];
    for (let i = 0; i < w.length; i++) x.push(x[i]! + w[i]!);
    const lineH = 12;
    const pad = 4;
    const minH = 30;
    const padV = 6;

    const rowH = (cells: string[], isHeader = false) => {
      let maxLines = 1;
      for (let i = 0; i < cells.length; i++) {
        const f = isHeader ? fontBold : font;
        const ls = wrapText(asString(cells[i]), w[i]! - pad * 2, f, 9);
        maxLines = Math.max(maxLines, Math.min(10, ls.length || 1));
      }
      return Math.max(minH, padV * 2 + maxLines * lineH);
    };

    const headerH = rowH(headers, true);
    const bodyHeights = rows.map((r) => rowH(r, false));
    const totalMonths = rows.reduce((s, r) => s + (Number(r[8]) || 0), 0);
    const totalRowH = Math.max(minH, pad * 2 + lineH);
    const totalH = headerH + bodyHeights.reduce((a, b) => a + b, 0) + totalRowH;
    ensure(totalH + 24);

    const top = y;
    const bottom = y - totalH;
    const xR = x[x.length - 1]!;
    cur.drawRectangle({ x: M.left, y: bottom, width: contentW, height: totalH, borderColor: rgb(0, 0, 0), borderWidth: 0.5 });

    let cy = top;
    const drawRow = (cells: string[], h: number, isHeader = false) => {
      if (cy !== top) cur.drawLine({ start: { x: M.left, y: cy }, end: { x: xR, y: cy }, thickness: 0.5, color: rgb(0, 0, 0) });
      for (let i = 1; i < x.length - 1; i++) cur.drawLine({ start: { x: x[i]!, y: cy }, end: { x: x[i]!, y: cy - h }, thickness: 0.5, color: rgb(0, 0, 0) });
      for (let i = 0; i < cells.length; i++) {
        const f = isHeader ? fontBold : font;
        const ls = wrapText(asString(cells[i]), w[i]! - pad * 2, f, 9).slice(0, 10);
        const blockH = ls.length * lineH;
        const yTop = cy - Math.max(padV, (h - blockH) / 2);
        for (let li = 0; li < ls.length; li++) {
          const tw = f.widthOfTextAtSize(ls[li]!, 9);
          cur.drawText(ls[li]!, { x: x[i]! + (w[i]! - tw) / 2, y: yTop - (li + 1) * lineH + lineH * 0.85, size: 9, font: f, color: rgb(0, 0, 0) });
        }
      }
      cy -= h;
    };

    drawRow(headers, headerH, true);
    rows.forEach((r, idx) => drawRow(r, bodyHeights[idx]!));

    // 跨列總計列：92% + 8%
    cur.drawLine({ start: { x: M.left, y: cy }, end: { x: xR, y: cy }, thickness: 0.5, color: rgb(0, 0, 0) });
    const splitX = M.left + contentW * 0.92;
    cur.drawLine({ start: { x: splitX, y: cy }, end: { x: splitX, y: cy - totalRowH }, thickness: 0.5, color: rgb(0, 0, 0) });
    const totalLabel = "總計";
    const labelW = fontBold.widthOfTextAtSize(totalLabel, 9);
    cur.drawText(totalLabel, {
      x: M.left + (contentW * 0.92 - labelW) / 2,
      y: cy - totalRowH / 2 - 3,
      size: 9,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    const sumText = totalMonths ? totalMonths.toFixed(1) : "";
    const sumW = font.widthOfTextAtSize(sumText, 9);
    cur.drawText(sumText, {
      x: splitX + (contentW * 0.08 - sumW) / 2,
      y: cy - totalRowH / 2 - 3,
      size: 9,
      font,
      color: rgb(0, 0, 0),
    });
    cy -= totalRowH;
    y = cy - 24;
  };

  const drawCompanyIntroComplexTable = (c: AnyRecord, fallbackCompanyName: string, fallbackLeaderName: string) => {
    const x0 = M.left;
    const totalW = contentW;
    const cols = [0.18, 0.34, 0.16, 0.14, 0.18].map((r) => totalW * r);
    const x: number[] = [x0];
    for (let i = 0; i < cols.length; i++) x.push(x[i]! + cols[i]!);
    const lineHCell = 11;

    const stockStatus = asString(c.stockStatus || "");
    const stockItems = ["上市", "上櫃", "公開發行", "未公開發行"];
    const stockText = stockItems.map((s) => `[${stockStatus.includes(s) ? "v" : " "}] ${s}`).join("   ");

    const awards = Array.isArray(c.awards) ? c.awards.filter(Boolean) : [];
    const awardItems = [
      "年度通過研發管理制度評鑑",
      "年度產業科技發展獎",
      "年度國家品質獎",
      "年度中小企業發展石獎",
      "其他成果",
    ];
    const awardText = awardItems
      .map((s) => {
        if (s === "其他成果") {
          const other = asString(c.awardOtherDetails || "");
          return `[${other ? "v" : " "}] ${s}${other ? `：${other}` : ""}`;
        }
        return `[${awards.includes(s) ? "v" : " "}] ${s}`;
      })
      .join("   ");

    const rows: Array<Array<{ text: string; w: number; bold?: boolean }>> = [
      [
        { text: "公司名稱", w: cols[0], bold: true },
        { text: asString(c.companyName || fallbackCompanyName), w: cols[1] + cols[2] },
        { text: "設立日期", w: cols[3], bold: true },
        { text: asString(c.establishDate), w: cols[4] },
      ],
      [
        { text: "統一編號", w: cols[0], bold: true },
        { text: asString(c.taxId), w: cols[1] },
        { text: "聯絡電話", w: cols[2], bold: true },
        { text: asString(c.phone), w: cols[3] },
        { text: "傳真號碼  " + asString(c.fax), w: cols[4] },
      ],
      [
        { text: "負責人", w: cols[0], bold: true },
        { text: asString(c.representative || fallbackLeaderName), w: cols[1] },
        { text: "身分證字號", w: cols[2], bold: true },
        { text: asString((c as AnyRecord).idNumber), w: cols[3] + cols[4] },
      ],
      [
        { text: "實收資本額", w: cols[0], bold: true },
        { text: `${asString(c.capital)}   千元`, w: cols[1] },
        { text: "主要營業項目", w: cols[2], bold: true },
        { text: asString(c.mainBusiness), w: cols[3] + cols[4] },
      ],
      [
        { text: "股票上市狀況", w: cols[0], bold: true },
        { text: stockText, w: cols[1] + cols[2] + cols[3] + cols[4] },
      ],
      [
        { text: "前一年度營業額", w: cols[0], bold: true },
        { text: `${asString(c.lastYearRevenue)}   千元`, w: cols[1] + cols[2] },
        { text: "員工人數", w: cols[3], bold: true },
        { text: `${asString(c.employeeCount)} 人`, w: cols[4] },
      ],
      [
        { text: "公司登記地址", w: cols[0], bold: true },
        { text: asString(c.registeredAddress), w: cols[1] + cols[2] + cols[3] + cols[4] },
      ],
      [
        { text: "通訊地址", w: cols[0], bold: true },
        { text: asString(c.mailingAddress), w: cols[1] + cols[2] + cols[3] + cols[4] },
      ],
      [
        { text: "研發成果\n獲得獎項", w: cols[0], bold: true },
        { text: awardText, w: cols[1] + cols[2] + cols[3] + cols[4] },
      ],
    ];

    const rowHeights = rows.map((row) => {
      let maxLines = 1;
      for (const cell of row) {
        const lines = wrapText(cell.text, cell.w - 8, cell.bold ? fontBold : font, 9);
        maxLines = Math.max(maxLines, Math.min(8, lines.length || 1));
      }
      return 10 + maxLines * lineHCell;
    });
    const totalH = rowHeights.reduce((a, b) => a + b, 0);
    ensure(totalH + 40);
    const top = y;
    let yy = top;

    cur.drawRectangle({ x: x0, y: top - totalH, width: totalW, height: totalH, borderColor: rgb(0, 0, 0), borderWidth: 0.5 });
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri]!;
      const rh = rowHeights[ri]!;
      if (ri > 0) cur.drawLine({ start: { x: x0, y: yy }, end: { x: x0 + totalW, y: yy }, thickness: 0.5, color: rgb(0, 0, 0) });
      let cx = x0;
      for (let ci = 0; ci < row.length; ci++) {
        const cell = row[ci]!;
        const cw = cell.w;
        if (ci > 0) cur.drawLine({ start: { x: cx, y: yy }, end: { x: cx, y: yy - rh }, thickness: 0.5, color: rgb(0, 0, 0) });
        const lines = wrapText(cell.text, cw - 8, cell.bold ? fontBold : font, 9).slice(0, 8);
        for (let li = 0; li < lines.length; li++) {
          cur.drawText(lines[li]!, {
            x: cx + 4,
            y: yy - 12 - li * lineHCell,
            size: 9,
            font: cell.bold ? fontBold : font,
            color: rgb(0, 0, 0),
          });
        }
        cx += cw;
      }
      yy -= rh;
    }
    y = top - totalH - 8;
    drawPara("註：1. 員工人數請與勞保人數（最近一期「勞保繳費清單之投保人數資料」）相符。");
    drawPara("    2. 請填寫通訊地址，除註明縣市別外，應有鄉鎮市區與詳細門牌資訊。");
  };

  const drawManpowerStatsTable = (
    rows: Array<{
      company: string;
      phd: string;
      master: string;
      bachelor: string;
      junior: string;
      male: string;
      female: string;
      avgAge: string;
      avgYears: string;
      toHire: string;
    }>,
    totalRow: {
      phd: string;
      master: string;
      bachelor: string;
      junior: string;
      male: string;
      female: string;
      avgAge: string;
      avgYears: string;
      toHire: string;
    }
  ) => {
    /*
     * 重要：此區為「(三) 計畫人力統計」穩定版表格核心。
     * 此處採用「扁平網格 (Flat Grid)」與「Flex 絕對比例法 (flex: 12, flex: 8 等)」
     * 以迴避 React-PDF 的巢狀計算誤差，嚴禁改回 flexDirection: 'column' 的包覆結構。
     * 調整時應只做字距/線距微調，不可改變欄位比例拓撲。
     */
    // Flex 比例對齊（12/50/12/13/13；中段 32/18；學歷 8/8/8/8；性別 9/9）
    const colFlex = [12, 8, 8, 8, 8, 9, 9, 12, 13, 13];
    const flexSum = colFlex.reduce((s, v) => s + v, 0);
    const widths = colFlex.map((f) => (contentW * f) / flexSum);
    const x: number[] = [M.left];
    for (let i = 0; i < widths.length; i++) x.push(x[i]! + widths[i]!);

    const h1 = 26;
    const h2 = 26;
    const h3 = 26;
    const rowH = 24;
    const topGap = 15;
    const bottomGap = 15;
    const maxRows = Math.max(1, Math.min(3, rows.length));
    const manpowerData = rows.slice(0, maxRows);
    const totals = { ...totalRow };
    const totalH = h1 + h2 + h3 + rowH * (manpowerData.length + 1);
    ensure(topGap + 16 + 6 + totalH + bottomGap + 4);
    y -= topGap;

    const topTextLeft = `公司名稱：${asString(manpowerData[0]?.company) || asString(companyName) || "公司名稱"}`;
    const topTextRight = "單位：人數";
    cur.drawText(topTextLeft, { x: M.left, y, size: 9.5, font, color: rgb(0, 0, 0) });
    const rw = font.widthOfTextAtSize(topTextRight, 9.5);
    cur.drawText(topTextRight, { x: M.left + contentW - rw, y, size: 9.5, font, color: rgb(0, 0, 0) });
    y -= 6;

    const line = (x1: number, y1: number, x2: number, y2: number) =>
      cur.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: rgb(0, 0, 0) });
    const center = (txt: string, x1: number, x2: number, y1: number, y2: number, bold = false, size = 8.8) => {
      const f = bold ? fontBold : font;
      const t = asString(txt);
      const tw = f.widthOfTextAtSize(t, size);
      cur.drawText(t, { x: (x1 + x2 - tw) / 2, y: (y1 + y2) / 2 - size / 2 + 1, size, font: f, color: rgb(0, 0, 0) });
    };

    const top = y;
    const r1t = top;
    const r1b = r1t - h1;
    const r2t = r1b;
    const r2b = r2t - h2;
    const r3t = r2b;
    const r3b = r3t - h3;

    // 外框頂線 + 左線
    line(x[0]!, r1t, x[10]!, r1t);
    line(x[0]!, r1t, x[0]!, r3b);
    line(x[10]!, r1t, x[10]!, r3b);

    // 公司名稱欄（跨三層）
    line(x[1]!, r1t, x[1]!, r3b);
    line(x[0]!, r3b, x[1]!, r3b);
    center("公司名稱", x[0]!, x[1]!, r1t, r3b, false, 9);

    // 計畫人力總區（跨六欄）
    line(x[1]!, r1b, x[7]!, r1b);
    line(x[7]!, r1t, x[7]!, r3b);
    center("計畫人力", x[1]!, x[7]!, r1t, r1b, false, 9);

    // 右三欄（跨三層）
    line(x[8]!, r1t, x[8]!, r3b);
    line(x[9]!, r1t, x[9]!, r3b);
    line(x[7]!, r3b, x[10]!, r3b);
    center("平均年齡", x[7]!, x[8]!, r1t, r3b, false, 9);
    center("平均年資", x[8]!, x[9]!, r1t, r3b, false, 9);
    center("待聘人數", x[9]!, x[10]!, r1t, r3b, false, 9);

    // 計畫人力中層：學歷/性別
    line(x[1]!, r2b, x[7]!, r2b);
    line(x[5]!, r1b, x[5]!, r3b);
    center("學歷", x[1]!, x[5]!, r1b, r2b, false, 9);
    center("性別", x[5]!, x[7]!, r1b, r2b, false, 9);

    // 底層分項
    for (let i = 2; i <= 7; i++) line(x[i]!, r2b, x[i]!, r3b);
    line(x[1]!, r3b, x[7]!, r3b);
    center("博士", x[1]!, x[2]!, r2b, r3b, false, 8.8);
    center("碩士", x[2]!, x[3]!, r2b, r3b, false, 8.8);
    center("學士", x[3]!, x[4]!, r2b, r3b, false, 8.8);
    const mid = (r2b + r3b) / 2;
    const s8 = 8;
    const l1 = "專科";
    const l2 = "(含)以下";
    const w1 = font.widthOfTextAtSize(l1, s8);
    const w2 = font.widthOfTextAtSize(l2, s8);
    cur.drawText(l1, { x: (x[4]! + x[5]! - w1) / 2, y: mid + 1.5, size: s8, font, color: rgb(0, 0, 0) });
    cur.drawText(l2, { x: (x[4]! + x[5]! - w2) / 2, y: mid - 7.5, size: s8, font, color: rgb(0, 0, 0) });
    center("男性", x[5]!, x[6]!, r2b, r3b, false, 8.8);
    center("女性", x[6]!, x[7]!, r2b, r3b, false, 8.8);

    // --- 資料列 + 總計列 ---
    const allRows = [
      ...manpowerData.map((item) => [
        asString(item.company),
        asString(item.phd),
        asString(item.master),
        asString(item.bachelor),
        asString(item.junior),
        asString(item.male),
        asString(item.female),
        asString(item.avgAge),
        asString(item.avgYears),
        asString(item.toHire),
      ]),
      [
        "總計",
        asString(totals.phd),
        asString(totals.master),
        asString(totals.bachelor),
        asString(totals.junior),
        asString(totals.male),
        asString(totals.female),
        asString(totals.avgAge),
        asString(totals.avgYears),
        asString(totals.toHire),
      ],
    ];
    let ryTop = r3b;
    for (let r = 0; r < allRows.length; r++) {
      const ryBottom = ryTop - rowH;
      line(x[0]!, ryTop, x[0]!, ryBottom);
      for (let i = 1; i <= 10; i++) line(x[i]!, ryTop, x[i]!, ryBottom);
      line(x[0]!, ryBottom, x[10]!, ryBottom);
      for (let i = 0; i < 10; i++) {
        center(allRows[r]![i]!, x[i]!, x[i + 1]!, ryTop, ryBottom, false, 9);
      }
      ryTop = ryBottom;
    }
    y = ryTop - bottomGap;
  };

  // 壹、公司概況
  drawHeading("壹、公司概況");
  drawSubHeading("一、基本資料");
  if (companyProfile?.formData) {
    const c = companyProfile.formData;
    drawSubHeading("（一）公司簡介");
    const awards = Array.isArray(c.awards) ? c.awards.filter(Boolean) : [];
    const awardText = awards.length ? awards.join("、") : asString(c.awardOtherDetails);
    void awardText;
    drawCompanyIntroComplexTable(c as AnyRecord, companyName, leaderName);

    drawSubHeading("（二）主要股東及持股比例（列出持股前五大）");
    const holders = Array.isArray(companyProfile.shareholders) ? companyProfile.shareholders : [];
    const holderRows = (holders.length ? holders : [{ name: "", shares: "", ratio: "" }]).slice(0, 5).map((h) => [
      asString(h.name),
      asString(h.shares),
      asString(h.ratio),
    ]);
    drawTableFlow(["主要股東名稱", "持有股份（千股）", "持股比例（%）"], holderRows, [contentW * 0.45, contentW * 0.27, contentW * 0.28]);

    drawSubHeading("（三）公司沿革");
    await drawParaThenImages(c.companyHistory ?? "", companyProfile?.images?.companyHistory ?? []);
  }

  drawSubHeading("二、公司營運及財務狀況");
  if (companyProfile?.formData) {
    const c = companyProfile.formData;
    drawSubHeading("（一）主要服務或產品目標客群");
    await drawParaThenImages(c.targetAudience ?? "", companyProfile?.images?.targetAudience ?? []);
    drawSubHeading("（二）銷售通路說明（包括虛擬及實體銷售據點分佈狀況）");
    await drawParaThenImages(c.salesChannels ?? "", companyProfile?.images?.salesChannels ?? []);
    drawSubHeading("（三）經營狀況");
    drawPara("（請說明公司主要經營之產品項目、銷售業績及市場占有率。）");
    const cAny = c as AnyRecord;
    const y1 = asString(((companyProfile as AnyRecord).opYears as string[] | undefined)?.[0] ?? "114");
    const y2 = asString(((companyProfile as AnyRecord).opYears as string[] | undefined)?.[1] ?? "113");
    const y3 = asString(((companyProfile as AnyRecord).opYears as string[] | undefined)?.[2] ?? "112");
    const opRows = Array.isArray(companyProfile.opData) ? companyProfile.opData : [];
    const volumeWithUnit = (yr: AnyRecord | undefined) => {
      const v = asString(yr?.volume);
      const u = asString(yr?.volumeUnit);
      return `${v}${u}`.trim();
    };
    const opBodyRows = opRows.length
      ? opRows.map((r) => [
          asString(r.product),
          volumeWithUnit(r.y1 as unknown as AnyRecord),
          asString(r.y1?.sales),
          asString(r.y1?.share),
          volumeWithUnit(r.y2 as unknown as AnyRecord),
          asString(r.y2?.sales),
          asString(r.y2?.share),
          volumeWithUnit(r.y3 as unknown as AnyRecord),
          asString(r.y3?.sales),
          asString(r.y3?.share),
        ])
      : [["", "", "", "", "", "", "", "", "", ""]];
    drawTableFlow(
      [
        "申請人主要產品/服務項目",
        `民國${y1}年\n產量`,
        `民國${y1}年\n銷售額(仟元)`,
        `民國${y1}年\n市場占有率`,
        `民國${y2}年\n產量`,
        `民國${y2}年\n銷售額(仟元)`,
        `民國${y2}年\n市場占有率`,
        `民國${y3}年\n產量`,
        `民國${y3}年\n銷售額(仟元)`,
        `民國${y3}年\n市場占有率`,
      ],
      opBodyRows,
      [contentW * 0.2, contentW * 0.09, contentW * 0.08, contentW * 0.07, contentW * 0.09, contentW * 0.08, contentW * 0.07, contentW * 0.09, contentW * 0.08, contentW * 0.07]
    );
    const totalY1 = opRows.reduce((s, r) => s + (Number(r.y1?.sales) || 0), 0);
    const totalY2 = opRows.reduce((s, r) => s + (Number(r.y2?.sales) || 0), 0);
    const totalY3 = opRows.reduce((s, r) => s + (Number(r.y3?.sales) || 0), 0);
    const b1 = Number(cAny.rndExpenseY1) || 0;
    const b2 = Number(cAny.rndExpenseY2) || 0;
    const b3 = Number(cAny.rndExpenseY3) || 0;
    const opSummaryRows: string[][] = [
      ["合 計", "—", `${totalY1 || ""}`, "—", "—", `${totalY2 || ""}`, "—", "—", `${totalY3 || ""}`, "—"],
      ["年度營業額(A)", "—", `${totalY1 || ""}`, "—", "—", `${totalY2 || ""}`, "—", "—", `${totalY3 || ""}`, "—"],
      ["年度研發費用(B)", "—", `${b1 || ""}`, "—", "—", `${b2 || ""}`, "—", "—", `${b3 || ""}`, "—"],
      ["(B)/(A)%", "—", `${totalY1 ? ((b1 / totalY1) * 100).toFixed(2) : "0.00"}%`, "—", "—", `${totalY2 ? ((b2 / totalY2) * 100).toFixed(2) : "0.00"}%`, "—", "—", `${totalY3 ? ((b3 / totalY3) * 100).toFixed(2) : "0.00"}%`, "—"],
    ];
    drawTableFlow(["項目", "產量1", "銷售1", "市佔1", "產量2", "銷售2", "市佔2", "產量3", "銷售3", "市佔3"], opSummaryRows, [contentW * 0.2, contentW * 0.09, contentW * 0.08, contentW * 0.07, contentW * 0.09, contentW * 0.08, contentW * 0.07, contentW * 0.09, contentW * 0.08, contentW * 0.07]);
  }

  drawSubHeading("三、曾經參與政府相關研發計畫之實績（無則免填）");
  drawSubHeading("（一）近3年曾經參與政府其他相關計畫");
  const past = Array.isArray(companyProfile?.pastProjects) ? companyProfile.pastProjects : [];
  {
    const pastRows = (past.length ? past : [{ date: "", category: "", name: "", duration: "", year: "", grant: "", totalBudget: "", manYears: "" }]).map((r) => {
      const y = asString(r.year);
      const g114 = y.includes("114") ? asString(r.grant) : "";
      const t114 = y.includes("114") ? asString(r.totalBudget) : "";
      const g113 = y.includes("113") ? asString(r.grant) : "";
      const t113 = y.includes("113") ? asString(r.totalBudget) : "";
      const g112 = y.includes("112") ? asString(r.grant) : "";
      const t112 = y.includes("112") ? asString(r.totalBudget) : "";
      return [
        asString(r.date),
        asString(r.category),
        asString(r.name),
        asString(r.duration),
        g114,
        t114,
        g113,
        t113,
        g112,
        t112,
        asString(r.manYears),
      ];
    });
    drawTableFlow(
      [
        "核定日期",
        "計畫類別",
        "計畫名稱",
        "計畫執行期間",
        "民國114年\n政府補助款",
        "民國114年\n計畫總經費",
        "民國113年\n政府補助款",
        "民國113年\n計畫總經費",
        "民國112年\n政府補助款",
        "民國112年\n計畫總經費",
        "計畫人年數",
      ],
      pastRows,
      [contentW * 0.11, contentW * 0.11, contentW * 0.12, contentW * 0.09, contentW * 0.08, contentW * 0.08, contentW * 0.08, contentW * 0.08, contentW * 0.08, contentW * 0.08, contentW * 0.09],
      { topDownText: true }
    );
  }
  const future = Array.isArray(companyProfile?.futureProjects) ? companyProfile.futureProjects : [];
  drawSubHeading("（二）本年度欲申請政府其他相關計畫");
  {
    const futureRows = (future.length ? future : [{ organizer: "", category: "", name: "", duration: "", year: "115", grant: "", totalBudget: "", manYears: "" }]).map((r) => [
      asString(r.organizer),
      asString(r.category),
      asString(r.name),
      asString(r.duration),
      asString(r.year),
      asString(r.grant),
      asString(r.totalBudget),
      asString(r.manYears),
    ]);
    drawTableFlow(
      ["主辦單位", "計畫類別", "欲申請之計畫名稱", "計畫執行期間", "年度", "政府補助款", "計畫總經費", "計畫人年數"],
      futureRows,
      [contentW * 0.12, contentW * 0.1, contentW * 0.22, contentW * 0.12, contentW * 0.06, contentW * 0.1, contentW * 0.12, contentW * 0.08],
      { topDownText: true }
    );
  }

  // 貳、計畫內容與實施方式
  const plan = (formData.planContent as PlanContentDraft | null) || null;
  const planImgs = (plan as AnyRecord)?.images as Record<string, UploadedImage[]> | undefined;
  if (plan) {
    drawHeading("貳、計畫內容與實施方式");
    drawSubHeading("一、背景與說明 (請說明計畫背景、面臨的問題、市場、環境及使用者之需求、未來對客戶層、使用者產生之效益等計畫發展願景)");
    await drawParaThenImages(plan.formData?.background ?? "", planImgs?.background ?? []);
    // Keep this heading with its first subsection/content block to avoid orphan heading at page end.
    ensure(180);
    drawSubHeading("二、國內外產業現況、發展趨勢及競爭力分析 (請註明索引據資料來源)");
    drawSubHeading("（一）國內外產業現況與發展方向");
    await drawParaThenImages(
      [plan.formData?.industryStatus ?? "", (plan.formData as AnyRecord)?.industryTrends ?? ""].filter(Boolean).join("\n\n"),
      [...(planImgs?.industryStatus ?? []), ...(planImgs?.industryTrends ?? [])]
    );
    drawSubHeading("（二）競爭力分析（產品/服務競爭優勢比較）");
    const competitorNarrative = asString((plan.formData as AnyRecord)?.competitorAnalysis ?? "").trim();
    if (competitorNarrative) await drawParaThenImages(competitorNarrative, planImgs?.competitorAnalysis ?? []);
    ensure(24);
    const competitorRows = Array.isArray((plan as AnyRecord).competitorRows)
      ? (plan as AnyRecord).competitorRows as AnyRecord[]
      : [];
    const d = { price: "", launchTime: "", marketShare: "", segment: "", channel: "", advantage: "" };
    const applicant = competitorRows[0] ?? d;
    const aCo = competitorRows[1] ?? d;
    const bCo = competitorRows[2] ?? d;
    const cCo = competitorRows[3] ?? d;

    const compRows: string[][] = [
      ["1. 價格(單位： )", asString(applicant.price), asString(aCo.price), asString(bCo.price), asString(cCo.price)],
      ["2. 產品/服務上市時間", asString(applicant.launchTime), asString(aCo.launchTime), asString(bCo.launchTime), asString(cCo.launchTime)],
      ["3. 市場占有率(%)", asString(applicant.marketShare), asString(aCo.marketShare), asString(bCo.marketShare), asString(cCo.marketShare)],
      ["4. 市場區隔", asString(applicant.segment), asString(aCo.segment), asString(bCo.segment), asString(cCo.segment)],
      ["5. 行銷管道", asString(applicant.channel), asString(aCo.channel), asString(bCo.channel), asString(cCo.channel)],
      ["6. 技術或服務優勢", asString(applicant.advantage), asString(aCo.advantage), asString(bCo.advantage), asString(cCo.advantage)],
    ];

    const w0 = contentW * 0.2;
    const w1 = contentW - w0;
    // Evenly distribute remaining 4 columns.
    drawTableFlow(
      ["項目", "名稱\n申請人(本計畫研發標的)", "A公司", "B公司", "C公司"],
      compRows,
      [w0, w1 / 4, w1 / 4, w1 / 4, w1 / 4]
    );
    ensure(20);
    drawSubHeading(
      "（三）計畫可行性分析 (依計畫屬性與內容，客觀評估分析本案整體之可行性程度，如市場商機、營運模式、系統 技術、商品化 應用或其他優勢等說明。)"
    );
    await drawParaThenImages(asString((plan.formData as AnyRecord)?.feasibility ?? ""), planImgs?.feasibility ?? []);
    drawSubHeading("三、創新性說明");
    await drawParaThenImages(plan.formData?.innovation ?? "", planImgs?.innovation ?? []);
    drawSubHeading("四、計畫架構與實施方式");
    drawSubHeading("（一）計畫架構");

    const treeJson = asString((plan as AnyRecord).architectureTreeJson);
    const treeObjFromJson = parseTreeFromJson(treeJson);
    const treeObj = treeObjFromJson || ((plan as AnyRecord).architectureTree as unknown);
    const root = treeObj ? asTreeNode(treeObj) : null;
    const treeText = parseTreeTextFromJson(treeJson) || (root ? flattenTreeText(root) : "");
    if (root || treeText) {
      drawSubHeading("樹枝圖（含權重與執行單位）");
      if (root && root.children && root.children.length > 0) {
      const countLeaves = (n: TreeNodeView): number => {
        const kids = n.children.map(asTreeNode).filter(Boolean) as TreeNodeView[];
        if (!kids.length) return 1;
        return kids.reduce((sum, child) => sum + countLeaves(child), 0);
      };
      const leafCount = countLeaves(root);
      const requiresDedicatedPage = leafCount > 8 || root.children.length > 3;
      const baseTreeBlockHeight = requiresDedicatedPage ? 680 : 460;
      ensure(requiresDedicatedPage ? 9999 : baseTreeBlockHeight + 20);
      if (requiresDedicatedPage) drawSubHeading("樹枝圖（完整顯示）");

      const treePdfBytes = await renderTreeBranchPageBuffer(toPdfTreeNodeData(root));
      const treeDoc = await PDFDocument.load(treePdfBytes);
      const treePage = treeDoc.getPage(0);
      const embeddedTree = await pdfDoc.embedPage(treePage);
      const boxX = M.left;
      const boxW = contentW;
      const tw = treePage.getSize().width;
      const th = treePage.getSize().height;
      const widthScale = boxW / Math.max(1, tw);
      const widthFillHeight = Math.max(1, th * widthScale);
      const treeBlockHeight = Math.max(baseTreeBlockHeight, widthFillHeight + 14);
      if (!requiresDedicatedPage) ensure(treeBlockHeight + 20);
      const boxY = y - treeBlockHeight;
      const drawW = boxW;
      const drawH = Math.max(1, th * widthScale);
      cur.drawPage(embeddedTree, {
        x: boxX,
        y: boxY + (treeBlockHeight - drawH) / 2,
        width: drawW,
        height: drawH,
      });
      y -= treeBlockHeight;
      } else {
        drawPara(treeText || "（請於撰寫頁填寫架構樹）");
      }
    }

    drawPara(
      "請註明下列資料：\n1.開發計畫中各分項計畫及所開發技術依開發經費占總開發費用之百分比。\n2.執行該分項計畫 開發技術之單位。\n3.若有委託研究或技術引進請一併列入計畫架構。"
    );
    drawSubHeading("（二）執行步驟及方法");
    await drawParaThenImages(asString((plan.formData as AnyRecord)?.implementation ?? (plan.formData?.stepsMethod ?? "")), planImgs?.stepsMethod ?? planImgs?.implementation ?? []);
    drawPara(
      "※本項撰寫參考建議\n技術開發：以計畫架構項目用流程圖示逐項說明本計畫進行步驟與實施方式，並有驗證測試、商品化開發之修正流程等之具體性與結果。\n創新服務: 從需求端以服務流、資訊流、金流等等表達計畫架構項目，用流程圖示逐項說明本計畫進行步驟與實施方式，並有試營運 服務模式等機制，以驗證該商業模式、電子商務或服務模式之可行性與結果。"
    );
    drawSubHeading("（三）技術移轉來源分析：擬與業界、學術界及其他研究機構合作計畫");
    const techTransferRows = Array.isArray((plan as AnyRecord).techTransferRows) ? (plan as AnyRecord).techTransferRows as Array<{ item: string; target: string; budget: string; content: string; period: string }> : [];
    drawSubHeading("1.項目表");
    const ttRows = (techTransferRows.length ? techTransferRows : [
      { item: "技術及智慧財產權移轉", target: "", budget: "", content: "", period: "" },
      { item: "委託研究", target: "", budget: "", content: "", period: "" },
      { item: "委託勞務", target: "", budget: "", content: "", period: "" },
    ]).map((r) => [asString(r.item), asString(r.target), asString(r.budget), asString(r.content), asString(r.period)]);
    drawTableFlow(["項目", "對象", "經費（仟元）", "內容", "起迄期間"], ttRows, [contentW * 0.24, contentW * 0.18, contentW * 0.14, contentW * 0.26, contentW * 0.18]);
    drawPara(
      "註：各項引進計畫及委託研究計畫均應將明確對象註明，並附契約書、協議書或專利證書（如為外文請附中譯本）等相關必要資料影本，如尚未完成簽約，須附雙方簽署之合作意願書（備忘錄）。"
    );
    drawSubHeading("2.技術及智慧財產權來源對象背景、能力及合作方式說明");
    await drawParaThenImages(asString((plan.formData as AnyRecord)?.techTransferAnalysis), planImgs?.techTransferAnalysis ?? []);
    drawSubHeading("(本計畫是否進行專利檢索分析，是否涉及他人智慧財產權說明？是否已申請或掌握關鍵智財權)");
    await drawParaThenImages(asString((plan.formData as AnyRecord)?.ipRisk ?? ""), planImgs?.ipRisk ?? []);
  }

  // 參、預期效益（強制換新頁）
  const eb = (formData.expectedBenefits as ExpectedBenefitsDraft | null) || null;
  if (eb) {
    ensure(9999);
    drawHeading("參、預期效益");
    drawPara(EXPECTED_BENEFITS_HINT);
    drawSubHeading("（一）量化效益");
    const fd = eb.formData as Record<string, string> | undefined;

    // 量化效益表：依撰寫頁樣式（每列 3 組：欄名+數值）
    const q = (k: keyof ExpectedBenefitsDraft["formData"]) => asString(fd?.[k] ?? "") || "0";
    const quantGridRows = [
      ["增加產值（千元）", q("valueAdded"), "產出新產品或服務（項）", q("newProducts"), "衍生商品或服務（項）", q("derivedProducts")],
      ["投入研發費用（千元）", q("rndInvestment"), "促成投資額（千元）", q("inducedInvestment"), "降低成本（千元）", q("costReduction")],
      ["增加就業人數（人）", q("employment"), "成立新公司（家）", q("newCompany"), "發明專利（件）", q("inventionPatent")],
      ["新型/新式樣專利（件）", q("utilityPatent"), "期刊論文（篇）", q("journalPapers"), "研討會論文（篇）", q("conferencePapers")],
    ];
    drawTableFlow(
      ["效益項目", "預期數值", "效益項目", "預期數值", "效益項目", "預期數值"],
      quantGridRows,
      [contentW * 0.22, contentW * 0.11, contentW * 0.22, contentW * 0.11, contentW * 0.22, contentW * 0.12]
    );

    drawSubHeading("（二）非量化效益");
    drawPara(asString(fd?.qualitativeBenefits ?? ""));

    drawSubHeading("（一）對公司之影響");
    drawPara(asString(fd?.impactOnCompany ?? ""));
    drawSubHeading("（二）對產業、產業技術所具有之創造、加值、或流通之效益");
    drawPara(asString(fd?.impactOnIndustry ?? ""));
  }

  // 肆、預定進度及查核點（表格形式輸出）
  if (schedule) {
    drawHeading("肆、預定進度及查核點");
    drawSubHeading("一、預定進度表");
    const progressRows = Array.isArray(schedule.rows) ? schedule.rows : [];
    const monthKeys = (() => {
      const src = progressRows.find((r) => r && r.months) as ScheduleCheckpointsDraft["rows"][number] | undefined;
      const keys = src ? Object.keys(src.months || {}) : [];
      // Keep original form order (same as ScheduleCheckpointsForm monthLabels).
      return keys;
    })();
    const monthLabelsAll = (() => {
      if (!monthKeys.length) return ["115/1", "115/2", "115/3", "115/4", "115/5", "115/6", "115/7", "115/8", "115/9", "115/10", "115/11", "115/12"];
      const hasYearMonth = monthKeys.some((k) => /^\d+\/\d+$/.test(k));
      if (hasYearMonth) return monthKeys;
      // Fallback: source keys are "7月" style; rebuild with ROC year/month from project start.
      const s = parseYmd(startRaw);
      let yRoc = s ? toRocYear(s.y) : "115";
      let m = s ? s.mo : 1;
      return monthKeys.map(() => {
        const label = `${yRoc}/${m}`;
        m += 1;
        if (m > 12) {
          m = 1;
          yRoc = String(Number(yRoc) + 1);
        }
        return label;
      });
    })();
    const monthCountFromPlan = Math.max(1, Math.min(24, Number(months) || monthLabelsAll.length));
    const monthLabels = monthLabelsAll.slice(0, monthCountFromPlan);
    const progressTableRows = progressRows.map((r) => {
      const row = r as AnyRecord;
      const months = (row.months as Record<string, unknown> | undefined) || {};
      const activeKeys = (monthKeys.length ? monthKeys : Object.keys(months)).slice(0, monthCountFromPlan);
      const marks = activeKeys.map((k) => {
        const v = months[k];
        if (v && typeof v === "object") {
          const o = v as { progress?: boolean; checkpoint?: boolean };
          const a = o.progress ? "＊" : "";
          const b = o.checkpoint ? "✓" : "";
          return a && b ? `${a}${b}` : a || b || "";
        }
        return v ? "＊" : "";
      });
      return [
        asString(row.item ?? row.workItem ?? row.name),
        asString(row.weight),
        asString(row.manMonths ?? row.man_months),
        ...marks,
      ];
    });
    if (progressTableRows.length) {
      const fixedCols = [contentW * 0.32, contentW * 0.08, contentW * 0.1];
      const remainW = Math.max(60, contentW - fixedCols.reduce((a, b) => a + b, 0));
      const perMonthW = remainW / Math.max(1, monthLabels.length);
      drawTableFlow(
        ["月份／進度／工作項目", "計畫權重（%）", "預定投入人月", ...monthLabels],
        progressTableRows,
        [...fixedCols, ...Array(monthLabels.length).fill(perMonthW)]
      );
      const totalWeightPlanOnly = progressRows
        .filter((r) => {
          const id = asString((r as AnyRecord).id);
          return id.length === 1 && /^[A-Za-z]$/.test(id);
        })
        .reduce((s, r) => s + (Number((r as AnyRecord).weight) || 0), 0);
      const totalManMonths = progressRows.reduce((s, r) => s + (Number((r as AnyRecord).manMonths ?? (r as AnyRecord).man_months) || 0), 0);
      drawTableFlow(
        ["項目", "數值"],
        [
          ["累計進度百分比", totalWeightPlanOnly ? `${totalWeightPlanOnly.toFixed(1)}` : ""],
          ["人月數小計", totalManMonths ? totalManMonths.toFixed(1) : ""],
        ],
        [contentW * 0.5, contentW * 0.5]
      );
    }
    drawPara(SCHEDULE_PROGRESS_TABLE_NOTE);
    drawSubHeading("二、預定查核點說明");
    const kpiRows = Array.isArray(schedule.kpis) ? schedule.kpis : [];
    const kpiTableRows = kpiRows.map((k) => {
      const row = k as AnyRecord;
      return [
        asString(row.code ?? row.id),
        asString(row.description ?? row.kpi),
        asString(row.period ?? row.startEnd),
        asString(row.weight),
        asString(row.staffCode ?? row.personnel ?? row.staff),
      ];
    });
    if (kpiTableRows.length) {
      const kpiWeightSum = kpiRows.reduce((s, k) => s + (Number((k as AnyRecord).weight) || 0), 0);
      const kpiRowsWithTotal = [...kpiTableRows, ["合計", "—", "—", `${kpiWeightSum.toFixed(1)}%`, ""]];
      drawTableFlow(["查核點編號", "查核點KPI量化說明", "起訖時間", "分配權重%", "計畫人員編號"], kpiRowsWithTotal, [contentW * 0.12, contentW * 0.38, contentW * 0.2, contentW * 0.15, contentW * 0.15]);
    }
    drawPara(SCHEDULE_KPI_TABLE_NOTE);
    if (schedule.notes?.progressNote) {
      drawSubHeading("備註（進度表）");
      drawPara(schedule.notes.progressNote);
    }
    if (schedule.notes?.kpiNote) {
      drawSubHeading("備註（查核點）");
      drawPara(schedule.notes.kpiNote);
    }
    const testReportImages = Array.isArray(schedule.testReportImages) ? (schedule.testReportImages as unknown[]) : [];
    if (testReportImages.length) {
      drawSubHeading("查核點佐證圖片");
      await drawParaThenImages("以下為查核點相關測試報告/照片佐證。", testReportImages);
    }
  }

  // 伍、人力及經費需求表（表格形式輸出）
  const humanBudget = (formData.humanBudget as HumanBudgetDraft | null) || null;
  if (humanBudget) {
    ensure(9999);
    p11Ref = cur;
    drawHeading("伍、人力及經費需求表");
    drawSubHeading("一、計畫人員簡歷表");
    const pi = humanBudget.piProfile || {};
    drawSubHeading("（一）計畫主持人資歷說明");
    const edu = Array.isArray(humanBudget.piEducation) ? humanBudget.piEducation : [];
    const exp = Array.isArray(humanBudget.piExperience) ? humanBudget.piExperience : [];
    const projs = Array.isArray(humanBudget.piProjects) ? humanBudget.piProjects : [];
    drawPiProfileTable(pi as AnyRecord, edu as AnyRecord[], exp as AnyRecord[], projs as AnyRecord[]);
    const team = Array.isArray(humanBudget.team) ? humanBudget.team : [];
    if (team.length) {
      drawSubHeading("（二）參與計畫研究發展人員資歷說明");
      // Web 端此處需顯示「公司名稱」欄位；PDF 顯示同等內容。
      drawKV("公司名稱", companyName);

      const teamRows = team.map((r, idx) => [
        asString(r.no || String(idx + 1)),
        asString(r.name),
        asString(r.title),
        asString(r.education),
        asString(r.experience),
        asString(r.achievements),
        asString(r.years),
        asString(r.tasks),
        asString(r.months),
      ]);
      drawTeamProfileTable(teamRows);
      drawPara(HUMAN_TEAM_TABLE_NOTE);
    }
    const stats = Array.isArray(humanBudget.manpowerStats) ? humanBudget.manpowerStats : [];
    if (stats.length) {
      drawSubHeading("（三）計畫人力統計（不含兼職顧問）");
      const maxRows = Math.min(3, stats.length);
      const statRows = stats.slice(0, maxRows).map((r) => ({
        company: asString(r.company),
        phd: asString(r.phd),
        master: asString(r.master),
        bachelor: asString(r.bachelor),
        junior: asString(r.junior),
        male: asString(r.male),
        female: asString(r.female),
        avgAge: asString(r.avgAge),
        avgYears: asString(r.avgYears),
        toHire: asString(r.toHire),
      }));

      // Web 端有總計列；PDF 端保留以便一致。
      const num = (v: unknown) => (v === "" || v == null ? 0 : Number(v));
      const totals = stats.reduce(
        (acc, r) => {
          acc.phd += num(r.phd);
          acc.master += num(r.master);
          acc.bachelor += num(r.bachelor);
          acc.junior += num(r.junior);
          acc.male += num(r.male);
          acc.female += num(r.female);
          acc.toHire += num(r.toHire);
          // avgAge / avgYears：Web 端目前直接顯示 input 值，不做加總平均；保留第一筆。
          return acc;
        },
        {
          phd: 0,
          master: 0,
          bachelor: 0,
          junior: 0,
          male: 0,
          female: 0,
          toHire: 0,
        }
      );

      drawManpowerStatsTable(statRows, {
        phd: String(totals.phd),
        master: String(totals.master),
        bachelor: String(totals.bachelor),
        junior: String(totals.junior),
        male: String(totals.male),
        female: String(totals.female),
        avgAge: stats[0] ? asString(stats[0]!.avgAge) : "",
        avgYears: stats[0] ? asString(stats[0]!.avgYears) : "",
        toHire: String(totals.toHire),
      });
    }
    const pcs = Array.isArray(humanBudget.personnelCosts) ? humanBudget.personnelCosts : [];
    const ccs = Array.isArray(humanBudget.consultantCosts) ? humanBudget.consultantCosts : [];
    const cons = Array.isArray(humanBudget.consumables) ? humanBudget.consumables : [];
    const eq = humanBudget.equipments;
    const maintenance = Array.isArray(humanBudget.equipmentMaintenanceCosts) ? humanBudget.equipmentMaintenanceCosts : [];
    const tech = (humanBudget as { techIntroCosts?: { buy?: Array<Record<string, unknown>>; research?: Array<Record<string, unknown>>; service?: Array<Record<string, unknown>>; design?: Array<Record<string, unknown>> } }).techIntroCosts;
    const num = (v: unknown) => (v === "" || v == null ? 0 : Number(v));
    const personnelTotal = pcs.reduce((s, r) => s + (num(r.cost) || num(r.avgSalary) * num(r.manMonths)), 0);
    const consultantTotal = ccs.reduce((s, r) => s + (num(r.cost) || num(r.avgSalary) * num(r.manMonths)), 0);
    const consumablesTotal = cons.reduce((s, r) => s + (num(r.total) || num(r.qty) * num(r.price)), 0);
    const ex = Array.isArray(eq?.existing) ? eq!.existing : [];
    const nw = Array.isArray(eq?.new) ? eq!.new : [];
    const equipmentTotal = ex.reduce((s, r) => s + num(r.total), 0) + nw.reduce((s, r) => s + num(r.total), 0);
    const maintenanceGov = maintenance.reduce((s, r) => s + num(r.gov), 0);
    const maintenanceSelf = maintenance.reduce((s, r) => s + num(r.self), 0);
    const maintenanceTotal = maintenanceGov + maintenanceSelf;
    const sumTechRows = (rows: Array<Record<string, unknown>> | undefined) =>
      (rows ?? []).reduce((acc, r) => acc + num(r.gov) + num(r.self), 0);
    const techTotal = sumTechRows(tech?.buy) + sumTechRows(tech?.research) + sumTechRows(tech?.service) + sumTechRows(tech?.design);
    const personnelSub = personnelTotal + consultantTotal;
    const grandTotal = personnelSub + consumablesTotal + equipmentTotal + maintenanceTotal + techTotal;
    const buildBudgetRows = (): string[][] => {
      const fromForm = Array.isArray(humanBudget.budgetRows) ? humanBudget.budgetRows : [];
      if (fromForm.length && fromForm.some((r) => asString(r.gov).trim() || asString(r.self).trim() || asString(r.total).trim())) {
        const govSumFromRows = fromForm
          .filter((r) => asString(r.subject) !== "合計" && asString(r.subject) !== "百分比")
          .reduce((s, r) => s + num(r.gov), 0);
        const selfSumFromRows = fromForm
          .filter((r) => asString(r.subject) !== "合計" && asString(r.subject) !== "百分比")
          .reduce((s, r) => s + num(r.self), 0);
        const totalSumFromRows = fromForm
          .filter((r) => asString(r.subject) !== "合計" && asString(r.subject) !== "百分比")
          .reduce((s, r) => s + num(r.total), 0);
        const computedGrand = totalSumFromRows || grandTotal;
        let lastSubject = "";
        return fromForm.map((r) => {
          const subjectRaw = asString(r.subject).replace(/\s+/g, "");
          const subject = subjectRaw === lastSubject ? "" : subjectRaw;
          lastSubject = subjectRaw || lastSubject;
          return [
            subject,
            asString(r.item).replace(/\s+/g, ""),
            asString(r.gov) ||
              (r.item === "計畫人員" ? String(personnelTotal) :
              r.item === "顧問" ? String(consultantTotal) :
              r.subject.startsWith("4.") ? String(maintenanceGov) :
              r.item.includes("(1)") ? String(sumTechRows(tech?.buy)) :
              r.item.includes("(2)") ? String(sumTechRows(tech?.research)) :
              r.item.includes("(3)") ? String(sumTechRows(tech?.service)) :
              r.item.includes("(4)") ? String(sumTechRows(tech?.design)) :
              r.item === "小計" && r.subject.includes("5.") ? String(techTotal) :
              r.subject === "合計" ? String(govSumFromRows) :
              r.subject === "百分比" ? (computedGrand ? `${((govSumFromRows / computedGrand) * 100).toFixed(1)}%` : "") : ""),
            asString(r.self) ||
              (r.item === "計畫人員" ? "0" :
              r.item === "顧問" ? "0" :
              r.subject.startsWith("4.") ? String(maintenanceSelf) :
              r.item.includes("(1)") || r.item.includes("(2)") || r.item.includes("(3)") || r.item.includes("(4)") ? "0" :
              r.item === "小計" && r.subject.includes("5.") ? "0" :
              r.subject === "合計" ? String(selfSumFromRows) :
              r.subject === "百分比" ? (computedGrand ? `${((selfSumFromRows / computedGrand) * 100).toFixed(1)}%` : "") : ""),
            asString(r.total) ||
              (r.item === "計畫人員" ? String(personnelTotal) :
              r.item === "顧問" ? String(consultantTotal) :
              r.item === "小 計" && r.subject.includes("人事") ? String(personnelSub) :
              r.subject.startsWith("4.") ? String(maintenanceTotal) :
              r.item.includes("(1)") ? String(sumTechRows(tech?.buy)) :
              r.item.includes("(2)") ? String(sumTechRows(tech?.research)) :
              r.item.includes("(3)") ? String(sumTechRows(tech?.service)) :
              r.item.includes("(4)") ? String(sumTechRows(tech?.design)) :
              r.item === "小計" && r.subject.includes("5.") ? String(techTotal) :
              r.subject === "合計" ? String(computedGrand) :
              r.subject === "百分比" ? (computedGrand ? "100%" : "") : ""),
            asString(r.ratio) ||
              (() => {
                const t =
                  r.item === "計畫人員" ? personnelTotal :
                  r.item === "顧問" ? consultantTotal :
                  r.item === "小 計" && r.subject.includes("人事") ? personnelSub :
                  r.subject.startsWith("2.") ? consumablesTotal :
                  r.subject.startsWith("3.") ? equipmentTotal :
                  r.subject.startsWith("4.") ? maintenanceTotal :
                  r.item.includes("(1)") ? sumTechRows(tech?.buy) :
                  r.item.includes("(2)") ? sumTechRows(tech?.research) :
                  r.item.includes("(3)") ? sumTechRows(tech?.service) :
                  r.item.includes("(4)") ? sumTechRows(tech?.design) :
                  r.item === "小計" && r.subject.includes("5.") ? techTotal :
                  r.subject.includes("合計") ? computedGrand :
                  r.subject === "百分比" ? computedGrand : 0;
                return t && computedGrand ? `${((t / computedGrand) * 100).toFixed(1)}%` : "";
              })(),
          ];
        });
      }
      return [
        ["1.人事費", "計畫人員", "", "", String(personnelTotal), ""],
        ["", "顧問", "", "", String(consultantTotal), ""],
        ["", "小 計", "", "", String(personnelSub), personnelSub && grandTotal ? ((personnelSub / grandTotal) * 100).toFixed(1) + "%" : ""],
        ["2.消耗性器材及原材料費", "", "", "", String(consumablesTotal), consumablesTotal && grandTotal ? ((consumablesTotal / grandTotal) * 100).toFixed(1) + "%" : ""],
        ["3.研發設備使用費", "", "", "", String(equipmentTotal), equipmentTotal && grandTotal ? ((equipmentTotal / grandTotal) * 100).toFixed(1) + "%" : ""],
        ["4.研發設備維護費", "", String(maintenanceGov), String(maintenanceSelf), String(maintenanceTotal), maintenanceTotal && grandTotal ? ((maintenanceTotal / grandTotal) * 100).toFixed(1) + "%" : ""],
        ["5.技術引進及委託研究費", "", "", "", String(techTotal || ""), techTotal && grandTotal ? ((techTotal / grandTotal) * 100).toFixed(1) + "%" : ""],
        ["合 計", "", "", "", String(grandTotal), "100%"],
      ];
    };
    drawSubHeading("二、經費需求總表");
    const budgetTableRows = buildBudgetRows();
    // 調整科目/項目欄寬，避免長科目名稱在 PDF 內擠壓換行造成錯列。
    drawTableFlow(
      ["科目", "項目", "政府補助款", "公司自籌款", "合計", "各科目佔總經費之比例%"],
      budgetTableRows,
      [contentW * 0.22, contentW * 0.24, contentW * 0.11, contentW * 0.11, contentW * 0.11, contentW * 0.21]
    );
    drawPara(BUDGET_SUMMARY_TABLE_NOTE);
    if (pcs.length) {
      drawSubHeading("（一）人事費");
      const personnelRows = pcs.map((r) => {
        const cost = asString(r.cost).trim() || (num(r.avgSalary) && num(r.manMonths) ? String(Math.round(num(r.avgSalary) * num(r.manMonths))) : "");
        return [asString(r.name), asString(r.avgSalary), asString(r.manMonths), cost];
      });
      drawTableFlow(["姓名", "平均月薪(A)", "人月數(B)", "全程費用概算（A×B）"], personnelRows, [contentW * 0.22, contentW * 0.26, contentW * 0.2, contentW * 0.32]);
    }
    if (ccs.length) {
      drawSubHeading("二、顧問");
      const consultantRows = ccs.map((r) => {
        const cost = asString(r.cost).trim() || (num(r.avgSalary) && num(r.manMonths) ? String(Math.round(num(r.avgSalary) * num(r.manMonths))) : "");
        return [asString(r.name), asString(r.avgSalary), asString(r.manMonths), cost];
      });
      drawTableFlow(["姓名", "平均月薪(A)", "人月數(B)", "全程費用概算（A×B）"], consultantRows, [contentW * 0.22, contentW * 0.26, contentW * 0.2, contentW * 0.32]);
    }
    if (pcs.length || ccs.length) {
      drawPara(PERSONNEL_FEE_TABLE_NOTE);
    }
    if (cons.length) {
      drawSubHeading("（二）消耗性器材及原材料費");
      const consRows = cons.map((r) => {
        const total = asString(r.total).trim() || (num(r.qty) && num(r.price) ? String(Math.round(num(r.qty) * num(r.price))) : "");
        return [asString(r.item), asString(r.unit), asString(r.qty), asString(r.price), total];
      });
      drawTableFlow(["項目", "單位", "預估需求數量", "預估單價", "全程費用概算"], consRows, [contentW * 0.28, contentW * 0.12, contentW * 0.14, contentW * 0.18, contentW * 0.28]);
      drawPara(CONSUMABLES_TABLE_NOTE);
    }
    if (eq) {
      const exList2 = Array.isArray(eq.existing) ? eq.existing : [];
      if (exList2.length) {
        drawSubHeading("（三）研發設備使用費（一、已有設備）");
        const exRows = exList2.map((r) => [asString(r.name), asString(r.assetId), asString(r.valueA), asString(r.countB), asString(r.remainingYears), asString(r.monthlyFee), asString(r.months), asString(r.total)]);
        const exRowsWithSubtotal = [...exRows, ["小計", "", "", "", "", "", "", String(Math.round(exList2.reduce((s, r) => s + num(r.total), 0)))].map(asString)];
        drawTableFlow(["設備名稱", "財產編號", "單套帳面價值A", "套數B", "剩餘使用年限Y", "月使用費", "投入月數", "全程費用概算"], exRowsWithSubtotal, Array(8).fill(contentW / 8));
      }
      const nwList = Array.isArray(eq.new) ? eq.new : [];
      if (nwList.length) {
        drawSubHeading("（三）研發設備使用費（二、計畫新增設備）");
        const nwRows = nwList.map((r) => [asString(r.name), asString(r.assetId), asString(r.valueA), asString(r.countB), asString(r.remainingYears), asString(r.monthlyFee), asString(r.months), asString(r.total)]);
        const nwRowsWithSubtotal = [...nwRows, ["小計", "", "", "", "", "", "", String(Math.round(nwList.reduce((s, r) => s + num(r.total), 0)))].map(asString)];
        drawTableFlow(["設備名稱", "財產編號", "單套購置金額A", "套數B", "剩餘使用年限Y", "月使用費", "投入月數", "全程費用概算"], nwRowsWithSubtotal, Array(8).fill(contentW / 8));
      }
      if (exList2.length || nwList.length) {
        drawPara(EQUIPMENT_USE_TABLE_NOTE);
      }
    }
    if (maintenance.length) {
      drawSubHeading("（四）研發設備維護費");
      const maintainRows = maintenance.map((r) => [asString(r.item), asString(r.gov), asString(r.self), String(num(r.gov) + num(r.self))]);
      drawTableFlow(["項目", "政府補助款", "公司自籌款", "合計"], maintainRows, [contentW * 0.46, contentW * 0.18, contentW * 0.18, contentW * 0.18]);
    }
    const techSections = [
      { title: "（五）技術引進及委託研究費（一）技術或智慧財產權購買費", rows: tech?.buy ?? [] },
      { title: "（五）技術引進及委託研究費（二）委託研究費", rows: tech?.research ?? [] },
      { title: "（五）技術引進及委託研究費（三）委託勞務費", rows: tech?.service ?? [] },
      { title: "（五）技術引進及委託研究費（四）委託設計費", rows: tech?.design ?? [] },
    ];
    for (const sec of techSections) {
      if (!sec.rows.length) continue;
      drawSubHeading(sec.title);
      const rows = sec.rows.map((r) => {
        const gov = asString(r.gov);
        const self = asString(r.self);
        const total = gov || self ? String(num(gov) + num(self)) : "";
        return [asString(r.item), gov, self, total];
      });
      drawTableFlow(["項目", "政府補助款", "公司自籌款", "合計"], rows, [contentW * 0.46, contentW * 0.18, contentW * 0.18, contentW * 0.18]);
    }
  }

  // Cache page refs for TOC/page numbering (flow 已跑完，頁數已固定)
  p4Ref = pdfDoc.getPageCount() >= 4 ? pdfDoc.getPage(3) : null;
  p5Ref = pdfDoc.getPageCount() >= 5 ? pdfDoc.getPage(4) : null;
  p6Ref = pdfDoc.getPageCount() >= 6 ? pdfDoc.getPage(5) : null;
  p7Ref = pdfDoc.getPageCount() >= 7 ? pdfDoc.getPage(6) : null;
  p8Ref = pdfDoc.getPageCount() >= 8 ? pdfDoc.getPage(7) : null;
  p9Ref = pdfDoc.getPageCount() >= 9 ? pdfDoc.getPage(8) : null;
  if (!p11Ref && pdfDoc.getPageCount() >= 11) p11Ref = pdfDoc.getPage(10);

  // Page 2 (摘要表) Hybrid Mode:
  // A. 使用 @react-pdf/renderer 產出動態單頁
  // B. 用 pdf-lib 抽換模板第 2 頁
  {
    const endIso = asString((formData as AnyRecord).projectEndDate);
    const quantLine = endIso
      ? `（${formatRocDateLongFromIso(endIso)}結案前可產出之效益）`
      : "（請於封面填寫計畫結束日期後顯示結案前可產出之效益）";
    const foundingRoc = formatRocDateLongFromIso(asString(formData.foundingDate)) || asString(formData.foundingDate);

    const summaryPdfBytes = await renderSummaryPageBuffer({
      companyName,
      foundingDate: foundingRoc,
      leaderName,
      mainBusinessItems: asString(formData.mainBusinessItems),
      quantBenefitDeadlineLine: quantLine,
      summary: asString(formData.summary),
      innovationFocus: asString(formData.innovationFocus),
      executionAdvantage: asString(formData.executionAdvantage),
      qualitativeBenefits: asString(formData.qualitativeBenefits),
      benefitValue: asString(formData.benefitValue),
      benefitNewProduct: asString(formData.benefitNewProduct),
      benefitDerivedProduct: asString(formData.benefitDerivedProduct),
      benefitAdditionalRnD: asString(formData.benefitAdditionalRnD),
      benefitInvestment: asString(formData.benefitInvestment),
      benefitCostReduction: asString(formData.benefitCostReduction),
      benefitEmployment: asString(formData.benefitEmployment),
      benefitNewCompany: asString(formData.benefitNewCompany),
      benefitInventionPatent: asString(formData.benefitInventionPatent),
      benefitUtilityPatent: asString(formData.benefitUtilityPatent),
    });

    const summaryDoc = await PDFDocument.load(summaryPdfBytes);
    const [summaryPage] = await pdfDoc.copyPages(summaryDoc, [0]);
    pdfDoc.removePage(1);
    pdfDoc.insertPage(1, summaryPage);
  }

  const useFlowMode = true;
  if (!useFlowMode) {
  // --- Page 4: 壹、公司概況 / 一、基本資料（填入 Tab3） ---
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
      const box = { x: 70, yTopFromBottom: 365, width: 470, height: 110 };
      const imgs = Array.isArray(cpImgs.companyHistory) ? cpImgs.companyHistory : [];
      const spacing = 6;
      const cols = 4;
      const gap = 8;
      const cellW = (box.width - gap * (cols - 1)) / cols;
      const cellH = cellW * 0.75;
      const rawRows = imgs.length ? Math.ceil(imgs.length / cols) : 0;
      const rawImgH = rawRows ? rawRows * cellH + (rawRows - 1) * gap : 0;
      const imgH = imgs.length ? Math.min(rawImgH, box.height) : 0;
      const textH = imgs.length ? Math.max(0, box.height - imgH - spacing) : box.height;

      // Text area (mask+fit)
      if (textH > 0) {
        drawMultilineBoxFit({
          page: p4,
          x: box.x,
          yTopFromBottom: box.yTopFromBottom,
          width: box.width,
          height: textH,
          text: asString(c.companyHistory),
          font,
          fontSize: 10,
          minFontSize: 7,
          lineHeight: 14,
        });
      }

      // Images area directly under the text block
      if (imgs.length && imgH > 0) {
        const imgBoxTop = box.yTopFromBottom - textH - spacing;
        await drawImageGridInBox({
          pdfDoc,
          page: p4,
          pageHeight: h4,
          images: imgs as unknown as UploadedImage[],
          box: { x: box.x, yTopFromBottom: imgBoxTop, width: box.width, height: imgH },
          columns: cols,
          gap,
        });
      }
    }
  }

  // --- Page 5: 二、公司營運及財務狀況 + 三、研發計畫實績（同頁下半部表格） ---
  if (companyProfile && pdfDoc.getPageCount() >= 5) {
    const p5 = pdfDoc.getPage(4);
    const { height: h5 } = p5.getSize();
    const c = companyProfile.formData;

    // (一) 主要服務或產品目標客群 (label at y~733)
    {
      const box = { x: 75, yTopFromBottom: 710, width: 470, height: 55 };
      const taImgs = Array.isArray(cpImgs.targetAudience) ? cpImgs.targetAudience : [];
      const hasImgs = taImgs.length > 0;
      const spacing = 6;
      const cols = 5;
      const gap = 6;
      const cellW = (box.width - gap * (cols - 1)) / cols;
      const cellH = cellW * 0.75;
      const rawRows = hasImgs ? Math.ceil(taImgs.length / cols) : 0;
      const rawImgH = rawRows ? rawRows * cellH + (rawRows - 1) * gap : 0;
      const imgH = hasImgs ? Math.min(rawImgH, box.height) : 0;
      const textH = hasImgs ? Math.max(0, box.height - imgH - spacing) : box.height;

      if (textH > 0) {
        drawMultilineBoxFit({
          page: p5,
          x: box.x,
          yTopFromBottom: box.yTopFromBottom,
          width: box.width,
          height: textH,
          text: asString(c.targetAudience),
          font,
          fontSize: 10,
          minFontSize: 7,
          lineHeight: 14,
        });
      }
      if (hasImgs && imgH > 0) {
        const imgBoxTop = box.yTopFromBottom - textH - spacing;
        await drawImageGridInBox({
          pdfDoc,
          page: p5,
          pageHeight: h5,
          images: taImgs as unknown as UploadedImage[],
          box: { x: box.x, yTopFromBottom: imgBoxTop, width: box.width, height: imgH },
          columns: cols,
          gap,
        });
      }
    }

    {
      const box = { x: 75, yTopFromBottom: 655, width: 470, height: 45 };
      const scImgs = Array.isArray(cpImgs.salesChannels) ? cpImgs.salesChannels : [];
      const hasImgs = scImgs.length > 0;
      const spacing = 6;
      const cols = 5;
      const gap = 6;
      const cellW = (box.width - gap * (cols - 1)) / cols;
      const cellH = cellW * 0.75;
      const rawRows = hasImgs ? Math.ceil(scImgs.length / cols) : 0;
      const rawImgH = rawRows ? rawRows * cellH + (rawRows - 1) * gap : 0;
      const imgH = hasImgs ? Math.min(rawImgH, box.height) : 0;
      const textH = hasImgs ? Math.max(0, box.height - imgH - spacing) : box.height;

      if (textH > 0) {
        drawMultilineBoxFit({
          page: p5,
          x: box.x,
          yTopFromBottom: box.yTopFromBottom,
          width: box.width,
          height: textH,
          text: asString(c.salesChannels),
          font,
          fontSize: 10,
          minFontSize: 7,
          lineHeight: 14,
        });
      }
      if (hasImgs && imgH > 0) {
        const imgBoxTop = box.yTopFromBottom - textH - spacing;
        await drawImageGridInBox({
          pdfDoc,
          page: p5,
          pageHeight: h5,
          images: scImgs as unknown as UploadedImage[],
          box: { x: box.x, yTopFromBottom: imgBoxTop, width: box.width, height: imgH },
          columns: cols,
          gap,
        });
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
    const drawCellTextFit = (opts: { page: PDFPage; x: number; y: number; w: number; h: number; text: string }) => {
      const t = asString(opts.text);
      if (!t) return;
      drawMultilineBoxFit({
        page: opts.page,
        x: opts.x,
        yTopFromBottom: opts.y + opts.h - 2,
        width: opts.w,
        height: opts.h,
        text: t,
        font,
        fontSize: 9.2,
        minFontSize: 6.2,
        lineHeight: 12,
      });
    };

    for (let i = 0; i < Math.min(3, past.length); i++) {
      const r = past[i] || {};
      const y = pastY0 - i * pastRowH;
      drawTextTopLeft({ page: p5, x: xPast.date, y, text: asString(r.date), size: 9.5, font });
      // Fit long values inside their own columns to avoid overlap/mixed text.
      drawCellTextFit({ page: p5, x: xPast.category + 1, y, w: 56, h: pastRowH - 1, text: asString(r.category) });
      drawCellTextFit({ page: p5, x: xPast.name + 1, y, w: 58, h: pastRowH - 1, text: asString(r.name) });
      drawCellTextFit({ page: p5, x: xPast.duration + 1, y, w: 78, h: pastRowH - 1, text: asString(r.duration) });
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
      drawCellTextFit({ page: p5, x: xF.organizer + 1, y, w: 60, h: futRowH - 1, text: asString(r.organizer) });
      drawCellTextFit({ page: p5, x: xF.category + 1, y, w: 52, h: futRowH - 1, text: asString(r.category) });
      drawCellTextFit({ page: p5, x: xF.name + 1, y, w: 156, h: futRowH - 1, text: asString(r.name) });
      drawCellTextFit({ page: p5, x: xF.duration + 1, y, w: 120, h: futRowH - 1, text: asString(r.duration) });
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
  if (!useFlowMode && planContent?.formData && pdfDoc.getPageCount() >= 6) {
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
  if (!useFlowMode && planContent?.formData && pdfDoc.getPageCount() >= 7) {
    const p7 = pdfDoc.getPage(6);
    const { height: h7 } = p7.getSize();
    const t = planContent.formData;
    const treeObj = parseTreeFromJson(asString(t.architectureTreeJson)) || (planContent.architectureTree as unknown as AnyRecord | null);
    const root = asTreeNode(treeObj);

    // (一) 樹枝圖區塊：依實際輸入分枝動態排版（A/B/C/D/E...）
    // 樹枝圖區在模板上約落在：x=70..540, y=710..440（距底）
    // 先清底，避免與模板原有示意文字疊加看不出差異
    drawWhiteRect(p7, 70, 440, 470, 270);
    if (root) {
      drawDynamicTreeDiagram({
        page: p7,
        root,
        font,
        fontBold,
        leftX: 76,
        midX: 300,
        rightX: 528,
        yTop: 666,
        yBottom: 506,
        minBranchGap: 20,
        minDepthGapX: 96,
      });
    }

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

  // --- Page 9-10: 肆、預定進度及查核點（Tab6）[保留供日後套版用；目前 flow 已輸出肆] ---
  if (schedule && pdfDoc.getPageCount() >= 10) {
    // Page 9 (index 8): 預定進度表
    const p9 = pdfDoc.getPage(8);
    // Template has 10 month columns; since month labels are vectorized in the template,
    // we approximate centers by the observed grid spacing (~32pt).
    const monthKeys = (() => {
      const src = schedule.rows?.find((r) => r && r.months) as ScheduleCheckpointsDraft["rows"][number] | undefined;
      const keys = src ? Object.keys(src.months || {}) : [];
      // Stable order: sort by ROC year/month if possible; fallback to string.
      return keys.sort((a, b) => {
        const ma = a.match(/^(\d+)\/(\d+)$/);
        const mb = b.match(/^(\d+)\/(\d+)$/);
        if (ma && mb) {
          const ya = Number(ma[1]) || 0;
          const yaM = Number(ma[2]) || 0;
          const yb = Number(mb[1]) || 0;
          const ybM = Number(mb[2]) || 0;
          return ya - yb || yaM - ybM;
        }
        return a.localeCompare(b, "zh-Hant");
      });
    })();
    // Month mark x positions (template page 9): 7..12,1..4 (measured centers)
    const monthCenters = [235, 265, 297, 326, 357, 389, 424, 456, 487, 518];

    // Redraw month labels based on project period.
    // IMPORTANT: do NOT mask a whole band here (it will erase table grid lines).
    const start = parseYmd(startRaw);
    if (start) {
      const monthLabelY = 642;
      // generate 10 months from project start
      let mm = start.mo;
      for (let i = 0; i < 10; i++) {
        const label = `${mm}月`;
        const w = font.widthOfTextAtSize(label, 9.5);
        const x = monthCenters[i]! - w / 2;
        // Clear just behind the label text (inset so we don't touch grid lines).
        drawWhiteRectInset(p9, x - 2, monthLabelY - 4, w + 4, 12, 0.8);
        drawTextTopLeft({ page: p9, x, y: monthLabelY, text: label, size: 9.5, font });
        mm += 1;
        if (mm >= 13) {
          mm = 1;
        }
      }
      // year header (e.g. 115年度) — mask and redraw from start year
      const yearText = `${toRocYear(start.y)}年度`;
      const yW = font.widthOfTextAtSize(yearText, 10);
      const yX = 377 - yW / 2; // anchor around the template's 「年度」 label at x~377
      drawWhiteRectInset(p9, yX - 2, 697 - 4, yW + 4, 12, 0.8);
      drawTextTopLeft({ page: p9, x: yX, y: 697, text: yearText, size: 10, font });
    }

    const rowYByIndex = [617, 562, 526, 470, 432, 393];
    const rows = Array.isArray(schedule.rows) ? schedule.rows : [];
    for (let i = 0; i < Math.min(rows.length, rowYByIndex.length); i++) {
      const r = rows[i]!;
      const y = rowYByIndex[i];
      // Replace placeholder "工作項目"
      drawWhiteRectInset(p9, 55, y - 6, 250, 16, 1.2);
      drawTextTopLeft({ page: p9, x: 58, y, text: asString(r.item), size: 9.5, font });
      // Weight / man-months
      drawWhiteRectInset(p9, 166, y - 6, 40, 16, 1.2);
      drawRightAlignedFit({ page: p9, xRight: 195, y, text: asString(r.weight), font, fontSize: 9.5, maxWidth: 34 });
      drawWhiteRectInset(p9, 205, y - 6, 50, 16, 1.2);
      drawRightAlignedFit({ page: p9, xRight: 250, y, text: asString(r.manMonths), font, fontSize: 9.5, maxWidth: 44 });

      // Month marks
      const months = r.months || {};
      const keys = (monthKeys.length ? monthKeys : Object.keys(months)).slice(0, 10);
      for (let mi = 0; mi < Math.min(keys.length, 10); mi++) {
        const k = keys[mi]!;
        if (!months[k]) continue;
        const cx = monthCenters[mi]!;
        // Template '*' marks are vertically a bit above the '工作項目' text baseline.
        const markY = y - 8;
        // Use small filled square as the mark.
        pageDrawMark(p9, cx, markY);
      }
    }

    // Notes under the table (keep within the template note area)
    const progressNote = asString(schedule.notes?.progressNote);
    if (progressNote) {
      // Clear template note text before overlaying ours (otherwise looks "stuck together").
      drawWhiteRect(p9, 55, 258, 520, 60);
      drawMultilineBoxFit({
        page: p9,
        x: 60,
        yTopFromBottom: 300,
        width: 480,
        height: 60,
        text: progressNote,
        font,
        fontSize: 9.5,
        minFontSize: 7,
        lineHeight: 13,
      });
    }

    // Page 10 (index 9): 預定查核點說明
    const p10 = pdfDoc.getPage(9);
    const kpis = Array.isArray(schedule.kpis) ? schedule.kpis : [];
    // Template page 10 KPI rows baseline y values (from short-text extraction):
    // about 696/680/664/647/631.
    const kpiRowYs = [696, 680, 664, 647, 631];
    for (let i = 0; i < Math.min(5, kpis.length); i++) {
      const k = kpis[i]!;
      const y = kpiRowYs[i]!;
      // code (use inset masking to remove placeholders without eating grid lines)
      drawWhiteRectInset(p10, 42, y - 6, 70, 16, 1.2);
      drawTextTopLeft({ page: p10, x: 46, y, text: asString(k.code), size: 9.5, font });
      // KPI description
      drawWhiteRectInset(p10, 74, y - 6, 250, 16, 1.2);
      drawTextTopLeft({ page: p10, x: 78, y, text: asString(k.description), size: 9.5, font });
      // period
      drawWhiteRectInset(p10, 315, y - 6, 125, 16, 1.2);
      drawTextTopLeft({ page: p10, x: 318, y, text: asString(k.period), size: 9.5, font });
      // weight
      drawWhiteRectInset(p10, 428, y - 6, 85, 16, 1.2);
      drawRightAlignedFit({ page: p10, xRight: 510, y, text: asString(k.weight), font, fontSize: 9.5, maxWidth: 70 });
      // staff code
      drawWhiteRectInset(p10, 500, y - 6, 78, 16, 1.2);
      drawTextTopLeft({ page: p10, x: 504, y, text: asString(k.staffCode), size: 9.5, font });
    }

    const kpiNote = asString(schedule.notes?.kpiNote);
    if (kpiNote) {
      // Clear template note text before overlaying ours (otherwise looks "stuck together").
      drawWhiteRect(p10, 55, 470, 520, 140);
      drawMultilineBoxFit({
        page: p10,
        x: 60,
        yTopFromBottom: 585,
        width: 480,
        height: 110,
        text: kpiNote,
        font,
        fontSize: 9.5,
        minFontSize: 7,
        lineHeight: 13,
      });
    }
  }

  // --- Page 11-13: 伍、人力及經費需求表（Tab7） ---
  const humanBudget = (formData.humanBudget as HumanBudgetDraft | null) || null;
  if (humanBudget && pdfDoc.getPageCount() >= 13) {
    // Page 11 (index 10): 計畫人員簡歷表 + 計畫人力統計
    const p11 = pdfDoc.getPage(10);
    const pi = humanBudget.piProfile || {};
    // 主持人基本資料（以標籤座標右側填入）
    drawWhiteRect(p11, 140, 671, 170, 16);
    drawTextTopLeft({ page: p11, x: 145, y: 677, text: asString(pi.name), size: 10, font });
    // 稱謂（先生/女士）位置：直接在稱謂欄位後寫入
    drawWhiteRect(p11, 365, 671, 70, 16);
    drawTextTopLeft({ page: p11, x: 368, y: 677, text: asString(pi.salutation), size: 10, font });
    drawWhiteRect(p11, 140, 647, 170, 16);
    drawTextTopLeft({ page: p11, x: 145, y: 653, text: asString(pi.id), size: 10, font });
    drawWhiteRect(p11, 395, 647, 170, 16);
    drawTextTopLeft({ page: p11, x: 400, y: 653, text: asString(pi.birth), size: 10, font });

    // 申請人名稱 / 職稱 / 年資
    drawTextTopLeft({ page: p11, x: 150, y: 625, text: asString(pi.applicant), size: 10, font });
    drawTextTopLeft({ page: p11, x: 370, y: 625, text: asString(pi.title), size: 10, font });
    drawTextTopLeft({ page: p11, x: 150, y: 602, text: asString(pi.outsideYears), size: 10, font });
    drawTextTopLeft({ page: p11, x: 370, y: 602, text: asString(pi.insideYears), size: 10, font });

    drawTextTopLeft({ page: p11, x: 150, y: 578, text: asString(pi.field), size: 10, font });
    drawMultilineBoxFit({
      page: p11,
      x: 150,
      yTopFromBottom: 555,
      width: 410,
      height: 48,
      text: asString(pi.achievements),
      font,
      fontSize: 9.5,
      minFontSize: 7,
      lineHeight: 13,
    });

    // 學歷表（最多 2 列）
    const edu = Array.isArray(humanBudget.piEducation) ? humanBudget.piEducation : [];
    for (let i = 0; i < Math.min(2, edu.length); i++) {
      const r = edu[i]!;
      const y = 520 - i * 18;
      drawTextTopLeft({ page: p11, x: 80, y, text: asString(r.school), size: 9.5, font });
      drawTextTopLeft({ page: p11, x: 260, y, text: asString(r.time), size: 9.5, font });
      drawTextTopLeft({ page: p11, x: 350, y, text: asString(r.degree), size: 9.5, font });
      drawTextTopLeft({ page: p11, x: 430, y, text: asString(r.dept), size: 9.5, font });
    }

    // 經歷表（最多 2 列）
    const exp = Array.isArray(humanBudget.piExperience) ? humanBudget.piExperience : [];
    for (let i = 0; i < Math.min(2, exp.length); i++) {
      const r = exp[i]!;
      const y = 455 - i * 18;
      drawTextTopLeft({ page: p11, x: 80, y, text: asString(r.org), size: 9.5, font });
      drawTextTopLeft({ page: p11, x: 240, y, text: asString(r.time), size: 9.5, font });
      drawTextTopLeft({ page: p11, x: 350, y, text: asString(r.dept), size: 9.5, font });
      drawTextTopLeft({ page: p11, x: 450, y, text: asString(r.title), size: 9.5, font });
    }

    // 曾參與計畫（最多 1 列）
    const projs = Array.isArray(humanBudget.piProjects) ? humanBudget.piProjects : [];
    if (projs[0]) {
      const r = projs[0];
      drawTextTopLeft({ page: p11, x: 80, y: 395, text: asString(r.org), size: 9.5, font });
      drawTextTopLeft({ page: p11, x: 200, y: 395, text: asString(r.time), size: 9.5, font });
      drawTextTopLeft({ page: p11, x: 290, y: 395, text: asString(r.name), size: 9.5, font });
      drawTextTopLeft({ page: p11, x: 450, y: 395, text: asString(r.task), size: 9.5, font });
    }

    // 參與計畫研究發展人員（最多 4 列）
    const team = Array.isArray(humanBudget.team) ? humanBudget.team : [];
    // 公司名稱：
    if (companyName) drawTextTopLeft({ page: p11, x: 175, y: 344, text: companyName, size: 10, font });
    for (let i = 0; i < Math.min(4, team.length); i++) {
      const r = team[i]!;
      const y = 295 - i * 24;
      drawTextTopLeft({ page: p11, x: 86, y, text: asString(r.no), size: 9, font });
      drawTextTopLeft({ page: p11, x: 110, y, text: asString(r.name), size: 9, font });
      drawTextTopLeft({ page: p11, x: 150, y, text: asString(r.title), size: 9, font });
      drawTextTopLeft({ page: p11, x: 190, y, text: asString(r.education), size: 9, font });
      drawTextTopLeft({ page: p11, x: 250, y, text: asString(r.experience), size: 9, font });
      drawTextTopLeft({ page: p11, x: 335, y, text: asString(r.achievements), size: 9, font });
      drawRightAlignedFit({ page: p11, xRight: 415, y, text: asString(r.years), font, fontSize: 9, maxWidth: 30 });
      drawTextTopLeft({ page: p11, x: 420, y, text: asString(r.tasks), size: 9, font });
      drawRightAlignedFit({ page: p11, xRight: 560, y, text: asString(r.months), font, fontSize: 9, maxWidth: 26 });
    }

    // 計畫人力統計（1 列）
    const stats = Array.isArray(humanBudget.manpowerStats) ? humanBudget.manpowerStats : [];
    if (stats[0]) {
      const r = stats[0];
      const y = 105;
      drawTextTopLeft({ page: p11, x: 78, y, text: asString(r.company), size: 9.5, font });
      drawRightAlignedFit({ page: p11, xRight: 240, y, text: asString(r.phd), font, fontSize: 9.5, maxWidth: 30 });
      drawRightAlignedFit({ page: p11, xRight: 280, y, text: asString(r.master), font, fontSize: 9.5, maxWidth: 30 });
      drawRightAlignedFit({ page: p11, xRight: 320, y, text: asString(r.bachelor), font, fontSize: 9.5, maxWidth: 30 });
      drawRightAlignedFit({ page: p11, xRight: 365, y, text: asString(r.junior), font, fontSize: 9.5, maxWidth: 30 });
      drawRightAlignedFit({ page: p11, xRight: 430, y, text: asString(r.male), font, fontSize: 9.5, maxWidth: 30 });
      drawRightAlignedFit({ page: p11, xRight: 475, y, text: asString(r.female), font, fontSize: 9.5, maxWidth: 30 });
      drawRightAlignedFit({ page: p11, xRight: 520, y, text: asString(r.avgAge), font, fontSize: 9.5, maxWidth: 30 });
      drawRightAlignedFit({ page: p11, xRight: 560, y, text: asString(r.avgYears), font, fontSize: 9.5, maxWidth: 30 });
      drawRightAlignedFit({ page: p11, xRight: 590, y, text: asString(r.toHire), font, fontSize: 9.5, maxWidth: 30 });
    }

    // Page 12 (index 11): 經費需求總表（依 budgetRows）
    const p12 = pdfDoc.getPage(11);
    const budgetRows = Array.isArray(humanBudget.budgetRows) ? humanBudget.budgetRows : [];
    // Rough row baselines aligned with template items
    const yMap: Record<string, number> = {
      "計畫人員": 655,
      "顧問": 635,
      "小計_人事費": 616,
      "2. 消耗性器材及原材料費": 557,
      "3. 研發設備使用費": 524,
      "4. 研發設備維護費": 490,
      "(1) 技術或智慧財產權購買費": 446,
      "(2) 委託研究費": 426,
      "(3) 委託勞務費": 406,
      "(4)委託設計費": 386,
      "小計_技轉": 366,
      "合計": 344,
      "百分比": 318,
    };
    const pickY = (r: { subject: string; item: string }) => {
      if (r.subject.includes("1.") && r.item.includes("計畫人員")) return yMap["計畫人員"];
      if (r.subject.includes("1.") && r.item.includes("顧問")) return yMap["顧問"];
      if (r.subject.includes("1.") && r.item.includes("小計")) return yMap["小計_人事費"];
      if (r.subject.startsWith("2.")) return yMap["2. 消耗性器材及原材料費"];
      if (r.subject.startsWith("3.")) return yMap["3. 研發設備使用費"];
      if (r.subject.startsWith("4.")) return yMap["4. 研發設備維護費"];
      if (r.subject.startsWith("5.") && r.item.includes("(1)")) return yMap["(1) 技術或智慧財產權購買費"];
      if (r.subject.startsWith("5.") && r.item.includes("(2)")) return yMap["(2) 委託研究費"];
      if (r.subject.startsWith("5.") && r.item.includes("(3)")) return yMap["(3) 委託勞務費"];
      if (r.subject.startsWith("5.") && r.item.includes("(4)")) return yMap["(4)委託設計費"];
      if (r.subject.startsWith("5.") && r.item.includes("小計")) return yMap["小計_技轉"];
      if (r.subject === "合計") return yMap["合計"];
      if (r.subject === "百分比") return yMap["百分比"];
      return null;
    };
    for (const r of budgetRows) {
      const y = pickY(r);
      if (!y) continue;
      drawRightAlignedFit({ page: p12, xRight: 308, y, text: asString(r.gov), font, fontSize: 9.5, maxWidth: 55 });
      drawRightAlignedFit({ page: p12, xRight: 380, y, text: asString(r.self), font, fontSize: 9.5, maxWidth: 55 });
      drawRightAlignedFit({ page: p12, xRight: 450, y, text: asString(r.total), font, fontSize: 9.5, maxWidth: 55 });
      drawRightAlignedFit({ page: p12, xRight: 560, y, text: asString(r.ratio), font, fontSize: 9.5, maxWidth: 55 });
    }

    // Page 13 (index 12): 人事費/材料/設備
    const p13 = pdfDoc.getPage(12);
    const pcs = Array.isArray(humanBudget.personnelCosts) ? humanBudget.personnelCosts : [];
    for (let i = 0; i < Math.min(2, pcs.length); i++) {
      const r = pcs[i]!;
      const y = 665 - i * 18;
      drawTextTopLeft({ page: p13, x: 80, y, text: asString(r.name), size: 9.5, font });
      drawRightAlignedFit({ page: p13, xRight: 250, y, text: asString(r.avgSalary), font, fontSize: 9.5, maxWidth: 70 });
      drawRightAlignedFit({ page: p13, xRight: 305, y, text: asString(r.manMonths), font, fontSize: 9.5, maxWidth: 40 });
      drawRightAlignedFit({ page: p13, xRight: 560, y, text: asString(r.cost), font, fontSize: 9.5, maxWidth: 90 });
    }
    const ccs = Array.isArray(humanBudget.consultantCosts) ? humanBudget.consultantCosts : [];
    if (ccs[0]) {
      const r = ccs[0];
      const y = 580;
      drawTextTopLeft({ page: p13, x: 80, y, text: asString(r.name), size: 9.5, font });
      drawRightAlignedFit({ page: p13, xRight: 250, y, text: asString(r.avgSalary), font, fontSize: 9.5, maxWidth: 70 });
      drawRightAlignedFit({ page: p13, xRight: 305, y, text: asString(r.manMonths), font, fontSize: 9.5, maxWidth: 40 });
      drawRightAlignedFit({ page: p13, xRight: 560, y, text: asString(r.cost), font, fontSize: 9.5, maxWidth: 90 });
    }

    const cons = Array.isArray(humanBudget.consumables) ? humanBudget.consumables : [];
    for (let i = 0; i < Math.min(2, cons.length); i++) {
      const r = cons[i]!;
      const y = 420 - i * 18;
      drawTextTopLeft({ page: p13, x: 80, y, text: asString(r.item), size: 9.5, font });
      drawTextTopLeft({ page: p13, x: 255, y, text: asString(r.unit), size: 9.5, font });
      drawRightAlignedFit({ page: p13, xRight: 365, y, text: asString(r.qty), font, fontSize: 9.5, maxWidth: 40 });
      drawRightAlignedFit({ page: p13, xRight: 450, y, text: asString(r.price), font, fontSize: 9.5, maxWidth: 70 });
      drawRightAlignedFit({ page: p13, xRight: 560, y, text: asString(r.total), font, fontSize: 9.5, maxWidth: 90 });
    }

    const eq = humanBudget.equipments;
    if (eq) {
      const ex = Array.isArray(eq.existing) ? eq.existing : [];
      if (ex[0]) {
        const r = ex[0];
        const y = 205;
        drawTextTopLeft({ page: p13, x: 80, y, text: asString(r.name), size: 9, font });
        drawTextTopLeft({ page: p13, x: 155, y, text: asString(r.assetId), size: 9, font });
        drawRightAlignedFit({ page: p13, xRight: 315, y, text: asString(r.valueA), font, fontSize: 9, maxWidth: 60 });
        drawRightAlignedFit({ page: p13, xRight: 350, y, text: asString(r.countB), font, fontSize: 9, maxWidth: 35 });
        drawRightAlignedFit({ page: p13, xRight: 410, y, text: asString(r.remainingYears), font, fontSize: 9, maxWidth: 55 });
        drawRightAlignedFit({ page: p13, xRight: 470, y, text: asString(r.monthlyFee), font, fontSize: 9, maxWidth: 55 });
        drawRightAlignedFit({ page: p13, xRight: 520, y, text: asString(r.months), font, fontSize: 9, maxWidth: 35 });
        drawRightAlignedFit({ page: p13, xRight: 560, y, text: asString(r.total), font, fontSize: 9, maxWidth: 70 });
      }
      const nw = Array.isArray(eq.new) ? eq.new : [];
      if (nw[0]) {
        const r = nw[0];
        const y = 120;
        drawTextTopLeft({ page: p13, x: 80, y, text: asString(r.name), size: 9, font });
        drawTextTopLeft({ page: p13, x: 155, y, text: asString(r.assetId), size: 9, font });
        drawRightAlignedFit({ page: p13, xRight: 315, y, text: asString(r.valueA), font, fontSize: 9, maxWidth: 60 });
        drawRightAlignedFit({ page: p13, xRight: 350, y, text: asString(r.countB), font, fontSize: 9, maxWidth: 35 });
        drawRightAlignedFit({ page: p13, xRight: 470, y, text: asString(r.monthlyFee), font, fontSize: 9, maxWidth: 55 });
        drawRightAlignedFit({ page: p13, xRight: 520, y, text: asString(r.months), font, fontSize: 9, maxWidth: 35 });
        drawRightAlignedFit({ page: p13, xRight: 560, y, text: asString(r.total), font, fontSize: 9, maxWidth: 70 });
      }
    }
  }

  } // end !useFlowMode (skip template Page 4-13)

  // --- 陸、附件（章節頁 + 附件內容緊接其後） ---
  const attachmentsSection = pdfDoc.addPage();
  attachmentsSectionRef = attachmentsSection;
  const { width: aw2, height: ah2 } = attachmentsSection.getSize();
  attachmentsSection.drawText("陸、附件（依計畫實際情況檢附，無則免附）", { x: 56, y: ah2 - 72, size: 18, font: fontBold, color: rgb(0, 0, 0) });

  const attachmentChecks = (formData.attachmentChecks || {}) as AnyRecord;
  const slotLabels = [
    "附件一、委外或技術合作/引進合約書",
    "附件二、聘任顧問及國內外專家背景說明/合約書/原任職單位同意函",
    "附件三、與本案相關專利證書或申請中專利文件",
    "附件四、其他參考資料(如：相關產品型錄或國外技轉公司背景資料等)",
    "附件五、申請本計畫相關登記證件、切結書及其他相關附件",
  ];

  const slotChecked = (slot: 1 | 2 | 3 | 4 | 5) => Boolean(attachmentChecks[`a${slot}`]);
  const slotFiles = (slot: 1 | 2 | 3 | 4 | 5) => files.filter((f) => f.attachmentIndex === slot);

  let yA = ah2 - 110;
  const lineH2 = 18;
  for (let i = 1 as 1 | 2 | 3 | 4 | 5; i <= 5; i++) {
    const checked = slotChecked(i);
    const label = slotLabels[i - 1] || `附件${i}`;
    const prefix = `[${checked ? "✓" : " "}] `;
    const maxW = aw2 - 56 - 36;
    const wrapped = wrapText(prefix + label, maxW, fontBold, 11).slice(0, 3);
    for (let li = 0; li < wrapped.length; li++) {
      attachmentsSection.drawText(wrapped[li]!, { x: 56, y: yA - li * lineH2, size: 11, font, color: rgb(0, 0, 0) });
    }
    yA -= Math.max(1, wrapped.length) * lineH2;

    if (checked) {
      const fs = slotFiles(i);
      for (const f of fs) {
        const fname = f?.name ? asString(f.name) : "";
        if (!fname) continue;
        attachmentsSection.drawText(`檔名：${fname}`, { x: 72, y: yA + 4, size: 10.5, font, color: rgb(0.25, 0.25, 0.25) });
        yA -= 14;
      }
    }

    if (yA < 70) break;
  }

  // 依「附件一~四」順序，只合併「有勾選且已上傳」的 PDF。
  const selectedAttachments: FileItem[] = [];
  for (const [slot] of [
    [1, "a1"],
    [2, "a2"],
    [3, "a3"],
    [4, "a4"],
    [5, "a5"],
  ] as Array<[1 | 2 | 3 | 4 | 5, string]>) {
    if (!slotChecked(slot)) continue;
    const fs = slotFiles(slot);
    if (!fs.length) continue;
    selectedAttachments.push(...fs);
  }

  await appendDriveAttachments({ pdfDoc, files: selectedAttachments, fontBold });

    // Page numbering starts from section 壹 (the cached p4Ref page)
    const pagesNow = pdfDoc.getPages();
    const sectionStartIndex = p4Ref ? pagesNow.indexOf(p4Ref) : 3;
    drawSectionPageNumbers(pdfDoc, font, sectionStartIndex >= 0 ? sectionStartIndex : 3);

    // Redraw TOC with correct computed page numbers (relative to 壹).
    if (tocPageRef && p4Ref) {
      const { width: tw2, height: th2 } = tocPageRef.getSize();
      // Clear the TOC page area roughly (title + items).
      drawWhiteRect(tocPageRef, 40, 60, tw2 - 80, th2 - 120);

      // Title
      tocPageRef.drawText("目 錄", {
        x: tw2 / 2 - fontBold.widthOfTextAtSize("目 錄", 18) / 2,
        y: th2 - 90,
        size: 18,
        font: fontBold,
        color: rgb(0, 0, 0),
      });

      const leftX = 78;
      const rightX = tw2 - 78;
      const dotFontSize = 12;
      const dotW = font.widthOfTextAtSize(".", dotFontSize);
      const dotsColor = rgb(0.55, 0.55, 0.55);

      const sectionStart = sectionStartIndex;
      const tocItems2: Array<{ label: string; pageRef: PDFPage | null; indent?: number }> = [
        { label: "壹、公司概況", pageRef: p4Ref },
        { label: "一、基本資料", pageRef: p4Ref, indent: 1 },
        { label: "二、公司營運及財務狀況", pageRef: p5Ref, indent: 1 },
        { label: "三、曾經參與政府相關研發計畫之實績", pageRef: p5Ref, indent: 1 },
        { label: "貳、計畫內容與實施方式", pageRef: p6Ref },
        { label: "一、背景與說明", pageRef: p6Ref, indent: 1 },
        { label: "二、國內外產業現況、發展趨勢及競爭力分析", pageRef: p6Ref, indent: 1 },
        { label: "三、創新性說明", pageRef: p6Ref, indent: 1 },
        { label: "四、計畫架構與實施方式", pageRef: p7Ref, indent: 1 },
        { label: "參、預期效益", pageRef: p8Ref },
        { label: "肆、預定進度及查核點", pageRef: p9Ref },
        { label: "伍、人力及經費需求表", pageRef: p11Ref },
        { label: "陸、附件", pageRef: attachmentsSectionRef },
      ];

      let yT2 = th2 - 150;
      const tocLineH = 20;

      for (const it of tocItems2) {
        if (yT2 < 80) break;
        const indent = (it.indent || 0) * 18;
        const labelX = leftX + indent;

        tocPageRef.drawText(it.label, { x: labelX, y: yT2, size: 12, font, color: rgb(0, 0, 0) });

        const idx = it.pageRef ? pagesNow.indexOf(it.pageRef) : -1;
        const relPage = idx >= 0 && sectionStart >= 0 ? idx - sectionStart + 1 : 0;
        const pageStr = String(relPage);
        const pageW = font.widthOfTextAtSize(pageStr, 12);
        tocPageRef.drawText(pageStr, { x: rightX - pageW, y: yT2, size: 12, font, color: rgb(0, 0, 0) });

        // dotted leader
        const labelW = font.widthOfTextAtSize(it.label, 12);
        const dotsStart = labelX + labelW + 10;
        const dotsEnd = rightX - pageW - 10;
        if (dotsEnd > dotsStart) {
          const count = Math.max(0, Math.floor((dotsEnd - dotsStart) / dotW));
          if (count > 0) {
            tocPageRef.drawText(".".repeat(Math.min(count, 200)), { x: dotsStart, y: yT2, size: dotFontSize, font, color: dotsColor });
          }
        }

        yT2 -= tocLineH;
      }
    }

    // Improve compatibility with some PDF viewers (reduce garbled rendering issues)
    const out = await pdfDoc.save({ useObjectStreams: false });
    await writeAuditLog({
      userId: userKey,
      action: "pdf.generate",
      targetId: filename,
      timestamp: new Date().toISOString(),
      detail: { ip },
    });
    return new NextResponse(Buffer.from(out), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": buildContentDisposition(filename),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const err = e as Error & { code?: unknown; cause?: unknown };
    const msg = e instanceof Error ? e.message : "PDF generation failed";
    const stackTop = typeof err?.stack === "string" ? err.stack.split("\n").slice(0, 8).join("\n") : null;
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        hint: "可直接回報 detail 內容，我會依錯誤點精準修正。",
        detail: {
          stage: "api/pdf",
          name: err?.name || typeof e,
          code: err?.code ?? null,
          cause: err?.cause ? String(err.cause) : null,
          stackTop,
        },
      },
      { status: 500 }
    );
  }
}

