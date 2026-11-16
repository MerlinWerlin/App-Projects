"""A full-resolution Home Screen in one Glaze theme, for the App Store shots.

The simulator cannot install the icon profile or place widgets, so this draws the Home Screen from the
theme's real files: its full-size wallpaper and ONE of its artworks as a Small Glaze widget up in a top corner (Jared,
17 Nov: "one art work per page", "only the apps in the top half"), the wallpaper left clear below, with icons
in the theme's icon style as the app draws it: Feather glyphs on the theme's tile colour, with a starfield
on night themes and a fine grain on the rest (src/core/iconLook.ts), matched to the in-app previews in the
captures. App labels are generic words; no brand logos.

python home.py --out home.png                         # Alpine Starlight, from the bundled starter pack
python home.py --theme desert-afterglow --out d.png   # any catalogue theme, from the live pack host (R2)
"""
import argparse
import glob
import json
import io
import random
import urllib.request
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

# Alpine Starlight's Artwork 1-5, in the order the Widgets tab lists them.
ART = ['copper-eclipse', 'jupiter-polar', 'saturn-rings', 'silver-moon', 'spiral-galaxy']
# The one artwork each store Home Screen shows (top corner). Any other theme: its Artwork 1.
HERO = {'alpine-starlight': 'saturn-rings', 'desert-afterglow': 'crescent-moon',
        'cloud-atelier': 'balloon-skiff', 'cobalt-caravan': 'oasis-bird'}
APPS_ROW = [('camera', 'Camera'), ('image', 'Photos'), ('clock', 'Clock'), ('sun', 'Weather')]
APPS_ROW2 = [('mail', 'Mail'), ('map', 'Maps'), ('music', 'Music'), ('calendar', 'Calendar')]
APPS_SIDE = [('book-open', 'Books'), ('edit-3', 'Notes'), ('folder', 'Files'), ('settings', 'Settings')]
DOCK = [('phone', ''), ('message-circle', ''), ('compass', ''), ('headphones', '')]
TILE = (14, 16, 22)
R2 = 'https://pub-cffeea0b1da4434db6daadc18078e71c.r2.dev'  # PACK_R2_PUBLIC_URL in src/config/packs.ts


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'glaze-store-capture'})
    return urllib.request.urlopen(req, timeout=60).read()


def hexc(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def remote_theme(theme_id, art=None):
    """(wallpaper, [the one art piece], look) of a catalogue theme, from its pack manifest."""
    cat = json.loads(fetch(f'{R2}/catalog.json'))
    entry = next(p for p in cat['packs'] if p['id'] == theme_id)
    base = f"{R2}/{entry['manifest'].rsplit('/', 1)[0]}"
    man = json.loads(fetch(f"{R2}/{entry['manifest']}"))
    wall = next(a['path'] for a in man['assets'] if a['role'] == 'wallpaper' and a['height'] >= 2796)
    # Artwork 1-5 exactly as the app picks them (scripts/packs/artwork-coverage.json, the same rule as
    # src/core/artworkCoverage.ts), never simply the manifest's first art pieces (those can repeat a motif).
    cov = json.loads((GLAZE / 'scripts/packs/artwork-coverage.json').read_text(encoding='utf8'))['perTheme'][theme_id]
    art_base = f"{R2}/{cov['manifest'].rsplit('/', 1)[0]}"
    want = art or HERO.get(theme_id)
    pick = next((i for i in cov['images'] if want and i.startswith(f'widget-{want}.')), cov['images'][0])
    arts = [Image.open(io.BytesIO(fetch(f'{art_base}/{pick}'))).convert('RGB')]
    pal = man['palette']
    look = {'tile': hexc(pal['tile']), 'glyph': hexc(pal['glyph']),
            'texture': 'stars' if entry.get('category') == 'Space & Night' else 'grain'}
    return Image.open(io.BytesIO(fetch(f'{base}/{wall}'))).convert('RGB'), arts, look


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


STARS = {'tile': TILE, 'glyph': (255, 255, 255), 'texture': 'stars'}


def icon(glyph, feather, seed, look=STARS):
    rnd = random.Random(seed)
    t = Image.new('RGBA', (ICON, ICON), look['tile'] + (250,))
    d = ImageDraw.Draw(t)
    for i in range(ICON):  # soft top light, as the textured look has
        d.line([(0, i), (ICON, i)], fill=(255, 255, 255, round(14 * (1 - i / ICON))))
    if look['texture'] == 'stars':
        for _ in range(26):
            x, y = rnd.uniform(0, ICON), rnd.uniform(0, ICON)
            r = rnd.choice([1.2, 1.6, 2.2])
            d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, rnd.randint(60, 170)))
        for _ in range(2):
            sparkle(d, rnd.uniform(ICON * 0.62, ICON * 0.86), rnd.uniform(ICON * 0.12, ICON * 0.88), rnd.uniform(9, 13), 230)
    else:
        for _ in range(420):
            d.point((rnd.uniform(0, ICON), rnd.uniform(0, ICON)), fill=look['glyph'] + (rnd.randint(14, 40),))
    f = ImageFont.truetype(feather, round(ICON * 0.46))
    ch = chr(GLYPHS[glyph])
    box = d.textbbox((0, 0), ch, font=f)
    d.text(((ICON - (box[2] - box[0])) / 2 - box[0], (ICON - (box[3] - box[1])) / 2 - box[1]), ch, font=f, fill=look['glyph'] + (255,))
    out = Image.new('RGBA', (ICON, ICON), (0, 0, 0, 0))
    out.paste(t, (0, 0), squircle(ICON, round(ICON * 0.225)))
    return out


