#!/usr/bin/env python3
"""Rebuild public/templates/Resume.docx with docxtemplater loops and 2-column tables."""

from __future__ import annotations

import re
import shutil
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("/Users/albert/Downloads/Resume.docx")
TARGET = ROOT / "public/templates/Resume.docx"
COL_WIDTH = 4680
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W14 = "http://schemas.microsoft.com/office/word/2010/wordml"
NS = {"w": W, "w14": W14}


def w(tag: str) -> str:
    return f"{{{W}}}{tag}"


SECTION_TITLES = [
    "EDUCATION",
    "HONORS & AWARDS",
    "EXTRACURRICULAR ACTIVITIES",
    "WORK EXPERIENCE & INTERNSHIPS",
    "RESEARCH & PROJECTS",
    "SKILLS & INTERESTS",
]


def add_section_rule(p: ET.Element) -> None:
    ppr = p.find(w("pPr"))
    if ppr is None:
        ppr = ET.Element(w("pPr"))
        p.insert(0, ppr)
    pbdr = ppr.find(w("pBdr"))
    if pbdr is None:
        pbdr = ET.SubElement(ppr, w("pBdr"))
    bottom = pbdr.find(w("bottom"))
    if bottom is None:
        bottom = ET.SubElement(pbdr, w("bottom"))
    bottom.set(w("val"), "single")
    bottom.set(w("sz"), "6")
    bottom.set(w("space"), "1")
    bottom.set(w("color"), "A0A0A0")


def is_hr_paragraph(p: ET.Element) -> bool:
    return p.find(f".//{w('pict')}") is not None or p.find(f".//{w('pBdr')}") is not None


def apply_section_rules(body: ET.Element) -> None:
    children = list(body)
    for title in SECTION_TITLES:
        idx = next(
            (
                i
                for i, child in enumerate(children)
                if child.tag == w("p")
                and title in "".join(t.text or "" for t in child.iter(w("t")))
            ),
            None,
        )
        if idx is None:
            continue
        add_section_rule(children[idx])
        if idx + 1 < len(children) and is_hr_paragraph(children[idx + 1]):
            body.remove(children[idx + 1])


def normalize_xml(xml: str) -> str:
    return (
        xml.replace("xmlns:ns0=", "xmlns:w=")
        .replace("xmlns:ns1=", "xmlns:w14=")
        .replace("xmlns:ns2=", "xmlns:v=")
        .replace("xmlns:ns3=", "xmlns:o=")
        .replace("<ns0:", "<w:")
        .replace("</ns0:", "</w:")
        .replace("<ns1:", "<w14:")
        .replace("</ns1:", "</w14:")
        .replace("<ns2:", "<v:")
        .replace("</ns2:", "</v:")
        .replace("<ns3:", "<o:")
        .replace("</ns3:", "</o:")
        .replace(" ns0:", " w:")
        .replace(" ns1:", " w14:")
        .replace(" ns2:", " v:")
        .replace(" ns3:", " o:")
    )


def set_para_text(p: ET.Element, text: str) -> None:
    for t in p.iter(w("t")):
        t.text = text
        return
    for r in list(p.findall(w("r"))):
        p.remove(r)
    r = ET.SubElement(p, w("r"))
    rpr = ET.SubElement(r, w("rPr"))
    rtl = ET.SubElement(rpr, w("rtl"))
    rtl.set(w("val"), "0")
    t = ET.SubElement(r, w("t"))
    t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    t.text = text


def parse_fragment(xml_fragment: str) -> list[ET.Element]:
    wrapped = f'<root xmlns:w="{W}" xmlns:w14="{W14}">{xml_fragment}</root>'
    root = ET.fromstring(wrapped)
    return list(root)


