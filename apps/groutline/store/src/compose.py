"""Compose App Store screenshots (1320 x 2868, RGB JPEG) from real captures (store/src/capture.mjs).

Each frame: charcoal ground, a two-line headline (orange accent word), and the real app screen in a rounded,
generic phone-style frame (no maker marks). Original artwork only.

  python store/src/compose.py <raw-dir> <out-dir>
"""
import sys, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAW, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
W, H = 1320, 2868
INK, ORANGE, PAPER = (21, 23, 26), (255, 106, 26), (244, 241, 234)

def font(names, size):
    for n in names:
        p = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts', n)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size)

HEAD = font(['seguibl.ttf', 'ariblk.ttf', 'arialbd.ttf'], 118)
SUB = font(['segoeuib.ttf', 'arialbd.ttf'], 54)

SHOTS = [
    ('01-tiles', ['Tiles and', 'cartons, sorted'], 1, 'Cut-outs, waste by layout, cartons to buy'),
    ('02-setout', ['No more', 'thin cuts'], 1, 'Centre the grid and see every cut'),
    ('03-falls', ['Falls to', 'the waste'], 0, 'Perimeter heights checked against code'),
    ('05-grout', ['Grout by', 'the bag'], 1, 'From tile size, joint and depth'),
    ('04-membrane', ['Waterproofing', 'take-off'], 0, 'Floor, shower walls, upturn and tape'),
    ('06-stairs', ['Stairs without', 'surprises'], 1, 'Tiles, nosings and the riser check'),
    ('07-home', ['Six tools.', 'One payment.'], 1, 'Free 7-day trial. No subscription.'),
]

def gradient():
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip((38, 41, 46), (16, 18, 21))))
    return im

for i, (name, lines, accent, sub) in enumerate(SHOTS, 1):
    im = gradient()
    d = ImageDraw.Draw(im)
    y = 150
    for j, line in enumerate(lines):
        d.text((96, y), line, font=HEAD, fill=ORANGE if j == accent else PAPER)
        y += 138
    d.text((100, y + 26), sub, font=SUB, fill=(196, 192, 184))
    # phone frame
    shot = Image.open(os.path.join(RAW, f'raw-{name}.png')).convert('RGB')
    fw = 1060
    fh = int(fw * shot.height / shot.width)
    top = 760
    shot = shot.resize((fw, fh), Image.LANCZOS)
    pad = 26
    frame = Image.new('RGBA', (fw + pad * 2, fh + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle([0, 0, fw + pad * 2 - 1, fh + pad * 2 - 1], radius=150, fill=(8, 9, 10, 255))
    mask = Image.new('L', (fw, fh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, fw - 1, fh - 1], radius=126, fill=255)
    frame.paste(shot, (pad, pad), mask)
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    x0 = (W - frame.width) // 2
    ImageDraw.Draw(shadow).rounded_rectangle([x0, top + 30, x0 + frame.width, top + 30 + frame.height], radius=150, fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(40))
    base = Image.alpha_composite(im.convert('RGBA'), shadow)
    base.alpha_composite(frame, (x0, top))
    # orange rim accent
    ImageDraw.Draw(base).rounded_rectangle([x0 - 4, top - 4, x0 + frame.width + 3, top + frame.height + 3], radius=154, outline=(255, 106, 26, 255), width=5)
    base.convert('RGB').save(os.path.join(OUT, f'{i:02d}-{name[3:]}.jpg'), quality=92)
    print('wrote', i, name)
