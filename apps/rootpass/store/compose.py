"""
App Store screenshots for Rootpass (APP_IPHONE_67, 1320 x 2868, RGB JPEG/PNG without alpha).

Each shot: an original dark "workshop" background (graphite with a hot-metal glow and faint layout lines, drawn here),
a two-line caption in Barlow Condensed (OFL, bundled with the app), and a real simulator capture from
.github/workflows/rootpass-capture.yml in a rounded frame.

  python store/compose.py --raw <folder of captures> --out store/iphone [--pdf <saddle template png>]
"""
import argparse
import math
import pathlib
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = pathlib.Path(__file__).resolve().parent
FONT = HERE.parent / 'node_modules/@expo-google-fonts/barlow-condensed/700Bold/BarlowCondensed_700Bold.ttf'
W, H = 1320, 2868
ORANGE = (255, 122, 26)
INK = (244, 241, 234)

SHOTS = [
    ('04-saddle-result', 'SADDLE TEMPLATES', 'Any angle, any offset'),
    ('pdf', 'PRINT TRUE SCALE', 'Wrap it round the pipe and cut'),
    ('07-lobster', 'LOBSTER-BACKS', 'Every piece, every angle'),
    ('08-cutlist', 'CUT LISTS', 'Fewest lengths, kerf counted'),
    ('10-weight', 'STEEL WEIGHT', 'Plate, tube, angle, bar'),
    ('02-home-tools', 'EIGHT WORKSHOP TOOLS', 'Big buttons. Glove friendly.'),
    ('05-saddle-working', 'SHOWS ITS WORKING', 'Check every number'),
    ('11-pcd', 'BOLT CIRCLES', 'Coordinates and drill template'),
]


def background(seed: int) -> Image.Image:
    rnd = random.Random(seed)
    img = Image.new('RGB', (W, H), (13, 15, 18))
    px = ImageDraw.Draw(img)
    # Vertical graphite gradient.
    for y in range(H):
        t = y / H
        c = int(24 - 12 * t)
        px.line([(0, y), (W, y)], fill=(c, c + 2, c + 6))
    # Faint ordinate lines like a template.
    lines = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lines)
    for k in range(9):
        x = 90 + k * (W - 180) / 8
        for y in range(0, H, 46):
            d.line([(x, y), (x, y + 24)], fill=(108, 200, 255, 26), width=4)
    img.paste(lines, (0, 0), lines)
    # Hot-metal glow behind the caption, placed a little differently on each shot.
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    cx, cy = W * (0.25 + 0.5 * rnd.random()), 330
    for r in range(520, 0, -8):
        a = int(70 * (1 - r / 520) ** 2)
        g.ellipse([cx - r * 1.6, cy - r, cx + r * 1.6, cy + r], fill=(255, 122, 26, a))
    glow = glow.filter(ImageFilter.GaussianBlur(40))
    img.paste(glow, (0, 0), glow)
    # A bead line across the top, echoing the icon.
    bead = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    b = ImageDraw.Draw(bead)
    pts = [(x, 560 + 26 * math.sin(x / W * math.pi * 2 + seed)) for x in range(-20, W + 20, 8)]
    b.line(pts, fill=(255, 122, 26, 90), width=10, joint='curve')
    img.paste(bead, (0, 0), bead)
    return img


def frame(shot: Image.Image, width: int) -> Image.Image:
    shot = shot.convert('RGB')
    h = int(shot.height * width / shot.width)
    shot = shot.resize((width, h), Image.LANCZOS)
    radius = 70
    mask = Image.new('L', (width, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, width, h], radius=radius, fill=255)
    border = 10
    out = Image.new('RGBA', (width + 2 * border, h + 2 * border), (0, 0, 0, 0))
    ImageDraw.Draw(out).rounded_rectangle([0, 0, out.width - 1, out.height - 1], radius=radius + border, fill=(48, 53, 62, 255))
    out.paste(shot, (border, border), mask)
    return out


def compose(raw: pathlib.Path, out: pathlib.Path, pdf: pathlib.Path | None):
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob('*.png'):
        old.unlink()
    big = ImageFont.truetype(str(FONT), 150)
    small = ImageFont.truetype(str(FONT), 82)
    n = 0
    for i, (name, title, sub) in enumerate(SHOTS):
        if name == 'pdf':
            if not pdf or not pdf.exists():
                continue
            src = Image.open(pdf)
        else:
            files = sorted(raw.glob(f'{name}*.png'))
            if not files:
                print('missing', name)
                continue
            src = Image.open(files[0])
        img = background(i)
        d = ImageDraw.Draw(img)
        d.text((W / 2, 250), title, font=big, fill=INK, anchor='mm')
        d.text((W / 2, 400), sub, font=small, fill=ORANGE, anchor='mm')
        if name == 'pdf':
            # A printed sheet on the bench: white paper with a soft shadow, slightly turned.
            sheet = src.convert('RGB')
            sw = 1180
            sheet = sheet.resize((sw, int(sheet.height * sw / sheet.width)), Image.LANCZOS)
            shadow = Image.new('RGBA', (sheet.width + 80, sheet.height + 80), (0, 0, 0, 0))
            ImageDraw.Draw(shadow).rectangle([40, 40, sheet.width + 40, sheet.height + 40], fill=(0, 0, 0, 160))
            shadow = shadow.filter(ImageFilter.GaussianBlur(24))
            layer = Image.new('RGBA', shadow.size, (0, 0, 0, 0))
            layer.paste(shadow, (12, 22))
            layer.paste(sheet, (40, 40))
            layer = layer.rotate(-4, expand=True, resample=Image.BICUBIC)
            img.paste(layer, ((W - layer.width) // 2, 720), layer)
            d.text((W / 2, 2700), 'Every sheet carries a 100 mm check ruler', font=ImageFont.truetype(str(FONT), 64), fill=(195, 199, 206), anchor='mm')
        else:
            f = frame(src, 1060)
            img.paste(f, ((W - f.width) // 2, 540), f)
        n += 1
        img.convert('RGB').save(out / f'{n:02d}-{name}.png', optimize=True)
        print('wrote', out / f'{n:02d}-{name}.png')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--pdf')
    a = ap.parse_args()
    compose(pathlib.Path(a.raw), pathlib.Path(a.out), pathlib.Path(a.pdf) if a.pdf else None)
