#!/usr/bin/env python3
"""Generate Trend Scout PDF from JSON data piped via stdin.
   Shows current trend findings with product images, preferences, and algo weights.
"""
import sys
import json
import os
import tempfile
import urllib.request
import ssl
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable, Image
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

CHOCOLATE = "#3C1A00"
SAGE = "#6B7F5E"
BLUSH = "#e06080"
BG = "#FAF6F0"
SURFACE2 = "#F3EDE5"
BORDER = "#E0D8CE"
TEXT_MUT = "#9A8B7E"

# SSL context that doesn't verify (some product image hosts have quirky certs)
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE


def download_image(url, tmp_dir):
    """Download an image URL to a temp file. Returns path or None."""
    if not url or not url.startswith("http"):
        return None
    try:
        ext = ".jpg"
        if ".png" in url.lower():
            ext = ".png"
        elif ".webp" in url.lower():
            ext = ".webp"
        fd, path = tempfile.mkstemp(suffix=ext, dir=tmp_dir)
        os.close(fd)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=3, context=_ssl_ctx) as resp:
            with open(path, "wb") as f:
                f.write(resp.read())
        # Verify file has content
        if os.path.getsize(path) < 100:
            os.unlink(path)
            return None
        return path
    except Exception as e:
        print(f"  [img] Failed to download {url[:80]}: {e}", file=sys.stderr)
        return None


def safe_image(path, width, height):
    """Create a reportlab Image, or return a placeholder Paragraph if it fails."""
    try:
        return Image(path, width=width, height=height)
    except Exception:
        placeholder_style = ParagraphStyle(
            "ImgPlaceholder", fontSize=7, textColor=HexColor(TEXT_MUT),
            alignment=TA_CENTER
        )
        return Paragraph("[no image]", placeholder_style)


