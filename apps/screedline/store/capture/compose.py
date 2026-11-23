"""Captioned App Store screenshots (1290 x 2796, 6.9-inch) from raw simulator captures.

python store/capture/compose.py --raw <dir with *.png> --out store/native/iphone
Backgrounds: store/art/store-bg-dark.jpg and store-bg-light.jpg (ChatGPT, see assets/meta.json).
"""
import argparse
import json
import pathlib

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = pathlib.Path(__file__).resolve().parent
APP = HERE.parent.parent
FONTS = APP / "node_modules" / "@expo-google-fonts"
W, H = 1290, 2796
AMBER = (255, 179, 0)


def font(rel, size):
    return ImageFont.truetype(str(FONTS / rel), size)


def rounded(img, r):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *img.size), r, fill=255)
    out = Image.new("RGBA", img.size)
    out.paste(img, (0, 0), mask)
    return out


def wrap(draw, text, f, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=f) <= width:
            cur = t
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def compose(shot, title, sub, dark, out):
    bg = Image.open(HERE.parent / "art" / ("store-bg-dark.jpg" if dark else "store-bg-light.jpg")).convert("RGB").resize((W, H))
    canvas = bg.convert("RGBA")
    d = ImageDraw.Draw(canvas)
    ink = (255, 255, 255) if dark else (21, 23, 26)
    ink2 = (201, 197, 186) if dark else (75, 79, 86)
    d.rounded_rectangle((110, 150, 230, 172), 11, fill=AMBER)
    ft = font("barlow-condensed/700Bold/BarlowCondensed_700Bold.ttf", 132)
    fs = font("atkinson-hyperlegible/400Regular/AtkinsonHyperlegible_400Regular.ttf", 50)
    y = 205
    for ln in wrap(d, title, ft, W - 220):
        d.text((110, y), ln, font=ft, fill=ink)
        y += 138
    y += 10
    for ln in wrap(d, sub, fs, W - 220):
        d.text((110, y), ln, font=fs, fill=ink2)
        y += 64
    raw = Image.open(shot).convert("RGB")
    sw = 1000
    sh = round(raw.height * sw / raw.width)
    raw = rounded(raw.resize((sw, sh), Image.LANCZOS), 70)
    top = max(y + 60, H - sh - 90)
    shadow = Image.new("RGBA", (sw + 120, sh + 120), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((60, 60, sw + 60, sh + 60), 70, fill=(0, 0, 0, 150 if dark else 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    x = (W - sw) // 2
    canvas.alpha_composite(shadow, (x - 60, top - 40))
    frame = Image.new("RGBA", (sw + 24, sh + 24), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle((0, 0, sw + 23, sh + 23), 80, fill=(21, 23, 26, 255) if not dark else (60, 62, 66, 255))
    canvas.alpha_composite(frame, (x - 12, top - 12))
    canvas.alpha_composite(raw, (x, top))
    canvas.convert("RGB").save(out, quality=95)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    spec = json.loads((HERE / "shots.json").read_text(encoding="utf-8"))
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for i, s in enumerate(spec, 1):
        src = pathlib.Path(a.raw) / s["raw"]
        if not src.exists():
            print("missing", src)
            continue
        dst = out / f"{i:02d}-{s['name']}.png"
        compose(src, s["title"], s["sub"], s.get("dark", False), dst)
        print("wrote", dst)
