import XLSX from "xlsx-js-style";

import { gradeRatioFromAvgScore } from "@/lib/settlementFormulas";
import type { SettlementRow } from "@/lib/settlementTable";

type CellValue = string | number | null;

const LAST_COL = 15; // A..P (0-indexed: 0..14)
const TIER_COL = 17; // R column for tier rate formulas

const FONT = { name: "Times New Roman", sz: 14 };
const MONEY_FMT = '0_);[Red]\\(0\\)';
const PCT_FMT = "0%";

const THIN_BORDER = {
  top: { style: "thin", color: { rgb: "FF000000" } },
  bottom: { style: "thin", color: { rgb: "FF000000" } },
  left: { style: "thin", color: { rgb: "FF000000" } },
  right: { style: "thin", color: { rgb: "FF000000" } },
};

const YELLOW_FILL = { fgColor: { rgb: "FFFFC000" } };

const COL_WIDTHS = [
  11.14, 8.57, 30.71, 87, 12, 8.86, 14.43, 13.86, 12.43, 13.57, 9.86, 8.86, 13, 13, 12.86, 11.43,
];

const ROW_HEIGHTS: Record<number, number> = {
  1: 51,
  2: 30.75,
  3: 30.75,
  4: 39,
  5: 20.25,
};

function colLetter(index: number): string {
  let n = index;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function baseStyle(extra?: Record<string, unknown>) {
  return {
    border: THIN_BORDER,
    font: FONT,
    alignment: { vertical: "center", wrapText: true },
    ...extra,
  };
}

function setCell(
  ws: XLSX.WorkSheet,
  addr: string,
  value: CellValue,
  style?: Record<string, unknown>,
) {
  if (value == null || value === "") return;
  const isNum = typeof value === "number";
  ws[addr] = {
    t: isNum ? "n" : "s",
    v: value,
    s: baseStyle(style),
  };
}

function setMoneyCell(ws: XLSX.WorkSheet, addr: string, value: CellValue, style?: Record<string, unknown>) {
  if (value == null || value === "") return;
  ws[addr] = {
    t: typeof value === "number" ? "n" : "s",
    v: value,
    s: baseStyle({ numFmt: MONEY_FMT, ...style }),
  };
}

function setPctCell(ws: XLSX.WorkSheet, addr: string, value: CellValue, style?: Record<string, unknown>) {
  if (value == null || value === "") return;
  ws[addr] = {
    t: typeof value === "number" ? "n" : "s",
    v: value,
    s: baseStyle({ numFmt: PCT_FMT, ...style }),
  };
}

function setFormulaCell(
  ws: XLSX.WorkSheet,
  addr: string,
  formula: string,
  value?: CellValue,
  style?: Record<string, unknown>,
  numFmt?: string,
) {
  ws[addr] = {
    t: typeof value === "number" ? "n" : "s",
    v: value ?? "",
    f: formula,
    s: baseStyle({ ...(numFmt ? { numFmt } : {}), ...style }),
  };
}

function applyFixedLayout(ws: XLSX.WorkSheet, lastRow: number) {
  ws["!cols"] = COL_WIDTHS.map((wch) => ({ wch }));
  ws["!rows"] = [];
  for (let r = 1; r <= lastRow; r++) {
    const h = ROW_HEIGHTS[r] ?? 19.5;
    ws["!rows"]![r - 1] = { hpt: h };
  }
}

function applyGrid(ws: XLSX.WorkSheet, startRow: number, endRow: number) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = 0; c < LAST_COL; c++) {
      const addr = `${colLetter(c)}${r}`;
      const existing = ws[addr];
      if (!existing) {
        ws[addr] = { t: "s", v: "", s: baseStyle() };
      } else if (!existing.s) {
        existing.s = baseStyle();
      }
    }
  }
}

function appendSignatureBlock(ws: XLSX.WorkSheet, afterRow: number): number {
  const titleRow = afterRow + 5;
  const sigStartCol = 10; // K
  const sigEndCol = 15; // P

  ws[`${colLetter(sigStartCol)}${titleRow}`] = {
    t: "s",
    v: "委員簽名欄",
    s: baseStyle({
      alignment: { horizontal: "center", vertical: "center" },
      font: { ...FONT, bold: true },
    }),
  };

  const merges = ws["!merges"] ?? [];
  merges.push({
    s: { r: titleRow - 1, c: sigStartCol },
    e: { r: titleRow - 1, c: sigEndCol },
  });

  for (let i = 1; i <= 3; i++) {
    const row = titleRow + i;
    applyGrid(ws, row, row);
    merges.push({
      s: { r: row - 1, c: sigStartCol },
      e: { r: row - 1, c: sigEndCol },
    });
  }
  ws["!merges"] = merges;
  return titleRow + 3;
}

