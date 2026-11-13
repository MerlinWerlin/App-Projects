"""Make 2:3 (1000x1500) Pinterest pins for the 5 woodworking plans from the approved Etsy listing photos."""
import os
from PIL import Image, ImageDraw, ImageFont

SRC = r"C:/Users/jared/Desktop/Woodworking project plans/woodworking-plans/etsy-upload"
OUT = os.path.dirname(os.path.abspath(__file__))
F = "C:/Windows/Fonts/"
serif = lambda s: ImageFont.truetype(F + "georgiab.ttf", s)
sans = lambda s: ImageFont.truetype(F + "segoeuib.ttf", s)
sansr = lambda s: ImageFont.truetype(F + "segoeui.ttf", s)
BG, INK, MUTED = (243, 238, 230), (40, 33, 27), (110, 98, 86)

PINS = [
 ("WW-P01", "four-board-bench", "00-main-square.jpg", "Four-Board Bench", "Build it in an afternoon from four boards"),
 ("WW-P02", "plant-ladder", "00-main-square.jpg", "A-Frame Plant Ladder", "Three tiers from eight standard boards"),
 ("WW-P03", "waterfall-stack-table", "00-main-square.jpg", "Waterfall Coffee Table", "Chunky two-tone 2x4 table, no screws on show"),
 ("WW-P04", "planter-bench", "00-main-square.jpg", "Planter Bench", "Two planter boxes and a seat, every screw hidden"),
 ("WW-P05", "garden-bar", "00-main-square.jpg", "Garden Bar & Potting Bench", "From 10 boards, every screw hidden"),
 ("WW-P06", "four-board-bench", "phone/07-stain-options.png", "Four-Board Bench", "One plan, four finishes"),
 ("WW-P07", "plant-ladder", "phone/07-finish-options.png", "A-Frame Plant Ladder", "Pick your finish"),
 ("WW-P08", "arbour-bench", "00-main-square.jpg", "Garden Arbour Bench", "A shady seat with a rafter top for climbing roses"),
 ("WW-P09", "flip-bin-record-stand", "00-main-square.jpg", "Flip-Bin Record Stand", "Browse your vinyl like a record shop"),
 ("WW-P10", "leaning-bookcase", "00-main-square.jpg", "Leaning Bookcase", "Four stepped shelves from ten standard boards"),
 ("WW-P11", "v-cradle-record-rack", "00-main-square.jpg", "V-Cradle Record Rack", "About 62 records from one sheet of plywood"),
 ("WW-P12", "cross-panel-side-table", "00-main-square.jpg", "X-Panel Side Table", "A modern side table from half a sheet of plywood"),
 ("WW-P13", "floating-king-bed", "00-main-square.jpg", "Floating King Bed", "A timber deck that seems to hover, no screws on show"),
 ("WW-P14", "tilted-record-cubby", "00-main-square.jpg", "Tilted Record Cubby", "A plywood LP box that leans back on X legs"),
 ("WW-P15", "cat-nook-side-table", "00-main-square.jpg", "Cat Nook Side Table", "A bedside table with a cushioned cat nook inside"),
 ("WW-P16", "log-store", "00-main-square.jpg", "Firewood Log Store", "Keeps a winter of firewood dry, with a kindling shelf"),
 ("WW-P17", "x-leg-record-table", "00-main-square.jpg", "X-Leg Record Table", "A turntable table with a box for about 100 LPs"),
 ("WW-P18", "zigzag-record-tower", "00-main-square.jpg", "Zigzag Record Tower", "Three diamond bays for about 135 records"),
 ("WW-P19", "record-console", "00-main-square.jpg", "Record Console", "Three bays for about 120 records, square cuts only"),
 ("WW-P20", "king-bed-slat-headboard", "00-main-square.jpg", "King Bed with Slat Headboard", "Solid wood, glued like furniture, no screws on show"),
]

def centred(d, y, text, font, fill, maxw=900):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= maxw: cur = t
        else: lines.append(cur); cur = w
    lines.append(cur)
    for ln in lines:
        w = d.textlength(ln, font=font)
        d.text(((1000 - w) / 2, y), ln, font=font, fill=fill)
        y += font.size * 1.18
    return y

import sys
ONLY = set(sys.argv[1:])  # optional: render only these ids
for pid, slug, rel, title, sub in PINS:
    if ONLY and pid not in ONLY:
        continue
    im = Image.open(f"{SRC}/{slug}/2-listing-photos/{rel}").convert("RGB")
    pin = Image.new("RGB", (1000, 1500), BG)
    d = ImageDraw.Draw(pin)
    y = 64
    y = centred(d, y, "WOODWORKING PLAN  ·  PDF", sans(28), MUTED)
    y = centred(d, y + 14, title, serif(76 if len(title) < 22 else 64), INK)
    y = centred(d, y + 8, sub, sansr(36), MUTED)
    top = int(y + 36)
    area_h = 1500 - top - 110
    ph = im.copy()
    ph.thumbnail((1000, area_h), Image.LANCZOS)
    if ph.width < 1000 and ph.height < area_h:  # never upscale much
        pass
    x = (1000 - ph.width) // 2
    pin.paste(ph, (x, top))
    centred(d, 1500 - 82, "US · AU · UK · EU · DE editions  ·  Fern & Fable", sans(30), INK)
    pin.save(f"{OUT}/{pid}.jpg", quality=88)
    print(pid, ph.size, top)
