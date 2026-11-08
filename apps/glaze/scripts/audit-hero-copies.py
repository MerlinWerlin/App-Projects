#!/usr/bin/env python3
# Owner 2026-11-08: finds v1 heroes (widget-small / widget-large) that are the same picture as one of
# their pack's pieces, and uneven star skies. Run over packs downloaded by an audit fetch (one folder
# per theme holding its widget-*.webp files): python3 scripts/audit-hero-copies.py <outdir> [ids].
# A hero counts as a copy when its 32px thumbnail differs from the piece by < 25 and fewer than 500
# colour-defect pixels remain; those file names go in src/core/heroCopies.ts.
"""Second pass over downloaded packs (audit/out/img). python audit2.py <outdir>"""
import json, os, sys, glob
from PIL import Image, ImageFilter, ImageChops, ImageStat

out = sys.argv[1]
only = sys.argv[2].split(',') if len(sys.argv) > 2 else None


def load(path):
    im = Image.open(path).convert('RGBA')
    bg = Image.new('RGBA', im.size, (0, 0, 0, 255)); bg.alpha_composite(im)
    return bg.convert('RGB'), im.getchannel('A')


def crop_to(im, w, h):
    W, H = im.size; r = w / h
    if W / H > r:
        nw = int(H * r); x = (W - nw) // 2; return im.crop((x, 0, x + nw, H))
    nh = int(W / r); y = (H - nh) // 2; return im.crop((0, y, W, y + nh))


def defect(hero_path, piece_path, n=256, b=3):
    h, ha = load(hero_path)
    p, _ = load(piece_path)
    p = crop_to(p, *h.size).resize((n, int(n * h.size[1] / h.size[0])), Image.LANCZOS)
    h = h.resize(p.size, Image.LANCZOS)
    ha = ha.resize(p.size)
    hs = h.convert('HSV').split()[1]
    ps, pv = p.convert('HSV').split()[1:]
    sd = ImageChops.difference(hs, ps).filter(ImageFilter.BoxBlur(b))
    ld = ImageChops.difference(h.convert('L'), p.convert('L')).filter(ImageFilter.BoxBlur(b))
    a, s, l, v = ha.load(), sd.load(), ld.load(), pv.load()
    W, H = p.size
    m = W // 10
    bad = 0; worst = 0; meds = []
    for y in range(m, H - m):
        for x in range(m, W - m):
            if a[x, y] < 255:
                continue
            meds.append(l[x, y])
            score = max(l[x, y] * 3, s[x, y] if v[x, y] > 18 else 0)
            worst = max(worst, score)
            bad += score > 110
    meds.sort()
    return {'median': meds[len(meds) // 2] if meds else None, 'worst': worst, 'bad_px': bad}


def match(hero, arts):
    hh = Image.open(hero).convert('L').resize((32, 32))
    best, bd = None, 1e9
    for k, v in arts.items():
        g = crop_to(Image.open(v).convert('L'), *Image.open(hero).size).resize((32, 32))
        s = ImageStat.Stat(ImageChops.difference(hh, g)).mean[0]
        if s < bd:
            best, bd = k, s
    return best, bd


def stars(path):
    """Isolated bright points on a dark border band, per 10k px; None when the border is not dark."""
    g = Image.open(path).convert('L').resize((512, 512), Image.LANCZOS)
    bl = g.filter(ImageFilter.BoxBlur(6))
    p, q = g.load(), bl.load()
    band = [(x, y) for y in range(512) for x in range(512) if x < 48 or x > 463 or y < 48 or y > 463]
    darks = sorted(q[x, y] for x, y in band)
    if darks[len(darks) // 2] > 45:
        return None
    c = sum(1 for x, y in band if p[x, y] > 90 and p[x, y] - q[x, y] > 40)
    return round(10000 * c / len(band), 1)


rows = []
for d in sorted(glob.glob(os.path.join(out, 'img', '*'))):
    tid = os.path.basename(d)
    if only and tid not in only:
        continue
    files = {os.path.basename(f).split('.')[0]: f for f in glob.glob(os.path.join(d, 'widget-*'))}
    heroes = {k: v for k, v in files.items() if k in ('widget-small', 'widget-large')}
    arts = {k: v for k, v in files.items() if k not in ('widget-small', 'widget-medium', 'widget-large') and 'clock' not in k and 'live-' not in k}
    r = {'id': tid, 'copies': {}, 'stars': {}}
    for h, hp in heroes.items():
        if not arts:
            continue
        best, dist = match(hp, arts)
        if dist < 25:
            r['copies'][h] = {'of': best, 'dist': round(dist, 1), **(defect(hp, arts[best]) or {})}
    for k, v in files.items():
        if 'clock' in k or 'live-' in k:
            continue
        s = stars(v)
        if s is not None:
            r['stars'][k] = s
    rows.append(r)
json.dump(rows, open(os.path.join(out, 'report2.json'), 'w'), indent=1)
for r in rows:
    print(json.dumps(r))