function buildHeaderRows(ws: XLSX.WorkSheet, memberNames: string[], titleLine1: string) {
  const title =
    titleLine1 ||
    "                 115年 6月22日、7月1日基隆市地方型SBIR補助分組審查會議";

  setCell(ws, "A1", title, {
    alignment: { horizontal: "center", vertical: "center" },
    font: { ...FONT, bold: true },
  });

  ws["A2"] = {
    t: "s",
    v: "會議決算清表",
    s: baseStyle({
      fill: YELLOW_FILL,
      alignment: { horizontal: "center", vertical: "center" },
      font: { ...FONT, bold: true },
    }),
  };
  setCell(ws, "E2", "領域分類", { alignment: { horizontal: "center" } });
  setCell(ws, "H2", "■創新服務  ■創新技術", { alignment: { horizontal: "center" } });

  const h3: Record<string, string> = {
    A3: "總排序",
    B3: "編號",
    C3: "申請單位",
    D3: "計畫名稱",
    E3: "申請",
    H3: "建議",
    K3: "委員評分",
    N3: "分數",
    O3: "補助額度",
    P3: "總補助",
  };
  for (const [addr, text] of Object.entries(h3)) {
    setCell(ws, addr, text, {
      font: { ...FONT, bold: true },
      alignment: { horizontal: "center", vertical: "center" },
    });
  }

  const h4: Record<string, string> = {
    E4: "補助款",
    F4: "自籌款",
    G4: "總經費",
    H4: "補助款",
    I4: "自籌款",
    J4: "總經費",
    K4: "A",
    L4: "B",
    M4: "C",
    N4: "平均",
    O4: "補助比例",
    P4: "比例",
  };
  for (const [addr, text] of Object.entries(h4)) {
    setCell(ws, addr, text, {
      font: { ...FONT, bold: true },
      alignment: { horizontal: "center", vertical: "center" },
    });
  }

  for (const col of ["E", "F", "G", "H", "I", "J"]) {
    setCell(ws, `${col}5`, "(千)", { alignment: { horizontal: "center" } });
  }

  memberNames.forEach((name, i) => {
    setCell(ws, `${colLetter(10 + i)}5`, name, { alignment: { horizontal: "center" } });
  });
}

function writeDataRow(
  ws: XLSX.WorkSheet,
  row: SettlementRow,
  excelRow: number,
  jointSheet: boolean,
) {
  const gradeRatio = row.subsidyGradeRatio ?? gradeRatioFromAvgScore(row.avgScore);
  const rankCell = jointSheet ? row.briefingOrder : row.overallRank;
  const briefingCell = jointSheet ? "" : row.briefingOrder;

  setCell(ws, `A${excelRow}`, rankCell);
  setCell(ws, `B${excelRow}`, briefingCell);
  setCell(ws, `C${excelRow}`, row.companyName);
  setCell(ws, `D${excelRow}`, row.title);
  setMoneyCell(ws, `E${excelRow}`, row.appliedSubsidy);
  setMoneyCell(ws, `F${excelRow}`, row.appliedSelfFund);
  setMoneyCell(ws, `G${excelRow}`, row.appliedTotal);

  if (gradeRatio != null) {
    setPctCell(ws, `R${excelRow}`, gradeRatio);
    setFormulaCell(
      ws,
      `H${excelRow}`,
      `ROUND(G${excelRow}*R${excelRow},0)`,
      row.suggestedSubsidy,
      undefined,
      MONEY_FMT,
    );
    setFormulaCell(ws, `I${excelRow}`, `F${excelRow}`, row.suggestedSelfFund, undefined, MONEY_FMT);
    setFormulaCell(
      ws,
      `J${excelRow}`,
      `ROUND(SUM(H${excelRow}:I${excelRow}),0)`,
      row.suggestedTotal,
      undefined,
      MONEY_FMT,
    );
    setFormulaCell(
      ws,
      `O${excelRow}`,
      `H${excelRow}/E${excelRow}`,
      row.subsidyRatio,
      undefined,
      PCT_FMT,
    );
    setFormulaCell(
      ws,
      `P${excelRow}`,
      `H${excelRow}/J${excelRow}`,
      row.totalSubsidyRatio,
      undefined,
      PCT_FMT,
    );
  } else {
    setMoneyCell(ws, `H${excelRow}`, row.suggestedSubsidy ?? 0);
    setMoneyCell(ws, `I${excelRow}`, row.suggestedSelfFund);
    setMoneyCell(ws, `J${excelRow}`, row.suggestedTotal);
  }

  row.committeeScores.forEach((score, i) => {
    if (score != null) setCell(ws, `${colLetter(10 + i)}${excelRow}`, score);
  });

  if (row.avgScore != null) {
    setCell(ws, `N${excelRow}`, Math.round(row.avgScore * 10) / 10);
  }
}

