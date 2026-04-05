#!/usr/bin/env python3
"""Generate Logistics Report PDF from JSON data piped via stdin.
   Mirrors the Routing page layout:
     - Summary stat cards (Total, Routed, Shipped, Not Routed, Past Due)
     - Warehouse breakdown cards
     - Past Due table
     - All Orders table with columns: PO, Ticket, Store, Start, Cancel, WH, Routing, Status

   Data format expected (from larry-report.js generateReport()):
     {
       generated_at, date_range: {start, end},
       stats: {total, routed, shipped, not_routed, past_due},
       warehouses: { "STAR": {total, routed, shipped, not_routed}, ... },
       orders: [{po, ticket_number, store_name, start_date, cancel_date, warehouse_code, routing, routing_status, lifecycle}, ...],
       past_due_orders: [{po, ticket_number, store_name, cancel_date, warehouse_code, routing}, ...]
     }
"""
import sys
import json
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# ── Project Petal palette ──
BG       = "#FAF6F0"
SURFACE  = "#FFFFFF"
SURFACE2 = "#F3EDE5"
BORDER   = "#E0D8CE"
TEXT     = "#2A2420"
TEXT_DIM = "#6B5A4E"
TEXT_MUT = "#9A8B7E"
ACCENT   = "#3D2E24"
SUCCESS  = "#16a34a"
WARN     = "#C4873B"
DANGER   = "#B5443B"
BLUE     = "#2563eb"


def fmt_date(d):
    if not d:
        return "—"
    try:
        dt = datetime.fromisoformat(d.replace("Z", "+00:00"))
        return dt.strftime("%m/%d/%y")
    except Exception:
        return str(d)[:10] if d else "—"


