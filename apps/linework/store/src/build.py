"""Linework App Store screenshots (store/README.md).

Every phone screen is a real capture of the app on an iPhone Pro Max simulator (1320x2868), taken by
store/capture/flow-*.yaml. This script only adds the frame around it: paper background with the drafting grid,
a caption from captions.json, a graphite phone outline and red registration marks (DESIGN.md). Nothing inside the
screen is drawn or edited.

    python store/src/build.py            # from apps/linework; needs Pillow and node_modules (fonts)

Writes jpg/a/*.jpg (1320x2868, the 6.9-inch slot listing.json uploads), jpg/a-6.5/*.jpg (1284x2778) and
contact-sheet.png.
"""
import json
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
STORE = os.path.dirname(HERE)
APP = os.path.dirname(STORE)
SHOTS = os.path.join(STORE, 'capture', 'shots')
W, H = 1320, 2868

FONT_HEAD = os.path.join(APP, 'node_modules', '@expo-google-fonts', 'fraunces', '600SemiBold', 'Fraunces_600SemiBold.ttf')
FONT_SUB = os.path.join(APP, 'node_modules', '@expo-google-fonts', 'inter', '500Medium', 'Inter_500Medium.ttf')

# src/theme/tokensV2.ts
LIGHT = dict(paper='#F6F2EB', graphite='#1E1B18', muted='#6B645A', ink='#B23A1F', line='#E2DACE')
DARK = dict(paper='#141210', graphite='#F2EDE5', muted='#B1A99E', ink='#FF8E6B', line='#36312B')

# id -> (capture file, scheme). Order is the store order.
SET = [
    ('01-home', 'clean-home', LIGHT),
    ('02-templates', 'trial-templates', LIGHT),
    ('03-letters', 'trial-letters', LIGHT),
    ('04-workshop', 'trial-workshop', LIGHT),
    ('05-photo-sketch', 'trial-prepare', LIGHT),
    ('06-lightbox', 'trial-lightbox', LIGHT),
    ('07-dark', 'dark-templates', DARK),
    ('08-plus', 'clean-plus', LIGHT),
]

SCALE = 0.70          # phone screen size on the canvas
TOP = 640             # phone top edge
BEZEL = 16


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def grid(img, pal):
    d = ImageDraw.Draw(img, 'RGBA')
    g = rgb(pal['graphite'])
    for i in range(0, max(W, H), 24):
        a = 22 if i % 96 == 0 else 10
        d.line([(i, 0), (i, H)], fill=g + (a,), width=1)
        d.line([(0, i), (W, i)], fill=g + (a,), width=1)


def wrap_center(d, text, font, y, fill, max_w, gap):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) <= max_w or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    for ln in lines:
        d.text(((W - d.textlength(ln, font=font)) / 2, y), ln, font=font, fill=fill)
        y += gap
    return y


def crop_marks(d, box, col):
    x0, y0, x1, y1 = box
    L, t, g = 54, 6, 22
    for (x, y, sx, sy) in ((x0, y0, -1, -1), (x1, y0, 1, -1), (x0, y1, -1, 1), (x1, y1, 1, 1)):
        cx, cy = x + sx * g, y + sy * g
        # An L at each corner, just outside the phone: one bar along x, one along y, meeting at (cx, cy).
        bar = lambda x0, y0, x1, y1: d.rectangle([min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)], fill=col)
        bar(cx, cy, cx - sx * L, cy - sy * t)
        bar(cx, cy, cx - sx * t, cy - sy * L)


def frame(shot_id, capture, pal, caption):
    img = Image.new('RGB', (W, H), rgb(pal['paper']))
    grid(img, pal)
    d = ImageDraw.Draw(img)
    head = ImageFont.truetype(FONT_HEAD, 112)
    sub = ImageFont.truetype(FONT_SUB, 46)
    y = wrap_center(d, caption['headline'], head, 170, rgb(pal['graphite']), W - 200, 128)
    wrap_center(d, caption['subtitle'], sub, y + 34, rgb(pal['muted']), W - 220, 62)

    scr = Image.open(os.path.join(SHOTS, capture + '.png')).convert('RGB')
    assert scr.size == (W, H), (capture, scr.size)
    sw, sh = int(W * SCALE), int(H * SCALE)
    scr = scr.resize((sw, sh), Image.LANCZOS)
    x = (W - sw) // 2
    r = int(55 * 3 * SCALE)  # iPhone Pro Max corner radius (55 pt at 3x)
    box = (x - BEZEL, TOP - BEZEL, x + sw + BEZEL, TOP + sh + BEZEL)

    shadow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle((box[0], box[1] + 30, box[2], box[3] + 30), r + BEZEL, fill=70)
    shadow = shadow.filter(ImageFilter.GaussianBlur(40))
    img.paste(Image.new('RGB', (W, H), (0, 0, 0)), (0, 0), shadow)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box, r + BEZEL, fill=(24, 22, 20))
    mask = Image.new('L', (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw, sh), r, fill=255)
    img.paste(scr, (x, TOP), mask)
    # Dynamic Island, where the real one sits (126x37 pt, 11 pt from the top, at 3x).
    iw, ih, it = int(126 * 3 * SCALE), int(37 * 3 * SCALE), int(11 * 3 * SCALE)
    d.rounded_rectangle(((W - iw) // 2, TOP + it, (W + iw) // 2, TOP + it + ih), ih // 2, fill=(0, 0, 0))
    crop_marks(d, box, rgb(pal['ink']))
    return img


def main():
    caps = json.load(open(os.path.join(STORE, 'captions.json'), encoding='utf-8'))
    by_id = {s['id']: s for s in caps['shots']}
    assert [s[0] for s in SET] == [s['id'] for s in caps['shots']], 'captions.json order matches SET'
    out_a = os.path.join(STORE, 'jpg', 'a')
    out_65 = os.path.join(STORE, 'jpg', 'a-6.5')
    for d in (out_a, out_65):
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            os.remove(os.path.join(d, f))
    thumbs = []
    for shot_id, capture, pal in SET:
        c = by_id[shot_id]
        img = frame(shot_id, capture, pal, {'headline': c['headline']['en'], 'subtitle': c['subtitle']['en']})
        img.save(os.path.join(out_a, shot_id + '.jpg'), quality=86, optimize=True)
        s65 = img.resize((1284, round(H * 1284 / W)), Image.LANCZOS)
        top = (s65.height - 2778) // 2
        s65.crop((0, top, 1284, top + 2778)).save(os.path.join(out_65, shot_id + '.jpg'), quality=86, optimize=True)
        thumbs.append(img.resize((264, 574), Image.LANCZOS))
    sheet = Image.new('RGB', (len(thumbs) * 276 + 12, 598), (40, 40, 40))
    for i, t in enumerate(thumbs):
        sheet.paste(t, (12 + i * 276, 12))
    sheet.save(os.path.join(STORE, 'contact-sheet.png'), optimize=True)
    print('wrote', len(thumbs), 'shots')


if __name__ == '__main__':
    main()