def tbl_pr() -> str:
    return (
        f'<w:tblPr>'
        f'<w:tblW w:w="5000" w:type="pct"/>'
        f'<w:tblLayout w:type="fixed"/>'
        f'<w:tblBorders>'
        f'<w:top w:val="nil" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:left w:val="nil" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:bottom w:val="nil" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:right w:val="nil" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:insideH w:val="nil" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:insideV w:val="nil" w:sz="0" w:space="0" w:color="auto"/>'
        f'</w:tblBorders>'
        f'<w:tblLook w:val="04A0" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/>'
        f'</w:tblPr>'
        f'<w:tblGrid><w:gridCol w:w="{COL_WIDTH}"/><w:gridCol w:w="{COL_WIDTH}"/></w:tblGrid>'
    )


def cell_para(text: str, bold: bool = False, italic: bool = False, align: str | None = None) -> str:
    rpr = ""
    if bold:
        rpr += '<w:b w:val="1"/><w:bCs w:val="1"/>'
    if italic:
        rpr += '<w:i w:val="1"/><w:iCs w:val="1"/>'
    if align == "right":
        ppr = '<w:pPr><w:jc w:val="right"/><w:rPr/></w:pPr>'
    elif rpr:
        ppr = f"<w:pPr><w:rPr>{rpr}</w:rPr></w:pPr>"
    else:
        ppr = "<w:pPr/>"
    rpr_run = f"<w:rPr>{rpr}<w:rtl w:val=\"0\"/></w:rPr>" if rpr else '<w:rPr><w:rtl w:val="0"/></w:rPr>'
    return (
        f'<w:tc><w:tcPr><w:tcW w:w="{COL_WIDTH}" w:type="dxa"/></w:tcPr>'
        f'<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" w:rsidRDefault="00000000" w:rsidRPr="00000000">'
        f"{ppr}<w:r w:rsidDel=\"00000000\" w:rsidR=\"00000000\" w:rsidRPr=\"00000000\">{rpr_run}"
        f'<w:t xml:space="preserve">{text}</w:t></w:r></w:p></w:tc>'
    )


def two_col(left: str, right: str, left_bold: bool = False, left_italic: bool = False) -> str:
    return (
        f"<w:tbl>{tbl_pr()}<w:tr w:rsidR=\"00000000\">"
        f"{cell_para(left, bold=left_bold, italic=left_italic)}"
        f'{cell_para(right, align="right")}'
        f"</w:tr></w:tbl>"
    )


def para(text: str, italic: bool = False) -> str:
    rpr = '<w:i w:val="1"/><w:iCs w:val="1"/>' if italic else ""
    ppr = f"<w:pPr><w:rPr>{rpr}</w:rPr></w:pPr>" if rpr else "<w:pPr/>"
    rpr_run = f"<w:rPr>{rpr}<w:rtl w:val=\"0\"/></w:rPr>" if rpr else '<w:rPr><w:rtl w:val="0"/></w:rPr>'
    return (
        f'<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" w:rsidRDefault="00000000" w:rsidRPr="00000000">'
        f"{ppr}<w:r w:rsidDel=\"00000000\" w:rsidR=\"00000000\" w:rsidRPr=\"00000000\">{rpr_run}"
        f'<w:t xml:space="preserve">{text}</w:t></w:r></w:p>'
    )


def loop_block(open_tag: str, close_tag: str, inner: str) -> str:
    return para(open_tag) + inner + para(close_tag)


