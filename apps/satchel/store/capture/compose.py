"""Satchel App Store screenshots: a caption over each real simulator capture.

python3 compose.py --raw <captures dir> --out <dir> [--fonts <dir>] [--only 1,3]

Reads shots.json next to this file. Every shot is 1320 x 2868 (6.9-inch iPhone), RGB JPEG (quality 93, 4:4:4).
The phone is a plain rounded rectangle (no device maker's art). Captions use Space Grotesk Bold and Inter (SIL OFL,
the same fonts the app bundles); the script finds them in node_modules/@expo-google-fonts or --fonts.
Palette from the app: paper #F4F1EA with navy #14213D text, night #0E1320 with #EEF1F7, accent #E07A2F.
"""
import argparse
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
APP = HERE.parent.parent
W, H = 1320, 2868
LIGHT = {'bg': (244, 241, 234), 'ink': (20, 33, 61), 'muted': (92, 100, 118), 'glow': (251, 231, 214)}
DARK = {'bg': (14, 19, 32), 'ink': (238, 241, 247), 'muted': (163, 171, 189), 'glow': (42, 60, 96)}
ACCENT = (224, 122, 47)
BEZEL = (24, 28, 38)


def font(fonts, name, size):
    cands = [Path(fonts) / name] if fonts else []
    cands += list((APP / 'node_modules' / '@expo-google-fonts').glob(f'**/{name}'))
    for c in cands:
        if c.exists():
            return ImageFont.truetype(str(c), size)
    raise SystemExit(f'font {name} not found (npm ci, or pass --fonts)')


def background(pal):
    bg = Image.new('RGBA', (W, H), pal['bg'] + (255,))
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse((-380, -300, 900, 900), fill=pal['glow'] + (200,))
    d.ellipse((560, 1900, 1800, 3100), fill=pal['glow'] + (150,))
    bg.alpha_composite(layer.filter(ImageFilter.GaussianBlur(240)))
    return bg


def wrap(draw, text, f, max_w):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=f) <= max_w:
            cur = t
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    if len(lines) == 2 and len(lines[1].split()) == 1 and len(lines[0].split()) > 2:
        a = lines[0].split()
        lines = [' '.join(a[:-1]), a[-1] + ' ' + lines[1]]
    return lines


def captions(img, shot, pal, fonts):
    d = ImageDraw.Draw(img)
    head = font(fonts, 'SpaceGrotesk_700Bold.ttf', shot.get('titleSize', 112))
    sub = font(fonts, 'Inter_400Regular.ttf', 50)
    y = 200
    d.rounded_rectangle(((W - 120) // 2, y, (W + 120) // 2, y + 14), 7, fill=ACCENT)
    y += 70
    for line in wrap(d, shot['title'], head, 1160):
        w = d.textlength(line, font=head)
        d.text(((W - w) / 2, y), line, font=head, fill=pal['ink'])
        y += round(head.size * 1.08)
    if shot.get('sub'):
        y += 30
        for line in wrap(d, shot['sub'], sub, 1080):
            w = d.textlength(line, font=sub)
            d.text(((W - w) / 2, y), line, font=sub, fill=pal['muted'])
            y += 66
    return y


def rounded(im, r):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.size[0] - 1, im.size[1] - 1), r, fill=255)
    out = im.convert('RGBA')
    out.putalpha(m)
    return out


def phone(screen, width):
    bez = round(width * 0.022)
    sw = width - 2 * bez
    sh = round(screen.size[1] * sw / screen.size[0])
    scr = rounded(screen.convert('RGB').resize((sw, sh), Image.LANCZOS), round(sw * 0.125))
    fw, fh = width, sh + 2 * bez
    pad = 120
    out = Image.new('RGBA', (fw + 2 * pad, fh + 2 * pad), (0, 0, 0, 0))
    shadow = Image.new('RGBA', out.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((pad, pad + 40, pad + fw, pad + fh + 40), round(fw * 0.14), fill=(10, 20, 40, 80))
    out.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(50)))
    ImageDraw.Draw(out).rounded_rectangle((pad, pad, pad + fw, pad + fh), round(fw * 0.14), fill=BEZEL + (255,))
    out.alpha_composite(scr, (pad + bez, pad + bez))
    return out, pad


def load(raw, name):
    p = Path(raw) / name
    if not p.exists():
        p = Path(raw) / (name + '.png')
    return Image.open(p).convert('RGB')


def render(shot, raw, fonts):
    pal = DARK if shot.get('dark') else LIGHT
    bg = background(pal)
    y = captions(bg, shot, pal, fonts)
    ph, pad = phone(load(raw, shot['raw']), shot.get('phoneWidth', 1010))
    bg.alpha_composite(ph, ((W - ph.size[0]) // 2, y + 80 - pad))
    return bg.convert('RGB')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--fonts')
    ap.add_argument('--only')
    ap.add_argument('--spec', default=str(HERE / 'shots.json'))
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text(encoding='utf8'))
    only = {int(x) for x in a.only.split(',')} if a.only else None
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for shot in spec['shots']:
        if only and shot['n'] not in only:
            continue
        try:
            img = render(shot, a.raw, a.fonts)
        except FileNotFoundError as e:
            print(f"shot {shot['n']}: missing capture ({e.filename})", file=sys.stderr)
            continue
        assert img.size == (W, H)
        p = out / f"{shot['n']:02d}-{shot['slug']}.jpg"
        img.save(p, quality=93, subsampling=0, optimize=True)
        print(p, os.path.getsize(p) // 1024, 'KB')


if __name__ == '__main__':
    main()