def label(img, text, cx, y, font):
    if not text:
        return
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    w = d.textlength(text, font=font)
    if light_under(img, (cx - w / 2, y, cx + w / 2, y + font.size * 1.3)):
        d.text((cx - w / 2, y), text, font=font, fill=(38, 40, 52, 255))  # dark text on a light wallpaper
    else:
        d.text((cx - w / 2, y), text, font=font, fill=(0, 0, 0, 150))
        layer = layer.filter(ImageFilter.GaussianBlur(4))
        ImageDraw.Draw(layer).text((cx - w / 2, y), text, font=font, fill=(255, 255, 255, 255))
    img.alpha_composite(layer)


def light_under(img, box):
    return img.crop(tuple(round(v) for v in box)).convert('L').resize((1, 1), Image.BOX).getpixel((0, 0)) > 175


def blended(art):
    """The artwork as the phone shows it (src/core/artBlend.ts via scripts/packs/blend-audit.py): a plain backdrop
    is keyed or feathered away so the subject floats on the wallpaper; a full scene keeps its rounded tile."""
    try:
        import importlib.util
        import numpy as np
        spec = importlib.util.spec_from_file_location('blend', GLAZE / 'scripts/packs/blend-audit.py')
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        rgba = np.asarray(art.convert('RGBA'), dtype=np.uint8).copy()
        d = m.decide(m.measure(rgba))
        if d.get('mode') in (None, 'none', 'tile', 'opaque'):
            return None
        return Image.fromarray(m.apply_blend(rgba, d, fill_interior=True), 'RGBA')
    except Exception as e:  # numpy missing or an odd piece: fall back to the rounded tile
        print('blend skipped:', e)
        return None


def widget(img, art, x, y, size):
    b = blended(art)
    if b is not None:
        b = b.resize((size, size), Image.LANCZOS)
        img.alpha_composite(b, (x, y))
        return
    a = art.resize((size, size), Image.LANCZOS).convert('RGBA')
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((x, y + 10, x + size, y + size + 10), round(size * 0.13), fill=(0, 0, 0, 110))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18)))
    img.paste(a, (x, y), squircle(size, round(size * 0.13)))


def status_bar(img, font):
    d = ImageDraw.Draw(img)
    top = img.crop((0, 0, W, 60 * PT)).convert('L').resize((1, 1), Image.BOX).getpixel((0, 0))
    ink = (0, 0, 0) if top > 170 else (255, 255, 255)  # iOS uses dark status bar text on light wallpapers
    d.rounded_rectangle((W / 2 - 63 * PT, 11 * PT, W / 2 + 63 * PT, 48 * PT), 19 * PT, fill=(0, 0, 0, 255))
    d.text((58 * PT, 17 * PT), '9:41', font=font, fill=ink)
    x0, base = 330 * PT, 35 * PT
    for i, hgt in enumerate((4, 6.5, 9, 11.5)):  # signal bars
        d.rounded_rectangle((x0 + i * 5.2 * PT, base - hgt * PT, x0 + i * 5.2 * PT + 3.4 * PT, base), 2, fill=ink)
    cx, cy = 362 * PT, base - 1 * PT  # wifi
    for r, wdt in ((10, 2.2), (6.5, 2.2)):
        d.arc((cx - r * PT, cy - r * PT, cx + r * PT, cy + r * PT), 225, 315, fill=ink, width=round(wdt * PT))
    d.ellipse((cx - 1.8 * PT, cy - 3.6 * PT, cx + 1.8 * PT, cy), fill=ink)
    bx = 378 * PT  # battery
    d.rounded_rectangle((bx, 24 * PT, bx + 25 * PT, 36 * PT), 4 * PT, outline=ink + (140,), width=3)
    d.rounded_rectangle((bx + 2 * PT, 26 * PT, bx + 23 * PT, 34 * PT), 2 * PT, fill=ink)
    d.rounded_rectangle((bx + 26 * PT, 28 * PT, bx + 27.5 * PT, 32 * PT), 2, fill=ink + (140,))


