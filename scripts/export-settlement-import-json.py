#!/usr/bin/env python3
"""Export settlement rows from reference xlsx as UTF-8 JSON for import script."""
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

XLSX = Path(
    r"c:\恂\02-業務\05-115\02-115基隆市SBIR\115徵件\基隆SBIR審查業者計畫書-20260616T114048Z-3-001\基隆SBIR審查業者計畫書\115決算清表-0624.xlsx"
)
OUT = Path(__file__).resolve().parent.parent / "lib" / "data" / "settlementImport0624.json"

NS_M = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def read_xlsx(path: Path):
    z = zipfile.ZipFile(path)
    ss = []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    for si in root.findall("m:si", NS_M):
        texts = [t.text or "" for t in si.findall(".//m:t", NS_M)]
        ss.append("".join(texts))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    rid_map = {
        r.get("Id"): r.get("Target")
        for r in rels.findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship")
    }
    sheets = []
    for sheet in wb.findall("m:sheets/m:sheet", NS_M):
        name = sheet.get("name")
        rid = sheet.get(REL_NS + "id")
        target = rid_map[rid]
        if not target.startswith("xl/"):
            target = "xl/" + target.lstrip("/")
        sheet_xml = ET.fromstring(z.read(target))
        rows = {}
        for row in sheet_xml.findall("m:sheetData/m:row", NS_M):
            rnum = int(row.get("r", "0"))
            cells = {}
            for c in row.findall("m:c", NS_M):
                ref = c.get("r", "")
                col = re.match(r"([A-Z]+)", ref).group(1)
                t = c.get("t")
                v_el = c.find("m:v", NS_M)
                val = v_el.text if v_el is not None else ""
                if t == "s" and val.isdigit():
                    val = ss[int(val)]
                try:
                    num = float(val)
                    if num.is_integer():
                        num = int(num)
                    cells[col] = num
                except (TypeError, ValueError):
                    if val != "":
                        cells[col] = val
            if cells:
                rows[rnum] = cells
        sheets.append({"name": name, "rows": rows})
    return sheets


def row_to_import(r: dict, joint: bool):
    def num(k):
        v = r.get(k)
        return v if isinstance(v, (int, float)) else None

    briefing = r.get("B") or r.get("A")
    return {
        "briefingOrder": str(briefing) if briefing is not None else "",
        "companyName": str(r.get("C", "")).strip(),
        "planTitle": str(r.get("D", "")).strip(),
        "appliedSubsidy": num("E"),
        "appliedSelfFund": num("F"),
        "appliedTotal": num("G"),
        "suggestedSubsidy": num("H"),
        "suggestedSelfFund": num("I"),
        "suggestedTotal": num("J"),
        "tierRate": num("R"),
        "isJoint": joint,
    }


def main():
    sheets = read_xlsx(XLSX)
    main_rows = []
    joint_rows = []
    for rnum, cells in sorted(sheets[0]["rows"].items()):
        if rnum < 6:
            continue
        if rnum >= 29:
            continue
        if not cells.get("C") and not cells.get("D"):
            continue
        if cells.get("A") == "總計" or str(cells.get("B", "")).startswith("*"):
            continue
        briefing = str(cells.get("B", cells.get("A", "")))
        is_joint = briefing.startswith("A") or "聯合" in str(cells.get("D", ""))
        item = row_to_import(cells, is_joint)
        if is_joint:
            joint_rows.append(item)
        else:
            main_rows.append(item)

    if len(sheets) > 1:
        for rnum, cells in sorted(sheets[1]["rows"].items()):
            if rnum < 6 or rnum >= 9:
                continue
            if not cells.get("C"):
                continue
            joint_rows.append(row_to_import(cells, True))

    OUT.write_text(
        json.dumps({"standard": main_rows, "joint": joint_rows}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(OUT, len(main_rows), len(joint_rows))


if __name__ == "__main__":
    main()
