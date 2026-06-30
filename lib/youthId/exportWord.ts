import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import {
  ID_CARD_HEIGHT_CM,
  ID_CARD_WIDTH_CM,
  YOUTH_ID_WORD_CASES_PER_PAGE,
  YOUTH_ID_WORD_TITLE,
} from "@/lib/youthId/constants";
import { downloadDriveFile } from "@/lib/youthId/driveFiles";
import { formatQualifiesLabel } from "@/lib/youthId/formatCommitteeNote";
import { extractIdCardPair } from "@/lib/youthId/idImageExtract";
import type { YouthVerificationRow } from "@/lib/youthId/types";

/** docx ImageRun 使用像素（約 96 DPI） */
const ID_W_PX = Math.round((ID_CARD_WIDTH_CM / 2.54) * 96);
const ID_H_PX = Math.round((ID_CARD_HEIGHT_CM / 2.54) * 96);

type DocChild = Paragraph | Table;

function cellText(text: string, bold = false) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold, font: "標楷體" })] })],
    verticalAlign: "center",
  });
}

function buildPersonTable(row: YouthVerificationRow): Table {
  const header = new TableRow({
    children: [
      cellText("公司名稱", true),
      cellText("計畫名稱", true),
      cellText("負責人", true),
      cellText("設籍縣市", true),
      cellText("年齡", true),
      cellText("是否符合", true),
    ],
  });

  const dataRows = row.persons.map((person, idx) =>
    new TableRow({
      children: [
        cellText(idx === 0 ? row.companyName : ""),
        cellText(idx === 0 ? row.title : ""),
        cellText(person.responsibleName || "—"),
        cellText(person.registeredCity || "—"),
        cellText(person.age != null ? String(person.age) : "—"),
        cellText(formatQualifiesLabel(person.qualifies)),
      ],
    }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...dataRows],
  });
}

async function idImagesParagraphs(row: YouthVerificationRow): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];
  for (const person of row.persons) {
    if (!person.driveFile?.id) continue;
    const label = person.responsibleName || person.sheetCompanyName || row.companyName;
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: `${label} — 身分證正反面`, bold: true, font: "標楷體" })],
        spacing: { before: 200, after: 100 },
      }),
    );
    try {
      const { buffer, mimeType } = await downloadDriveFile(person.driveFile.id);
      const pair = await extractIdCardPair(buffer, mimeType);
      if (!pair) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: "（無法解析證件影像）", font: "標楷體", italics: true })],
          }),
        );
        continue;
      }
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: pair.front,
              transformation: { width: ID_W_PX, height: ID_H_PX },
              type: "png",
            }),
            new TextRun({ text: "    ", font: "標楷體" }),
            new ImageRun({
              data: pair.back,
              transformation: { width: ID_W_PX, height: ID_H_PX },
              type: "png",
            }),
          ],
        }),
      );
    } catch (error) {
      console.error("[youthId export] image failed:", error);
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: "（證件下載失敗）", font: "標楷體", italics: true })],
        }),
      );
    }
  }
  return paragraphs;
}

async function buildCaseBlock(row: YouthVerificationRow): Promise<DocChild[]> {
  const blocks: DocChild[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: row.isJoint
            ? `【聯合提案】${row.companyName}`
            : `${row.overallRank != null ? `${row.overallRank}. ` : ""}${row.companyName}`,
          bold: true,
          size: 24,
          font: "標楷體",
        }),
      ],
      spacing: { after: 120 },
    }),
    buildPersonTable(row),
  ];
  const imageParagraphs = await idImagesParagraphs(row);
  return [...blocks, ...imageParagraphs];
}

function paginateRows(rows: YouthVerificationRow[]): YouthVerificationRow[][] {
  const pages: YouthVerificationRow[][] = [];
  let buffer: YouthVerificationRow[] = [];

  for (const row of rows) {
    if (row.isJoint) {
      if (buffer.length > 0) {
        pages.push(buffer);
        buffer = [];
      }
      pages.push([row]);
      continue;
    }
    buffer.push(row);
    if (buffer.length >= YOUTH_ID_WORD_CASES_PER_PAGE) {
      pages.push(buffer);
      buffer = [];
    }
  }
  if (buffer.length > 0) pages.push(buffer);
  return pages;
}

export async function buildYouthIdWordDocument(rows: YouthVerificationRow[]): Promise<Buffer> {
  const pages = paginateRows(rows);
  const children: DocChild[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: YOUTH_ID_WORD_TITLE, bold: true, size: 32, font: "標楷體" })],
      spacing: { after: 400 },
    }),
  ];

  for (let p = 0; p < pages.length; p++) {
    if (p > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    for (let i = 0; i < pages[p].length; i++) {
      const caseBlocks = await buildCaseBlock(pages[p][i]);
      children.push(...caseBlocks);
      if (i < pages[p].length - 1) {
        children.push(new Paragraph({ spacing: { before: 300, after: 300 } }));
      }
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  return Packer.toBuffer(doc);
}