def main() -> None:
    shutil.copy(SOURCE, TARGET)

    with zipfile.ZipFile(TARGET, "r") as zin:
        xml = normalize_xml(zin.read("word/document.xml").decode("utf-8"))
        other = {name: zin.read(name) for name in zin.namelist() if name != "word/document.xml"}

    root = ET.fromstring(xml)
    body = root.find(w("body"))
    if body is None:
        raise RuntimeError("document body missing")

    children = list(body)

    education = loop_block(
        "[#educations]",
        "[/educations]",
        two_col("[HS_NAME]", "[HS_CITY_STATE]", left_bold=True)
        + two_col(
            "Expected Graduation: [GRAD_MONTH_YEAR]",
            "GPA: [GPA] / 4.0  ·  Rank: [RANK_NUM] / [RANK_DEN]",
            left_italic=True,
        )
        + para("▪    [SAT_LINE]")
        + para("▪    AP Courses: [AP_COURSES_LINE]")
        + para("▪    Relevant Coursework: [COURSEWORK_LINE]"),
    )

    honors = loop_block(
        "[#honors]",
        "[/honors]",
        two_col("[AWARD_NAME]", "[AWARD_YEAR]", left_bold=True)
        + para("[AWARD_ISSUER]", italic=True)
        + para("[AWARD_DESC]"),
    )

    activities = loop_block(
        "[#activities]",
        "[/activities]",
        two_col("[ACTIVITY_ORG]", "[ACTIVITY_DATES]", left_bold=True)
        + two_col("[ACTIVITY_ROLE]", "[ACTIVITY_HOURS]", left_italic=True)
        + para("[ACTIVITY_BULLET_1]")
        + para("[ACTIVITY_BULLET_2]"),
    )

    works = loop_block(
        "[#works]",
        "[/works]",
        two_col("[WORK_COMPANY]", "[WORK_LOCATION]", left_bold=True)
        + two_col("[WORK_TITLE]", "[WORK_DATES]", left_italic=True)
        + para("[WORK_BULLET_1]")
        + para("[WORK_BULLET_2]"),
    )

    projects = loop_block(
        "[#projects]",
        "[/projects]",
        two_col("[PROJECT_TITLE]", "[PROJECT_YEAR]", left_bold=True)
        + para("[PROJECT_SUPERVISOR]", italic=True)
        + para("[PROJECT_BULLET_1]")
        + para("[PROJECT_BULLET_2]"),
    )

    def find_para_index(substr: str) -> int:
        for i, child in enumerate(body):
            if child.tag != w("p"):
                continue
            text = "".join(t.text or "" for t in child.iter(w("t")))
            if substr in text:
                return i
        raise RuntimeError(f"paragraph not found: {substr}")

    def find_hr_after(title: str) -> int:
        title_idx = find_para_index(title)
        return title_idx + 1

    def replace_section(title: str, next_title: str | None, fragment: str) -> None:
        start = find_hr_after(title) + 1
        if next_title:
            end = find_para_index(next_title) - 2  # skip blank + hr before next section
        else:
            end = find_para_index("SKILLS & INTERESTS") - 2
        for _ in range(end - start + 1):
            body.remove(list(body)[start])
        insert_at = start
        for el in parse_fragment(fragment):
            body.insert(insert_at, el)
            insert_at += 1

    # Header
    set_para_text(list(body)[find_para_index("[YOUR FULL NAME]")], "[FULL_NAME]")
    set_para_text(list(body)[find_para_index("[City, State]")], "[CONTACT_LINE]")

    replace_section("EDUCATION", "HONORS & AWARDS", education)
    replace_section("HONORS & AWARDS", "EXTRACURRICULAR ACTIVITIES", honors)
    replace_section("EXTRACURRICULAR ACTIVITIES", "WORK EXPERIENCE & INTERNSHIPS", activities)
    replace_section("WORK EXPERIENCE & INTERNSHIPS", "RESEARCH & PROJECTS", works)
    replace_section("RESEARCH & PROJECTS", None, projects)

    # Skills placeholders (re-find after mutations)
    set_para_text(list(body)[find_para_index("Technical Skills:")], "Technical Skills: [SKILLS_TECHNICAL]")
    set_para_text(list(body)[find_para_index("Languages:")], "Languages: [SKILLS_LANGUAGES]")
    set_para_text(list(body)[find_para_index("Interests:")], "Interests: [SKILLS_INTERESTS]")

    apply_section_rules(body)

    out_xml = ET.tostring(root, encoding="unicode")
    out_xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + out_xml

    with zipfile.ZipFile(TARGET, "w", zipfile.ZIP_DEFLATED) as zout:
        zout.writestr("word/document.xml", out_xml.encode("utf-8"))
        for name, data in other.items():
            zout.writestr(name, data)

    print(f"Rebuilt {TARGET}")


if __name__ == "__main__":
    main()
