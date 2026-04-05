#!/usr/bin/env python3
"""Generate ATS Inventory Report PDF from JSON data piped via stdin.
   Data format: { "ats": [{style_number, category, color, ats_units, warehouse, lot, vendor_inv, ct_number, buyer, remarks}, ...] }
"""
import sys
import json
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# ── Project Petal palette ──
BG       = "#FAF6F0"
SURFACE  = "#FFFFFF"
BORDER   = "#E0D8CE"
TEXT     = "#2A2420"
TEXT_DIM = "#6B5A4E"
TEXT_MUT = "#9A8B7E"
ACCENT   = "#3D2E24"


def build_pdf(data, output_path):
    now = datetime.now()
    ats = data.get("ats", [])
    total_units = sum(a.get("ats_units", 0) or 0 for a in ats)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        rightMargin=0.5 * inch,
    )

    styles = getSampleStyleSheet()

    header_style = ParagraphStyle(
        "HeaderTitle", parent=styles["Normal"],
        fontSize=13, fontName="Helvetica-Bold", textColor=white,
        spaceAfter=0, spaceBefore=0
    )
    header_sub_style = ParagraphStyle(
        "HeaderSub", parent=styles["Normal"],
        fontSize=8, textColor=HexColor("#FFFFFF80"),
        spaceAfter=0, spaceBefore=2
    )
    section_label_style = ParagraphStyle(
        "SectionLabel", parent=styles["Normal"],
        fontSize=9, fontName="Helvetica-Bold", textColor=HexColor(TEXT),
        spaceAfter=4, spaceBefore=8
    )
    stat_value_style = ParagraphStyle(
        "StatValue", parent=styles["Normal"],
        fontSize=16, fontName="Helvetica-Bold", alignment=TA_CENTER,
        spaceAfter=0, spaceBefore=2
    )
    stat_label_style = ParagraphStyle(
        "StatLabel", parent=styles["Normal"],
        fontSize=7, fontName="Helvetica-Bold", textColor=HexColor(TEXT_MUT),
        alignment=TA_CENTER, spaceAfter=0, spaceBefore=1
    )
    th_style = ParagraphStyle(
        "TH", parent=styles["Normal"],
        fontSize=7, fontName="Helvetica-Bold", textColor=HexColor(TEXT_MUT),
        spaceAfter=0, spaceBefore=0
    )
    td_style = ParagraphStyle(
        "TD", parent=styles["Normal"],
        fontSize=8, textColor=HexColor(TEXT),
        spaceAfter=0, spaceBefore=0
    )
    td_right_style = ParagraphStyle(
        "TDRight", parent=td_style, alignment=TA_CENTER,
    )
    footer_style = ParagraphStyle(
        "Footer", parent=styles["Normal"],
        fontSize=7, textColor=HexColor(TEXT_MUT), alignment=TA_CENTER
    )

    story = []

    # ════════════════════════════════════════════
    # HEADER BAR
    # ════════════════════════════════════════════
    header_content = [
        [Paragraph("ATS Inventory Report", header_style)],
        [Paragraph(f"Generated {now.strftime('%B %d, %Y')} · {total_units:,} total units · {len(ats)} styles", header_sub_style)],
    ]
    header_table = Table(header_content, colWidths=[doc.width])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor(ACCENT)),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 12))

    # ════════════════════════════════════════════
    # SUMMARY STAT CARDS
    # ════════════════════════════════════════════
    # Group by warehouse
    wh_counts = {}
    for a in ats:
        wh = a.get("warehouse") or "—"
        wh_counts[wh] = wh_counts.get(wh, 0) + (a.get("ats_units") or 0)

    # Build stat cards: Total Units, Total Styles, then top warehouses
    cards = [
        (f"{total_units:,}", "TOTAL UNITS", TEXT),
        (str(len(ats)), "STYLES", ACCENT),
    ]
    # Add top 3 warehouses
    sorted_wh = sorted(wh_counts.items(), key=lambda x: -x[1])
    for wh_name, wh_units in sorted_wh[:3]:
        cards.append((f"{wh_units:,}", wh_name, TEXT_DIM))

    val_row = []
    lbl_row = []
    for val, lbl, color in cards:
        val_row.append(Paragraph(f'<font color="{color}">{val}</font>', stat_value_style))
        lbl_row.append(Paragraph(lbl, stat_label_style))

    ncols = len(cards)
    cw = doc.width / ncols
    stat_table = Table([val_row, lbl_row], colWidths=[cw] * ncols)
    stat_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor(SURFACE)),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor(BORDER)),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor(BORDER)),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 6),
    ]))
    story.append(stat_table)
    story.append(Spacer(1, 14))

    # ════════════════════════════════════════════
    # ATS TABLE
    # ════════════════════════════════════════════
    story.append(Paragraph(
        f'AVAILABLE TO SELL ({len(ats)} styles)',
        section_label_style
    ))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor(BORDER)))
    story.append(Spacer(1, 4))

    if ats:
        ats_header = [
            Paragraph("STYLE #", th_style),
            Paragraph("CATEGORY", th_style),
            Paragraph("COLOR", th_style),
            Paragraph("UNITS", th_style),
            Paragraph("WAREHOUSE", th_style),
            Paragraph("LOT", th_style),
            Paragraph("VENDOR INV", th_style),
            Paragraph("CT", th_style),
        ]
        ats_rows = [ats_header]
        for a in ats:
            ats_rows.append([
                Paragraph(str(a.get("style_number", "—") or "—"), td_style),
                Paragraph(str(a.get("category", "—") or "—"), td_style),
                Paragraph(str(a.get("color", "—") or "—"), td_style),
                Paragraph(f'{(a.get("ats_units") or 0):,}', td_right_style),
                Paragraph(str(a.get("warehouse", "—") or "—"), td_style),
                Paragraph(str(a.get("lot", "—") or "—"), td_style),
                Paragraph(str(a.get("vendor_inv", "—") or "—"), td_style),
                Paragraph(str(a.get("ct_number", "—") or "—"), td_style),
            ])

        col_widths = [
            0.85 * inch, 0.8 * inch, 1.3 * inch, 0.65 * inch,
            0.75 * inch, 0.6 * inch, 0.85 * inch, 0.7 * inch
        ]
        ats_table = Table(ats_rows, colWidths=col_widths, repeatRows=1)
        ats_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor(ACCENT)),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("ALIGN", (3, 1), (3, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("BOX", (0, 0), (-1, -1), 0.5, HexColor(BORDER)),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, HexColor("#eeeeee")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor(BG)]),
        ]))
        story.append(ats_table)
    else:
        empty_style = ParagraphStyle(
            "EmptyNote", parent=styles["Normal"],
            fontSize=10, textColor=HexColor(TEXT_MUT), alignment=TA_CENTER,
            spaceAfter=12, spaceBefore=8
        )
        story.append(Paragraph("No ATS inventory data available.", empty_style))

    # ── Footer ──
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor(BORDER)))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        f"Unlimited Avenues · Project Petal · ATS Inventory Report · {now.strftime('%B %d, %Y at %I:%M %p')}",
        footer_style
    ))

    doc.build(story)
    return output_path


if __name__ == "__main__":
    raw = sys.stdin.read()
    data = json.loads(raw)
    output = sys.argv[1] if len(sys.argv) > 1 else "ats-report.pdf"
    path = build_pdf(data, output)
    print(f"PDF saved to: {path}")