def build(img, arts, look, fonts, feather, corner='left'):
    scale = max(W / img.size[0], H / img.size[1])
    img = img.resize((round(img.size[0] * scale), round(img.size[1] * scale)), Image.LANCZOS)
    img = img.crop(((img.size[0] - W) // 2, (img.size[1] - H) // 2, (img.size[0] - W) // 2 + W, (img.size[1] - H) // 2 + H)).convert('RGBA')
    lab = ImageFont.truetype(str(Path(fonts) / 'Inter-Medium.ttf'), 12 * PT)
    status_bar(img, ImageFont.truetype(str(Path(fonts) / 'Inter-SemiBold.ttf'), 17 * PT))
    wsize = COLS[1] - COLS[0] + ICON  # a Small widget spans two icon columns
    left = COLS[0] - ICON // 2
    right = COLS[2] - ICON // 2
    seed = 0

    def row(apps, top):
        nonlocal seed
        for (g, name), cx in zip(apps, COLS):
            img.alpha_composite(icon(g, feather, seed, look), (cx - ICON // 2, top))
            label(img, name, cx, top + ICON + 5 * PT, lab)
            seed += 1

    # One artwork, up in a top corner (a Small widget over two icon columns and two rows); four apps beside it
    # and one more row of four under it. Everything below stays clear so the wallpaper does the talking.
    art_x, apps_cols = (left, COLS[2:]) if corner == 'left' else (right, COLS[:2])
    widget(img, arts[0], art_x, ROW0, wsize)
    for i, (g, name) in enumerate(APPS_ROW):
        cx, t = apps_cols[i % 2], ROW0 + (i // 2) * PITCH
        img.alpha_composite(icon(g, feather, seed, look), (cx - ICON // 2, t))
        label(img, name, cx, t + ICON + 5 * PT, lab)
        seed += 1
    row(APPS_ROW2, ROW0 + 2 * PITCH)
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
    d.text((W / 2 - 30 * PT, py + 8 * PT), chr(GLYPHS['search']), font=f, fill=(38, 40, 52) if light_under(img, (W / 2 - 42 * PT, py, W / 2 + 42 * PT, py + 30 * PT)) else (255, 255, 255))
    pill_ink = (38, 40, 52) if light_under(img, (W / 2 - 42 * PT, py, W / 2 + 42 * PT, py + 30 * PT)) else (255, 255, 255)
    d.text((W / 2 - 14 * PT, py + 5.5 * PT), 'Search', font=ImageFont.truetype(str(Path(fonts) / 'Inter-SemiBold.ttf'), 13.5 * PT), fill=pill_ink)
    for (g, _), cx in zip(DOCK, COLS):
        img.alpha_composite(icon(g, feather, seed, look), (cx - ICON // 2, dock_top + 14 * PT))
        seed += 1
    return img.convert('RGB')


GLYPHS = {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pack', default=str(GLAZE / 'assets/starter-packs/alpine-starlight'))
    ap.add_argument('--theme', help='a catalogue theme id (downloaded from the pack host)')
    ap.add_argument('--out', required=True)
    ap.add_argument('--art', help='which artwork goes in the corner (e.g. saturn-rings); default HERO[theme]')
    ap.add_argument('--corner', choices=['left', 'right'], default='left')
    ap.add_argument('--fonts')
    ap.add_argument('--vector-icons', default=str(GLAZE / VI))
    a = ap.parse_args()
    GLYPHS.update(json.loads((Path(a.vector_icons) / 'glyphmaps/Feather.json').read_text()))
    from compose import fonts_dir
    if a.theme:
        wall, arts, look = remote_theme(a.theme, a.art)
    else:
        wall = Image.open(glob.glob(str(Path(a.pack) / 'wallpaper-*.webp'))[0]).convert('RGB')
        arts, look = [piece(a.pack, a.art or HERO['alpine-starlight'])], STARS
    img = build(wall, arts, look, str(fonts_dir(a.fonts)), str(Path(a.vector_icons) / 'Fonts/Feather.ttf'), a.corner)
    img.save(a.out)
    print(a.out, img.size)


if __name__ == '__main__':
    main()
