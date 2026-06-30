#!/usr/bin/env python3
import json
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

DOCX = Path(r"c:\恂\02-業務\05-115\02-115基隆市SBIR\115徵件\115年初審審查會議程表0701調.docx")
XLSX = Path(
    r"c:\恂\02-業務\05-115\02-115基隆市SBIR\115徵件\基隆SBIR審查業者計畫書-20260616T114048Z-3-001\基隆SBIR審查業者計畫書\115決算清表-0624.xlsx"
)
OUT = Path(__file__).resolve().parent / "_reference_parse_output.json"

NS_W = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
NS_M = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def parse_docx(path: Path):
    z = zipfile.ZipFile(path)
    root = ET.fromstring(z.read("word/document.xml"))
    paras = []
    for p in root.findall(".//w:p", NS_W):
        text = "".join(t.text or "" for t in p.findall(".//w:t", NS_W))
        if text.strip():
            paras.append(text.strip())
    return {"paragraphs": paras}


def parse_xlsx(path: Path):
    z = zipfile.ZipFile(path)
    ss = []
    if "xl/sharedStrings.xml" in z.namelist():
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

    sheets_out = []
    for sheet in wb.findall("m:sheets/m:sheet", NS_M):
        name = sheet.get("name")
        rid = sheet.get(REL_NS + "id")
        target = rid_map.get(rid, "")
        if not target.startswith("xl/"):
            target = "xl/" + target.lstrip("/")
        sheet_xml = ET.fromstring(z.read(target))
        rows_out = []
        for row in sheet_xml.findall("m:sheetData/m:row", NS_M):
            rnum = int(row.get("r", "0"))
            cells = {}
            for c in row.findall("m:c", NS_M):
                ref = c.get("r", "")
                t = c.get("t")
                f_el = c.find("m:f", NS_M)
                v_el = c.find("m:v", NS_M)
                formula = f_el.text if f_el is not None else None
                val = v_el.text if v_el is not None else ""
                if t == "s" and val.isdigit():
                    val = ss[int(val)]
                cells[ref] = {"v": val, "f": formula}
            if cells:
                rows_out.append({"row": rnum, "cells": cells})
        sheets_out.append({"name": name, "rows": rows_out})
    return {"sheets": sheets_out}


def main():
    out = {}
    if DOCX.exists():
        out["docx"] = parse_docx(DOCX)
    if XLSX.exists():
        out["xlsx"] = parse_xlsx(XLSX)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(str(OUT))


if __name__ == "__main__":
    main()
