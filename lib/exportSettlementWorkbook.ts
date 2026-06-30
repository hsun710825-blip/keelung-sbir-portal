import XLSX from "xlsx-js-style";

import { gradeRatioFromAvgScore } from "@/lib/settlementFormulas";
import type { SettlementRow } from "@/lib/settlementTable";

type CellValue = string | number | null;

const THIN_BORDER = {
  top: { style: "thin", color: { rgb: "FF000000" } },
  bottom: { style: "thin", color: { rgb: "FF000000" } },
  left: { style: "thin", color: { rgb: "FF000000" } },
  right: { style: "thin", color: { rgb: "FF000000" } },
};

const DATA_LAST_COL = 17; // A..R
const HEADER_LAST_COL = 24; // through Y (grade legend)

function cellStyle(extra?: Record<string, unknown>) {
  return {
    border: THIN_BORDER,
    alignment: { vertical: "center", wrapText: true },
    ...extra,
  };
}

function colLetter(index: number): string {
  let n = index;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function setCell(
  ws: XLSX.WorkSheet,
  addr: string,
  value: CellValue,
  style?: Record<string, unknown>,
) {
  if (value == null || value === "") return;
  ws[addr] = {
    t: typeof value === "number" ? "n" : "s",
    v: value,
    s: cellStyle(style),
  };
}

function setFormulaCell(
  ws: XLSX.WorkSheet,
  addr: string,
  formula: string,
  value?: CellValue,
  style?: Record<string, unknown>,
) {
  const cell: XLSX.CellObject = {
    t: typeof value === "number" ? "n" : "s",
    v: value ?? "",
    f: formula,
    s: cellStyle(style),
  };
  ws[addr] = cell;
}

function displayWidth(text: string): number {
  let w = 0;
  for (const ch of text) {
    w += ch.charCodeAt(0) > 255 ? 2 : 1;
  }
  return w;
}

function applyAutoColumnWidths(ws: XLSX.WorkSheet, colCount: number, lastRow: number) {
  const widths: number[] = Array.from({ length: colCount }, () => 8);
  for (let r = 0; r <= lastRow; r++) {
    for (let c = 0; c < colCount; c++) {
      const addr = `${colLetter(c)}${r + 1}`;
      const cell = ws[addr];
      if (!cell || cell.v == null) continue;
      const text = String(cell.v);
      const extra = c === 2 || c === 3 ? 2 : 1;
      widths[c] = Math.max(widths[c], displayWidth(text) + extra);
    }
  }
  ws["!cols"] = widths.map((wch) => ({ wch: Math.min(Math.max(wch, 8), 48) }));
}

function applyGridToRange(
  ws: XLSX.WorkSheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const addr = `${colLetter(c)}${r + 1}`;
      const existing = ws[addr];
      if (!existing) {
        ws[addr] = { t: "s", v: "", s: cellStyle() };
      } else if (!existing.s) {
        existing.s = cellStyle();
      }
    }
  }
}

function appendCommitteeSignatureBlock(
  ws: XLSX.WorkSheet,
  contentLastRow: number,
  lastCol: number,
): number {
  const sigStartCol = lastCol - 2;
  const titleRow = contentLastRow + 2;
  const boxStartRow = titleRow + 1;
  const boxEndRow = boxStartRow + 3;

  ws[`${colLetter(sigStartCol)}${titleRow}`] = {
    t: "s",
    v: "委員簽名",
    s: cellStyle({
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true },
    }),
  };

  applyGridToRange(ws, boxStartRow - 1, boxEndRow - 1, sigStartCol, lastCol);

  const merges = ws["!merges"] ?? [];
  merges.push(
    { s: { r: titleRow - 1, c: sigStartCol }, e: { r: titleRow - 1, c: lastCol } },
    { s: { r: boxStartRow - 1, c: sigStartCol }, e: { r: boxEndRow - 1, c: lastCol } },
  );
  ws["!merges"] = merges;

  return boxEndRow;
}

function buildGradeLegend(ws: XLSX.WorkSheet) {
  setCell(ws, "R1", "研發個案補助比例建議", { font: { bold: true } });
  setCell(ws, "Y1", "補助比例", { font: { bold: true } });
  setCell(ws, "E2", "領域分類");
  setCell(ws, "H2", "■創新服務  ■創新技術");
  setCell(ws, "R2", "A級");
  setCell(ws, "S2", "(90分以上)");
  setCell(ws, "Y2", "45%~50%");
  setCell(ws, "R3", "B級");
  setCell(ws, "S3", "(80~89分)");
  setCell(ws, "Y3", "35%~45%");
  setCell(ws, "R4", "C級");
  setCell(ws, "S4", "(70~79分)");
  setCell(ws, "Y4", "21%~35%");
  setCell(ws, "R5", "F級");
  setCell(ws, "S5", "(69分以下)");
  setCell(ws, "Y5", "不補助");
}

