"""A full-resolution Home Screen in one Glaze theme, for the App Store hero shot.

The simulator cannot install the icon profile or place widgets, so this draws the Home Screen from the
theme's real files: its full-size wallpaper and its Artwork 1-4 pieces (as Small Glaze widgets), with icons
in the theme's icon style as the app draws it (Feather glyphs on the theme's dark tile with sparkles, matched
to the in-app preview in the 40-icons-step capture). App labels are generic words; no brand logos.

python home.py --pack ../../assets/starter-packs/alpine-starlight --out home.png [--fonts DIR] [--feather Feather.ttf]
"""
import argparse
import glob
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
GLAZE = HERE.parent.parent
VI = 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons'
W, H = 1320, 2868
PT = 3  # 440 x 956 points
ICON = 64 * PT
COLS = [round(x * PT) for x in (64, 170, 270, 376)]  # icon centres
ROW0 = 78 * PT  # first row top
PITCH = 102 * PT

# Alpine Starlight's Artwork 1-4, in the order the Widgets tab lists them.
ART = ['copper-eclipse', 'jupiter-polar', 'saturn-rings', 'silver-moon']
APPS_ROW = [('camera', 'Camera'), ('image', 'Photos'), ('clock', 'Clock'), ('sun', 'Weather')]
APPS_ROW2 = [('mail', 'Mail'), ('map', 'Maps'), ('music', 'Music'), ('calendar', 'Calendar')]
APPS_SIDE = [('book-open', 'Books'), ('edit-3', 'Notes'), ('folder', 'Files'), ('settings', 'Settings')]
DOCK = [('phone', ''), ('message-circle', ''), ('compass', ''), ('headphones', '')]
TILE = (14, 16, 22)


def piece(pack, name):
    return Image.open(glob.glob(str(Path(pack) / f'widget-{name}.*.webp'))[0]).convert('RGB')


def squircle(size, r):
    m = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), r * 4, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def sparkle(d, x, y, s, a):
    c = (255, 255, 255, a)
    d.polygon([(x, y - s), (x + s * 0.22, y - s * 0.22), (x + s, y), (x + s * 0.22, y + s * 0.22),
               (x, y + s), (x - s * 0.22, y + s * 0.22), (x - s, y), (x - s * 0.22, y - s * 0.22)], fill=c)


def icon(glyph, feather, seed):
    rnd = random.Random(seed)
    t = Image.new('RGBA', (ICON, ICON), TILE + (250,))
    d = ImageDraw.Draw(t)
    for i in range(ICON):  # soft top light, as the textured look has
        d.line([(0, i), (ICON, i)], fill=(255, 255, 255, round(14 * (1 - i / ICON))))
    for _ in range(26):
        x, y = rnd.uniform(0, ICON), rnd.uniform(0, ICON)
        r = rnd.choice([1.2, 1.6, 2.2])
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, rnd.randint(60, 170)))
    for _ in range(2):
        sparkle(d, rnd.uniform(ICON * 0.62, ICON * 0.86), rnd.uniform(ICON * 0.12, ICON * 0.88), rnd.uniform(9, 13), 230)
    f = ImageFont.truetype(feather, round(ICON * 0.46))
    ch = chr(GLYPHS[glyph])
    box = d.textbbox((0, 0), ch, font=f)
    d.text(((ICON - (box[2] - box[0])) / 2 - box[0], (ICON - (box[3] - box[1])) / 2 - box[1]), ch, font=f, fill=(255, 255, 255, 255))
    out = Image.new('RGBA', (ICON, ICON), (0, 0, 0, 0))
    out.paste(t, (0, 0), squircle(ICON, round(ICON * 0.225)))
    return out


def label(img, text, cx, y, font):
    if not text:
        return
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    w = d.textlength(text, font=font)
    d.text((cx - w / 2, y), text, font=font, fill=(0, 0, 0, 150))
    layer = layer.filter(ImageFilter.GaussianBlur(4))
    ImageDraw.Draw(layer).text((cx - w / 2, y), text, font=font, fill=(255, 255, 255, 255))
    img.alpha_composite(layer)


def widget(img, art, x, y, size):
    a = art.resize((size, size), Image.LANCZOS).convert('RGBA')
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((x, y + 10, x + size, y + size + 10), round(size * 0.13), fill=(0, 0, 0, 110))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18)))
    img.paste(a, (x, y), squircle(size, round(size * 0.13)))


