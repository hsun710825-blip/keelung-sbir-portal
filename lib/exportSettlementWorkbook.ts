import XLSX from "xlsx-js-style";

import type { SettlementRow } from "@/lib/settlementTable";

type CellValue = string | number | null;

const THIN_BORDER = {
  top: { style: "thin", color: { rgb: "FF000000" } },
  bottom: { style: "thin", color: { rgb: "FF000000" } },
  left: { style: "thin", color: { rgb: "FF000000" } },
  right: { style: "thin", color: { rgb: "FF000000" } },
};

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
      const extra = c === 1 || c === 2 ? 2 : 1;
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

function buildSheet(
  rows: SettlementRow[],
  memberNames: string[],
  appendSignature = false,
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const lastCol = 16; // A..Q

  setCell(ws, "A1", "115年度基隆市地方產業創新研發推動計畫(地方型 SBIR) 決算清表", {
    alignment: { horizontal: "center", vertical: "center" },
    font: { bold: true },
  });
  setCell(ws, "F2", "領域");
  setCell(ws, "G2", "■ 創新服務    ■ 創新技術");
  setCell(ws, "F3", "分類");

  const headers4: Record<string, string> = {
    A4: "編號",
    B4: "申請單位",
    C4: "計畫名稱",
    D4: "申請",
    G4: "建議",
    J4: "委員評分",
    M4: "分數",
    N4: "補助款",
    O4: "總補助",
    P4: "總排序",
    Q4: "編號排序",
  };
  for (const [k, v] of Object.entries(headers4)) setCell(ws, k, v, { font: { bold: true } });

  setCell(ws, "D5", "補助款");
  setCell(ws, "E5", "自籌款");
  setCell(ws, "F5", "總經費");
  setCell(ws, "G5", "補助款");
  setCell(ws, "H5", "自籌款");
  setCell(ws, "I5", "總經費");
  setCell(ws, "M5", "平均");
  setCell(ws, "N5", "補助比例");
  setCell(ws, "O5", "比例");
  setCell(ws, "D6", "(千)");
  setCell(ws, "E6", "(千)");
  setCell(ws, "F6", "(千)");
  setCell(ws, "G6", "(千)");
  setCell(ws, "H6", "(千)");
  setCell(ws, "I6", "(千)");

  memberNames.forEach((name, i) => {
    const scoreCol = colLetter(9 + i);
    setCell(ws, `${scoreCol}6`, name);
  });

  const startRow = 7;
  rows.forEach((row, idx) => {
    const r = startRow + idx;
    setCell(ws, `A${r}`, row.overallRank);
    setCell(ws, `B${r}`, row.companyName);
    setCell(ws, `C${r}`, row.title);
    setCell(ws, `D${r}`, row.appliedSubsidy);
    setCell(ws, `E${r}`, row.appliedSelfFund);
    setCell(ws, `F${r}`, row.appliedTotal);
    setCell(ws, `G${r}`, row.suggestedSubsidy);
    setCell(ws, `H${r}`, row.suggestedSelfFund);
    setCell(ws, `I${r}`, row.suggestedTotal);
    setCell(ws, `J${r}`, row.committeeScores[0]);
    setCell(ws, `K${r}`, row.committeeScores[1]);
    setCell(ws, `L${r}`, row.committeeScores[2]);
    setCell(ws, `M${r}`, row.avgScore != null ? Math.round(row.avgScore * 10) / 10 : null);
    setCell(ws, `P${r}`, row.overallRank);
    setCell(ws, `Q${r}`, row.briefingOrder);
  });

  const totalRow = startRow + rows.length + 1;
  setCell(ws, `F${totalRow}`, "總計", { font: { bold: true } });
  if (rows.length > 0) {
    const first = startRow;
    const last = startRow + rows.length - 1;
    for (const col of ["G", "H", "I"]) {
      ws[`${col}${totalRow}`] = {
        t: "n",
        f: `SUM(${col}${first}:${col}${last})`,
        s: cellStyle({ font: { bold: true } }),
      };
    }
  }

  setCell(ws, `B${totalRow + 1}`, "*本表係依據上開計畫之個案決議彙總表彙總而成");

  const footnoteRow = totalRow + 1;
  let lastRowIndex = footnoteRow;
  if (appendSignature) {
    lastRowIndex = appendCommitteeSignatureBlock(ws, footnoteRow, lastCol);
  }

  ws["!ref"] = `A1:Q${lastRowIndex}`;
  applyGridToRange(ws, 3, footnoteRow - 1, 0, lastCol);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 2, c: 4 } },
    { s: { r: 1, c: 5 }, e: { r: 2, c: lastCol } },
    { s: { r: 3, c: 3 }, e: { r: 3, c: 5 } },
    { s: { r: 3, c: 6 }, e: { r: 3, c: 8 } },
    { s: { r: 3, c: 9 }, e: { r: 3, c: 11 } },
  ];

  applyAutoColumnWidths(ws, lastCol + 1, footnoteRow - 1);
  return ws;
}

export function buildSettlementWorkbook(
  standardRows: SettlementRow[],
  jointRows: SettlementRow[],
  memberNames: string[],
): Buffer {
  const wb = XLSX.utils.book_new();
  const hasJointSheet = jointRows.length > 0;
  XLSX.utils.book_append_sheet(wb, buildSheet(standardRows, memberNames, !hasJointSheet), "決算清表");
  if (hasJointSheet) {
    XLSX.utils.book_append_sheet(wb, buildSheet(jointRows, memberNames, true), "聯合提案");
  }
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