function buildHeaderRows(ws: XLSX.WorkSheet, memberNames: string[], titleLine1: string) {
  setCell(ws, "A1", titleLine1, {
    alignment: { horizontal: "center", vertical: "center" },
    font: { bold: true },
  });
  setCell(ws, "A2", "會議決算清表", { font: { bold: true } });

  buildGradeLegend(ws);

  const h3: Record<string, string> = {
    A3: "總排序",
    B3: "編號",
    C3: "申請單位",
    D3: "計畫名稱",
    E3: "申請",
    H3: "建議",
    K3: "委員評分",
    N3: "分數",
    O3: "補助款",
    P3: "總補助",
  };
  for (const [addr, text] of Object.entries(h3)) {
    setCell(ws, addr, text, { font: { bold: true }, alignment: { horizontal: "center" } });
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
    setCell(ws, addr, text, { font: { bold: true }, alignment: { horizontal: "center" } });
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
  const scored = row.avgScore != null;
  const gradeRatio = row.subsidyGradeRatio ?? gradeRatioFromAvgScore(row.avgScore);

  const rankCell = jointSheet ? row.briefingOrder : row.overallRank;
  const briefingCell = jointSheet ? "" : row.briefingOrder;

  setCell(ws, `A${excelRow}`, rankCell);
  setCell(ws, `B${excelRow}`, briefingCell);
  setCell(ws, `C${excelRow}`, row.companyName);
  setCell(ws, `D${excelRow}`, row.title);
  setCell(ws, `E${excelRow}`, row.appliedSubsidy);
  setCell(ws, `F${excelRow}`, row.appliedSelfFund);
  setCell(ws, `G${excelRow}`, row.appliedTotal);

  if (scored && gradeRatio != null) {
    setFormulaCell(
      ws,
      `H${excelRow}`,
      `ROUND(G${excelRow}*R${excelRow},0)`,
      row.suggestedSubsidy,
    );
    setFormulaCell(ws, `I${excelRow}`, `F${excelRow}`, row.suggestedSelfFund);
    setFormulaCell(
      ws,
      `J${excelRow}`,
      `ROUND(SUM(H${excelRow}:I${excelRow}),0)`,
      row.suggestedTotal,
    );
    setCell(ws, `R${excelRow}`, gradeRatio);
    setFormulaCell(ws, `O${excelRow}`, `H${excelRow}/E${excelRow}`, row.subsidyRatio);
    setFormulaCell(ws, `P${excelRow}`, `H${excelRow}/J${excelRow}`, row.totalSubsidyRatio);
  } else {
    setCell(ws, `H${excelRow}`, row.suggestedSubsidy ?? 0);
    setCell(ws, `I${excelRow}`, row.suggestedSelfFund);
    setCell(ws, `J${excelRow}`, row.suggestedTotal);
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
  const sheetTitle =
    titleLine1 ??
    "                 115年 6月22日、7月1日基隆市地方型SBIR補助分組審查會議";

  buildHeaderRows(ws, memberNames, sheetTitle);

  const startRow = 6;
  rows.forEach((row, idx) => {
    writeDataRow(ws, row, startRow + idx, jointSheet);
  });

  const totalRow = startRow + rows.length + (rows.length > 0 ? 1 : 0);
  if (rows.length > 0) {
    const first = startRow;
    const last = startRow + rows.length - 1;
    setCell(ws, `D${totalRow}`, "總計", { font: { bold: true } });
    for (const col of ["E", "F", "G", "H", "I", "J"]) {
      setFormulaCell(ws, `${col}${totalRow}`, `SUM(${col}${first}:${col}${last})`, undefined, {
        font: { bold: true },
      });
    }
  }

  const footnoteRow = totalRow + (rows.length > 0 ? 1 : 0);
  setCell(ws, `A${footnoteRow}`, "*本表係依據上開計畫之個案決議彙總表彙總而成");

  let lastRowIndex = footnoteRow;
  if (appendSignature) {
    lastRowIndex = appendCommitteeSignatureBlock(ws, footnoteRow, DATA_LAST_COL - 1);
  }

  ws["!ref"] = `A1:${colLetter(HEADER_LAST_COL)}${lastRowIndex}`;
  applyGridToRange(ws, 2, footnoteRow - 1, 0, DATA_LAST_COL - 1);

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: DATA_LAST_COL - 1 } },
    { s: { r: 2, c: 4 }, e: { r: 2, c: 6 } },
    { s: { r: 2, c: 7 }, e: { r: 2, c: 9 } },
    { s: { r: 2, c: 10 }, e: { r: 2, c: 12 } },
    { s: { r: 2, c: 13 }, e: { r: 2, c: 13 } },
    { s: { r: 2, c: 14 }, e: { r: 2, c: 15 } },
  ];
  if (ws["!merges"]) merges.push(...ws["!merges"]);
  ws["!merges"] = merges;

  applyAutoColumnWidths(ws, DATA_LAST_COL, footnoteRow);
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
    buildSheet(mainRows, memberNames, { appendSignature: !hasJointSheet }),
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
