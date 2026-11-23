"""Builds the App Store screenshots (1290x2796, iPhone 6.9") from real simulator captures.

Usage: python store/compose.py <captures folder with 01-home.png ...> [out folder, default store/iphone]
Background: store/art/store-bg.png (generated in ChatGPT, see docs/ART.md). Captions use the app's own Barlow
Condensed font. Every capture is the real app (spigot-capture workflow), nothing is mocked up.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
FONT_DIR = os.path.join(APP, "node_modules", "@expo-google-fonts", "barlow-condensed")
W, H = 1290, 2796
VIS = (255, 204, 0)
WHITE = (255, 255, 255)
GREY = (201, 205, 211)

SHOTS = [
    ("02-offset", "OFFSETS IN ONE TAP", "Travel, run and cut length for 11¼° to 90° fittings"),
    ("07-cut", "CUT TO THE MILLIMETRE", "Take-offs from a PVC, copper and steel fitting table, or your own"),
    ("03-offset-working", "EVERY ANSWER SHOWS ITS WORKING", "Check the maths, then share it with the job"),
    ("06-fall", "FALL FOR ANY GRADE", "1:40, 1:60 or percent, with finish invert levels"),
    ("05-cutlist-plan", "LEAST WASTE FROM 6 M LENGTHS", "A cutting plan with blade width and end trim"),
    ("08-volume", "LITRES, FLOW AND PRESSURE LOSS", "Copper, PVC, PE-X and steel bores built in"),
    ("01-home", "BIG KEYS. READABLE IN THE SUN.", "Glove-sized keypad, mm or inches, no account"),
    ("11-offset-inches", "MILLIMETRES OR INCHES", "Fractions to 1/16 inch at a tap"),
]


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    for root, _dirs, files in os.walk(FONT_DIR):
        for f in files:
            if f == f"BarlowCondensed_{weight}.ttf":
                return ImageFont.truetype(os.path.join(root, f), size)
    raise SystemExit(f"Barlow Condensed {weight} not found under {FONT_DIR} (run npm install)")


def wrap(draw, text, fnt, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if draw.textlength(test, font=fnt) <= width:
            cur = test
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def compose(src, title, sub, out):
    bg = Image.open(os.path.join(HERE, "art", "store-bg.png")).convert("RGB").resize((W, H), Image.LANCZOS)
    d = ImageDraw.Draw(bg)
    ft, fs = font("800ExtraBold", 132), font("600SemiBold", 60)
    y = 210
    for line in wrap(d, title, ft, W - 200):
        d.text((W / 2, y), line, font=ft, fill=VIS, anchor="ma")
        y += 140
    y += 10
    for line in wrap(d, sub, fs, W - 220):
        d.text((W / 2, y), line, font=fs, fill=GREY, anchor="ma")
        y += 72
    shot = Image.open(src).convert("RGB")
    sw = 980
    sh = round(shot.height * sw / shot.width)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    top = max(y + 50, 640)
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, sh - 1], radius=72, fill=255)
    frame = Image.new("RGB", (sw + 24, sh + 24), (0, 0, 0))
    fmask = Image.new("L", frame.size, 0)
    ImageDraw.Draw(fmask).rounded_rectangle([0, 0, sw + 23, sh + 23], radius=84, fill=255)
    x = (W - sw) // 2
    bg.paste(frame, (x - 12, top - 12), fmask)
    bg.paste(shot, (x, top), mask)
    bg.save(out, optimize=True)


def main():
    caps = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "iphone")
    os.makedirs(out_dir, exist_ok=True)
    n = 0
    for name, title, sub in SHOTS:
        src = os.path.join(caps, name + ".png")
        if not os.path.exists(src):
            print("missing", src)
            continue
        n += 1
        compose(src, title, sub, os.path.join(out_dir, f"{n:02d}-{name[3:]}.png"))
        print("made", n, name)


if __name__ == "__main__":
    main()
