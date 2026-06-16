import * as XLSX from "xlsx";

import type { SettlementRow } from "@/lib/settlementTable";

function setCell(ws: XLSX.WorkSheet, addr: string, value: string | number | null) {
  if (value == null || value === "") return;
  ws[addr] = { t: typeof value === "number" ? "n" : "s", v: value };
}

function buildSheet(rows: SettlementRow[], memberNames: string[]): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  setCell(ws, "A1", "115年度基隆市地方產業創新研發推動計畫(地方型 SBIR) 決算清表");
  setCell(ws, "F2", "領域");
  setCell(ws, "G2", "■ 創新服務    ■ 創新技術");
  setCell(ws, "F3", "分類");

  const headers4 = {
    A4: "編號",
    B4: "申請單位",
    C4: "計畫名稱",
    D4: "申請",
    F4: "申請",
    G4: "建議",
    H4: "建議",
    I4: "建議",
    J4: "委員評分",
    M4: "分數",
    N4: "委員排序",
    Q4: "排序",
    R4: "補助款",
    S4: "總補助",
    T4: "總排序",
    U4: "編號排序",
  };
  for (const [k, v] of Object.entries(headers4)) setCell(ws, k, v);

  setCell(ws, "D5", "補助款");
  setCell(ws, "E5", "自籌款");
  setCell(ws, "F5", "總經費");
  setCell(ws, "G5", "補助款");
  setCell(ws, "H5", "自籌款");
  setCell(ws, "I5", "總經費");
  setCell(ws, "M5", "平均");
  setCell(ws, "Q5", "加總");
  setCell(ws, "R5", "補助比例");
  setCell(ws, "S5", "比例");
  setCell(ws, "D6", "(千)");
  setCell(ws, "E6", "(千)");
  setCell(ws, "F6", "(千)");
  setCell(ws, "G6", "(千)");
  setCell(ws, "H6", "(千)");
  setCell(ws, "I6", "(千)");

  memberNames.forEach((name, i) => {
    const scoreCol = String.fromCharCode("J".charCodeAt(0) + i);
    const rankCol = String.fromCharCode("N".charCodeAt(0) + i);
    setCell(ws, `${scoreCol}6`, name);
    setCell(ws, `${rankCol}6`, name);
  });

  const startRow = 7;
  rows.forEach((row, idx) => {
    const r = startRow + idx;
    setCell(ws, `A${r}`, row.overallRank);
    setCell(ws, `B${r}`, row.companyName);
    setCell(ws, `C${r}`, row.title);
    setCell(ws, `G${r}`, row.suggestedSubsidy);
    setCell(ws, `H${r}`, row.suggestedSelfFund);
    setCell(ws, `I${r}`, row.suggestedTotal);
    setCell(ws, `J${r}`, row.committeeScores[0]);
    setCell(ws, `K${r}`, row.committeeScores[1]);
    setCell(ws, `L${r}`, row.committeeScores[2]);
    setCell(ws, `M${r}`, row.avgScore != null ? Math.round(row.avgScore * 10) / 10 : null);
    setCell(ws, `N${r}`, row.committeeRanks[0]);
    setCell(ws, `O${r}`, row.committeeRanks[1]);
    setCell(ws, `P${r}`, row.committeeRanks[2]);
    setCell(ws, `Q${r}`, row.rankSum);
    setCell(ws, `T${r}`, row.overallRank);
    setCell(ws, `U${r}`, row.briefingOrder);
  });

  const totalRow = startRow + rows.length + 1;
  setCell(ws, `F${totalRow}`, "總計");
  if (rows.length > 0) {
    const first = startRow;
    const last = startRow + rows.length - 1;
    ws[`G${totalRow}`] = { t: "n", f: `SUM(G${first}:G${last})` };
    ws[`H${totalRow}`] = { t: "n", f: `SUM(H${first}:H${last})` };
    ws[`I${totalRow}`] = { t: "n", f: `SUM(I${first}:I${last})` };
  }

  setCell(ws, `B${totalRow + 1}`, "*本表係依據上開計畫之個案決議彙總表彙總而成");

  ws["!ref"] = `A1:U${totalRow + 2}`;
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 20 } },
    { s: { r: 1, c: 0 }, e: { r: 2, c: 4 } },
    { s: { r: 1, c: 5 }, e: { r: 2, c: 20 } },
  ];

  return ws;
}

export function buildSettlementWorkbook(
  standardRows: SettlementRow[],
  jointRows: SettlementRow[],
  memberNames: string[],
): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(standardRows, memberNames), "決算清表");
  if (jointRows.length > 0) {
    XLSX.utils.book_append_sheet(wb, buildSheet(jointRows, memberNames), "聯合提案");
  }
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
