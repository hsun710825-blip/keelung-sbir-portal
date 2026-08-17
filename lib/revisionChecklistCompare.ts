import { after } from "next/server";
import { getDriveOauthClient } from "@/app/api/_driveOauth";
import { withGoogleApiRetry } from "@/app/api/_googleApiRetry";
import {
  companyShortNameFromAllowlist,
} from "@/lib/applicantRevisionAccess";
import findingsData from "@/lib/data/sbir115RevisionFindings.json";
import { pushLineToPo } from "@/lib/poRevisionUploadNotify";

type FindingIssue = {
  no: number;
  category: string;
  severity: string;
  problem: string;
  suggestion: string;
};

type FindingPack = {
  code: string;
  company: string;
  planName: string;
  issues: FindingIssue[];
};

type Verdict = "fixed" | "unfixed" | "unknown";

const FINDINGS = findingsData as FindingPack[];

function normalize(input: string): string {
  return String(input || "")
    .replace(/\s+/g, "")
    .replace(/[：:]/g, ":")
    .replace(/[～~]/g, "～")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")");
}

function extractQuoted(text: string): string[] {
  const out: string[] = [];
  const re = /[「『"]([^」』"]{8,80})[」』"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push(m[1]);
  }
  return out;
}

function distinctiveSnippets(text: string): string[] {
  const snippets = extractQuoted(text);
  const extra = text.match(/11[56]年\d{1,2}月\d{1,2}日/g) || [];
  const extra2 = text.match(/共\d+個月/g) || [];
  const extra3 = text.match(/○年○月○日/g) || [];
  return [...snippets, ...extra, ...extra2, ...extra3];
}

function findFinding(companyName: string): FindingPack | null {
  const raw = String(companyName || "").trim();
  const short = companyShortNameFromAllowlist(raw);
  const hit =
    FINDINGS.find((f) => f.company === raw) ||
    FINDINGS.find((f) => f.company.includes(raw) || raw.includes(f.company.replace(/＋.*/, ""))) ||
    FINDINGS.find((f) => short && f.company.includes(short));
  return hit ?? null;
}

async function downloadRevisionPdf(fileId: string): Promise<Buffer> {
  const drive = getDriveOauthClient();
  const dl = await withGoogleApiRetry(`revisionCompare.download.${fileId}`, () =>
    drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" },
    ),
  );
  return Buffer.from(dl.data as ArrayBuffer);
}

async function extractPdfPlainText(bytes: Uint8Array): Promise<{ text: string; pages: number; weakPages: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
  const pages = doc.numPages;
  const parts: string[] = [];
  let weakPages = 0;
  const limit = Math.min(pages, 80);
  for (let i = 1; i <= limit; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? String(item.str || "") : ""))
      .join("");
    const compact = pageText.replace(/\s+/g, "");
    if (compact.length < 20) weakPages += 1;
    parts.push(pageText);
  }
  return { text: parts.join("\n"), pages, weakPages };
}

function judgeIssue(issue: FindingIssue, normPdf: string): Verdict {
  const oldBits = distinctiveSnippets(issue.problem)
    .map(normalize)
    .filter((s) => s.length >= 6);
  const newBits = distinctiveSnippets(issue.suggestion)
    .map(normalize)
    .filter((s) => s.length >= 6);

  const oldHit = oldBits.some((s) => normPdf.includes(s));
  const newHit = newBits.some((s) => normPdf.includes(s));

  if (oldHit && !newHit) return "unfixed";
  if (!oldHit && newHit) return "fixed";
  if (oldHit && newHit) return "unfixed";
  return "unknown";
}

function buildCompareMessage(input: {
  companyName: string;
  pack: FindingPack;
  pages: number;
  weakPages: number;
  must: { fixed: FindingIssue[]; unfixed: FindingIssue[]; unknown: FindingIssue[] };
  fileUrl?: string;
}): string {
  const mustTotal = input.must.fixed.length + input.must.unfixed.length + input.must.unknown.length;
  const lines = [
    `【基隆SBIR】修改清單自動初核：${input.companyName}`,
    `計畫：${input.pack.planName}`,
    `PDF ${input.pages} 頁（文字過少 ${input.weakPages} 頁，該部分無法判讀）`,
    `必改 ${mustTotal} 項 → 已見修正 ${input.must.fixed.length}、疑未改 ${input.must.unfixed.length}、無法判定 ${input.must.unknown.length}`,
    "",
  ];

  if (input.must.unfixed.length) {
    lines.push("疑未改（必改，最多列 8 項）：");
    input.must.unfixed.slice(0, 8).forEach((it, i) => {
      const hint = it.problem.replace(/\s+/g, " ").slice(0, 60);
      lines.push(`${i + 1}. [${it.category}] ${hint}`);
    });
    if (input.must.unfixed.length > 8) {
      lines.push(`…另有 ${input.must.unfixed.length - 8} 項疑未改`);
    }
    lines.push("");
  }

  lines.push("此為程式初核（對照今日修改清單的關鍵字／日期），圖檔頁與敘述品質仍需人工複核。");
  if (input.fileUrl) lines.push(`檔案：${input.fileUrl}`);
  return lines.join("\n");
}

export async function compareRevisionPdfAndNotify(input: {
  companyName: string;
  fileId: string;
  fileUrl?: string;
  pdfBytes?: Uint8Array;
}): Promise<void> {
  const pack = findFinding(input.companyName);
  if (!pack) {
    await pushLineToPo(
      `【基隆SBIR】修改清單自動初核失敗：找不到「${input.companyName}」的清單資料。`,
    );
    return;
  }

  const bytes = input.pdfBytes
    ? Buffer.from(input.pdfBytes)
    : await downloadRevisionPdf(input.fileId);
  const extracted = await extractPdfPlainText(new Uint8Array(bytes));
  const normPdf = normalize(extracted.text);

  const mustIssues = pack.issues.filter((x) => x.severity === "必改");
  const must = { fixed: [] as FindingIssue[], unfixed: [] as FindingIssue[], unknown: [] as FindingIssue[] };
  for (const issue of mustIssues) {
    const v = judgeIssue(issue, normPdf);
    must[v === "fixed" ? "fixed" : v === "unfixed" ? "unfixed" : "unknown"].push(issue);
  }

  await pushLineToPo(
    buildCompareMessage({
      companyName: input.companyName,
      pack,
      pages: extracted.pages,
      weakPages: extracted.weakPages,
      must,
      fileUrl: input.fileUrl,
    }),
  );
}

export function scheduleRevisionChecklistCompare(input: {
  companyName: string;
  fileId: string;
  fileUrl?: string;
  pdfBytes?: Uint8Array;
}): void {
  const run = () =>
    compareRevisionPdfAndNotify(input).catch((err) => {
      console.warn(
        "[revisionChecklistCompare] failed:",
        err instanceof Error ? err.message : String(err),
      );
      void pushLineToPo(
        `【基隆SBIR】修改清單自動初核失敗：${input.companyName}\n${err instanceof Error ? err.message : String(err)}`.slice(
          0,
          1000,
        ),
      );
    });

  try {
    after(run);
  } catch {
    void run();
  }
}