def status_bar(img, font):
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((W / 2 - 63 * PT, 11 * PT, W / 2 + 63 * PT, 48 * PT), 19 * PT, fill=(0, 0, 0, 255))
    d.text((58 * PT, 17 * PT), '9:41', font=font, fill='white')
    x0, base = 330 * PT, 35 * PT
    for i, hgt in enumerate((4, 6.5, 9, 11.5)):  # signal bars
        d.rounded_rectangle((x0 + i * 5.2 * PT, base - hgt * PT, x0 + i * 5.2 * PT + 3.4 * PT, base), 2, fill='white')
    cx, cy = 362 * PT, base - 1 * PT  # wifi
    for r, wdt in ((10, 2.2), (6.5, 2.2)):
        d.arc((cx - r * PT, cy - r * PT, cx + r * PT, cy + r * PT), 225, 315, fill='white', width=round(wdt * PT))
    d.ellipse((cx - 1.8 * PT, cy - 3.6 * PT, cx + 1.8 * PT, cy), fill='white')
    bx = 378 * PT  # battery
    d.rounded_rectangle((bx, 24 * PT, bx + 25 * PT, 36 * PT), 4 * PT, outline=(255, 255, 255, 140), width=3)
    d.rounded_rectangle((bx + 2 * PT, 26 * PT, bx + 23 * PT, 34 * PT), 2 * PT, fill='white')
    d.rounded_rectangle((bx + 26 * PT, 28 * PT, bx + 27.5 * PT, 32 * PT), 2, fill=(255, 255, 255, 140))


def build(pack, fonts, feather):
    wall = glob.glob(str(Path(pack) / 'wallpaper-*.webp'))[0]
    img = Image.open(wall).convert('RGB')
    scale = max(W / img.size[0], H / img.size[1])
    img = img.resize((round(img.size[0] * scale), round(img.size[1] * scale)), Image.LANCZOS)
    img = img.crop(((img.size[0] - W) // 2, (img.size[1] - H) // 2, (img.size[0] - W) // 2 + W, (img.size[1] - H) // 2 + H)).convert('RGBA')
    lab = ImageFont.truetype(str(Path(fonts) / 'Inter-Medium.ttf'), 12 * PT)
    status_bar(img, ImageFont.truetype(str(Path(fonts) / 'Inter-SemiBold.ttf'), 17 * PT))
    arts = [piece(pack, n) for n in ART]
    wsize = COLS[1] - COLS[0] + ICON  # a Small widget spans two icon columns
    left = COLS[0] - ICON // 2
    right = COLS[2] - ICON // 2
    seed = 0

    def row(apps, top):
        nonlocal seed
        for (g, name), cx in zip(apps, COLS):
            img.alpha_composite(icon(g, feather, seed), (cx - ICON // 2, top))
            label(img, name, cx, top + ICON + 5 * PT, lab)
            seed += 1

    # Rows 1-2: Artwork 1 and Artwork 2.
    widget(img, arts[0], left, ROW0, wsize)
    widget(img, arts[1], right, ROW0, wsize)
    row(APPS_ROW, ROW0 + 2 * PITCH)
    row(APPS_ROW2, ROW0 + 3 * PITCH)
    # Rows 5-6: Artwork 3 on the left, four apps on the right; Artwork 4 under them would crowd the dock.
    top = ROW0 + 4 * PITCH
    widget(img, arts[2], left, top, wsize)
    for i, (g, name) in enumerate(APPS_SIDE):
        cx, t = COLS[2 + i % 2], top + (i // 2) * PITCH
        img.alpha_composite(icon(g, feather, seed), (cx - ICON // 2, t))
        label(img, name, cx, t + ICON + 5 * PT, lab)
        seed += 1
    # Search pill and dock.
    d = ImageDraw.Draw(img)
    pill = Image.new('RGBA', img.size, (0, 0, 0, 0))
    pd = ImageDraw.Draw(pill)
    py = 806 * PT
    pd.rounded_rectangle((W / 2 - 42 * PT, py, W / 2 + 42 * PT, py + 30 * PT), 15 * PT, fill=(255, 255, 255, 60))
    dock_top = 852 * PT
    pd.rounded_rectangle((12 * PT, dock_top, W - 12 * PT, dock_top + 92 * PT), 38 * PT, fill=(255, 255, 255, 48))
    img.alpha_composite(pill)
    f = ImageFont.truetype(feather, 12 * PT)
    d.text((W / 2 - 30 * PT, py + 8 * PT), chr(GLYPHS['search']), font=f, fill='white')
    d.text((W / 2 - 14 * PT, py + 5.5 * PT), 'Search', font=ImageFont.truetype(str(Path(fonts) / 'Inter-SemiBold.ttf'), 13.5 * PT), fill='white')
    for (g, _), cx in zip(DOCK, COLS):
        img.alpha_composite(icon(g, feather, seed), (cx - ICON // 2, dock_top + 14 * PT))
        seed += 1
    return img.convert('RGB')


GLYPHS = {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pack', default=str(GLAZE / 'assets/starter-packs/alpine-starlight'))
    ap.add_argument('--out', required=True)
    ap.add_argument('--fonts')
    ap.add_argument('--vector-icons', default=str(GLAZE / VI))
    a = ap.parse_args()
    GLYPHS.update(json.loads((Path(a.vector_icons) / 'glyphmaps/Feather.json').read_text()))
    from compose import fonts_dir
    img = build(a.pack, str(fonts_dir(a.fonts)), str(Path(a.vector_icons) / 'Fonts/Feather.ttf'))
    img.save(a.out)
    print(a.out, img.size)


if __name__ == '__main__':
    main()
