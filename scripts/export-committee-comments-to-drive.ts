import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import { Readable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import type { drive_v3 } from "googleapis";

import { getDriveSaClient } from "../app/api/_driveSa";
import { withGoogleApiRetry } from "../app/api/_googleApiRetry";
import { prisma } from "../lib/prisma";
import { withPrismaRetry } from "../lib/prismaRetry";
import { resolveApplicationDisplayFieldsBatch } from "../lib/resolveApplicationDisplayFields";
import {
  isReviewMeetingDate,
  reviewMeetingAdminLabel,
  type ReviewMeetingDate,
} from "../lib/reviewMeetingAgenda";

const DEFAULT_DRIVE_FOLDER_ID = "1b-P31NacYYMl-CMxSPFOk1U_Ns-3Hjo9";
const DOC_TITLE = "115 年度基隆市地方型 SBIR 審查委員意見彙整";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type ExportCase = {
  applicationId: string;
  meetingDate: ReviewMeetingDate;
  reviewProposalType: string | null;
  companyName: string;
  planTitle: string;
  fileBaseName: string;
  comments: string[];
};

function parseArgValue(flag: string): string | null {
  const prefix = `${flag}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : null;
}

function sanitizeFileSegment(input: string): string {
  return String(input || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
}

function buildDocFileName(base: string): string {
  return `${sanitizeFileSegment(base) || "未命名案件"}.docx`;
}

function normalizeComment(input: string | null | undefined): string {
  return String(input || "").replace(/\r\n/g, "\n").trim();
}

async function deleteFilesWithNameInFolder(
  drive: drive_v3.Drive,
  folderId: string,
  fileName: string,
): Promise<void> {
  const escaped = fileName.replace(/'/g, "\\'");
  const oldFiles = await drive.files.list({
    q: `'${folderId}' in parents and name='${escaped}' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 20,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  for (const old of oldFiles.data.files ?? []) {
    if (!old.id) continue;
    await drive.files.delete({ fileId: old.id, supportsAllDrives: true });
  }
}

async function uploadDocxToDrive(input: {
  drive: drive_v3.Drive;
  folderId: string;
  fileName: string;
  buffer: Buffer;
}): Promise<string> {
  return withGoogleApiRetry(`committeeComments.upload:${input.fileName}`, async () => {
    await deleteFilesWithNameInFolder(input.drive, input.folderId, input.fileName);
    const created = await input.drive.files.create({
      requestBody: {
        name: input.fileName,
        parents: [input.folderId],
        mimeType: DOCX_MIME,
      },
      media: {
        mimeType: DOCX_MIME,
        body: Readable.from(input.buffer),
      },
      fields: "id,name,webViewLink",
      supportsAllDrives: true,
    });
    const fileId = created.data.id?.trim();
    if (!fileId) {
      throw new Error(`Drive upload failed for ${input.fileName}: missing file id`);
    }
    return created.data.webViewLink?.trim() || `https://drive.google.com/file/d/${fileId}/view`;
  });
}

function buildDocChildren(item: ExportCase): Paragraph[] {
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: DOC_TITLE, bold: true, size: 30, font: "標楷體" })],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: "審查場次：", bold: true, font: "標楷體" }),
        new TextRun({ text: reviewMeetingAdminLabel(item.meetingDate), font: "標楷體" }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: "公司名稱：", bold: true, font: "標楷體" }),
        new TextRun({ text: item.companyName || "—", font: "標楷體" }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({ text: "計畫名稱：", bold: true, font: "標楷體" }),
        new TextRun({ text: item.planTitle || "—", font: "標楷體" }),
      ],
    }),
    new Paragraph({
      spacing: { after: 180 },
      children: [new TextRun({ text: "委員意見", bold: true, size: 26, font: "標楷體" })],
    }),
  ];

  if (item.comments.length === 0) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: "（本案委員未填寫審查意見）", font: "標楷體" })],
      }),
    );
    return children;
  }

  item.comments.forEach((comment, index) => {
    const lines = comment.split("\n");
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: `意見 ${index + 1}：`, bold: true, font: "標楷體" }),
          new TextRun({ text: lines[0] || "", font: "標楷體" }),
        ],
      }),
    );
    for (let i = 1; i < lines.length; i++) {
      children.push(
        new Paragraph({
          spacing: { after: i === lines.length - 1 ? 120 : 40 },
          children: [new TextRun({ text: lines[i] || "", font: "標楷體" })],
        }),
      );
    }
  });

  return children;
}