def build_pdf(data, output_path):
    now = datetime.now()

    stats = data.get("stats", {})
    warehouses = data.get("warehouses", {})
    orders = data.get("orders", [])
    past_due_orders = data.get("past_due_orders", [])
    date_range = data.get("date_range", {})

    range_start = ""
    range_end = ""
    if date_range.get("start"):
        try:
            range_start = datetime.fromisoformat(date_range["start"].replace("Z", "+00:00")).strftime("%b %d").upper()
        except Exception:
            range_start = ""
    if date_range.get("end"):
        try:
            range_end = datetime.fromisoformat(date_range["end"].replace("Z", "+00:00")).strftime("%b %d").upper()
        except Exception:
            range_end = ""

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        rightMargin=0.5 * inch,
    )

    styles = getSampleStyleSheet()

    # ── Styles ──
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
    section_label_style = ParagraphStyle(
        "SectionLabel", parent=styles["Normal"],
        fontSize=9, fontName="Helvetica-Bold", textColor=HexColor(TEXT),
        spaceAfter=4, spaceBefore=8
    )
    wh_title_style = ParagraphStyle(
        "WHTitle", parent=styles["Normal"],
        fontSize=9, fontName="Helvetica-Bold", textColor=HexColor(TEXT),
        spaceAfter=2
    )
    wh_count_style = ParagraphStyle(
        "WHCount", parent=styles["Normal"],
        fontSize=7, textColor=HexColor(TEXT_MUT),
        spaceAfter=2
    )
    wh_stat_val = ParagraphStyle(
        "WHStatVal", parent=styles["Normal"],
        fontSize=12, fontName="Helvetica-Bold", alignment=TA_CENTER,
        spaceAfter=0
    )
    wh_stat_lbl = ParagraphStyle(
        "WHStatLbl", parent=styles["Normal"],
        fontSize=7, fontName="Helvetica-Bold", textColor=HexColor(TEXT_MUT),
        alignment=TA_CENTER, spaceAfter=0
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
    footer_style = ParagraphStyle(
        "Footer", parent=styles["Normal"],
        fontSize=7, textColor=HexColor(TEXT_MUT), alignment=TA_CENTER
    )

    story = []

    # ════════════════════════════════════════════
    # HEADER BAR
    # ════════════════════════════════════════════
    header_content = [
        [Paragraph("Routing", header_style)],
        [Paragraph(f"NEXT 2 WEEKS · {range_start} — {range_end}", header_sub_style)],
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
    def stat_cell(value, label, color):
        return [
            Paragraph(f'<font color="{color}">{value}</font>', stat_value_style),
            Paragraph(label.upper(), stat_label_style),
        ]

    stat_cards = [
        stat_cell(stats.get("total", 0), "Total POs", TEXT),
        stat_cell(stats.get("routed", 0), "Routed", ACCENT),
        stat_cell(stats.get("shipped", 0), "Shipped", SUCCESS),
        stat_cell(stats.get("not_routed", 0), "Not Routed", WARN),
        stat_cell(stats.get("past_due", 0), "Past Due", DANGER),
    ]

    # Build as a 2-row table (value row, label row)
    val_row = []
    lbl_row = []
    for card in stat_cards:
        val_row.append(card[0])
        lbl_row.append(card[1])

    cw = doc.width / 5
    stat_table = Table([val_row, lbl_row], colWidths=[cw] * 5)
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
    story.append(Spacer(1, 12))

    # ════════════════════════════════════════════
    # WAREHOUSE BREAKDOWN
    # ════════════════════════════════════════════
    if warehouses:
        wh_cells = []
        for wh_name, wh_data in warehouses.items():
            total = wh_data.get("total", 0)
            routed = wh_data.get("routed", 0)
            shipped = wh_data.get("shipped", 0)
            not_routed = wh_data.get("not_routed", 0)

            inner_data = [
                [Paragraph(f"<b>{wh_name}</b>", wh_title_style)],
                [Paragraph(f"{total} orders", wh_count_style)],
                [Table(
                    [
                        [
                            Paragraph(f'<font color="{SUCCESS}">{routed}</font>', wh_stat_val),
                            Paragraph(f'<font color="{SUCCESS}">{shipped}</font>', wh_stat_val),
                            Paragraph(f'<font color="{WARN}">{not_routed}</font>', wh_stat_val),
                        ],
                        [
                            Paragraph("ROUTED", wh_stat_lbl),
                            Paragraph("SHIPPED", wh_stat_lbl),
                            Paragraph("NOT ROUTED", wh_stat_lbl),
                        ],
                    ],
                    colWidths=[1.1 * inch, 1.1 * inch, 1.1 * inch],
                )],
            ]
            inner_table = Table(inner_data, colWidths=[3.4 * inch])
            inner_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), HexColor(SURFACE)),
                ("BOX", (0, 0), (-1, -1), 0.5, HexColor(BORDER)),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ]))
            wh_cells.append(inner_table)

        if len(wh_cells) == 1:
            wh_layout = Table([[wh_cells[0]]], colWidths=[doc.width])
        else:
            wh_layout = Table([wh_cells[:2]], colWidths=[doc.width / 2] * 2)
        wh_layout.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ]))
        story.append(wh_layout)
        story.append(Spacer(1, 12))

    # ════════════════════════════════════════════
    # Split orders into Not Routed vs Routed
    # ════════════════════════════════════════════
    not_routed_orders = [o for o in orders if o.get("routing_status") == "not_routed"]
    routed_orders = [o for o in orders if o.get("routing_status") in ("routed", "shipped")]

    order_col_widths = [
        0.85 * inch, 0.85 * inch, 1.55 * inch, 0.7 * inch, 0.7 * inch, 0.55 * inch, 0.95 * inch, 0.85 * inch
    ]
    order_header = [
        Paragraph("PO", th_style),
        Paragraph("TICKET", th_style),
        Paragraph("STORE", th_style),
        Paragraph("START", th_style),
        Paragraph("CANCEL", th_style),
        Paragraph("WH", th_style),
        Paragraph("ROUTING", th_style),
        Paragraph("STATUS", th_style),
    ]

    def status_badge(status):
        smap = {
            "routed": {"color": BLUE, "label": "Routed"},
            "shipped": {"color": SUCCESS, "label": "Shipped"},
            "not_routed": {"color": TEXT_MUT, "label": "Not Routed"},
        }
        s = smap.get(status, smap["not_routed"])
        return Paragraph(f'<font color="{s["color"]}"><b>{s["label"]}</b></font>', td_style)

    def order_row(o):
        return [
            Paragraph(str(o.get("po", "—")), td_style),
            Paragraph(str(o.get("ticket_number", "—")), td_style),
            Paragraph(str(o.get("store_name", "—")), td_style),
            Paragraph(fmt_date(o.get("start_date")), td_style),
            Paragraph(fmt_date(o.get("cancel_date")), td_style),
            Paragraph(str(o.get("warehouse_code", "—")), td_style),
            Paragraph(str(o.get("routing", "—") or "—"), td_style),
            status_badge(o.get("routing_status", "not_routed")),
        ]

    order_table_style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor(ACCENT)),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor(BORDER)),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, HexColor("#eeeeee")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor(BG)]),
    ])

    # ── 1. NOT ROUTED SECTION (first) ──
    story.append(Paragraph(
        f'<font color="{WARN}">NOT ROUTED ({len(not_routed_orders)})</font>',
        section_label_style
    ))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor(BORDER)))
    story.append(Spacer(1, 4))

    if not_routed_orders:
        nr_rows = [list(order_header)]
        for o in not_routed_orders:
            nr_rows.append(order_row(o))
        nr_table = Table(nr_rows, colWidths=order_col_widths, repeatRows=1)
        nr_table.setStyle(order_table_style)
        story.append(nr_table)
    else:
        empty_style = ParagraphStyle(
            "EmptyNR", parent=styles["Normal"],
            fontSize=10, textColor=HexColor(TEXT_MUT), alignment=TA_CENTER,
            spaceAfter=12, spaceBefore=8
        )
        story.append(Paragraph("No unrouted orders.", empty_style))

    story.append(Spacer(1, 14))

    # ── 2. ROUTED SECTION ──
    story.append(Paragraph(
        f'<font color="{BLUE}">ROUTED ({len(routed_orders)})</font>',
        section_label_style
    ))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor(BORDER)))
    story.append(Spacer(1, 4))

    if routed_orders:
        r_rows = [list(order_header)]
        for o in routed_orders:
            r_rows.append(order_row(o))
        r_table = Table(r_rows, colWidths=order_col_widths, repeatRows=1)
        r_table.setStyle(order_table_style)
        story.append(r_table)
    else:
        empty_style = ParagraphStyle(
            "EmptyR", parent=styles["Normal"],
            fontSize=10, textColor=HexColor(TEXT_MUT), alignment=TA_CENTER,
            spaceAfter=12, spaceBefore=8
        )
        story.append(Paragraph("No routed orders.", empty_style))

    story.append(Spacer(1, 14))

    # ── 3. PAST DUE SECTION (last) ──
    if past_due_orders:
        story.append(Paragraph(
            f'<font color="{DANGER}">PAST DUE — NOT ROUTED ({len(past_due_orders)})</font>',
            section_label_style
        ))
        story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor(BORDER)))
        story.append(Spacer(1, 4))

        pd_header = [
            Paragraph("PO", th_style),
            Paragraph("TICKET", th_style),
            Paragraph("STORE", th_style),
            Paragraph("CANCEL", th_style),
            Paragraph("WH", th_style),
        ]
        pd_rows = [pd_header]
        for o in past_due_orders:
            pd_rows.append([
                Paragraph(str(o.get("po", "—")), td_style),
                Paragraph(str(o.get("ticket_number", "—")), td_style),
                Paragraph(str(o.get("store_name", "—")), td_style),
                Paragraph(fmt_date(o.get("cancel_date")), td_style),
                Paragraph(str(o.get("warehouse_code", "—")), td_style),
            ])

        pd_table = Table(pd_rows, colWidths=[
            1.2 * inch, 1.2 * inch, 2.0 * inch, 1.0 * inch, 1.0 * inch
        ], repeatRows=1)
        pd_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor(DANGER)),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("BOX", (0, 0), (-1, -1), 0.5, HexColor(BORDER)),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, HexColor("#eeeeee")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor(BG)]),
        ]))
        story.append(pd_table)

    # ── Footer ──
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor(BORDER)))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        f"Generated by Larry · Unlimited Avenues · Project Petal · {now.strftime('%B %d, %Y at %I:%M %p')}",
        footer_style
    ))

    doc.build(story)
    return output_path


if __name__ == "__main__":
    raw = sys.stdin.read()
    data = json.loads(raw)
    output = sys.argv[1] if len(sys.argv) > 1 else "larry-report.pdf"
    path = build_pdf(data, output)
    print(f"PDF saved to: {path}")