def build_pdf(data, output_path):
    now = datetime.now()
    title_date = now.strftime("%m/%d/%Y")

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        rightMargin=0.5 * inch,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle", parent=styles["Title"],
        fontSize=20, textColor=HexColor(CHOCOLATE),
        spaceAfter=2, alignment=TA_CENTER, fontName="Helvetica-Bold"
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle", parent=styles["Normal"],
        fontSize=10, textColor=HexColor("#888"),
        alignment=TA_CENTER, spaceAfter=16
    )
    section_style = ParagraphStyle(
        "SectionHeader", parent=styles["Heading2"],
        fontSize=13, textColor=HexColor(CHOCOLATE),
        fontName="Helvetica-Bold", spaceAfter=8, spaceBefore=16
    )
    body_style = ParagraphStyle(
        "BodyText", parent=styles["Normal"],
        fontSize=9, textColor=HexColor("#333"),
        leading=12, spaceAfter=2
    )
    small_style = ParagraphStyle(
        "SmallText", parent=styles["Normal"],
        fontSize=7, textColor=HexColor("#999"),
        leading=10
    )
    card_title_style = ParagraphStyle(
        "CardTitle", parent=styles["Normal"],
        fontSize=9, fontName="Helvetica-Bold", textColor=HexColor("#2A2420"),
        leading=11, spaceAfter=1
    )
    card_detail_style = ParagraphStyle(
        "CardDetail", parent=styles["Normal"],
        fontSize=8, textColor=HexColor("#6B5A4E"),
        leading=10, spaceAfter=1
    )
    vote_like_style = ParagraphStyle(
        "VoteLike", parent=styles["Normal"],
        fontSize=8, fontName="Helvetica-Bold", textColor=HexColor(SAGE),
        alignment=TA_CENTER
    )
    vote_dislike_style = ParagraphStyle(
        "VoteDislike", parent=styles["Normal"],
        fontSize=8, fontName="Helvetica-Bold", textColor=HexColor(BLUSH),
        alignment=TA_CENTER
    )
    vote_none_style = ParagraphStyle(
        "VoteNone", parent=styles["Normal"],
        fontSize=8, textColor=HexColor(TEXT_MUT),
        alignment=TA_CENTER
    )

    story = []

    # ── Title ──
    story.append(Paragraph("Woodcock Trend Scout Report", title_style))
    story.append(Paragraph(f"Generated {title_date}", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=HexColor(CHOCOLATE)))
    story.append(Spacer(1, 12))

    trends = data.get("trends", [])
    weights = data.get("weights", [])
    votes = data.get("votes", {})

    # ── Summary Stats ──
    total = len(trends)
    liked = sum(1 for v in votes.values() if v == "like")
    disliked = sum(1 for v in votes.values() if v == "dislike")

    stats_data = [
        [
            Paragraph("<b>Total Finds</b>", body_style),
            Paragraph("<b>Liked</b>", body_style),
            Paragraph("<b>Disliked</b>", body_style),
            Paragraph("<b>Markets</b>", body_style),
        ],
        [
            Paragraph(str(total), body_style),
            Paragraph(str(liked), body_style),
            Paragraph(str(disliked), body_style),
            Paragraph(
                ", ".join(set(t.get("market", "—") for t in trends if t.get("market"))),
                body_style
            ),
        ],
    ]
    stats_table = Table(stats_data, colWidths=[1.5 * inch, 1.2 * inch, 1.2 * inch, 3.0 * inch])
    stats_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor(SURFACE2)),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor(BORDER)),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 16))

    # ── Trend Findings with Images ──
    story.append(Paragraph("Current Trend Findings", section_style))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor(BORDER)))
    story.append(Spacer(1, 8))

    if trends:
        # Download all images to a temp directory
        tmp_dir = tempfile.mkdtemp(prefix="trend_imgs_")
        print(f"  [img] Downloading {len(trends)} product images...", file=sys.stderr)

        image_paths = {}
        MAX_IMG_DOWNLOADS = 8  # Limit to avoid timeout
        img_count = 0
        for t in trends:
            if img_count >= MAX_IMG_DOWNLOADS:
                break
            img_url = t.get("image_url") or t.get("image") or ""
            if img_url:
                path = download_image(img_url, tmp_dir)
                if path:
                    image_paths[t.get("id", "")] = path
                img_count += 1

        print(f"  [img] Downloaded {len(image_paths)} of {len(trends)} images", file=sys.stderr)

        IMG_W = 0.65 * inch
        IMG_H = 0.65 * inch

        # Build trend cards — each row: [image, product info, vote]
        header = [
            Paragraph("<b>IMAGE</b>", small_style),
            Paragraph("<b>PRODUCT</b>", small_style),
            Paragraph("<b>BRAND</b>", small_style),
            Paragraph("<b>CATEGORY</b>", small_style),
            Paragraph("<b>MARKET</b>", small_style),
            Paragraph("<b>PRICE</b>", small_style),
            Paragraph("<b>VOTE</b>", small_style),
        ]
        rows = [header]

        for i, t in enumerate(trends, 1):
            tid = str(t.get("id", ""))
            vote_str = votes.get(tid, "—")

            if vote_str == "like":
                vote_para = Paragraph("Liked", vote_like_style)
            elif vote_str == "dislike":
                vote_para = Paragraph("Disliked", vote_dislike_style)
            else:
                vote_para = Paragraph("—", vote_none_style)

            # Image cell
            img_path = image_paths.get(t.get("id", ""))
            if img_path:
                img_cell = safe_image(img_path, IMG_W, IMG_H)
            else:
                placeholder_style = ParagraphStyle(
                    f"ph_{i}", fontSize=7, textColor=HexColor(TEXT_MUT),
                    alignment=TA_CENTER
                )
                img_cell = Paragraph("[no image]", placeholder_style)

            rows.append([
                img_cell,
                Paragraph(t.get("title", "—")[:50], card_title_style),
                Paragraph(t.get("brand", "—"), card_detail_style),
                Paragraph(t.get("category", "—"), card_detail_style),
                Paragraph(t.get("market", "—"), card_detail_style),
                Paragraph(t.get("price_range", "—"), card_detail_style),
                vote_para,
            ])

        trend_table = Table(rows, colWidths=[
            0.8 * inch, 2.0 * inch, 1.1 * inch, 0.9 * inch, 0.7 * inch, 0.7 * inch, 0.7 * inch
        ])
        trend_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor(CHOCOLATE)),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor(BORDER)),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor(BG)]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, 0), 5),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
            ("TOPPADDING", (0, 1), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(trend_table)

        # Cleanup temp images after build (handled at end)
    else:
        story.append(Paragraph("No trends found. Run the Trend Scout scan to discover new styles.", body_style))

    story.append(Spacer(1, 20))

    # ── Algorithm Preferences ──
    if weights:
        story.append(Paragraph("Algorithm Preferences", section_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor(BORDER)))
        story.append(Spacer(1, 8))
        story.append(Paragraph(
            "These weights reflect your like/dislike feedback. Positive scores mean the algorithm favors "
            "these attributes; negative scores mean it avoids them.",
            small_style
        ))
        story.append(Spacer(1, 6))

        w_header = [
            Paragraph("<b>Dimension</b>", small_style),
            Paragraph("<b>Value</b>", small_style),
            Paragraph("<b>Score</b>", small_style),
        ]
        w_rows = [w_header]
        for w in sorted(weights, key=lambda x: -x.get("score", 0)):
            score = w.get("score", 0)
            color = SAGE if score > 0 else (BLUSH if score < 0 else "#333")
            w_rows.append([
                Paragraph(w.get("dimension", "").title(), body_style),
                Paragraph(w.get("value", ""), body_style),
                Paragraph(f'<font color="{color}"><b>{score:+d}</b></font>', body_style),
            ])

        w_table = Table(w_rows, colWidths=[1.5 * inch, 3.5 * inch, 1.0 * inch])
        w_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor(CHOCOLATE)),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor(BORDER)),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor(BG)]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(w_table)

    # ── Footer ──
    story.append(Spacer(1, 30))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor(BORDER)))
    story.append(Spacer(1, 6))
    footer_style = ParagraphStyle(
        "Footer", parent=styles["Normal"],
        fontSize=8, textColor=HexColor("#aaa"), alignment=TA_CENTER
    )
    story.append(Paragraph(
        f"Unlimited Avenues — Woodcock Trend Scout — {title_date}",
        footer_style
    ))

    doc.build(story)

    # Cleanup temp images
    if trends:
        try:
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 generate-trend-scout-pdf.py <output.pdf>", file=sys.stderr)
        sys.exit(1)

    data = json.load(sys.stdin)
    build_pdf(data, sys.argv[1])
    print(f"PDF written to {sys.argv[1]}", file=sys.stderr)
