#!/usr/bin/env python3
"""T251 (owner-1101h #2): widget art blend audit + fix for every theme.

Widget art must BLEND with the wallpaper: no frame, no box, no halo. For every theme with widget
art (bundled art packs under themes/, every remote pack in the release catalogue, read from a
local cache), this script:

  1. measures each art piece's edge ring and decides transparent / key / feather with the SAME
     maths as src/core/artBlend.ts (constants pinned by src/core/artBlend.test.ts);
  2. renders a contact sheet per theme: every piece at small / medium / large over the wallpaper
     crop under the widget's default slot (src/core/seamlessWidget.ts seamlessCrop, 6.7-inch 2796),
     top row RAW (the art as shipped, which is what shows as a box), bottom row BLENDED (what a
     native build with T251 composes: GlazeWidgetBridgeModule.setSeamless + GlazeArtBlend);
  3. flags frames, black outlines, halos, boxes and seams (see FLAGS below);
  4. with --fix DIR writes the blended PNG of every opaque piece (straight alpha, source size) to
     DIR/<themeId>/<image stem>.png, for the pack build to ship instead of the opaque original.

Usage (Python 3 + Pillow + numpy; Node 22 for the crop maths):

  python3 scripts/packs/blend-audit.py                       # cache only, sheets to /home/claude/contact-sheets
  python3 scripts/packs/blend-audit.py --download            # fetch missing remote files first (curl)
  python3 scripts/packs/blend-audit.py --only alpine-starlight --fix /tmp/keyed
  python3 scripts/packs/blend-audit.py --report docs/widget_snapshots/BLEND_AUDIT_1101H.md --json out.json

Sheets and the cache live OUTSIDE the repo (bundle size guard). Exit code 0 even with flags
(review aid, not a gate), 2 on bad arguments.
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
RELEASES = {
    'production': 'https://github.com/MerlinWerlin/App-Projects/releases/download/glaze-packs-v1',
    'staging': 'https://github.com/MerlinWerlin/App-Projects/releases/download/glaze-packs-staging',
}

# ---------------------------------------------------------------- src/core/artBlend.ts mirror
BLEND_RING_SHARE = 0.03
BLEND_RING_MIN_PX = 2
BLEND_TRANSPARENT_SHARE = 0.5
BLEND_KEY_NEAR = 20
BLEND_KEY_MIN_UNIFORM = 0.95
BLEND_KEY_MAX_SPREAD = 10
BLEND_KEY_LO_BASE = 16
BLEND_KEY_SOFT = 48
BLEND_MIN_SUBJECT = 0.03
BLEND_FEATHER_SHARE = 0.14
BLEND_KEY_EDGE_FEATHER_SHARE = 0.04
BLEND_KEY_BG_ALPHA = 0.5
BLEND_KEY_RIM_SHARE = 0.02
BLEND_KEY_HOLD_LO = 0.05
BLEND_KEY_HOLD_HI = 0.3
BLEND_BOX_DISTANCE = 28

# Audit-only thresholds.
FRAME_DISTANCE = 30      # outer ring vs the ring just inside it (RGB): a drawn border
FRAME_MAX_SPREAD = 12    # ...and the outer ring is one flat colour
HALO_LUMA = 40           # near-transparent pixels this much lighter/darker than the wallpaper (0-255)
HALO_MIN_SHARE = 0.004   # ...over at least this share of the widget
OUTLINE_LUMA = 45        # a fringe darker than this round a subject brighter than OUTLINE_SUBJECT
OUTLINE_SUBJECT = 110
SEAM_MEAN = 6            # blended widget edge vs the wallpaper crop edge (mean abs, 0-255)

SIZES_PT = {'small': (170, 170), 'medium': (364, 170), 'large': (364, 382)}
CORNER_PT = 22
WIDGET_ART_PADDING = 0.06


def ring_width(w, h):
    return max(BLEND_RING_MIN_PX, int(round(min(w, h) * BLEND_RING_SHARE)))


def ring_mask(w, h, r):
    m = np.zeros((h, w), dtype=bool)
    m[:r, :] = True
    m[-r:, :] = True
    m[:, :r] = True
    m[:, -r:] = True
    return m


def hist_median(values):
    """Lower median via a 256-bin histogram (same as artBlend.ts histMedian)."""
    n = values.size
    if n == 0:
        return 0
    hist = np.bincount(values.astype(np.int64), minlength=256)
    cum = np.cumsum(hist)
    return int(np.searchsorted(cum, (n + 1) // 2))


def key_thresholds(spread):
    lo = BLEND_KEY_LO_BASE + max(0.0, float(spread))
    return lo, lo + BLEND_KEY_SOFT


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0) if e1 > e0 else (x >= e1).astype(np.float64)
    return t * t * (3 - 2 * t)


def measure(rgba):
    """artBlend.ts measureArtEdges on a straight uint8 RGBA array (h, w, 4)."""
    h, w = rgba.shape[:2]
    r = ring_width(w, h)
    ring = ring_mask(w, h, r)
    a = rgba[..., 3]
    ring_px = rgba[ring]
    ring_total = ring_px.shape[0]
    opaque = ring_px[ring_px[:, 3] >= 128][:, :3].astype(np.float64)
    transparent = ring_total - opaque.shape[0]
    if opaque.shape[0]:
        key = tuple(hist_median(opaque[:, c]) for c in range(3))
        spread = float(np.mean(np.sqrt(np.maximum(0, (opaque ** 2).mean(0) - opaque.mean(0) ** 2))))
    else:
        key, spread = (0, 0, 0), 0.0
    lo, hi = key_thresholds(spread)
    rgb = rgba[..., :3].astype(np.float64)
    dist = np.sqrt(((rgb - np.array(key, dtype=np.float64)) ** 2).sum(-1))
    solid = a >= 128
    near = np.count_nonzero(solid & ring & (dist <= BLEND_KEY_NEAR))
    subject = np.count_nonzero(solid & (dist > hi))
    return {
        'width': w, 'height': h, 'ring': r,
        'transparentShare': transparent / ring_total if ring_total else 1.0,
        'key': key, 'spread': spread,
        'uniformShare': near / opaque.shape[0] if opaque.shape[0] else 0.0,
        'subjectShare': subject / (w * h) if w * h else 0.0,
    }


def rgb_distance(a, b):
    return float(np.sqrt(sum((float(x) - float(y)) ** 2 for x, y in zip(a, b))))


def decide(stats, wallpaper=None):
    """artBlend.ts decideArtBlend."""
    if not stats['transparentShare'] < BLEND_TRANSPARENT_SHARE:
        return {'mode': 'transparent'}
    box = round(rgb_distance(stats['key'], wallpaper) * 10) / 10 if wallpaper is not None else None
    lo, hi = key_thresholds(stats['spread'])
    if stats['spread'] <= BLEND_KEY_MAX_SPREAD and stats['uniformShare'] >= BLEND_KEY_MIN_UNIFORM and stats['subjectShare'] >= BLEND_MIN_SUBJECT:
        return {'mode': 'key', 'key': stats['key'], 'lo': lo, 'hi': hi, 'band': BLEND_KEY_EDGE_FEATHER_SHARE, 'boxDistance': box}
    return {'mode': 'feather', 'band': BLEND_FEATHER_SHARE, 'edge': stats['key'], 'boxDistance': box}


def feather_alpha(w, h, band_px):
    xs = np.arange(w, dtype=np.float64) + 0.5
    ys = np.arange(h, dtype=np.float64) + 0.5
    ex = np.minimum(xs, w - xs)
    ey = np.minimum(ys, h - ys)
    e = np.minimum(ey[:, None], ex[None, :])
    return smoothstep(0.0, max(1.0, band_px), e)


def key_background(t):
    """artBlend.ts keyBackground: t < BLEND_KEY_BG_ALPHA, 4-connected to the border."""
    low = t < BLEND_KEY_BG_ALPHA
    h, w = low.shape
    try:
        from scipy import ndimage  # fast path
        lab, _ = ndimage.label(low)  # default structure = 4-connected
        border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        return np.isin(lab, list(border))
    except ImportError:
        from collections import deque
        bg = np.zeros_like(low)
        q = deque()
        for y, x in [(0, x) for x in range(w)] + [(h - 1, x) for x in range(w)] + [(y, 0) for y in range(h)] + [(y, w - 1) for y in range(h)]:
            if low[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
        while q:
            y, x = q.popleft()
            for ny, nx in ((y, x - 1), (y, x + 1), (y - 1, x), (y + 1, x)):
                if 0 <= ny < h and 0 <= nx < w and low[ny, nx] and not bg[ny, nx]:
                    bg[ny, nx] = True
                    q.append((ny, nx))
        return bg


def distance_to(mask, limit):
    """Distance (px) to the nearest mask pixel, exact up to `limit` (artBlend.ts uses chamfer 3-4)."""
    try:
        from scipy import ndimage
        return ndimage.distance_transform_edt(~mask)
    except ImportError:
        d = np.where(mask, 0.0, np.inf)
        reached = mask.copy()
        for k in range(1, int(np.ceil(limit)) + 2):
            grown = reached.copy()
            grown[1:, :] |= reached[:-1, :]
            grown[:-1, :] |= reached[1:, :]
            grown[:, 1:] |= reached[:, :-1]
            grown[:, :-1] |= reached[:, 1:]
            if k % 2 == 0:  # alternate 4 / 8 neighbours: an octagonal approximation of Euclid
                g2 = grown.copy()
                g2[1:, 1:] |= reached[:-1, :-1]
                g2[:-1, :-1] |= reached[1:, 1:]
                g2[1:, :-1] |= reached[:-1, 1:]
                g2[:-1, 1:] |= reached[1:, :-1]
                grown = g2
            d[grown & ~reached] = k
            reached = grown
        return d


def apply_blend(rgba, d):
    """artBlend.ts applyArtBlend: straight uint8 RGBA in, straight uint8 RGBA out."""
    if d['mode'] == 'transparent':
        return rgba.copy()
    h, w = rgba.shape[:2]
    rgb = rgba[..., :3].astype(np.float64)
    a = rgba[..., 3].astype(np.float64) / 255.0
    if d['mode'] == 'key':
        key = np.array(d['key'], dtype=np.float64)
        dist = np.sqrt(((rgb - key) ** 2).sum(-1))
        t = smoothstep(d['lo'], d['hi'], dist)
        rim = BLEND_KEY_RIM_SHARE * min(w, h)
        to_bg = distance_to(key_background(t), rim)
        k = np.maximum(t, smoothstep(rim * 0.5, rim, to_bg) * smoothstep(BLEND_KEY_HOLD_LO, BLEND_KEY_HOLD_HI, t))
        safe = np.where(k > 1 / 255, k, 1.0)
        fg = np.clip(key + (rgb - key) / safe[..., None], 0, 255)
        rgb = np.where((k > 1 / 255)[..., None], np.round(fg), 0)
        a = a * k
    a = a * feather_alpha(w, h, d['band'] * min(w, h))
    out = np.empty_like(rgba)
    out[..., :3] = rgb.astype(np.uint8)
    out[..., 3] = np.round(a * 255).astype(np.uint8)
    return out


def luma(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]

# ---------------------------------------------------------------- crops (src/core/seamlessWidget.ts)


_CROPS = {}


def crops_for(wall_w, wall_h):
    key = (wall_w, wall_h)
    if key in _CROPS:
        return _CROPS[key]
    js = (
        "import { deviceById, seamlessCrop, normaliseSlot, DEFAULT_DEVICE_ID } from './src/core/seamlessWidget.ts';"
        "const d = deviceById(DEFAULT_DEVICE_ID); const o = {};"
        "for (const s of ['small','medium','large']) o[s] = seamlessCrop({ device: d, wallpaper: { w: %d, h: %d }, size: s, slot: normaliseSlot(s, null), nudge: { dx: 0, dy: 0 } }).cropPx;"
        "console.log(JSON.stringify(o));" % (wall_w, wall_h)
    )
    try:
        out = subprocess.run(['node', '--no-warnings', '--input-type=module', '-e', js], cwd=ROOT, capture_output=True, text=True, check=True).stdout
        _CROPS[key] = json.loads(out)
    except (OSError, subprocess.CalledProcessError, ValueError):
        # 6.7-inch 2796 defaults for a 1290x2796 wallpaper (scaled for other sizes).
        k = wall_w / 1290
        base = {'small': (99, 282, 510, 510), 'medium': (99, 282, 1092, 510), 'large': (99, 282, 1092, 1146)}
        _CROPS[key] = {s: {'x': round(x * k), 'y': round(y * k), 'w': round(w * k), 'h': round(h * k)} for s, (x, y, w, h) in base.items()}
    return _CROPS[key]


def hero_rect(tw, th, aw, ah, pad=WIDGET_ART_PADDING):
    p = pad * min(tw, th)
    bw, bh = tw - 2 * p, th - 2 * p
    k = min(bw / aw, bh / ah)
    w, h = aw * k, ah * k
    return (tw - w) / 2, (th - h) / 2, w, h

# ---------------------------------------------------------------- themes


def sha256(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def fetch(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    subprocess.run(['curl', '-fsSL', '--retry', '2', '-o', dest, url], check=True)


def bundled_themes(only):
    out = []
    tdir = os.path.join(ROOT, 'themes')
    for tid in sorted(os.listdir(tdir)) if os.path.isdir(tdir) else []:
        d = os.path.join(tdir, tid)
        wall = os.path.join(d, 'wallpaper.png')
        heroes = [(f'hero-{s}', os.path.join(d, f'widget-{s}.png')) for s in ('small', 'medium', 'large')]
        heroes = [(i, f) for i, f in heroes if os.path.exists(f)]
        if not heroes or (only and tid not in only):
            continue
        name = tid
        meta = os.path.join(d, 'meta.json')
        if os.path.exists(meta):
            name = json.load(open(meta)).get('name', tid)
        out.append({'id': tid, 'name': name, 'source': 'bundled', 'wallpaper': wall if os.path.exists(wall) else None,
                    'pieces': [{'id': i, 'label': i, 'file': f, 'kind': 'art', 'background': 'wallpaper'} for i, f in heroes], 'errors': []})
    return out


def remote_themes(cache, env, download, only):
    base = RELEASES[env]
    root = os.path.join(cache, env)
    cat_file = os.path.join(root, 'catalog.json')
    errors = []
    if download:
        try:
            fetch(f'{base}/catalog.json', cat_file)
        except subprocess.CalledProcessError as e:
            errors.append(f'catalog download failed: {e}')
    if not os.path.exists(cat_file):
        return [], errors + [f'no catalogue cached at {cat_file} (run with --download)']
    cat = json.load(open(cat_file))
    out = []
    for p in cat.get('packs', []):
        if only and p['id'] not in only:
            continue
        mrel = p['manifest']
        mfile = os.path.join(root, mrel)
        try:
            if not os.path.exists(mfile):
                if not download:
                    raise FileNotFoundError('manifest not cached')
                fetch(f"{base}/{mrel.replace('/', '__')}", mfile)
            m = json.load(open(mfile))
            folder = f"art/{p['id']}/v{p['packVersion']}"
            by_path = {a['path']: a for a in m.get('assets', [])}

            def local(asset):
                dest = os.path.join(root, folder, asset['path'])
                if os.path.exists(dest) and sha256(dest) == asset['sha256']:
                    return dest
                if not download:
                    return None
                # A release stores flat names (src/core/packHost.ts flatAssetName: '/' -> '__').
                fetch(f"{base}/{(folder + '/' + asset['path']).replace('/', '__')}", dest)
                if sha256(dest) != asset['sha256']:
                    os.remove(dest)
                    raise ValueError(f"sha256 mismatch: {asset['path']}")
                return dest

            walls = sorted([a for a in m['assets'] if a.get('role') == 'wallpaper'], key=lambda a: max(a['width'], a['height']))
            wall = next((a for a in walls if max(a['width'], a['height']) >= 2796), walls[-1] if walls else None)
            pieces = []
            for o in m.get('widgets', []):
                a = by_path.get(o['image'])
                f = local(a) if a else None
                if f:
                    pieces.append({'id': o['id'], 'label': o.get('label') or o['id'], 'file': f, 'image': o['image'], 'kind': o.get('kind', 'art'), 'background': o.get('background', 'blur')})
                else:
                    errors.append(f"{p['id']}/{o['id']}: image not cached")
            out.append({'id': p['id'], 'name': p.get('name', p['id']), 'source': 'remote', 'packVersion': p['packVersion'],
                        'wallpaper': local(wall) if wall else None, 'pieces': pieces, 'errors': []})
        except Exception as e:  # noqa: BLE001 - one bad pack never stops the audit
            errors.append(f"{p['id']}: {e}")
    return out, errors


def no_art_packs():
    d = os.path.join(ROOT, 'packs')
    return sorted(x for x in os.listdir(d) if os.path.isdir(os.path.join(d, x))) if os.path.isdir(d) else []

# ---------------------------------------------------------------- audit


def load_rgba(path):
    im = Image.open(path)
    im.load()
    return np.asarray(im.convert('RGBA'), dtype=np.uint8).copy()


def frame_check(rgba, r):
    """A drawn border: the outer ring is one flat colour and differs from the ring just inside it."""
    h, w = rgba.shape[:2]
    if min(w, h) < 6 * r:
        return None
    outer = ring_mask(w, h, r)
    inner = ring_mask(w, h, 2 * r) & ~outer
    inner[2 * r:h - 2 * r, 2 * r:w - 2 * r] = False
    o = rgba[outer]
    i = rgba[inner]
    o = o[o[:, 3] >= 128][:, :3].astype(np.float64)
    i = i[i[:, 3] >= 128][:, :3].astype(np.float64)
    if o.shape[0] < 0.5 * outer.sum() or i.shape[0] == 0:
        return None
    dist = rgb_distance(o.mean(0), i.mean(0))
    spread = float(np.mean(o.std(0)))
    return dist, spread


def composite(wall_crop, art_rgba, rect, tw, th):
    """Art (straight RGBA) drawn at rect over the wallpaper crop scaled to tw x th. Returns (rgb float, art alpha full-size)."""
    bg = np.asarray(wall_crop.convert('RGB').resize((tw, th), Image.LANCZOS), dtype=np.float64)
    x, y, w, h = rect
    aw, ah = max(1, int(round(w))), max(1, int(round(h)))
    art = Image.fromarray(art_rgba, 'RGBA').resize((aw, ah), Image.LANCZOS)
    layer = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    layer.paste(art, (int(round(x)), int(round(y))))
    la = np.asarray(layer, dtype=np.float64)
    alpha = la[..., 3:4] / 255.0
    out = la[..., :3] * alpha + bg * (1 - alpha)
    return out, alpha[..., 0], bg


def round_mask(w, h, radius):
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    return m


def audit_piece(theme, piece, wall_img, crops, fix_dir):
    rgba = load_rgba(piece['file'])
    stats = measure(rgba)
    flags = []
    cells = {}
    # Wallpaper colour under the default small slot (the decision's boxDistance).
    wall_mean = None
    if wall_img is not None:
        c = crops['small']
        sub = np.asarray(wall_img.crop((c['x'], c['y'], c['x'] + c['w'], c['y'] + c['h'])).convert('RGB'), dtype=np.float64)
        wall_mean = tuple(float(v) for v in sub.reshape(-1, 3).mean(0))
    d = decide(stats, wall_mean)
    blended = apply_blend(rgba, d)

    fc = frame_check(rgba, stats['ring'])
    if fc and fc[0] > FRAME_DISTANCE and fc[1] < FRAME_MAX_SPREAD:
        flags.append({'code': 'frame', 'severity': 'warn', 'detail': f'outer {stats["ring"]} px ring differs from the ring inside it by {fc[0]:.0f} (a drawn border)'})
    if d['mode'] != 'transparent':
        bd = d.get('boxDistance')
        sev = 'warn' if bd is not None and bd > BLEND_BOX_DISTANCE else 'info'
        flags.append({'code': 'box', 'severity': sev,
                      'detail': f"opaque {('plain' if d['mode'] == 'key' else 'painted')} background rgb{tuple(int(v) for v in stats['key'])}"
                                + (f', {bd:.0f} from the wallpaper under the widget' if bd is not None else '')
                                + f"; ships opaque: {d['mode']} (pack rebuild)"})
    renders = {}
    if wall_img is not None:
        for s, (pw, ph) in SIZES_PT.items():
            c = crops[s]
            crop = wall_img.crop((c['x'], c['y'], c['x'] + c['w'], c['y'] + c['h']))
            tw, th = pw, ph
            rect = hero_rect(tw, th, rgba.shape[1], rgba.shape[0])
            raw_rgb, _, _ = composite(crop, rgba, rect, tw, th)
            out_rgb, alpha, bg = composite(crop, blended, rect, tw, th)
            # Seam: the blended widget's outer 2 px against the wallpaper crop's.
            edge = ring_mask(tw, th, 2)
            seam = float(np.abs(out_rgb[edge] - bg[edge]).mean())
            # Halo: near-transparent art pixels that do not look like the wallpaper under them.
            faint = (alpha > 0.02) & (alpha < 0.5)
            halo_share = 0.0
            halo_delta = 0.0
            if faint.any():
                dl = luma(out_rgb[faint]) - luma(bg[faint])
                bad = np.abs(dl) > HALO_LUMA
                halo_share = float(bad.sum()) / (tw * th)
                halo_delta = float(np.mean(dl[bad])) if bad.any() else 0.0
            # Outline: a dark fringe round a bright subject.
            fringe = (alpha > 0.1) & (alpha < 0.9)
            solid = alpha >= 0.9
            outline = bool(fringe.sum() > 0.002 * tw * th and solid.any()
                           and luma(out_rgb[fringe]).mean() < OUTLINE_LUMA and luma(out_rgb[solid]).mean() > OUTLINE_SUBJECT
                           and luma(bg[fringe]).mean() > luma(out_rgb[fringe]).mean() + 15)
            cell = {'seam': round(seam, 1), 'halo': round(halo_share, 4), 'haloDelta': round(halo_delta, 1), 'outline': outline}
            cells[s] = cell
            renders[s] = (raw_rgb, out_rgb)
            if seam > SEAM_MEAN:
                flags.append({'code': 'seam', 'severity': 'error', 'detail': f'{s}: blended widget edge differs from the wallpaper by {seam:.1f}'})
            if halo_share > HALO_MIN_SHARE:
                flags.append({'code': 'halo', 'severity': 'warn', 'detail': f"{s}: {halo_share * 100:.1f} % of the widget is a faint {'light' if halo_delta > 0 else 'dark'} fringe/glow ({halo_delta:+.0f} luma vs the wallpaper)"})
            if outline:
                flags.append({'code': 'outline', 'severity': 'warn', 'detail': f'{s}: dark outline round the subject'})
    else:
        flags.append({'code': 'noWallpaper', 'severity': 'warn', 'detail': 'no wallpaper: blended over the theme colour'})

    fixed = None
    if fix_dir and d['mode'] != 'transparent':
        stem = os.path.splitext(os.path.basename(piece.get('image') or piece['file']))[0]
        stem = stem.split('.')[0]  # drop the content hash: the pack build adds a new one
        dest = os.path.join(fix_dir, theme['id'], f'{stem}.png')
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        Image.fromarray(blended, 'RGBA').save(dest, optimize=True)
        fixed = dest

    # Remove duplicate flag codes per size: keep them (they name the size), but dedupe exact repeats.
    seen, uniq = set(), []
    for f in flags:
        k = (f['code'], f['detail'])
        if k not in seen:
            seen.add(k)
            uniq.append(f)
    return {
        'id': piece['id'], 'label': piece['label'], 'kind': piece['kind'], 'background': piece['background'],
        'px': [int(rgba.shape[1]), int(rgba.shape[0])],
        'stats': {k: (round(v, 4) if isinstance(v, float) else v) for k, v in stats.items()},
        'decision': {k: (round(v, 2) if isinstance(v, float) else v) for k, v in d.items()},
        'cells': cells, 'flags': uniq, 'fixed': fixed,
    }, renders


def sheet_for(theme, rows, out_dir):
    """One JPG per theme: per piece a RAW row and a BLENDED row, small / medium / large, rounded."""
    from PIL import ImageFont
    font = ImageFont.load_default()
    label_w, gap, pad = 150, 10, 10
    row_h = max(h for _, h in SIZES_PT.values())
    width = label_w + sum(w for w, _ in SIZES_PT.values()) + gap * 3 + pad
    height = 28 + len(rows) * (2 * row_h + 3 * gap)
    sheet = Image.new('RGB', (width, max(60, height)), (38, 38, 42))
    dr = ImageDraw.Draw(sheet)
    dr.text((pad, 8), f"{theme['name']} ({theme['id']}, {theme['source']}): top = raw art as shipped, bottom = T251 blended", fill=(235, 235, 235), font=font)
    y = 28
    for piece, renders in rows:
        dec = piece['decision']['mode']
        codes = sorted({f['code'] for f in piece['flags']})
        for k, label in enumerate(('raw', 'blended')):
            x = label_w
            dr.text((pad, y + 4), f"{piece['label'][:22]}", fill=(240, 240, 240), font=font)
            dr.text((pad, y + 18), f"{label} · {dec}", fill=(190, 190, 190), font=font)
            if k == 0 and codes:
                dr.text((pad, y + 32), ', '.join(codes)[:26], fill=(255, 170, 90), font=font)
            for s, (pw, ph) in SIZES_PT.items():
                if s in renders:
                    img = Image.fromarray(np.clip(renders[s][k], 0, 255).astype(np.uint8), 'RGB')
                    sheet.paste(img, (x, y), round_mask(pw, ph, CORNER_PT))
                x += pw + gap
            y += row_h + gap
        y += gap
    os.makedirs(out_dir, exist_ok=True)
    dest = os.path.join(out_dir, f"{theme['id']}.jpg")
    sheet.save(dest, quality=82, optimize=True)
    return dest


def report_md(results, errors, args):
    lines = ['# Widget art blend audit (T251, owner-1101h #2)', '',
             'Generated by `python3 scripts/packs/blend-audit.py` (Pillow + numpy; maths = `src/core/artBlend.ts`).',
             f"Remote packs: `{args.env}` release, read from a local cache. Contact sheets were written outside the repo"
             f" (`{args.out}`; bundle size guard); this report is the committed record.", '',
             '**Not device-tested.** The sheets model the phone with the same maths; a native build must confirm.', '',
             '## Decisions', '',
             '| Theme | Source | Piece | Edge ring (median rgb, spread, uniform) | Decision | Flags |',
             '| --- | --- | --- | --- | --- | --- |']
    for t in results:
        for p in t['pieces']:
            st = p['stats']
            flags = '; '.join(f"{f['code']}" for f in p['flags'] if f['severity'] != 'info') or 'ok'
            key = tuple(int(v) for v in st['key'])
            lines.append(f"| {t['id']} | {t['source']} | {p['id']} | rgb{key}, {st['spread']:.1f}, {st['uniformShare']:.2f} | {p['decision']['mode']} | {flags} |")
    lines += ['']
    rebuild = [(t, p) for t in results for p in t['pieces'] if p['decision']['mode'] != 'transparent']
    lines += ['## Needs the pack release rebuilt (owner chat)', '']
    if rebuild:
        by = {}
        for t, p in rebuild:
            by.setdefault(t['id'], []).append(f"{p['id']} ({p['decision']['mode']})")
        for tid, ps in by.items():
            lines.append(f"- **{tid}**: {', '.join(ps)}")
        lines += ['', 'Run `python3 scripts/packs/blend-audit.py --download --fix <dir>` and ship `<dir>/<theme>/<image>.png` (straight alpha) in place of'
                  ' the opaque widget images (the pack build re-encodes to WebP with alpha and re-hashes), with `"background": "wallpaper"`'
                  ' on each option. Until then a native build with T251 keys / feathers these on the phone at "Use on my widget".']
    else:
        lines.append('- nothing: every piece already has a transparent edge.')
    lines += ['', '## Flag key', '',
              '- `box`: opaque background behind the subject (info when it is within 28 rgb of the wallpaper under the widget, warn when farther: a visible box if drawn raw).',
              '- `frame`: the outer ring is flat and differs from the ring inside it (a drawn border).',
              '- `halo`: after blending, faint (alpha < 0.5) pixels covering > 0.4 % of the widget are > 40 luma off the wallpaper under them (a glow or fringe).',
              '- `outline`: a dark fringe round a bright subject.',
              '- `seam` (error): after blending, the widget edge does not match the wallpaper crop.', '']
    if errors:
        lines += ['## Errors', ''] + [f'- {e}' for e in errors] + ['']
    return '\n'.join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--cache', default=os.environ.get('GLAZE_PACK_CACHE', '/home/claude/contact-sheets/cache'))
    ap.add_argument('--env', default='production', choices=sorted(RELEASES))
    ap.add_argument('--download', action='store_true', help='fetch missing remote files (curl)')
    ap.add_argument('--out', default='/home/claude/contact-sheets', help='contact sheet folder (keep it outside the repo)')
    ap.add_argument('--only', default='', help='comma-separated theme ids')
    ap.add_argument('--fix', default='', help='write blended PNGs of opaque pieces here (for the pack build)')
    ap.add_argument('--report', default='', help='write the markdown report here')
    ap.add_argument('--json', default='', help='write the findings JSON here')
    ap.add_argument('--no-sheets', action='store_true')
    args = ap.parse_args()
    if os.path.abspath(args.out).startswith(ROOT + os.sep) and not args.no_sheets:
        print('refusing to write contact sheets inside the repo (bundle size guard); use --out outside it', file=sys.stderr)
        return 2
    only = {x for x in args.only.split(',') if x}
    themes = bundled_themes(only)
    remote, errors = remote_themes(args.cache, args.env, args.download, only)
    themes += remote
    results = []
    for t in themes:
        wall_img = Image.open(t['wallpaper']).convert('RGB') if t.get('wallpaper') else None
        crops = crops_for(*wall_img.size) if wall_img is not None else {}
        rows, pieces = [], []
        for p in t['pieces']:
            res, renders = audit_piece(t, p, wall_img, crops, args.fix)
            pieces.append(res)
            rows.append((res, renders))
        sheet = None if args.no_sheets else sheet_for(t, rows, args.out)
        results.append({'id': t['id'], 'name': t['name'], 'source': t['source'], 'sheet': sheet, 'pieces': pieces})
        modes = {}
        for p in pieces:
            modes[p['decision']['mode']] = modes.get(p['decision']['mode'], 0) + 1
        nflags = sum(1 for p in pieces for f in p['flags'] if f['severity'] in ('warn', 'error'))
        print(f"{t['id']:20s} {t['source']:8s} pieces={len(pieces):2d} {modes} warn/error flags={nflags}" + (f' sheet={sheet}' if sheet else ''))
    for e in errors:
        print('error:', e)
    print('packs without widget art:', ', '.join(no_art_packs()) or 'none')
    if args.json:
        with open(args.json, 'w') as f:
            json.dump({'task': 'T251', 'env': args.env, 'themes': results, 'errors': errors}, f, indent=1)
    if args.report:
        with open(args.report, 'w') as f:
            f.write(report_md(results, errors, args))
    return 0


if __name__ == '__main__':
    sys.exit(main())
