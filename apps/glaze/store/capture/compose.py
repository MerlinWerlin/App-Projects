"""Glaze App Store screenshots: a caption over each real simulator capture.

python compose.py --raw <captures dir> --out <dir> [--fonts <dir with Inter TTFs>] [--only 1,3]

Reads shots.json next to this file. Every shot is 1320 x 2868 (6.9-inch iPhone), flattened RGB PNG.
The phone is a plain rounded rectangle (no Apple device art). Fonts: Inter / Inter Display (SIL OFL);
pass --fonts, or the script looks in ./fonts and downloads Inter 4.1 from its GitHub release if needed.
"""
import argparse
import io
import json
import os
import sys
import urllib.request
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
W, H = 1320, 2868
INK = (36, 27, 47)
MUTED = (104, 92, 120)
BEZEL = (28, 25, 36)
INTER_ZIP = 'https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip'
FONT_FILES = ['InterDisplay-Bold.ttf', 'InterDisplay-SemiBold.ttf', 'Inter-Medium.ttf', 'Inter-SemiBold.ttf']


def fonts_dir(arg):
    d = Path(arg) if arg else HERE / 'fonts'
    if all((d / f).exists() for f in FONT_FILES):
        return d
    d.mkdir(parents=True, exist_ok=True)
    data = urllib.request.urlopen(INTER_ZIP, timeout=120).read()
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for name in z.namelist():
            if Path(name).name in FONT_FILES and '/ttf/' in name:
                (d / Path(name).name).write_bytes(z.read(name))
    return d


def hexc(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def background(c1, c2, glow):
    """A soft diagonal gradient with two blurred glows, like Glaze's pastel surfaces."""
    a, b = hexc(c1), hexc(c2)
    small = Image.new('RGB', (66, 143))
    px = small.load()
    for y in range(143):
        for x in range(66):
            t = min(1.0, max(0.0, (y / 143) * 0.8 + (x / 66) * 0.2))
            px[x, y] = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
    bg = small.resize((W, H), Image.BICUBIC)
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    g = hexc(glow)
    d.ellipse((-300, -200, 900, 900), fill=g + (120,))
    d.ellipse((600, 1700, 1700, 3000), fill=g + (90,))
    layer = layer.filter(ImageFilter.GaussianBlur(220))
    bg = bg.convert('RGBA')
    bg.alpha_composite(layer)
    return bg


def wrap(draw, text, font, max_w):
    lines = []
    for para in text.split('\n'):
        words, cur = para.split(), ''
        for w in words:
            t = (cur + ' ' + w).strip()
            if draw.textlength(t, font=font) <= max_w:
                cur = t
            else:
                lines.append(cur)
                cur = w
        lines.append(cur)
    return lines


def captions(img, shot, F, top=210):
    d = ImageDraw.Draw(img)
    ink, muted = ((255, 255, 255), (214, 204, 240)) if shot.get('dark') else (INK, MUTED)
    head = ImageFont.truetype(str(F / 'InterDisplay-Bold.ttf'), shot.get('titleSize', 116))
    sub = ImageFont.truetype(str(F / 'Inter-Medium.ttf'), 50)
    y = top
    for line in wrap(d, shot['title'], head, 1140):
        w = d.textlength(line, font=head)
        d.text(((W - w) / 2, y), line, font=head, fill=ink)
        y += round(head.size * 1.1)
    if shot.get('sub'):
        y += 34
        for line in wrap(d, shot['sub'], sub, 1080):
            w = d.textlength(line, font=sub)
            d.text(((W - w) / 2, y), line, font=sub, fill=muted)
            y += 66
    return y


def rounded(im, r):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.size[0] - 1, im.size[1] - 1), r, fill=255)
    out = im.convert('RGBA')
    out.putalpha(m)
    return out


def phone(screen, width):
    """The capture in a plain dark rounded frame with a soft shadow. Returns (RGBA image, pad)."""
    bez = round(width * 0.022)
    sw = width - 2 * bez
    sh = round(screen.size[1] * sw / screen.size[0])
    scr = rounded(screen.convert('RGB').resize((sw, sh), Image.LANCZOS), round(sw * 0.125))
    fw, fh = width, sh + 2 * bez
    pad = 120
    out = Image.new('RGBA', (fw + 2 * pad, fh + 2 * pad), (0, 0, 0, 0))
    sh_layer = Image.new('RGBA', out.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh_layer).rounded_rectangle((pad, pad + 40, pad + fw, pad + fh + 40), round(fw * 0.14), fill=(40, 20, 60, 70))
    out.alpha_composite(sh_layer.filter(ImageFilter.GaussianBlur(50)))
    ImageDraw.Draw(out).rounded_rectangle((pad, pad, pad + fw, pad + fh), round(fw * 0.14), fill=BEZEL + (255,))
    out.alpha_composite(scr, (pad + bez, pad + bez))
    return out, pad


def load(raw, name):
    p = Path(raw) / name
    if not p.exists():
        p = Path(raw) / (name + '.png')
    return Image.open(p).convert('RGB')


def crop_status(img, shot):
    """Optional crop of the capture (in capture pixels) before it goes in the phone."""
    if 'crop' in shot:
        img = img.crop(tuple(shot['crop']))
    return img


def render(shot, raw, F):
    bg = background(*shot['bg'], shot.get('glow', '#FFFFFF'))
    kind = shot.get('kind', 'phone')
    if kind == 'phone':
        y = captions(bg, shot, F)
        width = shot.get('phoneWidth', 1010)
        ph, pad = phone(crop_status(load(raw, shot['raw']), shot), width)
        top = max(y + 70, shot.get('phoneTop', 0))
        bg.alpha_composite(ph, ((W - ph.size[0]) // 2, top - pad))
    elif kind == 'trio':
        y = captions(bg, shot, F)
        names = shot['raw']
        side_w, mid_w = 640, 760
        sides = [phone(load(raw, n), side_w) for n in (names[0], names[2])]
        mid = phone(load(raw, names[1]), mid_w)
        top = y + 80
        (l, lp), (r, rp) = sides
        bg.alpha_composite(l, (-70 - lp, top + 260 - lp))
        bg.alpha_composite(r, (W + 70 - side_w - rp, top + 260 - rp))
        bg.alpha_composite(mid[0], ((W - mid[0].size[0]) // 2, top - mid[1]))
    else:
        raise SystemExit(f'unknown kind {kind}')
    return bg.convert('RGB')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--fonts')
    ap.add_argument('--only')
    ap.add_argument('--pending', action='store_true', help='also render shots marked pending')
    ap.add_argument('--spec', default=str(HERE / 'shots.json'))
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text(encoding='utf8'))
    F = fonts_dir(a.fonts)
    only = {int(x) for x in a.only.split(',')} if a.only else None
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for shot in spec['shots']:
        if only and shot['n'] not in only:
            continue
        if shot.get('pending') and not a.pending:
            print(f"shot {shot['n']}: pending, skipped")
            continue
        try:
            img = render(shot, a.raw, F)
        except FileNotFoundError as e:
            print(f"shot {shot['n']}: missing capture ({e.filename})", file=sys.stderr)
            continue
        assert img.size == (W, H)
        p = out / f"{shot['n']:02d}-{shot['slug']}.png"
        img.save(p, optimize=True)
        print(p, os.path.getsize(p) // 1024, 'KB')


if __name__ == '__main__':
    main()