function buildSheet(
  rows: SettlementRow[],
  memberNames: string[],
  options: { appendSignature?: boolean; jointSheet?: boolean; titleLine1?: string } = {},
): XLSX.WorkSheet {
  const { appendSignature = false, jointSheet = false, titleLine1 } = options;
  const ws: XLSX.WorkSheet = {};

  buildHeaderRows(ws, memberNames, titleLine1 ?? "");

  const startRow = 6;
  rows.forEach((row, idx) => writeDataRow(ws, row, startRow + idx, jointSheet));

  const totalRow = startRow + rows.length + (rows.length > 0 ? 1 : 0);
  if (rows.length > 0) {
    const first = startRow;
    const last = startRow + rows.length - 1;
    setCell(ws, `A${totalRow}`, "總計", { font: { ...FONT, bold: true } });
    for (const col of ["E", "F", "G", "H", "I", "J"]) {
      setFormulaCell(
        ws,
        `${col}${totalRow}`,
        `SUM(${col}${first}:${col}${last})`,
        undefined,
        { font: { ...FONT, bold: true } },
        MONEY_FMT,
      );
    }
  }

  const footnoteRow = totalRow + (rows.length > 0 ? 1 : 0);
  ws[`A${footnoteRow}`] = {
    t: "s",
    v: "*本表係依據上開計畫之個案決議彙總表彙總而成",
    s: baseStyle({ alignment: { horizontal: "left" } }),
  };

  let lastRowIndex = footnoteRow;
  if (appendSignature) {
    lastRowIndex = appendSignatureBlock(ws, footnoteRow);
  }

  ws["!ref"] = `A1:R${lastRowIndex}`;
  applyGrid(ws, 2, footnoteRow);

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: LAST_COL - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 1, c: 4 }, e: { r: 1, c: 6 } },
    { s: { r: 1, c: 7 }, e: { r: 1, c: LAST_COL - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 4, c: 0 } },
    { s: { r: 2, c: 1 }, e: { r: 4, c: 1 } },
    { s: { r: 2, c: 2 }, e: { r: 4, c: 2 } },
    { s: { r: 2, c: 3 }, e: { r: 4, c: 3 } },
    { s: { r: 2, c: 4 }, e: { r: 2, c: 6 } },
    { s: { r: 2, c: 7 }, e: { r: 2, c: 9 } },
    { s: { r: 2, c: 10 }, e: { r: 2, c: 12 } },
    { s: { r: 2, c: 13 }, e: { r: 4, c: 13 } },
    { s: { r: 2, c: 14 }, e: { r: 2, c: 14 } },
    { s: { r: 2, c: 15 }, e: { r: 2, c: 15 } },
    { s: { r: 3, c: 14 }, e: { r: 4, c: 14 } },
    { s: { r: 3, c: 15 }, e: { r: 4, c: 15 } },
    { s: { r: footnoteRow - 1, c: 0 }, e: { r: footnoteRow - 1, c: LAST_COL - 1 } },
  ];
  if (ws["!merges"]) merges.push(...ws["!merges"]);
  ws["!merges"] = merges;

  applyFixedLayout(ws, lastRowIndex);
  return ws;
}

export function buildSettlementWorkbook(
  standardRows: SettlementRow[],
  jointRows: SettlementRow[],
  memberNames: string[],
): Buffer {
  const mainRows = [...standardRows, ...jointRows];
  const wb = XLSX.utils.book_new();
  const hasJointSheet = jointRows.length > 0;

  XLSX.utils.book_append_sheet(
    wb,
    buildSheet(mainRows, memberNames, { appendSignature: true }),
    "決算清表",
  );

  if (hasJointSheet) {
    XLSX.utils.book_append_sheet(
      wb,
      buildSheet(jointRows, memberNames, { appendSignature: true, jointSheet: true }),
      "聯合提案",
    );
  }

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
