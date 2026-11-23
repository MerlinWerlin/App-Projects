"""Liquidline App Store screenshots: a bold caption over each real simulator capture.

python3 compose.py --raw <captures dir> --out <dir> [--mode light]

Every shot is 1320 x 2868 (6.9-inch iPhone), RGB JPEG. Background: graphite with the manifold's blue (low side) and
red (high side) as two soft bands, the app's own colours; captions in Barlow Condensed (SIL OFL, bundled by the app).
"""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
APP = HERE.parent.parent
W, H = 1320, 2868
BG_TOP, BG_BOTTOM = (28, 34, 43), (11, 13, 16)
BLUE, RED = (91, 155, 255), (255, 107, 94)
INK, MUTED = (242, 243, 245), (181, 187, 196)


def font(name, size):
    for c in (APP / 'node_modules' / '@expo-google-fonts').glob(f'**/{name}'):
        return ImageFont.truetype(str(c), size)
    raise SystemExit(f'font {name} not found (npm ci first)')


def background(accent):
    img = Image.new('RGB', (W, H), BG_BOTTOM)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(round(BG_TOP[i] * (1 - t) + BG_BOTTOM[i] * t) for i in range(3)))
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    a, b = (BLUE, RED) if accent == 'low' else (RED, BLUE)
    g.ellipse((-500, 1500, 900, 3300), fill=a + (70,))
    g.ellipse((700, 1900, 1900, 3400), fill=b + (55,))
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    img.paste(glow, (0, 0), glow)
    return img


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


def compose(shot, raw, out):
    img = background(shot.get('accent', 'low'))
    d = ImageDraw.Draw(img)
    head = font('BarlowCondensed_800ExtraBold.ttf', 136)
    sub = font('BarlowCondensed_600SemiBold.ttf', 62)
    y = 170
    tag = shot.get('tag')
    if tag:
        tf = font('BarlowCondensed_700Bold.ttf', 50)
        tw = d.textlength(tag.upper(), font=tf)
        col = BLUE if shot.get('accent', 'low') == 'low' else RED
        d.rounded_rectangle(((W - tw) / 2 - 30, y, (W + tw) / 2 + 30, y + 78), 39, fill=col)
        d.text(((W - tw) / 2, y + 10), tag.upper(), font=tf, fill=(11, 13, 16))
        y += 120
    for line in wrap(d, shot['title'], head, 1180):
        w = d.textlength(line, font=head)
        d.text(((W - w) / 2, y), line, font=head, fill=INK)
        y += 140
    if shot.get('sub'):
        y += 10
        for line in wrap(d, shot['sub'], sub, 1120):
            w = d.textlength(line, font=sub)
            d.text(((W - w) / 2, y), line, font=sub, fill=MUTED)
            y += 74
    y += 50
    cap = Image.open(raw).convert('RGB')
    pw = 1060
    ph = round(cap.height * pw / cap.width)
    cap = cap.resize((pw, ph), Image.LANCZOS)
    bezel = 22
    frame = Image.new('RGB', (pw + 2 * bezel, ph + 2 * bezel), (6, 7, 9))
    frame = rounded(frame, 120)
    img.paste(frame, ((W - frame.width) // 2, y), frame)
    screen = rounded(cap, 100)
    img.paste(screen, ((W - pw) // 2, y + bezel), screen)
    img.save(out, 'JPEG', quality=93, subsampling=0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--mode', default='light')
    a = ap.parse_args()
    shots = json.loads((HERE / 'shots.json').read_text(encoding='utf-8'))
    Path(a.out).mkdir(parents=True, exist_ok=True)
    for i, s in enumerate(shots, 1):
        src = next(Path(a.raw).glob(f"{s['capture']}-{a.mode}*.png"), None)
        if not src:
            print('missing capture', s['capture'])
            continue
        compose(s, src, Path(a.out) / f"{i:02d}-{s['capture']}.jpg")
        print('composed', s['capture'])


if __name__ == '__main__':
    main()
