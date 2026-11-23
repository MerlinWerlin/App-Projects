"""Wattle App Store screenshots: a bold caption over each real simulator capture.

python compose.py --raw <captures dir> --out <dir> [--font-bold path] [--font path]

Reads shots.json next to this file. Output: 1320 x 2868 (6.9-inch iPhone) RGB JPEG. Wattle-gold board, black
caption, the active/neutral/earth stripe, and the capture in a plain rounded phone shape (no device maker's art).
"""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
W, H = 1320, 2868
GOLD = (255, 194, 26)
INK = (21, 18, 10)
INK2 = (74, 60, 20)
STRIPE = [((142, 78, 34), 1), ((31, 99, 204), 1), ((35, 145, 63), 1), ((245, 208, 0), 0.33)]


def wrap(d, text, f, max_w):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=f) <= max_w:
            cur = t
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def rounded(im, r):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.size[0] - 1, im.size[1] - 1), r, fill=255)
    out = im.convert('RGBA')
    out.putalpha(m)
    return out


def compose(shot, raw_dir, out_dir, bold, reg):
    img = Image.new('RGB', (W, H), GOLD)
    d = ImageDraw.Draw(img)
    # stripe
    x, y0, total = 110, 150, sum(w for _, w in STRIPE)
    for col, w in STRIPE:
        seg = round(300 * w / total)
        d.rectangle((x, y0, x + seg, y0 + 22), fill=col)
        x += seg
    head = ImageFont.truetype(bold, shot.get('titleSize', 112))
    sub = ImageFont.truetype(reg, 50)
    y = 210
    for line in wrap(d, shot['title'], head, 1100):
        d.text((110, y), line, font=head, fill=INK)
        y += round(head.size * 1.1)
    if shot.get('sub'):
        y += 20
        for line in wrap(d, shot['sub'], sub, 1100):
            d.text((110, y), line, font=sub, fill=INK2)
            y += 68
    raw = Image.open(raw_dir / f"{shot['raw']}.png").convert('RGB')
    top = max(y + 70, 760)
    ph = H - top + 260  # phone runs off the bottom edge
    pw = round(ph * raw.width / raw.height)
    if pw > 1120:
        pw = 1120
        ph = round(pw * raw.height / raw.width)
    screen = raw.resize((pw, ph), Image.LANCZOS)
    bezel = 26
    phone = Image.new('RGB', (pw + 2 * bezel, ph + 2 * bezel), INK)
    phone = rounded(phone, 120)
    px = (W - phone.width) // 2
    img.paste(phone, (px, top), phone)
    s = rounded(screen, 96)
    img.paste(s, (px + bezel, top + bezel), s)
    out = out_dir / f"{shot['n']:02d}-{shot['slug']}.jpg"
    img.save(out, 'JPEG', quality=93, subsampling=0)
    print('wrote', out)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--font-bold', default='C:/Windows/Fonts/seguibl.ttf')
    ap.add_argument('--font', default='C:/Windows/Fonts/segoeui.ttf')
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for shot in json.loads((HERE / 'shots.json').read_text(encoding='utf8'))['shots']:
        compose(shot, Path(a.raw), out, a.font_bold, a.font)