async function buildWordBuffer(item: ExportCase): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: buildDocChildren(item),
      },
    ],
  });
  return Packer.toBuffer(doc);
}

async function loadExportCases(): Promise<ExportCase[]> {
  const applications = await withPrismaRetry(() =>
    prisma.application.findMany({
      where: {
        reviewMeetingDate: { in: ["0622", "0701"] },
        evaluations: { some: { meetingDate: { in: ["0622", "0701"] } } },
      },
      select: {
        id: true,
        title: true,
        reviewMeetingDate: true,
        reviewProposalType: true,
        submissionMode: true,
        description: true,
        displayCompanyName: true,
        evaluations: {
          where: { meetingDate: { in: ["0622", "0701"] } },
          select: {
            comment: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: "asc" }],
        },
      },
      orderBy: [{ reviewMeetingDate: "asc" }, { reviewAgendaOrder: "asc" }, { createdAt: "asc" }],
    }),
  );

  const displayMap = await resolveApplicationDisplayFieldsBatch(
    applications.map((app) => ({
      id: app.id,
      submissionMode: app.submissionMode,
      description: app.description,
      displayCompanyName: app.displayCompanyName,
    })),
  );

  const usedFileNames = new Map<string, number>();
  const out: ExportCase[] = [];

  for (const app of applications) {
    const meetingDateRaw = String(app.reviewMeetingDate || "");
    if (!isReviewMeetingDate(meetingDateRaw)) continue;
    const fields = displayMap.get(app.id);
    const companyName = fields?.companyName?.trim() || app.displayCompanyName?.trim() || "未命名公司";
    const planTitle = app.title?.trim() || "未命名計畫";
    const isJoint = String(app.reviewProposalType || "").toUpperCase() === "JOINT";
    const desiredBase = isJoint ? planTitle : companyName;
    const normalizedBase = sanitizeFileSegment(desiredBase) || "未命名案件";
    const hitCount = (usedFileNames.get(normalizedBase) ?? 0) + 1;
    usedFileNames.set(normalizedBase, hitCount);
    const fileBaseName = hitCount === 1 ? normalizedBase : `${normalizedBase} (${hitCount})`;
    const comments = app.evaluations.map((row) => normalizeComment(row.comment)).filter(Boolean);

    out.push({
      applicationId: app.id,
      meetingDate: meetingDateRaw,
      reviewProposalType: app.reviewProposalType,
      companyName,
      planTitle,
      fileBaseName,
      comments,
    });
  }

  return out;
}

async function main() {
  const localMode = process.argv.includes("--local");
  const folderId = parseArgValue("--folder-id") || DEFAULT_DRIVE_FOLDER_ID;
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const items = await loadExportCases();
  console.log("Rated cases:", items.length);
  if (items.length === 0) {
    console.log("No rated cases found for 0622/0701.");
    return;
  }

  if (localMode) {
    const outDir = path.resolve("output", "committee-comments");
    fs.mkdirSync(outDir, { recursive: true });
    for (const item of items) {
      const fileName = buildDocFileName(item.fileBaseName);
      const buffer = await buildWordBuffer(item);
      const filePath = path.join(outDir, fileName);
      fs.writeFileSync(filePath, buffer);
      console.log(`Written: ${filePath} (${item.comments.length} comments)`);
    }
    console.log(`\nDone! ${items.length} files saved to ${outDir}`);
    return;
  }

  console.log("Drive folder:", folderId);
  const drive = await getDriveSaClient();
  for (const item of items) {
    const fileName = buildDocFileName(item.fileBaseName);
    const buffer = await buildWordBuffer(item);
    const link = await uploadDocxToDrive({
      drive,
      folderId,
      fileName,
      buffer,
    });
    console.log(
      JSON.stringify({
        applicationId: item.applicationId,
        meetingDate: item.meetingDate,
        reviewProposalType: item.reviewProposalType,
        companyName: item.companyName,
        planTitle: item.planTitle,
        fileName,
        commentCount: item.comments.length,
        link,
      }),
    );
  }
}

main()
  .catch((error) => {
    console.error("[export-committee-comments-to-drive] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
