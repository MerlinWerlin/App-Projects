#!/usr/bin/env python3
"""Generator for src/core/templateArt/wildlife.ts (birds, insects, sea life, mammals and pets).

Run:  python3 scripts/templategen/wildlife.py && node scripts/export-templates.ts
Check: python3 scripts/preview-templates.py /tmp/wild-prev wild-

All art is original: hand-placed control points smoothed with Catmull-Rom -> cubic Bezier
conversion, plus procedural construction (spirals, Voronoi wing cells, hex lattices, feather
barbs, fur flow fields). Randomness uses fixed seeds so the output is deterministic.
Dev-time only: the app ships the static path strings this script writes.
"""
import json
import math
import pathlib
import random
import re

import numpy as np
from matplotlib.path import Path as MPath
from scipy.spatial import Voronoi

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / 'src' / 'core' / 'templateArt' / 'wildlife.ts'

# ---------------------------------------------------------------------------------------------
# formatting & curve primitives
# ---------------------------------------------------------------------------------------------


def fm(v):
    r = math.floor(v * 10 + 0.5) / 10
    if abs(r) < 0.05:
        return '0'
    s = f'{r:.1f}'
    return s[:-2] if s.endswith('.0') else s


def pt(p):
    return f'{fm(p[0])} {fm(p[1])}'


def _cr_segments(pts, closed, k):
    n = len(pts)
    segs = n if closed else n - 1
    out = []
    for i in range(segs):
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p0 = pts[(i - 1) % n] if (closed or i > 0) else p1
        p3 = pts[(i + 2) % n] if (closed or i + 2 < n) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) * k / 6, p1[1] + (p2[1] - p0[1]) * k / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) * k / 6, p2[1] - (p3[1] - p1[1]) * k / 6)
        out.append((p1, c1, c2, p2))
    return out


def cr(pts, closed=False, k=1.0, corners=()):
    """Smooth curve through points (Catmull-Rom as cubic Beziers).

    `corners` = indices where the curve may turn sharply (the curve is split there into
    separate smooth runs that share the corner point)."""
    pts = [tuple(map(float, p)) for p in pts]
    if len(pts) < 2:
        raise ValueError('cr needs 2 points')
    if len(pts) == 2:
        return f'M {pt(pts[0])} L {pt(pts[1])}' + (' Z' if closed else '')
    corners = sorted(set(c % len(pts) for c in corners))
    if not corners:
        segs = _cr_segments(pts, closed, k)
    else:
        n = len(pts)
        runs = []
        if closed:
            cs = corners
            for a, b in zip(cs, cs[1:] + [cs[0] + n]):
                runs.append([pts[i % n] for i in range(a, b + 1)])
        else:
            cs = [0] + [c for c in corners if 0 < c < n - 1] + [n - 1]
            for a, b in zip(cs, cs[1:]):
                runs.append(pts[a:b + 1])
        segs = []
        for run in runs:
            if len(run) == 2:
                a, b = run
                segs.append((a, a, b, b))
            else:
                segs.extend(_cr_segments(run, False, k))
    d = f'M {pt(segs[0][0])}'
    for _, c1, c2, p2 in segs:
        d += f' C {pt(c1)} {pt(c2)} {pt(p2)}'
    if closed:
        d += ' Z'
    return d


def cr_sample(pts, closed=False, k=1.0, n=10, corners=()):
    """Dense polyline of the same curve cr() draws."""
    pts = [tuple(map(float, p)) for p in pts]
    if len(pts) == 2:
        a, b = pts
        return [(a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n) for t in range(n + 1)]
    d = cr(pts, closed, k, corners)
    return sample_d(d, n)


def sample_d(d, n=10):
    """Sample an M/L/C/Z path into one polyline (first subpath only)."""
    toks = re.findall(r'[MLCZ]|-?\d*\.?\d+', d)
    out = []
    i = 0
    cur = None
    start = None
    cmd = None
    while i < len(toks):
        t = toks[i]
        if t in 'MLCZ':
            cmd = t
            i += 1
            if cmd == 'Z':
                if start is not None:
                    out.append(start)
                continue
            if cmd == 'M' and out:
                break
        if cmd == 'M':
            cur = (float(toks[i]), float(toks[i + 1]))
            start = cur
            out.append(cur)
            i += 2
        elif cmd == 'L':
            p = (float(toks[i]), float(toks[i + 1]))
            for s in range(1, n + 1):
                out.append((cur[0] + (p[0] - cur[0]) * s / n, cur[1] + (p[1] - cur[1]) * s / n))
            cur = p
            i += 2
        elif cmd == 'C':
            v = [float(x) for x in toks[i:i + 6]]
            c1, c2, p = (v[0], v[1]), (v[2], v[3]), (v[4], v[5])
            for s in range(1, n + 1):
                out.append(bez(cur, c1, c2, p, s / n))
            cur = p
            i += 6
    return out


def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    )


def bez_d(p0, p1, p2, p3):
    return f'M {pt(p0)} C {pt(p1)} {pt(p2)} {pt(p3)}'


def qd(p0, c, p1):
    return f'M {pt(p0)} Q {pt(c)} {pt(p1)}'


def ln(a, b):
    return f'M {pt(a)} L {pt(b)}'


def polyd(pts, closed=False):
    d = f'M {pt(pts[0])}' + ''.join(f' L {pt(p)}' for p in pts[1:])
    return d + (' Z' if closed else '')


def circle(cx, cy, r):
    return ellipse(cx, cy, r, r)


def ellipse(cx, cy, rx, ry, rot=0.0):
    """Ellipse with rotation rot (degrees, clockwise on screen)."""
    a = math.radians(rot)
    p1 = (cx - rx * math.cos(a), cy - rx * math.sin(a))
    p2 = (cx + rx * math.cos(a), cy + rx * math.sin(a))
    rr = fm(rot % 180)
    return (f'M {pt(p1)} A {fm(rx)} {fm(ry)} {rr} 1 0 {pt(p2)} '
            f'A {fm(rx)} {fm(ry)} {rr} 1 0 {pt(p1)} Z')


def ellipse_pts(cx, cy, rx, ry, rot=0.0, n=48):
    a = math.radians(rot)
    out = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x, y = rx * math.cos(t), ry * math.sin(t)
        out.append((cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)))
    return out


def arc_pts(cx, cy, r, a0, a1, n=24):
    """Points on a circle, angles in degrees (0 = +x, clockwise on screen since y is down)."""
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


# ---------------------------------------------------------------------------------------------
# point-list transforms & d-string transforms
# ---------------------------------------------------------------------------------------------


def tf(pts, fn):
    return [fn(p) for p in pts]


def mir(pts, ax=200.0):
    return [(2 * ax - x, y) for x, y in pts]


def rot_pts(pts, deg, c=(0.0, 0.0)):
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    return [(c[0] + (x - c[0]) * ca - (y - c[1]) * sa, c[1] + (x - c[0]) * sa + (y - c[1]) * ca) for x, y in pts]


def mv(pts, dx, dy):
    return [(x + dx, y + dy) for x, y in pts]


def sc(pts, s, c=(0.0, 0.0)):
    sx, sy = (s, s) if not isinstance(s, tuple) else s
    return [(c[0] + (x - c[0]) * sx, c[1] + (y - c[1]) * sy) for x, y in pts]


_ARGS = {'M': 2, 'L': 2, 'C': 6, 'Q': 4, 'A': 7, 'Z': 0}


def map_d(d, fn, scale=1.0, rot=0.0, flip=False):
    toks = re.findall(r'[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?', d)
    out = []
    i = 0
    cmd = ''
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t
            out.append(cmd)
            i += 1
            if cmd == 'Z':
                continue
        n = _ARGS[cmd]
        v = [float(x) for x in toks[i:i + n]]
        i += n
        if cmd == 'A':
            x, y = fn((v[5], v[6]))
            phi = ((-v[2] if flip else v[2]) + rot) % 180
            sweep = 1 - int(v[4]) if flip else int(v[4])
            out += [fm(v[0] * scale), fm(v[1] * scale), fm(phi), str(int(v[3])), str(sweep), fm(x), fm(y)]
        else:
            for k in range(0, n, 2):
                x, y = fn((v[k], v[k + 1]))
                out += [fm(x), fm(y)]
    return ' '.join(out)


def bbox_d(ds):
    xs, ys = [], []
    for d in ds:
        def rec(p):
            xs.append(p[0])
            ys.append(p[1])
            return p
        map_d(d, rec)
    return min(xs), min(ys), max(xs), max(ys)


def fit_canvas(paths, detail, margin=12.0, max_scale=1.6):
    """Uniformly scale and centre a drawing so its bounding box fills the canvas (minus margin)."""
    x0, y0, x1, y1 = bbox_d(paths + detail)
    s_ = min((400 - 2 * margin) / (x1 - x0), (400 - 2 * margin) / (y1 - y0), max_scale)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2

    def T(d):
        return map_d(d, lambda p: (200 + (p[0] - cx) * s_, 200 + (p[1] - cy) * s_), scale=s_)
    return [T(d) for d in paths], [T(d) for d in detail]


def mir_d(d, ax=200.0):
    return map_d(d, lambda p: (2 * ax - p[0], p[1]), flip=True)


def both(d, ax=200.0):
    """A d string plus its mirror image."""
    return d + ' ' + mir_d(d, ax)


def rot_d(d, deg, c):
    return map_d(d, lambda p: rot_pts([p], deg, c)[0], rot=deg)


def move_d(d, dx, dy):
    return map_d(d, lambda p: (p[0] + dx, p[1] + dy))


def scale_d(d, s, c=(200.0, 200.0)):
    return map_d(d, lambda p: (c[0] + (p[0] - c[0]) * s, c[1] + (p[1] - c[1]) * s), scale=s)


# ---------------------------------------------------------------------------------------------
# polyline geometry: resampling, clipping to regions, offsets
# ---------------------------------------------------------------------------------------------


def plen(pts):
    return sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))


def resample(pts, step):
    """Even spacing along a polyline (keeps both ends)."""
    if len(pts) < 2:
        return list(pts)
    cum = [0.0]
    for a, b in zip(pts, pts[1:]):
        cum.append(cum[-1] + math.dist(a, b))
    total = cum[-1]
    if total < 1e-9:
        return [pts[0]]
    n = max(1, round(total / step))
    out = []
    j = 0
    for i in range(n + 1):
        s = total * i / n
        while j < len(cum) - 2 and cum[j + 1] < s:
            j += 1
        seg = cum[j + 1] - cum[j]
        t = 0 if seg < 1e-9 else (s - cum[j]) / seg
        a, b = pts[j], pts[j + 1]
        out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out


def smooth(pts, step=10.0, closed=False):
    """Smooth d string through a dense polyline (resampled)."""
    if closed:
        r = resample(list(pts) + [pts[0]], step)[:-1]
        if len(r) < 3:
            return polyd(pts, True)
        return cr(r, closed=True)
    r = resample(pts, step)
    if len(r) < 2:
        return ''
    if len(r) == 2:
        return ln(r[0], r[1])
    return cr(r)


def rdp(pts, tol):
    """Ramer-Douglas-Peucker simplification."""
    if len(pts) < 3:
        return list(pts)
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    best, bi = -1.0, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        d = abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / L if L > 1e-9 else math.dist(p, a)
        if d > best:
            best, bi = d, i
    if best <= tol:
        return [a, b]
    return rdp(pts[:bi + 1], tol)[:-1] + rdp(pts[bi:], tol)


def qfit(run):
    """Single quadratic through the ends and the middle of a short run."""
    a, b = run[0], run[-1]
    m = run[len(run) // 2]
    c = (2 * m[0] - (a[0] + b[0]) / 2, 2 * m[1] - (a[1] + b[1]) / 2)
    return qd(a, c, b)


def fit(pts, tol=0.6, max_step=40.0):
    """Compact smooth d string for a dense polyline: simplify, then Catmull-Rom."""
    dense = resample(pts, 1.0) if plen(pts) > 2 else list(pts)
    r = rdp(dense, tol)
    out = [r[0]]
    for a, b in zip(r, r[1:]):
        n = max(1, math.ceil(math.dist(a, b) / max_step))
        for i in range(1, n + 1):
            out.append(lerp(a, b, i / n))
    if len(out) == 2:
        # keep a little curvature information for gentle arcs
        mid = dense[len(dense) // 2]
        if abs((out[1][0] - out[0][0]) * (mid[1] - out[0][1]) - (out[1][1] - out[0][1]) * (mid[0] - out[0][0])) > 1e-6:
            return cr([out[0], mid, out[1]]) if math.dist(out[0], mid) > 1 else ln(out[0], out[1])
        return ln(out[0], out[1])
    return cr(out)


class Region:
    """Union/difference of polygons for point-in-region tests."""

    def __init__(self, polys=(), holes=()):
        self.polys = [MPath(np.array(p)) for p in polys]
        self.holes = [MPath(np.array(p)) for p in holes]

    def contains(self, pts):
        pts = np.asarray(pts, dtype=float).reshape(-1, 2)
        inside = np.zeros(len(pts), dtype=bool)
        for p in self.polys:
            inside |= p.contains_points(pts)
        for h in self.holes:
            inside &= ~h.contains_points(pts)
        return inside

    def minus(self, *polys):
        r = Region()
        r.polys = list(self.polys)
        r.holes = list(self.holes) + [MPath(np.array(p)) for p in polys]
        return r


def clip(pts, region, inside=True, min_len=4.0, fine=1.0):
    """Split a polyline into the runs that lie inside (or outside) the region."""
    dense = resample(pts, fine) if plen(pts) > fine else list(pts)
    mask = region.contains(dense)
    if not inside:
        mask = ~mask
    runs = []
    cur = []
    for p, m in zip(dense, mask):
        if m:
            cur.append(p)
        elif cur:
            runs.append(cur)
            cur = []
    if cur:
        runs.append(cur)
    return [r for r in runs if len(r) > 1 and plen(r) >= min_len]


def clip_d(pts, region, inside=True, step=8.0, min_len=4.0):
    return ' '.join(smooth(r, step) for r in clip(pts, region, inside, min_len) if len(r) > 1)


def offset_closed(pts, dist):
    """Offset a closed polyline along its normals (positive = outward for CCW-on-screen?)."""
    n = len(pts)
    out = []
    area = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n))
    sgn = 1 if area > 0 else -1
    for i in range(n):
        a, b = pts[(i - 1) % n], pts[(i + 1) % n]
        tx, ty = b[0] - a[0], b[1] - a[1]
        L = math.hypot(tx, ty) or 1
        nx, ny = ty / L, -tx / L
        out.append((pts[i][0] + nx * dist * sgn, pts[i][1] + ny * dist * sgn))
    return out


def offset_open(pts, dist):
    out = []
    n = len(pts)
    for i in range(n):
        a, b = pts[max(0, i - 1)], pts[min(n - 1, i + 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]
        L = math.hypot(tx, ty) or 1
        out.append((pts[i][0] - ty / L * dist, pts[i][1] + tx / L * dist))
    return out


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def ccw_area(pts):
    n = len(pts)
    return 0.5 * sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n))


class Spine:
    """A centre curve with arc-length parameter u in [0, 1] and left normals; maps (u, v) -> point."""

    def __init__(self, ctrl, n=400, k=1.0):
        self.pts = resample(cr_sample(ctrl, False, k, 40), plen(cr_sample(ctrl, False, k, 40)) / n)
        self.n = len(self.pts) - 1

    def at(self, u):
        u = min(max(u, 0.0), 1.0) * self.n
        i = min(int(u), self.n - 1)
        t = u - i
        a, b = self.pts[i], self.pts[i + 1]
        p = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
        tang = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
        return p, tang, (tang[1], -tang[0])

    def map(self, u, v):
        p, _, nrm = self.at(u)
        return (p[0] + nrm[0] * v, p[1] + nrm[1] * v)

    def length(self):
        return plen(self.pts)


def voronoi_edges(seeds, region, min_len=2.0):
    """Voronoi cell edges of the seeds, clipped to region, as straight segments."""
    vor = Voronoi(np.array(seeds))
    segs = []
    for (a, b) in vor.ridge_vertices:
        if a < 0 or b < 0:
            continue
        p, q = tuple(vor.vertices[a]), tuple(vor.vertices[b])
        for run in clip([p, q], region, True, min_len, 0.5):
            segs.append((run[0], run[-1]))
    return segs


def poisson(region, bbox, r, rng, tries=30, max_pts=4000):
    """Simple dart-throwing Poisson-disc sampling inside a region."""
    x0, y0, x1, y1 = bbox
    pts = []
    attempts = 0
    while attempts < tries * 200 and len(pts) < max_pts:
        attempts += 1
        p = (rng.uniform(x0, x1), rng.uniform(y0, y1))
        if not region.contains([p])[0]:
            continue
        if all(math.dist(p, q) >= r for q in pts):
            pts.append(p)
            attempts = 0 if len(pts) % 20 == 0 else attempts
    return pts


# ---------------------------------------------------------------------------------------------
# templates (registered below)
# ---------------------------------------------------------------------------------------------

TEMPLATES = []


def study(**kw):
    """Like @template but not exported (work in progress kept for later)."""
    return lambda fn: fn


def template(**kw):
    def deco(fn):
        TEMPLATES.append((kw, fn))
        return fn
    return deco


# === TEMPLATES ===


def chunks(ds, n=12):
    """Join many short d strings into fewer path strings."""
    ds = [d for d in ds if d]
    return [' '.join(ds[i:i + n]) for i in range(0, len(ds), n)]


@template(id='wild-feather', name='Single feather', category='wildlife', level='intermediate',
          tags=['feather', 'bird', 'botanical', 'realistic', 'vintage', 'boho', 'journal'])
def feather():
    rng = random.Random(7)
    S = Spine([(96, 374), (136, 296), (196, 196), (258, 114), (318, 36)])
    u0 = 0.17
    WL, WR = 66.0, 48.0
    notches = {1: [(0.4, 0.3), (0.68, 0.26)], -1: [(0.55, 0.28)]}

    def w(u, side):
        if u <= u0:
            return 0.0
        t = min((u - u0) / (1 - u0), 1.0)
        g = math.sin(math.pi * t ** 0.85) ** 0.8
        for tn, depth in notches[side]:
            g *= 1 - depth * max(0.0, 1 - abs(t - tn) / 0.022) ** 1.5
        return (WL if side > 0 else WR) * g

    paths, detail = [], []
    # vane outline: shaft(u0) -> left edge -> tip -> right edge -> shaft(u0)
    us = [u0 + (1 - u0) * (i / 160) for i in range(161)]
    left = [S.map(u, w(u, 1)) for u in us]
    right = [S.map(u, -w(u, -1)) for u in reversed(us)]
    outline = left + right[1:]
    paths.append(smooth(outline, 6))
    paths.append(smooth([S.map(u / 100, 0) for u in range(0, 99)], 12))
    # barbs
    for side in (1, -1):
        ub = u0 + 0.008
        while ub < 0.975:
            t = (ub - u0) / (1 - u0)
            lag = 0.025 + 0.085 * math.sin(math.pi * min(t, 1) ** 0.8) ** 0.6
            ue = min(ub + lag, 0.995)
            we = w(ue, side)
            if we < 3:
                break
            a = S.map(ub, side * 2.2)
            c = S.map(ub + lag * 0.3, side * we * 0.62)
            e = S.map(ue, side * (we - 0.6))
            detail.append(qd(a, c, e))
            ub += (6.2 + 1.2 * rng.random()) / S.length() * (0.95 + 0.6 * min(t, 1) ** 2)
    # downy afterfeather near the base
    for side in (1, -1):
        for i in range(8):
            u = 0.06 + i * 0.016 + rng.uniform(-0.003, 0.003)
            p, tang, nrm = S.at(u)
            L = 22 + 20 * math.sin(math.pi * (i + 1) / 9) + rng.uniform(-4, 4)
            ang = math.radians(rng.uniform(25, 45))
            dx = nrm[0] * side * math.cos(ang) + tang[0] * math.sin(ang)
            dy = nrm[1] * side * math.cos(ang) + tang[1] * math.sin(ang)
            pts = [(p[0] + nrm[0] * side * 2, p[1] + nrm[1] * side * 2)]
            for j in range(1, 5):
                s = L * j / 4
                wig = math.sin(j * 1.7 + i) * 2.2
                pts.append((p[0] + dx * s - dy * wig * side, p[1] + dy * s + dx * wig * side))
            end = pts[-1]
            pts.append((end[0] + tang[0] * 5 + nrm[0] * side * 2, end[1] + tang[1] * 5 + nrm[1] * side * 2))
            detail.append(cr(pts))
    return paths, chunks(detail)


@template(id='wild-nautilus', name='Chambered nautilus', category='wildlife', level='intermediate',
          tags=['nautilus', 'shell', 'sea', 'ocean', 'spiral', 'geometric', 'vintage', 'realistic'])
def nautilus():
    b = 0.18
    a = 1.0
    th_max = math.log(170) / b

    def r(th):
        return a * math.exp(b * th)

    def P(th, f=1.0):
        rr = r(th) * f
        return (rr * math.cos(th), rr * math.sin(th))

    th0 = math.log(3) / b
    raw = [P(th0 + (th_max - th0) * i / 900) for i in range(901)]
    xs = [p[0] for p in raw]
    ys = [p[1] for p in raw]
    s = 335 / max(max(xs) - min(xs), max(ys) - min(ys))
    ox = 200 - s * (max(xs) + min(xs)) / 2
    oy = 200 - s * (max(ys) + min(ys)) / 2
    rot = math.radians(0)

    def X(p):
        x, y = p
        x, y = x * math.cos(rot) - y * math.sin(rot), x * math.sin(rot) + y * math.cos(rot)
        return (ox + s * x, oy + s * y)

    paths, detail = [], []
    spiral_pts = [X(p) for p in raw]
    outer = spiral_pts
    def PP(th, rho):
        return X((rho * math.cos(th), rho * math.sin(th)))

    def septum(th, k, n=16, f_out=1.0):
        r_in, r_out = r(th - 2 * math.pi), r(th) * f_out
        return [PP(th - k * math.sin(math.pi * f), r_in + (r_out - r_in) * f) for f in (i / n for i in range(n + 1))]

    paths.append(smooth(outer, 7))
    # aperture lip, bowing slightly forward
    paths.append(cr(septum(th_max, -0.12, 8)))
    # shell wall thickness on the outer whorl
    wall = [X(P(th_max - 0.02 - 2 * math.pi * i / 300, 0.955)) for i in range(300)]
    detail.append(smooth(wall, 7))
    # septa (nested crescents, concave toward the aperture)
    step = 2 * math.pi / 15
    th = th_max - 1.3
    first = th
    while r(th - 2 * math.pi) * s > 2.6:
        f_out = 0.955 if th > th_max - 2 * math.pi else 1.0
        sp = septum(th, 0.3, 24, f_out)
        detail.append(smooth(sp, max(2.5, plen(sp) / 5)))
        last = th
        th -= step
    # siphuncle threading the chambers
    sip = []
    t = last
    while t <= first + 1e-6:
        r_in, r_out = r(t - 2 * math.pi), r(t)
        sip.append(PP(t - 0.3 * math.sin(math.pi * 0.32), r_in + (r_out - r_in) * 0.32))
        t += 0.05
    detail.append(smooth(sip, 6))
    return paths, detail


def wing_net(outline_local, base, angle, veins, rng, cell=9.0, stigma=None):
    """Insect wing in local coords (base at 0,0, wing along +x, leading edge at negative y).

    veins: list of (fraction across the chord, x_start, x_end) longitudinal veins; cross veins are
    laddered between neighbouring veins; the rear field gets Voronoi cells. Returns (outline_d, detail).
    """
    dense = cr_sample(outline_local, True, n=12)
    xs = np.array([p[0] for p in dense])
    tip = max(xs)
    reg = Region([dense])

    def edge(x, lead=True):
        # intersect vertical line with the outline: min y (lead) or max y (trail)
        ys = []
        for a, b in zip(dense, dense[1:] + dense[:1]):
            if (a[0] - x) * (b[0] - x) <= 0 and a[0] != b[0]:
                t = (x - a[0]) / (b[0] - a[0])
                ys.append(a[1] + (b[1] - a[1]) * t)
        if not ys:
            return 0.0
        return min(ys) if lead else max(ys)

    def vein_pt(fr, x):
        y0, y1 = edge(x, True), edge(x, False)
        return (x, y0 + (y1 - y0) * fr)

    lines = []
    vpts = []
    for fr, xa, xb in veins:
        pts = [vein_pt(fr, xa + (xb - xa) * i / 40) for i in range(41)]
        # veins converge to the leading edge near the tip
        vpts.append((fr, xa, xb, pts))
        lines.append(pts)
    # cross veins between consecutive veins (and between costa and first vein)
    rungs = []
    fracs = [(0.0, 4, tip - 4)] + [(fr, xa, xb) for fr, xa, xb in veins]
    for (f1, a1, b1), (f2, a2, b2) in zip(fracs, fracs[1:]):
        x0, x1 = max(a1, a2) + 3, min(b1, b2) - 2
        x = x0
        while x < x1:
            p1, p2 = vein_pt(f1, x), vein_pt(f2, x + 1.5)
            if math.dist(p1, p2) > 2.5:
                rungs.append((p1, p2))
            x += cell * (0.8 + 0.4 * rng.random())
    # Voronoi field behind the last vein
    flast, xa, xb = veins[-1]
    rear = [vein_pt(flast, xa + (xb - xa) * i / 30) for i in range(31)]
    trail = [(x, edge(x, False)) for x in np.linspace(xb, xa, 30)]
    rear_poly = rear + trail
    rreg = Region([rear_poly])
    seeds = poisson(rreg, (min(p[0] for p in rear_poly), min(p[1] for p in rear_poly),
                           max(p[0] for p in rear_poly), max(p[1] for p in rear_poly)), cell, rng)
    # ghost seeds keep the cells bounded
    ghosts = [(x, y) for x in np.arange(-20, tip + 30, cell * 2) for y in (-80, 80)]
    vsegs = voronoi_edges(seeds + ghosts, rreg, 1.5) if len(seeds) > 3 else []
    if stigma:
        x0, x1 = stigma
        st = [vein_pt(0.0, x0), vein_pt(0.0, x1), vein_pt(veins[0][0], x1 - 2), vein_pt(veins[0][0], x0 - 2)]
    def to_world(p):
        a = math.radians(angle)
        return (base[0] + p[0] * math.cos(a) - p[1] * math.sin(a), base[1] + p[0] * math.sin(a) + p[1] * math.cos(a))
    out_d = cr([to_world(p) for p in outline_local], True)
    det = [smooth([to_world(p) for p in pts], 10) for pts in lines]
    det += [ln(to_world(a), to_world(b)) for a, b in rungs]
    det += [ln(to_world(a), to_world(b)) for a, b in vsegs]
    if stigma:
        det.append(polyd([to_world(p) for p in st], True))
    return out_d, det


@template(id='wild-dragonfly', name='Dragonfly', category='wildlife', level='intermediate',
          tags=['dragonfly', 'insect', 'garden', 'summer', 'realistic', 'botanical', 'geometric'],
          detailWidth=1.5)
def dragonfly():
    rng = random.Random(11)
    paths, detail = [], []
    fore = [(0, -3), (25, -10), (80, -15), (135, -17), (165, -13), (178, -5), (176, 4), (160, 11),
            (115, 14), (60, 13), (25, 9), (4, 5)]
    hind = [(0, -3), (28, -10), (85, -14), (135, -15), (160, -10), (170, -2), (165, 7), (140, 14),
            (95, 19), (55, 26), (28, 25), (10, 15), (2, 6)]
    vf = [(0.22, 6, 172), (0.45, 8, 170), (0.66, 12, 166)]
    vh = [(0.2, 6, 165), (0.4, 8, 162), (0.6, 12, 155)]
    for side in (1, -1):
        for outline, base, ang, veins, stig in ((fore, (212, 112), -9, vf, (150, 160)),
                                               (hind, (211, 134), 11, vh, (140, 149))):
            o, d = wing_net(outline, base, ang, veins, rng, 9.0, stig)
            if side < 0:
                o = mir_d(o)
                d = [mir_d(x) for x in d]
            paths.append(o)
            detail += d
    # head: two large compound eyes meeting on the midline, frons below
    paths.append(ellipse(185.5, 68, 14.5, 13.5, -12))
    paths.append(ellipse(214.5, 68, 14.5, 13.5, 12))
    detail.append(cr([(192, 83), (200, 87), (208, 83)]))
    # thorax
    thor = [(200, 88), (210, 92), (215, 112), (213, 138), (206, 152), (200, 154), (194, 152), (187, 138),
            (185, 112), (190, 92)]
    paths.append(cr(thor, True))
    detail.append(both(cr([(194, 98), (191, 118), (194, 142)])))
    # abdomen: tapering segmented tube
    sp = Spine([(200, 154), (200, 230), (201, 300), (203, 366)])

    def wdt(u):
        return 4.2 + 2.6 * math.sin(math.pi * min(u / 0.16, 1) / 2) - 3.4 * u

    left = [sp.map(i / 60, wdt(i / 60)) for i in range(61)]
    right = [sp.map(i / 60, -wdt(i / 60)) for i in range(61)]
    end = sp.map(1.0, 0)
    tipp = sp.at(1.0)
    paths.append(cr(left + [(end[0] + tipp[1][0] * 4, end[1] + tipp[1][1] * 4)] + right[::-1], True))
    for i in range(1, 10):
        u = i / 10
        a, b = sp.map(u, wdt(u)), sp.map(u, -wdt(u))
        m = sp.map(u + 0.01, 0)
        detail.append(cr([a, m, b]))
    return paths, chunks(detail, 20)
    return paths, detail


def scallops(anchors, bulge, closed=False):
    """Points for a scalloped edge through anchors: each span bulges outward (to the left of travel
    when bulge > 0). Returns (points, corner indices)."""
    pts, corners = [], []
    for a, b in zip(anchors, anchors[1:]):
        corners.append(len(pts))
        pts.append(a)
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = dy / L, -dx / L
        for t, h in ((0.3, 0.8), (0.5, 1.0), (0.7, 0.8)):
            pts.append((a[0] + dx * t + nx * bulge * h, a[1] + dy * t + ny * bulge * h))
    corners.append(len(pts))
    pts.append(anchors[-1])
    return pts, corners


def scallop_d(anchors, bulge):
    """Scalloped run as one path of quadratic arcs bulging to the left of travel."""
    d = f'M {pt(anchors[0])}'
    for a, b in zip(anchors, anchors[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1
        m = lerp(a, b, 0.5)
        c = (m[0] + dy / L * bulge * 2, m[1] - dx / L * bulge * 2)
        d += f' Q {pt(c)} {pt(b)}'
    return d


def toward(a, b, dist):
    """Point at distance dist from b back toward a."""
    L = math.dist(a, b) or 1
    return (b[0] + (a[0] - b[0]) * dist / L, b[1] + (a[1] - b[1]) * dist / L)


def vein(a, b, bow=0.06):
    m = lerp(a, b, 0.5)
    dx, dy = b[0] - a[0], b[1] - a[1]
    return qd(a, (m[0] - dy * bow, m[1] + dx * bow), b)


def butterfly_body(paths, detail, head_y, thorax, abdomen_end, ant_tip, club=True):
    """Head, thorax, segmented abdomen and antennae on the x = 200 axis."""
    paths.append(circle(200, head_y, 7.5))
    t0, t1 = thorax
    paths.append(cr([(200, t0), (209, t0 + 8), (210, (t0 + t1) / 2), (206, t1 - 4), (200, t1), (194, t1 - 4),
                     (190, (t0 + t1) / 2), (191, t0 + 8)], True))
    sp = Spine([(200, t1), (200.5, (t1 + abdomen_end) / 2), (201, abdomen_end)])

    def w(u):
        return 6.2 * math.sin(math.pi * (0.12 + 0.88 * u) ** 0.8) ** 0.5 if u < 0.999 else 0

    left = [sp.map(i / 30, w(i / 30)) for i in range(31)]
    right = [sp.map(i / 30, -w(i / 30)) for i in range(30, -1, -1)]
    paths.append(cr(left + right[1:-1], True))
    for i in range(1, 7):
        u = i / 7.5
        detail.append(cr([sp.map(u, w(u) - 0.5), sp.map(u + 0.025, 0), sp.map(u, -w(u) + 0.5)]))
    for side in (1, -1):
        tip = ant_tip if side > 0 else (400 - ant_tip[0], ant_tip[1])
        base = (200 + 3 * side, head_y - 6)
        mid = (base[0] + (tip[0] - base[0]) * 0.45 + 6 * side, base[1] + (tip[1] - base[1]) * 0.55)
        paths.append(qd(base, mid, tip))
        if club:
            d = (tip[0] - mid[0], tip[1] - mid[1])
            ang = math.degrees(math.atan2(d[1], d[0]))
            paths.append(ellipse(tip[0] + d[0] * 0.04, tip[1] + d[1] * 0.04, 5, 2.8, ang))


@template(id='wild-swallowtail', name='Swallowtail butterfly', category='wildlife', level='intermediate',
          tags=['butterfly', 'insect', 'garden', 'summer', 'botanical', 'realistic', 'spring'])
def swallowtail():
    paths, detail = [], []
    wing_paths, wing_detail = [], []
    # ---- forewing (right side) ----
    fm_anchors = [(357, 63), (356, 84), (350, 106), (343, 128), (336, 148), (328, 168), (320, 187)]
    marg, corners = scallops(fm_anchors, 1.6)
    fore = [(207, 166), (226, 138), (262, 106), (302, 80), (338, 64)] + marg + \
           [(290, 191), (252, 187), (224, 181)]
    fc = [0] + [c + 5 for c in corners] + [len(fore) - 1]
    wing_paths.append(cr(fore, True, corners=(0, 5, 5 + len(marg) - 1)))
    cell = [(213, 172), (242, 159), (272, 140), (290, 128), (296, 139), (293, 151), (264, 166), (234, 175)]
    wing_detail.append(cr(cell, True, corners=(3, 5)))
    fveins = [((252, 152), (300, 81)), ((266, 144), (322, 72)), ((280, 135), (343, 65)),
              ((290, 128), fm_anchors[0]), ((294, 134), fm_anchors[1]), ((296, 142), fm_anchors[2]),
              ((294, 150), fm_anchors[3]), ((280, 158), fm_anchors[4]), ((262, 166), fm_anchors[5]),
              ((238, 174), fm_anchors[6]), ((212, 177), (296, 190))]
    for a, b in fveins:
        wing_detail.append(vein(a, b, 0.04))
    # forewing tiger bars from costa toward the inner margin
    freg = Region([cr_sample(fore, True, n=8, corners=(0, 5, 5 + len(marg) - 1))])
    # bars across the cell
    for t in (0.35, 0.62):
        a = bez((213, 172), (242, 159), (272, 140), (290, 128), t)
        b = bez((234, 175), (264, 166), (293, 151), (296, 139), t)
        wing_detail.append(vein(a, b, 0.05))
    # submarginal band and marginal spots
    fcent = (282, 142)
    band = [toward(fcent, m, 15) for m in fm_anchors]
    wing_detail.append(cr(band))
    band2 = [toward(fcent, m, 26) for m in fm_anchors]
    wing_detail.append(cr(band2))
    for a, b in zip(fm_anchors, fm_anchors[1:]):
        m = lerp(a, b, 0.5)
        c = toward(fcent, m, 8)
        ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        wing_detail.append(ellipse(c[0], c[1], 5.5, 2.6, ang))
    # ---- hindwing (right side) ----
    h_anchors = [(318, 210), (326, 232), (322, 256), (310, 276), (296, 292), (288, 301)]
    hm, hc = scallops(h_anchors, 4.0)
    tail = [(291, 322), (290, 343), (283, 351), (276, 345), (274, 322), (271, 305)]
    h2 = [(271, 305), (256, 301), (240, 293)]
    hm2, hc2 = scallops(h2, 3.0)
    hind = [(207, 184), (236, 187), (272, 192), (302, 199)] + hm + tail[:-1] + hm2 + \
           [(225, 281), (214, 258), (208, 230), (206, 205)]
    i_tail0 = 4 + len(hm) - 1
    i_m2 = i_tail0 + len(tail) - 0
    corners_h = [0] + [4 + c for c in hc] + [i_m2 - 1 + c for c in hc2]
    wing_paths.append(cr(hind, True, corners=corners_h))
    hcell = [(214, 196), (250, 200), (272, 213), (277, 230), (267, 244), (240, 237), (220, 223)]
    wing_detail.append(cr(hcell, True, corners=(3, 4)))
    hveins = [((248, 200), (302, 199)), ((271, 211), h_anchors[0]), ((276, 224), h_anchors[1]),
              ((275, 236), h_anchors[2]), ((267, 244), h_anchors[3]), ((254, 241), h_anchors[4]),
              ((240, 237), (282, 340)), ((224, 226), (256, 301)), ((210, 214), (240, 293))]
    for a, b in hveins:
        wing_detail.append(vein(a, b, -0.05))
    hcent = (262, 228)
    hb = [toward(hcent, m, 16) for m in h_anchors]
    wing_detail.append(cr(hb))
    for a, b in zip(h_anchors, h_anchors[1:]):
        m = lerp(a, b, 0.5)
        c = toward(hcent, m, 9)
        ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        d = cr([toward(hcent, lerp(a, b, 0.2), 10), toward(hcent, m, 5.5), toward(hcent, lerp(a, b, 0.8), 10),
                toward(hcent, m, 11), toward(hcent, lerp(a, b, 0.2), 10)])
        wing_detail.append(d)
    # eyespot at the inner corner
    wing_detail.append(circle(236, 280, 7.5))
    wing_detail.append(circle(236, 280, 3.5))
    for d in wing_paths:
        paths.append(both(d))
    for d in wing_detail:
        detail.append(both(d))
    butterfly_body(paths, detail, 152, (160, 198), 286, (232, 86))
    return paths, detail


def feather_antenna(base, ctrl, tip, width, n=14):
    """Bipectinate (feathery) antenna: leaf-shaped outline (main) + barbs (detail)."""
    sh = [bez(base, lerp(base, ctrl, 0.66), lerp(tip, ctrl, 0.66), tip, i / 40) for i in range(41)]
    S = Spine(sh, 120)
    out_l, out_r, barbs = [], [], []
    for i in range(0, 41):
        u = i / 40
        wv = width * math.sin(math.pi * min(1, u * 1.15)) ** 0.7 if u > 0.04 else 0.0
        out_l.append(S.map(min(u + 0.06, 1), wv))
        out_r.append(S.map(min(u + 0.06, 1), -wv))
    for i in range(1, n):
        u = i / n
        for sgn in (1, -1):
            wv = width * math.sin(math.pi * min(1, (u + 0.06) * 1.15)) ** 0.7
            barbs.append(ln(S.map(u, 0), S.map(min(u + 0.06, 1), sgn * (wv - 0.8))))
    outline = cr(resample(out_l, 5) + resample(out_r[::-1], 5)[1:-1], True)
    return outline, ' '.join(barbs), ' '.join([smooth(sh, 10)])


def fuzzy_outline(left_pts, bump=2.2, step=7.0):
    """Hairy body edge: a scalloped run along a polyline."""
    r = resample(left_pts, step)
    pts, corners = scallops(r, bump)
    return pts, corners


@template(id='wild-luna-moth', name='Luna moth', category='wildlife', level='intermediate',
          tags=['moth', 'insect', 'night', 'celestial', 'gothic', 'vintage', 'boho', 'botanical'])
def luna_moth():
    paths, detail = [], []
    wp, wd = [], []
    fore = [(207, 150), (228, 124), (262, 98), (300, 76), (333, 60), (347, 55), (352, 62), (346, 84),
            (338, 114), (330, 146), (321, 174), (307, 194), (272, 197), (240, 187), (216, 170)]
    wp.append(cr(fore, True, corners=(0,)))
    # thick leading edge (costal band)
    costa_in = [(214, 150), (232, 130), (264, 106), (300, 85), (333, 69), (344, 64)]
    wd.append(cr(costa_in))
    # submarginal line
    fm = [(345, 70), (339, 96), (332, 125), (324, 153), (314, 177), (300, 188)]
    wd.append(cr(fm))
    # eyespot
    wd.append(ellipse(286, 140, 15, 11, -30))
    wd.append(cr([(276, 142), (281, 133), (292, 129)]))
    wd.append(ellipse(287, 141, 7, 5, -30))
    for a, b in (((292, 131), (335, 88)), ((296, 140), (330, 128)), ((294, 149), (322, 160)),
                 ((283, 151), (306, 186)), ((276, 133), (300, 92)), ((275, 143), (230, 165))):
        wd.append(vein(a, b, 0.05))
    hind = [(207, 172), (240, 178), (280, 186), (310, 198), (321, 220), (317, 245), (302, 264), (287, 278),
            (279, 298), (279, 322), (286, 346), (299, 366), (296, 380), (283, 381), (268, 368), (256, 346),
            (248, 318), (243, 292), (232, 268), (217, 244), (208, 212)]
    wp.append(cr(hind, True, corners=(0,)))
    hm = [(310, 210), (311, 232), (300, 252), (284, 268), (273, 290), (271, 318), (276, 342), (288, 364)]
    wd.append(cr(hm))
    wd.append(ellipse(262, 230, 15, 11, 20))
    wd.append(cr([(252, 228), (258, 220), (270, 220)]))
    wd.append(ellipse(263, 231, 7, 5, 20))
    for a, b in (((272, 226), (310, 208)), ((272, 236), (305, 252)), ((265, 240), (280, 275)),
                 ((256, 238), (262, 330)), ((252, 230), (220, 236))):
        wd.append(vein(a, b, -0.05))
    for d in wp:
        paths.append(both(d))
    for d in wd:
        detail.append(both(d))
    # fuzzy body
    paths.append(circle(200, 140, 8))
    paths.append(cr([(200, 148), (209, 154), (213, 172), (209, 191), (200, 198), (191, 191), (187, 172),
                     (191, 154)], True))
    for y in (160, 172, 184):
        detail.append(both(cr([(203, y - 3), (207, y), (209, y + 4)])))
    al, ac = fuzzy_outline([(204, 198), (209, 214), (209, 240), (206, 262), (200, 276)], 1.6, 7)
    ab = al + mir(al[::-1])[1:]
    paths.append(cr(ab, True, corners=list(ac) + [len(al) - 1 + c for c in ac]))
    for y in (214, 228, 242, 256):
        detail.append(cr([(193, y), (200, y + 3), (207, y)]))
    # feathery antennae
    for side in (1, -1):
        o, b, sh = feather_antenna((200 + 4 * side, 133), (200 + 16 * side, 100), (200 + 54 * side, 70), 10, 16)
        paths.append(o)
        detail.append(b + ' ' + sh)
    return paths, detail


def egg(cx, cy, rx, ry, taper=0.12, n=72):
    """Egg / ovoid outline, narrower at the bottom (screen y down)."""
    return [(cx + rx * math.cos(t) * (1 - taper * math.sin(t)), cy + ry * math.sin(t))
            for t in (2 * math.pi * i / n for i in range(n))]


@template(id='wild-peacock-feather', name='Peacock feather', category='wildlife', level='advanced',
          tags=['peacock', 'feather', 'bird', 'ornamental', 'boho', 'vintage', 'realistic', 'gift'],
          detailWidth=1.3, coarse=True)
def peacock_feather():
    rng = random.Random(23)
    paths, detail = [], []
    c = (198.0, 122.0)
    R1 = egg(c[0], c[1], 50, 64, 0.14)
    R2 = egg(c[0], c[1] + 7, 37, 49, 0.16)
    R3 = egg(c[0], c[1] + 13, 26, 36, 0.18)
    core = [(198, 108), (207, 110), (213, 120), (214, 134), (209, 147), (202, 153), (198, 149),
            (194, 153), (187, 147), (182, 134), (183, 120), (189, 110)]
    core = mv(core, 0, 2)
    for ring in (R1, R2):
        paths.append(cr(resample(ring + [ring[0]], 9)[:-1], True))
    detail.append(cr(resample(R3 + [R3[0]], 9)[:-1], True))
    core = egg(c[0], c[1] + 18, 15, 22, 0.1, 36)
    paths.append(cr(resample(core + [core[0]], 7)[:-1], True))
    # rachis: from the quill up into the bottom of the eye
    rach = [(207, 396), (205, 330), (201, 250), (198, 190)]
    rs = cr_sample(rach, n=20)
    paths.append(smooth(rs, 14))

    def rx_at(y):
        # x of the (virtual) rachis at height y
        if y >= 190:
            best = min(rs, key=lambda p: abs(p[1] - y))
            return best[0]
        return 198.0

    # envelope: an upward flame / teardrop around the eye, narrowing toward the quill
    def half_w(y):
        if y < 8:
            return 0
        if y < 150:
            t = (150 - y) / 142
            return 108 * (1 - t ** 2.2) ** 0.55
        t = (y - 150) / 235
        return 108 * (1 - t ** 1.3) + 34 * t

    env = [(198 + half_w(y), y) for y in np.linspace(8, 385, 120)]
    env = env + [(198 - half_w(y), y) for y in np.linspace(385, 8, 120)]
    envR = Region([env])
    eye = Region([R1])
    band12 = Region([R1]).minus(R2)
    band3 = Region([R3]).minus(offset_closed(core, 3) if ccw_area(core) > 0 else offset_closed(core, -3))

    def barb(o, side, y0, wave):
        pts = []
        wisp = max(0.0, (y0 - 230) / 150)
        dmax = 92 + rng.uniform(-8, 8)
        for i in range(80):
            d = i * 2.0
            if d > dmax:
                break
            y = o[1] - (0.08 * d + 0.0105 * d * d)
            x = o[0] + side * d
            y += wisp * 3.0 * math.sin(d / 13 + wave) * min(1, d / 30)
            pts.append((x, y))
        return pts

    y0 = 12.0
    out_runs, in_runs = [], []
    while y0 < 384:
        for side in (1, -1):
            if y0 > 250 and rng.random() < 0.22:
                continue  # gaps between the loose lower barbs
            o = (rx_at(y0) + side * 2.5, y0)
            pts = barb(o, side, y0, rng.uniform(0, 6.28))
            pts = [p for p in pts if 3 < p[0] < 397 and 3 < p[1] < 397]
            if len(pts) < 2:
                continue
            for run in clip(pts, envR, True, 6):
                if y0 > 240:
                    run = run[:max(2, int(len(run) * rng.uniform(0.7, 1.0)))]
                for r2 in clip(run, eye, False, 6):
                    out_runs.append(r2)
                for r2 in clip(run, band12, True, 3):
                    in_runs.append(r2)
                for r2 in clip(run, band3, True, 2.5):
                    in_runs.append(r2)
        y0 += 6.0 if y0 < 250 else 7.0
    for r in out_runs:
        detail.append(fit(r, 0.5))
    for r in in_runs:
        detail.append(fit(r, 0.5))
    return paths, chunks(detail, 24)


def fin_rays(outline_pts, root, n, inset=0.88, start=0.08, end=0.92):
    """Rays from a root point to the far edge of a fin outline (points list, open far edge)."""
    out = []
    for i in range(n):
        t = start + (end - start) * i / max(1, n - 1)
        q = outline_pts[int(t * (len(outline_pts) - 1))]
        out.append(cr([lerp(root, q, 0.08), lerp(lerp(root, q, 0.5), q, 0.05), lerp(root, q, inset)]))
    return out


@template(id='wild-koi', name='Koi fish', category='wildlife', level='intermediate',
          tags=['koi', 'fish', 'water', 'pond', 'japanese', 'stylized', 'ornamental', 'luck'])
def koi():
    rng = random.Random(5)
    paths, detail = [], []
    S = Spine([(100, 36), (116, 100), (160, 162), (220, 204), (262, 244)])
    L = S.length()

    def w(u):
        if u < 0.15:
            return 46 * math.sin(math.pi / 2 * u / 0.15) ** 0.85 + 0.5
        if u < 0.32:
            return 46.5 + 3.5 * math.sin(math.pi * (u - 0.15) / 0.34)
        t = (u - 0.32) / 0.68
        return 50 * (1 - t) ** 1.25 * (1 - 0.15 * t) + 9 * t

    us = [i / 120 for i in range(121)]
    left = [S.map(u, w(u)) for u in us]
    right = [S.map(u, -w(u)) for u in us]
    body = left[::-1][:-1] + right
    body_closed = left + right[::-1]
    paths.append(cr(resample(left[::-1] + right[1:], 7)))
    body_reg = Region([body_closed])
    # caudal fin: two flowing lobes from the peduncle, sweeping to one side
    p_end, tang, nrm = S.at(1.0)
    def T(a, b):
        return (p_end[0] + tang[0] * a + nrm[0] * b, p_end[1] + tang[1] * a + nrm[1] * b)
    tail = [T(0, 9), T(14, 22), T(40, 44), T(70, 56), T(92, 50), T(88, 34), T(70, 20), T(60, 6), T(66, -12),
            T(82, -30), T(96, -48), T(86, -58), T(58, -46), T(32, -30), T(12, -18), T(0, -9)]
    paths.append(cr(tail))
    tail_far = cr_sample(tail[3:13], n=10)
    detail += fin_rays(tail_far, T(-2, 0), 15, 0.9)
    # pectoral fins
    for side in (1, -1):
        a = S.map(0.25, side * 44)
        b = S.map(0.33, side * 46)
        p0, tg, nm = S.at(0.29)
        def F(x, y):
            return (a[0] + tg[0] * x + nm[0] * side * y, a[1] + tg[1] * x + nm[1] * side * y)
        fin = [F(-10, -2), F(-6, 14), F(4, 34), F(24, 52), F(52, 60), F(74, 52), F(74, 32), F(56, 14), F(34, 2),
               F(22, -3)]
        paths.append(cr(fin))
        detail += fin_rays(cr_sample(fin[2:8], n=12), F(6, -1), 8, 0.86)
        # pelvic fins
        c0 = S.map(0.6, side * w(0.6))
        p1, tg2, nm2 = S.at(0.6)
        def G(x, y):
            return (c0[0] + tg2[0] * x + nm2[0] * side * y, c0[1] + tg2[1] * x + nm2[1] * side * y)
        pf = [G(-4, -1), G(4, 12), G(18, 26), G(36, 30), G(36, 18), G(24, 6), G(14, -1)]
        paths.append(cr(pf))
        detail += fin_rays(cr_sample(pf[1:5], n=10), G(0, 0), 4, 0.8)
    # head: gill covers, eyes, nostrils, barbels
    gill = [S.map(0.205, v) for v in np.linspace(-44, 44, 17)]
    gill = [S.map(0.2 - 0.035 * (1 - (v / 45) ** 2), v) for v in np.linspace(-45, 45, 19)]
    paths.append(cr(resample(gill, 9)))
    for side in (1, -1):
        e = S.map(0.075, side * 31)
        paths.append(circle(e[0], e[1], 5.5))
        detail.append(circle(e[0], e[1], 2))
        n0 = S.map(0.03, side * 14)
        detail.append(ellipse(n0[0], n0[1], 3, 2, 0))
        p0, tg0, nm0 = S.at(0.0)
        def H(x, y):
            return (p0[0] + tg0[0] * x + nm0[0] * side * y, p0[1] + tg0[1] * x + nm0[1] * side * y)
        paths.append(cr([H(4, 7), H(-2, 11), H(-2, 19), H(5, 23)]))
    # scales: arcs on a (u, v) grid, facing the tail
    du = 11.5 / L
    row = 0
    u = 0.215
    while u < 0.98:
        half = w(u)
        nv = max(1, int(2 * half / 12))
        dv = 2 * half / nv
        off = 0.5 * dv if row % 2 else 0.0
        v = -half + off
        while v <= half + 0.1:
            pts = []
            rr = dv * 0.55
            for k in range(13):
                ang = math.pi * k / 12
                pts.append(S.map(u + (rr * math.sin(ang)) / L, v + rr * math.cos(ang)))
            for run in clip(pts, body_reg, True, 3, 0.5):
                detail.append(fit(run, 0.6))
            v += dv
        u += du
        row += 1
    return fit_canvas(paths, chunks(detail, 30), 14)


def limb(ctrl, w0, w1, cap=True, step=5.0):
    """Closed tapered tube along a smooth centre line (width w0 at start -> w1 at end)."""
    cen = resample(cr_sample(ctrl, n=16), 2.0)
    n = len(cen)
    L, R = [], []
    for i, p in enumerate(cen):
        t = i / (n - 1)
        hw = (w0 + (w1 - w0) * t) / 2
        a, b = cen[max(0, i - 1)], cen[min(n - 1, i + 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]
        ll = math.hypot(tx, ty) or 1
        L.append((p[0] - ty / ll * hw, p[1] + tx / ll * hw))
        R.append((p[0] + ty / ll * hw, p[1] - tx / ll * hw))
    end = cen[-1]
    a = cen[-2]
    ux, uy = end[0] - a[0], end[1] - a[1]
    ul = math.hypot(ux, uy) or 1
    tip = (end[0] + ux / ul * w1 * 0.5, end[1] + uy / ul * w1 * 0.5)
    pts = resample(L, step) + ([tip] if cap else []) + resample(R[::-1], step)
    return cr(pts, True), cen


@template(id='wild-scarab', name='Ornamental scarab', category='wildlife', level='intermediate',
          tags=['beetle', 'scarab', 'insect', 'ornamental', 'geometric', 'vintage', 'gothic'])
def scarab():
    paths, detail = [], []
    rp, rd = [], []  # right half, mirrored at the end
    # broad shovel-shaped head (clypeus) with a serrated front edge and fan grooves
    hp = [(200, 70), (214, 71), (229, 77), (241, 88), (247, 101), (244, 113), (236, 118)]
    rp.append(cr(hp))
    for i in range(1, 6):
        a = math.radians(-90 + i * 14)
        p_in = (200 + 22 * math.cos(a), 112 + 22 * math.sin(a) * 1.3)
        p_out = (200 + 38 * math.cos(a), 112 + 38 * math.sin(a) * 1.05)
        rd.append(ln(p_in, p_out))
    rd.append(cr([(200, 83), (214, 84), (228, 92), (236, 104)]))
    for t in (0.15, 0.32, 0.5, 0.68):
        q = cr_sample(hp[:5], n=10)[int(t * 40)]
        rd.append(ln(q, lerp(q, (200, 112), 0.08)))
    # antenna with lamellate club
    rp.append(cr([(242, 96), (252, 88), (258, 80)]))
    for ang in (-70, -40, -10):
        a = math.radians(ang)
        cx, cy = 258 + 6 * math.cos(a), 80 + 6 * math.sin(a)
        rp.append(ellipse(cx, cy, 6, 2.4, ang))
    pron = [(200, 112), (226, 112), (250, 118), (266, 133), (272, 154), (265, 174), (244, 184), (200, 186)]
    rp.append(cr(pron))
    inner = offset_open(cr_sample(pron, n=8), 7)
    inner = [p for p in inner if p[0] >= 200]
    rd.append(cr(inner[::4] + [inner[-1]]))
    # pronotum ornament: art-deco sunburst rising from the base
    inn = Region([cr_sample(pron, n=8) + mir(cr_sample(pron, n=8))[::-1]])
    for i in range(5):
        a = math.radians(-90 + 18 * (i + 0.5))
        far = (200 + 120 * math.cos(a), 178 + 120 * math.sin(a))
        seg = clip(resample([(200, 178), far], 1), Region([inner + [(200, inner[-1][1]), (200, inner[0][1])]]), True, 4)
        if seg:
            rd.append(ln(lerp(seg[0][0], seg[0][-1], 0.25), seg[0][-1]))
    rd.append(cr([(200, 162), (210, 166), (218, 178)]))
    # elytra
    ely = [(200, 186), (236, 186), (262, 196), (276, 222), (281, 262), (273, 302), (252, 332), (224, 350),
           (200, 355)]
    rp.append(cr(ely))
    rp.append(polyd([(200, 186), (213, 186), (200, 206)], True))
    # striae: curves inset from the outer edge, converging at the apex
    for k, frac in enumerate((0.2, 0.4, 0.6, 0.8)):
        pts = [(200 + (x - 200) * (1 - frac) + 2, 186 + (y - 186) * (1 - 0.12 * frac) + 8 * frac)
               for x, y in cr_sample(ely[1:-1], n=8)]
        pts = [p for p in pts if p[1] > 196]
        rd.append(smooth(pts, 10))
    # shoulder bump and a row of punctures
    rd.append(cr([(250, 196), (260, 204), (264, 216)]))
    for y in range(226, 320, 14):
        rd.append(circle(212, y, 2))
    # legs
    for ctrl, w0, w1 in (([(258, 138), (284, 124), (300, 112)], 10, 7), ([(268, 202), (292, 208), (312, 216)], 10, 7),
                         ([(266, 240), (288, 258), (300, 272)], 11, 7)):
        d, _ = limb(ctrl, w0, w1)
        rp.append(d)
    # tibiae (front with teeth)
    tib = [(298, 114), (304, 104), (311, 98), (308, 92), (315, 84), (312, 79), (318, 70), (316, 64),
           (308, 72), (302, 86), (294, 106)]
    rp.append(cr(tib, True, corners=range(len(tib))))
    for ctrl in ([(310, 214), (330, 232), (344, 256)], [(298, 270), (314, 300), (324, 334)]):
        d, _ = limb(ctrl, 8, 5)
        rp.append(d)
        # spines along the tibia
        for t in (0.35, 0.6, 0.85):
            p = bez(ctrl[0], lerp(ctrl[0], ctrl[1], 0.66), lerp(ctrl[2], ctrl[1], 0.66), ctrl[2], t)
            rd.append(ln((p[0] + 3, p[1]), (p[0] + 9, p[1] - 2)))
    # tarsi: slender segmented feet ending in paired claws
    for ctrl in ([(316, 66), (320, 54), (322, 40)], [(343, 254), (352, 268), (360, 284)], [(324, 332), (328, 350), (330, 368)]):
        d, cen = limb(ctrl, 5, 3.4)
        rp.append(d)
        for t in (0.3, 0.55, 0.8):
            p = cen[int(t * (len(cen) - 1))]
            q = cen[min(len(cen) - 1, int(t * (len(cen) - 1)) + 1)]
            tx, ty = q[0] - p[0], q[1] - p[1]
            ll = math.hypot(tx, ty) or 1
            rd.append(ln((p[0] - ty / ll * 2.5, p[1] + tx / ll * 2.5), (p[0] + ty / ll * 2.5, p[1] - tx / ll * 2.5)))
        e, f0 = cen[-1], cen[-4]
        ux, uy = e[0] - f0[0], e[1] - f0[1]
        ll = math.hypot(ux, uy) or 1
        ux, uy = ux / ll, uy / ll
        for sg in (1, -1):
            rp.append(qd(e, (e[0] + ux * 5 - uy * 4 * sg, e[1] + uy * 5 + ux * 4 * sg),
                         (e[0] + ux * 6 - uy * 7 * sg, e[1] + uy * 6 + ux * 7 * sg)))
    paths += [both(d) for d in rp]
    paths.append(ln((200, 206), (200, 355)))
    detail += [both(d) for d in rd]
    return paths, detail


def hairs(region, rng, n, length, angle_fn, min_d=4.0, bbox=(0, 0, 400, 400), curve=0.25):
    """Short fur strokes inside a region: direction from angle_fn(x, y) (radians)."""
    seeds = poisson(region, bbox, min_d, rng, max_pts=n)
    out = []
    for (x, y) in seeds:
        a = angle_fn(x, y) + rng.uniform(-0.15, 0.15)
        L = length * rng.uniform(0.7, 1.15)
        p0 = (x - math.cos(a) * L / 2, y - math.sin(a) * L / 2)
        p1 = (x + math.cos(a) * L / 2, y + math.sin(a) * L / 2)
        c = (x - math.sin(a) * L * curve, y + math.cos(a) * L * curve)
        out.append(qd(p0, c, p1))
    return out


@template(id='wild-bee-honeycomb', name='Bee on honeycomb', category='wildlife', level='advanced',
          tags=['bee', 'honeycomb', 'insect', 'geometric', 'botanical', 'garden', 'summer', 'realistic'],
          detailWidth=1.6)
def bee_honeycomb():
    rng = random.Random(31)
    paths, detail = [], []
    # ---------- bee (right half built, mirrored) ----------
    rp, rd = [], []
    fore = [(212, 138), (236, 110), (268, 82), (306, 62), (340, 58), (356, 70), (350, 92), (326, 112), (290, 130),
            (250, 144), (220, 148)]
    hind = [(214, 152), (244, 152), (282, 152), (310, 160), (318, 174), (304, 186), (272, 186), (240, 176), (218, 164)]
    rp.append(cr(fore, True))
    rp.append(cr(hind, True))
    # wing veins with a few closed cells
    rd.append(cr([(216, 142), (250, 124), (292, 102), (330, 80)]))
    rd.append(cr([(222, 146), (262, 134), (300, 118), (334, 98)]))
    rd.append(cr([(270, 98), (282, 112), (276, 132)]))
    rd.append(cr([(300, 84), (306, 98), (300, 118)]))
    rd.append(cr([(318, 76), (330, 86), (334, 98)]))
    rd.append(cr([(220, 158), (258, 162), (296, 168)]))
    rd.append(cr([(258, 154), (262, 162), (256, 176)]))
    # head: big compound eyes, antennae
    head = [(200, 94), (212, 95), (223, 104), (226, 117), (219, 128), (208, 133), (200, 134)]
    rp.append(cr(head))
    rp.append(cr([(212, 99), (221, 106), (224, 117), (218, 127), (211, 122), (209, 110)], True))
    rd.append(cr([(200, 112), (205, 120), (200, 128)]))
    rp.append(cr([(206, 94), (212, 78), (210, 64), (222, 52), (234, 46)]))
    # legs: short front legs, mid legs, hind legs with pollen baskets
    LEGS = ([(226, 162), (240, 170), (250, 184)], [(226, 176), (248, 194), (266, 218), (272, 240)])
    for ctrl, w0, w1 in zip(LEGS, (5, 6), (3.5, 4)):
        d, cen = limb(ctrl, w0, w1)
        rp.append(d)
    rp.append(ellipse(266, 216, 8, 12, -30))
    for y in (210, 216, 222):
        rd.append(ln((261, y - 3), (271, y + 2)))
    # thorax (fuzzy) and a rounded, banded abdomen
    thor = [(200, 130), (218, 132), (228, 146), (228, 164), (218, 178), (200, 182)]
    rp.append(cr(thor))
    abd = [(200, 180), (224, 184), (237, 204), (237, 230), (226, 254), (212, 266), (200, 270)]
    rp.append(cr(abd))
    bands = [(196, 26), (214, 34), (232, 35), (250, 28)]
    for y, wv in bands:
        rd.append(cr([(200, y + 6), (200 + wv * 0.6, y + 3.5), (200 + wv, y - 2)]))
    rd.append(cr([(200, 270), (200, 278)]))
    paths += [both(d) for d in rp]
    detail += [both(d) for d in rd]
    thor_full = cr_sample(thor, n=8)
    thor_reg = Region([thor_full + mir(thor_full)[::-1]])
    detail += chunks(hairs(thor_reg, rng, 70, 7, lambda x, y: math.atan2(y - 156, x - 200), 5.5, (170, 128, 230, 184)), 20)
    abd_full = cr_sample(abd, n=8)
    abd_reg = Region([abd_full + mir(abd_full)[::-1]])
    # dark bands = dense short hatching between alternate band lines
    dark = []
    for (ya, wa), (yb, wb) in ((bands[0], bands[1]), (bands[2], bands[3])):
        top = cr_sample([(200, ya + 6), (200 + wa * 0.6, ya + 3.5), (200 + wa, ya - 2)], n=8)
        bot = cr_sample([(200, yb + 6), (200 + wb * 0.6, yb + 3.5), (200 + wb, yb - 2)], n=8)
        dark.append(top + bot[::-1])
        dark.append(mir(top + bot[::-1]))
    dark_reg = Region(dark)
    detail += chunks(hairs(Region([d for d in dark]), rng, 75, 6, lambda x, y: math.pi / 2 + (x - 200) / 60, 3.6,
                           (162, 190, 238, 260), 0.1), 25)
    detail += chunks(hairs(abd_reg.minus(*dark), rng, 26, 4, lambda x, y: math.pi / 2 + (x - 200) / 60, 7.0,
                           (162, 180, 238, 272)), 20)
    # silhouette of the bee (for keeping the comb behind it)
    sil = []
    for poly in (fore, hind):
        ps = cr_sample(poly, True, n=6)
        sil.append(ps)
        sil.append(mir(ps))
    for part in (head, thor, abd):
        ps = cr_sample(part, n=6)
        sil.append(ps + mir(ps)[::-1])
    for pl in LEGS:
        ps = cr_sample(pl, n=6)
        tube = offset_open(ps, 6) + offset_open(ps, -6)[::-1]
        sil.append(tube)
        sil.append(mir(tube))
    sil.append(ellipse_pts(266, 216, 11, 15, -30))
    sil.append(mir(ellipse_pts(266, 216, 11, 15, -30)))
    bee = Region([offset_closed(p, 0) for p in sil])
    big = [offset_closed(cr_sample(poly, True, n=6), 5) for poly in (fore, hind)]
    bee_pad = Region(sil + big + [mir(b) for b in big] + [offset_closed(p, 4) for p in sil])
    # ---------- honeycomb ----------
    R = 25.0
    h = math.sqrt(3) * R
    cells = []
    for col in range(-1, 14):
        for row in range(-1, 14):
            cx = 22 + col * 1.5 * R
            cy = 60 + row * h + (h / 2 if col % 2 else 0)
            # comb outline: wide arch under the bee with a ragged edge
            dx, dy = (cx - 200) / 190, (cy - 262) / 150
            if dx * dx + dy * dy > 1 + 0.18 * math.sin(cx * 0.07 + cy * 0.05):
                continue
            if cy < 80 or not (R < cx < 400 - R) or cy > 400 - h / 2 - 2:
                continue
            cells.append((cx, cy))
    edges = {}
    for (cx, cy) in cells:
        vs = [(cx + R * math.cos(math.radians(60 * k)), cy + R * math.sin(math.radians(60 * k))) for k in range(6)]
        for k in range(6):
            a, b = vs[k], vs[(k + 1) % 6]
            key = tuple(sorted([(round(a[0], 1), round(a[1], 1)), (round(b[0], 1), round(b[1], 1))]))
            edges[key] = (a, b)
    comb = []
    for a, b in edges.values():
        for run in clip([a, b], bee_pad, False, 2, 0.5):
            comb.append(ln(run[0], run[-1]))
    paths += chunks(comb, 30)
    inner = []
    caps = []
    for (cx, cy) in cells:
        r2 = rng.random()
        if r2 < 0.42:
            # capped cell: domed cap drawn as a circle with a highlight arc
            cp = ellipse_pts(cx, cy, R * 0.7, R * 0.7, 0, 36)
            caps.append(cp + [cp[0]])
            caps.append(arc_pts(cx, cy, R * 0.45, 200, 250, 8))
        else:
            vs = [(cx + R * 0.74 * math.cos(math.radians(60 * k)), cy + R * 0.74 * math.sin(math.radians(60 * k)))
                  for k in range(6)]
            inner.append(vs)
            if r2 > 0.82:
                # honey level line
                caps.append(cr_sample([(cx - R * 0.55, cy + 3), (cx, cy + 6), (cx + R * 0.55, cy + 3)], n=6))
    for vs in inner:
        if not bee_pad.contains(resample(vs + [vs[0]], 1)).any():
            detail.append(polyd(vs, True))
            continue
        for run in clip(vs + [vs[0]], bee_pad, False, 2, 0.5):
            detail.append(polyd(rdp(run, 0.3)))
    capd = []
    for pts in caps:
        if len(pts) > 30 and not bee_pad.contains(resample(pts, 1)).any():
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            capd.append(circle((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, (max(xs) - min(xs)) / 2))
            continue
        for run in clip(pts, bee_pad, False, 2, 0.5):
            capd.append(fit(run, 0.4))
    detail += capd
    # honey drips from the lowest cells
    lows = sorted(cells, key=lambda c: -c[1])[:40]
    lows = [c for c in lows if not any(abs(c[0] - o[0]) < 1 and o[1] > c[1] for o in cells)]
    drips = []
    for (cx, cy) in lows[::2]:
        x0 = cx - R * 0.5
        x1 = cx + R * 0.5
        yb = cy + h / 2
        Ld = rng.uniform(14, 36)
        if yb + Ld + 10 > 392:
            Ld = 392 - yb - 10
        if Ld < 8:
            continue
        drips.append(cr([(x0, yb), (cx - 4, yb + 6), (cx - 4, yb + Ld), (cx, yb + Ld + 7), (cx + 4, yb + Ld),
                         (cx + 4, yb + 6), (x1, yb)]))
    paths += drips
    return paths, chunks(detail, 30)


def scale_rows(region, x0, x1, y0, y1, sw, sh, jitter_rng=None, shaft=True, mirror_ax=None):
    """Rows of U-shaped feather scales (offset rows) clipped to region."""
    out = []
    row = 0
    y = y0
    while y < y1:
        off = sw / 2 if row % 2 else 0
        x = x0 + off
        while x < x1:
            pts = [(x - sw / 2 + sw * k / 8, y + sh * math.sin(math.pi * k / 8)) for k in range(9)]
            if region.contains(pts).all():
                out.append(qd(pts[0], (x, y + sh * 1.9), pts[-1]))
            else:
                for run in clip(pts, region, True, 3, 0.7):
                    out.append(qfit(run) if plen(run) < 30 else fit(run, 0.8))
            if shaft and region.contains([(x, y + sh * 0.5)])[0]:
                out.append(ln((x, y + sh * 0.25), (x, y + sh * 0.65)))
            x += sw
        y += sh * 0.82
        row += 1
    return out


@template(id='wild-owl', name='Owl portrait', category='wildlife', level='advanced',
          tags=['owl', 'bird', 'woodland', 'realistic', 'vintage', 'gothic', 'halloween', 'wisdom'],
          detailWidth=1.5)
def owl():
    rng = random.Random(41)
    paths, detail = [], []
    rp, rd = [], []
    # ---- branch (full width, drawn once) ----
    br_top = [(8, 344), (80, 340), (160, 342), (240, 340), (320, 338), (392, 342)]
    br_bot = [(8, 366), (90, 368), (170, 365), (250, 368), (330, 366), (392, 362)]
    paths.append(cr(br_top))
    paths.append(cr(br_bot))
    paths.append(cr([(8, 344), (4, 355), (8, 366)]))
    paths.append(cr([(392, 342), (396, 352), (392, 362)]))
    for x0 in range(20, 390, 26):
        if 140 < x0 < 260:
            continue
        y = 351 + rng.uniform(-3, 3)
        detail.append(cr([(x0, y), (x0 + 8, y - 1.5), (x0 + 16, y + 1)]))
    # ---- body outline (right half) ----
    body = [(200, 186), (240, 186), (276, 198), (302, 226), (314, 264), (310, 302), (294, 330), (266, 346)]
    rp.append(cr([(286, 174), (302, 200), (313, 232), (316, 268), (310, 304), (294, 332), (266, 346)]))
    # folded wing
    wing = [(282, 204), (300, 232), (308, 270), (302, 308), (288, 336), (270, 352), (262, 360)]
    rp.append(cr(wing))
    wing_in = [(282, 204), (266, 240), (258, 280), (258, 318), (262, 360)]
    rp.append(cr(wing_in))
    wing_poly = cr_sample(wing, n=8) + cr_sample(wing_in, n=8)[::-1]
    wreg = Region([wing_poly])
    # coverts (scales) on the upper wing, long primaries below
    rd += scale_rows(wreg, 262, 312, 214, 280, 12, 10, shaft=False)
    for i in range(5):
        t = i / 5
        top = lerp((262, 282), (306, 278), t)
        rd.append(cr([top, lerp(top, (262 + 9 * i, 356), 0.5), (262 + 8 * i + 2, 354 - 4 * i)]))
    # talons gripping the branch
    for cx in (226,):
        for k, dx in enumerate((-9, 0, 9)):
            toe = [(cx + dx * 0.5, 334), (cx + dx, 342), (cx + dx * 1.1, 350)]
            d, cen = limb(toe, 6, 4.5)
            rp.append(d)
            e = cen[-1]
            rp.append(qd((e[0] - 2, e[1]), (e[0] + 1, e[1] + 6), (e[0] - 3, e[1] + 9)))
    # ---- head ----
    head = [(200, 64), (226, 60), (252, 56), (270, 44), (284, 36), (282, 58), (294, 84), (304, 118), (300, 152),
            (284, 176), (256, 190), (226, 194), (200, 194)]
    rp.append(cr(head[:11], corners=(4,)))
    # ear tuft feathers
    for i, (a, b) in enumerate((((254, 62), (280, 40)), ((262, 66), (284, 46)), ((246, 62), (270, 46)))):
        rd.append(qd(a, (lerp(a, b, 0.5)[0] - 2, lerp(a, b, 0.5)[1] + 4), b))
    # facial disc: ruff edge (scalloped) around each eye
    ec = (240, 122)
    disc = []
    for k in range(0, 27):
        ang = math.radians(-100 + k * 10)  # from top-centre round the outside to the bottom
        rr = 58 + 4 * math.sin(math.radians(k * 10))
        disc.append((ec[0] + rr * math.cos(ang) * 0.98, ec[1] + rr * math.sin(ang) * 0.92))
    disc = [p for p in disc if p[0] >= 199]
    rp.append(scallop_d(disc, 2.4))
    disc_reg = Region([cr_sample(disc, n=6) + [(200, disc[-1][1]), (200, disc[0][1])]])
    # radial feathering inside the disc
    eye_r = 22
    for k in range(64):
        ang = 2 * math.pi * k / 64
        p0 = (ec[0] + (eye_r + 7) * math.cos(ang), ec[1] + (eye_r + 7) * math.sin(ang))
        p1 = (ec[0] + 70 * math.cos(ang), ec[1] + 70 * math.sin(ang))
        mid = lerp(p0, p1, 0.5)
        line_ = cr_sample([p0, (mid[0] + 2 * math.sin(ang), mid[1] - 2 * math.cos(ang)), p1], n=12)
        for run in clip(line_, disc_reg, True, 4):
            run = [p for p in run if p[0] > 203]
            if len(run) > 3:
                if math.dist(run[-1], run[0]) > 8:
                    run = run[:max(3, len(run) - 3)]
                rd.append(qfit(run))
    # eyes
    rp.append(circle(ec[0], ec[1], eye_r))
    rp.append(circle(ec[0], ec[1] + 1, 13))
    rd.append(circle(ec[0], ec[1] + 1, 6.5))
    rd.append(circle(ec[0] - 4, ec[1] - 4, 2.5))
    rd.append(cr(arc_pts(ec[0], ec[1], eye_r + 4, 200, 320, 8)))
    # brow feathers between the eyes, forming the V
    for i in range(5):
        y = 82 + i * 8
        rd.append(cr([(202, y + 10), (210, y + 3), (222, y - 2)]))
    # head-top feathers: small scales between the tufts
    top_reg = Region([cr_sample(head[:5], n=8) + [(260, 74), (220, 82), (200, 80)]])
    rd += scale_rows(top_reg, 204, 280, 60, 82, 10, 7, shaft=False)
    # ---- chest: scale feathers with barring ----
    chest = Region([[(200, 192)] + cr_sample(body[:3], n=8) + cr_sample(wing_in, n=8) + [(262, 346), (200, 346)]])
    chest = chest.minus(cr_sample(head, n=8) + [(200, 194)])
    rd += scale_rows(chest, 206, 270, 192, 330, 15, 12, shaft=False)
    # beak
    paths.append(cr([(200, 136), (208, 142), (209, 156), (200, 172), (191, 156), (192, 142)], True, corners=(0, 3)))
    detail.append(cr([(200, 146), (203, 156), (200, 165)]))
    paths += [both(d) for d in rp]
    detail += [both(d) for d in rd]
    return paths, chunks(detail, 30)


@template(id='wild-swan-heart', name='Swans in love', category='wildlife', level='intermediate',
          tags=['swan', 'bird', 'heart', 'love', 'wedding', 'valentine', 'romantic', 'ornamental', 'card'],
          detailWidth=1.5)
def swan_heart():
    rng = random.Random(3)
    paths, detail = [], []
    rp, rd = [], []
    # neck outer edge runs from the back of the head over the heart lobe down to the chest
    n_out = [(224, 122), (234, 96), (252, 72), (280, 58), (308, 68), (322, 98), (320, 138), (306, 178),
             (286, 216), (264, 252), (244, 284), (230, 308), (226, 326), (232, 338)]
    rp.append(cr(n_out))
    n_in = [(224, 152), (238, 122), (258, 94), (281, 79), (299, 88), (305, 112), (299, 148), (283, 186),
            (264, 222), (250, 248)]
    rp.append(cr(n_in))
    # head and beak (bowed toward the partner)
    head = [(224, 122), (213, 118), (205, 124), (202.5, 134), (200.5, 152), (205, 152), (212, 150), (224, 152)]
    rp.append(cr(head, corners=(4, 5)))
    rd.append(cr([(203, 133), (208, 131), (212, 126)]))  # knob edge at the base of the beak
    rp.append(circle(216, 129, 1.8))
    # body waterline to the upturned tail
    belly = [(232, 338), (262, 345), (306, 346), (342, 339), (368, 325), (384, 307), (392, 290)]
    rp.append(cr(belly))
    # raised wing: layered rows of feathers between the wing base and the outer arch
    arch = cr_sample([(250, 248), (262, 220), (288, 196), (322, 184), (354, 190), (376, 210), (388, 240),
                      (392, 290)], n=20)
    basec = cr_sample([(250, 248), (268, 280), (300, 296), (340, 298), (372, 294), (392, 290)], n=20)
    arch = resample(arch, 1)
    basec = resample(basec, 1)
    na, nb = len(arch), len(basec)

    def row(f, n):
        pts = []
        for k in range(n + 1):
            t = k / n
            a = arch[min(na - 1, int(t * (na - 1)))]
            b = basec[min(nb - 1, int(t * (nb - 1)))]
            pts.append(lerp(b, a, f))
        return pts

    # individual pointed feathers fanning from the base to the arch; front (neck side) ones on top
    covered = [cr_sample(n_out, n=8) + cr_sample(n_in, n=8)[::-1]]
    # small covert feathers along the wing base, in front of the long ones
    for k in range(7):
        t = (k + 0.5) / 7
        root = basec[min(nb - 1, int((0.03 + 0.8 * t) * (nb - 1)))]
        tip = lerp(root, arch[min(na - 1, int((0.1 + 0.85 * t) * (na - 1)))], 0.38)
        dx, dy = tip[0] - root[0], tip[1] - root[1]
        L = math.hypot(dx, dy)
        ux, uy = dx / L, dy / L
        w2 = 8
        cpts = [(root[0] - uy * -w2 * 0.8, root[1] + ux * -w2 * 0.8),
                (root[0] + ux * L * 0.6 - uy * -w2, root[1] + uy * L * 0.6 + ux * -w2),
                (root[0] + ux * (L + 3), root[1] + uy * (L + 3)),
                (root[0] + ux * L * 0.6 - uy * w2, root[1] + uy * L * 0.6 + ux * w2),
                (root[0] - uy * w2 * 0.8, root[1] + ux * w2 * 0.8)]
        dense = cr_sample(cpts, n=10)
        for run in clip(dense, Region(covered), False, 4, 1):
            rp.append(fit(run, 0.5))
        covered.append(dense)
    nf = 10
    for k in range(nf):
        t = (k + 0.5) / nf
        tip = arch[min(na - 1, int((0.1 + 0.9 * t) * (na - 1)))]
        root = basec[min(nb - 1, int((0.0 + 0.72 * t) * (nb - 1)))]
        root = lerp(root, tip, 0.12)
        dx, dy = tip[0] - root[0], tip[1] - root[1]
        L = math.hypot(dx, dy)
        ux, uy = dx / L, dy / L
        wdt = 9 + 3 * math.sin(math.pi * t)
        def P(a, b):
            return (root[0] + ux * a - uy * b, root[1] + uy * a + ux * b)
        bend = 5
        fpts = [P(0, -wdt * 0.6), P(L * 0.45, -wdt + bend), P(L * 0.85, -wdt * 0.7 + bend * 0.6), P(L + 4, 0),
                P(L * 0.85, wdt * 0.7 + bend * 0.6), P(L * 0.45, wdt + bend), P(0, wdt * 0.6)]
        dense = cr_sample(fpts, n=10)
        reg = Region(covered)
        for run in clip(dense, reg, False, 4, 1):
            rp.append(fit(run, 0.5))
        for run in clip(resample([P(L * 0.1, 0), P(L * 0.8, 1.5)], 1), reg, False, 4, 1):
            rd.append(qfit(run))
        # barbs: short diagonal strokes on the visible side
        for a in (0.35, 0.5, 0.65):
            seg = [P(L * a, 1), P(L * (a + 0.07), wdt * 0.75)]
            for run in clip(resample(seg, 1), reg, False, 3, 1):
                rd.append(ln(run[0], run[-1]))
        covered.append(dense)
    rp.append(cr(basec[::10] + [basec[-1]]))
    # body feather lines and chest
    rd.append(cr([(246, 318), (290, 330), (340, 326)]))
    rd.append(cr([(262, 334), (300, 340), (334, 336)]))
    # neck feather texture: a few soft strokes
    neck_pts = cr_sample(n_out[4:10], n=6)
    for i in range(3, len(neck_pts) - 3, 6):
        a = neck_pts[i]
        b = neck_pts[i + 2]
        rd.append(qd(lerp(a, (290, 140), 0.12), lerp(lerp(a, b, 0.5), (290, 140), 0.25), lerp(b, (290, 140), 0.3)))
    paths += [both(d) for d in rp]
    detail += [both(d) for d in rd]
    # water ripples (full width)
    for y, x0, x1 in ((362, 40, 360), (374, 20, 380), (386, 70, 330)):
        pts = []
        x = x0
        while x <= x1:
            pts.append((x, y + 2.2 * math.sin((x - x0) / 14)))
            x += 4
        segs = []
        cur = []
        for p in pts:
            if rng.random() < 0.06 and len(cur) > 6:
                segs.append(cur)
                cur = []
            else:
                cur.append(p)
        if len(cur) > 2:
            segs.append(cur)
        for sgm in segs:
            detail.append(fit(sgm, 0.4))
    # small floating heart above
    hpts = [(200, 44), (208, 34), (218, 34), (222, 44), (216, 56), (200, 68), (184, 56), (178, 44), (182, 34),
            (192, 34)]
    paths.append(cr(hpts, True, corners=(0, 5)))
    return paths, detail


@template(id='wild-ladybird', name='Ladybird on a leaf', category='wildlife', level='beginner',
          tags=['ladybird', 'ladybug', 'insect', 'leaf', 'garden', 'cute', 'luck', 'spring', 'kids'])
def ladybird():
    paths, detail = [], []
    cx, cy, rot = 206, 200, 42

    def R(pts):
        return rot_pts(pts, rot, (cx, cy))
    body = R(ellipse_pts(cx, cy + 12, 62, 70, 0, 64))
    head = R([(cx - 30, cy - 46), (cx - 26, cy - 70), (cx, cy - 82), (cx + 26, cy - 70), (cx + 30, cy - 46)])
    K = 1.22
    sil = Region([sc(offset_closed(body, 6), K, (cx, cy)), sc(offset_closed(R(ellipse_pts(cx, cy - 56, 34, 30)), 6), K, (cx, cy))])
    bug = []
    # leaf behind the ladybird
    leaf_pts = [(40, 362), (52, 290), (84, 206), (140, 122), (226, 58), (320, 32), (370, 30), (368, 80),
                (342, 174), (282, 268), (190, 340), (100, 370)]
    lf = cr_sample(leaf_pts, True, n=12, corners=(0, 6))
    paths.append(' '.join(fit(r, 0.5) for r in clip(lf, sil, False, 6)))
    paths.append(cr([(22, 384), (40, 362)]))
    mid = cr_sample([(40, 362), (130, 278), (250, 160), (366, 40)], n=14)
    paths.append(' '.join(fit(r, 0.5) for r in clip(mid, sil, False, 6)))
    for t in (0.14, 0.3, 0.46, 0.62, 0.78):
        p = mid[int(t * (len(mid) - 1))]
        for side in (1, -1):
            a = (p[0] + 50, p[1] - 6) if side > 0 else (p[0] + 6, p[1] - 50)
            a = lerp(p, a, 1 - 0.4 * t)
            c = lerp(p, a, 0.5)
            c = (c[0] - 4 * side, c[1] + 4 * side) if True else c
            for run in clip(cr_sample([p, c, a], n=12), sil, False, 6):
                detail.append(fit(run, 0.5))
    # ladybird
    bug.append(cr(resample(body + [body[0]], 10)[:-1], True))
    bug.append(cr(head))
    bug.append(cr(R([(cx - 54, cy - 30), (cx, cy - 46), (cx + 54, cy - 30)])))
    bug.append(cr(R([(cx, cy - 46), (cx, cy + 82)])))
    for sgn in (1, -1):
        e = R([(cx + 13 * sgn, cy - 62)])[0]
        bug.append(ellipse(e[0], e[1], 7, 5.5, rot))
        for (dx, dy, r) in ((28, -6, 13), (40, 32, 10), (20, 54, 10)):
            q = R([(cx + dx * sgn, cy + dy)])[0]
            bug.append(circle(q[0], q[1], r))
        bug.append(cr(R([(cx + 10 * sgn, cy - 78), (cx + 18 * sgn, cy - 100), (cx + 30 * sgn, cy - 110)])))
        a = R([(cx + 30 * sgn, cy - 110)])[0]
        bug.append(circle(a[0], a[1], 4))
        for dy, kn, ft in ((-28, -36, -50), (12, 8, 20), (46, 50, 66)):
            bug.append(cr(R([(cx + 56 * sgn, cy + dy), (cx + 72 * sgn, cy + kn), (cx + 76 * sgn, cy + ft)]),
                          corners=(1,)))
    paths += [scale_d(d, K, (cx, cy)) for d in bug]
    return paths, detail


@template(id='wild-whale', name='Whale and spout', category='wildlife', level='beginner',
          tags=['whale', 'sea', 'ocean', 'nautical', 'cute', 'baby', 'kids', 'stylized'])
def whale():
    paths, detail = [], []
    body = [(46, 236), (60, 196), (100, 168), (160, 160), (226, 172), (280, 196), (318, 226), (340, 238),
            (352, 228), (360, 200), (376, 170), (392, 164), (386, 190), (378, 212), (390, 238), (394, 262),
            (376, 252), (354, 254), (330, 266), (290, 290), (230, 306), (160, 308), (100, 296), (62, 272)]
    paths.append(cr(body, True, corners=(11, 15)))
    # mouth line and throat grooves
    paths.append(cr([(50, 246), (80, 258), (120, 262), (150, 258)]))
    for k in range(5):
        y = 272 + k * 7
        detail.append(cr([(84 + k * 6, y), (130, y + 5), (182 - k * 4, y + 3 - k)]))
    # eye and flipper
    paths.append(circle(120, 232, 7))
    paths.append(cr([(204, 274), (214, 300), (230, 324), (246, 330), (246, 312), (232, 286), (226, 270)]))
    # spout: three jets and droplets
    paths.append(cr([(112, 160), (106, 120), (90, 90), (70, 78)]))
    paths.append(cr([(118, 158), (120, 116), (126, 80), (132, 56)]))
    paths.append(cr([(124, 160), (138, 122), (160, 96), (184, 86)]))
    for (x, y, r) in ((60, 90, 5), (82, 66, 4), (146, 44, 5), (196, 98, 5), (176, 64, 4)):
        paths.append(circle(x, y, r))
    # sea
    for y, x0, x1 in ((338, 20, 380), (362, 60, 340)):
        pts = [(x, y + 6 * math.sin((x - x0) / 18)) for x in range(x0, x1 + 1, 6)]
        paths.append(fit(pts, 0.4))
    return paths, detail


@template(id='wild-bunny', name='Sitting bunny', category='animals', level='beginner',
          tags=['rabbit', 'bunny', 'easter', 'spring', 'cute', 'baby', 'kids', 'woodland'])
def bunny():
    paths, detail = [], []
    # body: big rounded haunch, chest, front paw
    body = [(150, 200), (128, 236), (118, 282), (126, 330), (150, 352), (200, 360), (262, 358), (300, 346),
            (318, 320), (316, 280), (298, 236), (262, 206), (220, 196)]
    head = [(150, 200), (128, 186), (110, 160), (112, 132), (132, 112), (164, 106), (196, 114), (216, 136),
            (222, 166), (226, 192)]
    outline = head + body[::-1][1:-1]
    paths.append(cr(outline, True, corners=(0,)))
    # ears
    paths.append(cr([(150, 112), (128, 76), (116, 36), (126, 20), (146, 34), (166, 74), (176, 108)]))
    paths.append(cr([(180, 110), (192, 70), (210, 34), (228, 28), (232, 48), (218, 86), (204, 118)]))
    detail.append(cr([(146, 96), (132, 62), (130, 40), (142, 46), (156, 80)]))
    detail.append(cr([(194, 96), (206, 62), (220, 42), (222, 56), (208, 92)]))
    # face
    paths.append(circle(140, 150, 6))
    paths.append(cr([(112, 166), (118, 170), (114, 176)]))
    detail.append(cr([(116, 176), (124, 186), (134, 184)]))
    for a, b in (((112, 168), (78, 160)), ((114, 172), (80, 178)), ((118, 176), (90, 192))):
        detail.append(qd(a, lerp(a, b, 0.5), b))
    # haunch line and back foot
    paths.append(cr([(270, 262), (240, 280), (228, 316), (240, 346), (262, 358)]))
    # front paw
    paths.append(cr([(168, 290), (162, 330), (164, 350), (178, 358), (192, 352), (188, 320), (186, 292)]))
    detail.append(ln((176, 350), (176, 357)))
    # tail puff
    tail = scallops([(316, 286), (338, 274), (352, 292), (342, 314), (318, 320)], 4.0)
    paths.append(cr(tail[0], corners=tail[1]))
    # grass tufts
    for x0 in (60, 362):
        for k, (dx, h) in enumerate(((-12, 26), (0, 40), (12, 30))):
            paths.append(qd((x0 + dx * 0.4, 362), (x0 + dx * 0.6, 362 - h * 0.6), (x0 + dx * 1.4, 362 - h)))
    paths.append(ln((30, 364), (370, 364)))
    return paths, detail


@template(id='wild-songbird', name='Songbird on a branch', category='wildlife', level='beginner',
          tags=['bird', 'robin', 'branch', 'garden', 'spring', 'cute', 'botanical', 'kids'])
def songbird():
    paths, detail = [], []
    # body: round chest, back, tail
    body = [(150, 120), (128, 128), (114, 146), (110, 172), (122, 210), (150, 240), (190, 258), (232, 262),
            (268, 252), (300, 262), (346, 290), (356, 276), (318, 236), (292, 212), (262, 170), (230, 136),
            (196, 118)]
    paths.append(cr(body, True, corners=(10, 11)))
    # beak and eye
    paths.append(cr([(116, 140), (92, 148), (112, 156)], corners=(1,)))
    paths.append(circle(140, 140, 6.5))
    # chest bib
    paths.append(cr([(112, 160), (142, 168), (170, 196), (184, 232), (186, 256)]))
    # wing
    wing = [(176, 166), (214, 158), (252, 180), (286, 216), (300, 240), (262, 238), (220, 228), (190, 206)]
    paths.append(cr(wing, True))
    for t in (0.35, 0.6, 0.85):
        a = lerp((196, 196), (236, 170), t)
        detail.append(cr([a, (a[0] + 34, a[1] + 26), (a[0] + 60, a[1] + 50)]))
    # legs
    for x in (190, 214):
        paths.append(ln((x, 256), (x - 6, 292)))
        paths.append(cr([(x - 18, 294), (x - 6, 292), (x + 6, 296)]))
    # branch with leaves and berries
    paths.append(cr([(20, 300), (120, 292), (220, 294), (310, 300), (386, 312)]))
    paths.append(cr([(20, 312), (120, 304), (220, 306), (300, 312), (370, 322)]))
    paths.append(cr([(20, 300), (14, 306), (20, 312)]))
    paths.append(cr([(370, 322), (386, 312)]))
    for bx, by, ang, L in ((52, 298, -40, 62), (92, 296, 15, 52), (300, 306, 165, 50), (350, 312, 140, 46)):
        a = math.radians(ang)
        ux, uy = math.sin(a), -math.cos(a)
        nx, ny = -uy, ux
        def Q(t, w):
            return (bx + ux * L * t + nx * w, by + uy * L * t + ny * w)
        wd = L * 0.24
        paths.append(cr([Q(0, 0), Q(0.3, wd), Q(0.7, wd * 0.8), Q(1, 0), Q(0.7, -wd * 0.8), Q(0.3, -wd)], True,
                        corners=(0, 3)))
        detail.append(cr([Q(0, 0), Q(0.5, 1), Q(0.85, 0)]))
    for x, y in ((240, 336), (256, 344), (246, 356)):
        paths.append(circle(x, y, 7.5))
    paths.append(cr([(232, 306), (240, 322), (240, 328)]) + ' ' + cr([(240, 322), (254, 332), (256, 336)]))
    return [move_d(d, 0, -40) for d in paths], [move_d(d, 0, -40) for d in detail]


class Wing:
    """Butterfly wing: outline, discal cell, radiating veins and a (s, r) map of each intervein cell."""

    def __init__(self, outline, i0, i1, cell, starts, n_veins):
        self.outline = outline
        dense = cr_sample(outline, True, n=16)
        # margin polyline between outline points i0 .. i1 (sample index = point index * 16)
        self.margin = resample(dense[i0 * 16:i1 * 16 + 1], 1.0)
        self.region = Region([dense])
        self.cell = cell
        mL = plen(self.margin)
        cum = [0.0]
        for a, b in zip(self.margin, self.margin[1:]):
            cum.append(cum[-1] + math.dist(a, b))
        self.mcum = cum
        self.mL = mL
        self.n = n_veins
        self.ends = [self.mat(j / (n_veins - 1)) for j in range(n_veins)]
        st = resample(cr_sample(starts, n=12), 1.0)
        self.starts = [st[int(j / (n_veins - 1) * (len(st) - 1))] for j in range(n_veins)]

    def mat(self, t):
        s = t * self.mL
        for k in range(len(self.mcum) - 1):
            if self.mcum[k + 1] >= s:
                return self.margin[k]
        return self.margin[-1]

    def V(self, j, r):
        a, b = self.starts[j], self.ends[j]
        p = lerp(a, b, r)
        # slight bow so veins are not ruler-straight
        dx, dy = b[0] - a[0], b[1] - a[1]
        bow = 0.05 * math.sin(math.pi * r)
        return (p[0] - dy * bow, p[1] + dx * bow)

    def P(self, j, s, r):
        a, b = self.V(j, r), self.V(j + 1, r)
        p = lerp(a, b, s)
        t0, t1 = j / (self.n - 1), (j + 1) / (self.n - 1)
        m = self.mat(t0 + (t1 - t0) * s)
        lin = lerp(self.ends[j], self.ends[j + 1], s)
        k = r ** 4
        return (p[0] + (m[0] - lin[0]) * k, p[1] + (m[1] - lin[1]) * k)

    def cellpath(self, j, pts_sr, closed=False):
        return cr([self.P(j, s, r) for s, r in pts_sr], closed)


@template(id='wild-butterfly-specimen', name='Butterfly specimen', category='wildlife', level='advanced',
          tags=['butterfly', 'insect', 'specimen', 'vintage', 'botanical', 'ornamental', 'realistic', 'journal'],
          detailWidth=1.4, coarse=True)
def butterfly_specimen():
    paths, detail = [], []
    rp, rd = [], []
    fo = [(206, 146), (224, 116), (258, 84), (300, 58), (340, 44), (364, 44), (370, 64), (364, 98), (352, 132),
          (338, 162), (322, 186), (306, 198), (270, 198), (236, 188), (212, 170)]
    fw = Wing(fo, 3, 11, None, [(240, 140), (268, 122), (296, 112), (302, 126), (300, 142), (282, 152), (250, 164)], 10)
    fcell = [(214, 160), (240, 140), (270, 122), (296, 112), (302, 126), (300, 142), (282, 152), (258, 160), (232, 170)]
    ho = [(206, 172), (236, 176), (282, 182), (318, 196), (338, 220), (346, 250), (340, 280), (322, 308), (296, 330),
          (266, 342), (240, 336), (222, 312), (210, 270), (205, 220)]
    hw = Wing(ho, 3, 10, None, [(256, 200), (276, 210), (282, 226), (276, 240), (262, 246), (246, 244)], 9)
    hcell = [(214, 190), (246, 196), (270, 206), (282, 224), (276, 240), (262, 246), (240, 240), (222, 222)]
    for wg, cellp in ((fw, fcell), (hw, hcell)):
        rp.append(cr(wg.outline, True))
        rd.append(cr(cellp, True))
        for j in range(wg.n):
            pts = [wg.V(j, r / 12) for r in range(13)]
            rd.append(cr(pts[::3] + [pts[-1]]))
    rd.append(cr([(220, 176), (256, 186), (300, 194)]))
    # hindwing anal veins
    rd.append(cr([(212, 200), (222, 260), (238, 320)]))
    # ----- cell patterns -----
    for wg, eyes in ((fw, set()), (hw, {2, 3, 4, 5})):
        n = wg.n
        # marginal scalloped band and dots
        band = []
        for j in range(n - 1):
            for k in range(7):
                s = k / 6
                band.append(wg.P(j, s, 0.9 + 0.03 * math.sin(math.pi * s)))
        rd.append(fit(band, 0.7))
        band2 = []
        for j in range(n - 1):
            for k in range(7):
                s = k / 6
                band2.append(wg.P(j, s, 0.8 - 0.035 * math.sin(math.pi * s)))
        rd.append(fit(band2, 0.7))
        for j in range(n - 1):
            c = wg.P(j, 0.5, 0.955)
            w = math.dist(wg.P(j, 0, 0.955), wg.P(j, 1, 0.955))
            if w > 9:
                rd.append(circle(c[0], c[1], min(2.6, w * 0.14)))
            # submarginal chevron (pointing to the base)
            rd.append(qfit([wg.P(j, 0.18, 0.75), wg.P(j, 0.5, 0.66), wg.P(j, 0.82, 0.75)]))
            if j in eyes:
                c = wg.P(j, 0.5, 0.52)
                w = math.dist(wg.P(j, 0, 0.52), wg.P(j, 1, 0.52))
                r0 = w * 0.38
                rd.append(circle(c[0], c[1], r0))
                rd.append(circle(c[0], c[1], r0 * 0.62))
                rd.append(circle(c[0] - r0 * 0.15, c[1] - r0 * 0.15, r0 * 0.2))
            else:
                # postdiscal teardrop window with a midrib
                rd.append(wg.cellpath(j, [(0.5, 0.33), (0.72, 0.5), (0.5, 0.61), (0.28, 0.5)], True))
                rd.append(ln(wg.P(j, 0.5, 0.39), wg.P(j, 0.5, 0.55)))
            # basal streak
            rd.append(ln(wg.P(j, 0.5, 0.1), wg.P(j, 0.5, 0.24)))
    # discal cell ornaments: inner outline and bars
    for cellp in (fcell, hcell):
        inner = offset_closed(cr_sample(cellp, True, n=8), -6)
        if ccw_area(inner) * ccw_area(cr_sample(cellp, True, n=8)) < 0 or abs(ccw_area(inner)) > abs(ccw_area(cellp)):
            inner = offset_closed(cr_sample(cellp, True, n=8), 6)
        rd.append(cr(resample(inner + [inner[0]], 12)[:-1], True))
    rd.append(cr([(262, 132), (272, 140), (268, 152)]))
    rd.append(cr([(238, 148), (248, 156), (244, 166)]))
    rd.append(ellipse(252, 222, 7, 5, 30))
    K = 0.9
    paths += [scale_d(both(d), K, (200, 186)) for d in rp]
    detail += [scale_d(both(d), K, (200, 186)) for d in rd]
    body_p, body_d = [], []
    # body, antennae and pin
    body_p.append(circle(200, 138, 7))
    body_p.append(cr([(200, 145), (209, 152), (211, 170), (207, 186), (200, 192), (193, 186), (189, 170), (191, 152)], True))
    sp = Spine([(200, 192), (200.5, 240), (201, 284)])

    def w(u):
        return 6 * math.sin(math.pi * (0.12 + 0.88 * u) ** 0.8) ** 0.5
    left = [sp.map(i / 10, w(i / 10)) for i in range(11)]
    right = [sp.map(i / 10, -w(i / 10)) for i in range(10, -1, -1)]
    body_p.append(cr(left + right[1:-1], True))
    for i in range(1, 8):
        u = i / 8.5
        body_d.append(cr([sp.map(u, w(u) - 0.5), sp.map(u + 0.02, 0), sp.map(u, -w(u) + 0.5)]))
    for sgn in (1, -1):
        tip = (200 + 40 * sgn, 70)
        body_p.append(qd((200 + 3 * sgn, 132), (200 + 14 * sgn, 96), tip))
        body_p.append(ellipse(tip[0] + 1.5 * sgn, tip[1] - 2, 5, 2.8, -60 * sgn))
    paths += [scale_d(d, K, (200, 186)) for d in body_p]
    detail += [scale_d(d, K, (200, 186)) for d in body_d]
    # entomologist's pin through the thorax
    paths.append(circle(200, 22, 6))
    detail.append(ln((200, 28), (200, 134)))
    # specimen label
    paths.append(rrect_d(132, 348, 136, 38, 6))
    detail.append(rrect_d(138, 354, 124, 26, 3))
    detail.append(ln((154, 363), (246, 363)) + ' ' + ln((170, 372), (230, 372)))
    return paths, chunks(detail, 30)


def tufts(anchors, amp, step=10.0, rng=None, lean=0.35):
    """Furry edge: a run of pointed tufts along a polyline (tips pushed to the left of travel and
    leaning backward along it). Returns (points, corner indices)."""
    r = resample(cr_sample(anchors, n=12), step)
    pts, corners = [], []
    for i, (a, b) in enumerate(zip(r, r[1:])):
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = dy / L, -dx / L
        h = amp * (rng.uniform(0.7, 1.2) if rng else 1.0)
        tip = (a[0] + dx * (0.5 + lean) + nx * h, a[1] + dy * (0.5 + lean) + ny * h)
        pts.append(a)
        pts.append(lerp(a, tip, 0.55))
        corners.append(len(pts))
        pts.append(tip)
    pts.append(r[-1])
    return pts, corners


def locks(anchors, amp, n, rng=None, lean=0.45, inner=2, side=1):
    """Fur edge made of n curved locks along a smooth run. Returns (outline d, inner-stroke d list,
    outline points). side=1 puts the tips to the left of travel."""
    base = resample(cr_sample(anchors, n=16), 1.0)
    L = len(base) - 1
    bs = [base[int(L * k / n)] for k in range(n + 1)]
    pts, corners, strokes = [bs[0]], [0], []
    for k in range(n):
        b0, b1 = bs[k], bs[k + 1]
        dx, dy = b1[0] - b0[0], b1[1] - b0[1]
        ll = math.hypot(dx, dy) or 1
        nx, ny = dy / ll * side, -dx / ll * side
        h = amp * (rng.uniform(0.75, 1.15) if rng else 1.0)
        T = (b0[0] + dx * (0.5 + lean) + nx * h, b0[1] + dy * (0.5 + lean) + ny * h)
        m1 = lerp(b0, T, 0.5)
        m1 = (m1[0] + nx * h * 0.18 - dx * 0.05, m1[1] + ny * h * 0.18 - dy * 0.05)
        m2 = lerp(T, b1, 0.5)
        m2 = (m2[0] - nx * h * 0.16, m2[1] - ny * h * 0.16)
        pts += [m1, T]
        corners.append(len(pts) - 1)
        pts += [m2, b1]
        corners.append(len(pts) - 1)
        for q in range(1, inner + 1):
            f = q / (inner + 1)
            a = lerp(b0, b1, f * 0.8)
            a = (a[0] - nx * 4, a[1] - ny * 4)
            e = lerp(T, b1, f * 0.55)
            e = lerp(a, e, 0.8)
            c = lerp(a, e, 0.5)
            c = (c[0] + nx * h * 0.12, c[1] + ny * h * 0.12)
            strokes.append(qd(a, c, e))
    return cr(pts, corners=corners), strokes, pts


def edge_fur(edge, region, rng, spacing, depth, tilt=0.35, curve=0.15, inset=3.0):
    """Short strokes just inside an edge polyline, pointing inward (tilted along the edge)."""
    out = []
    pts = resample(edge, spacing)
    for i in range(1, len(pts) - 1):
        a, b = pts[i - 1], pts[i + 1]
        tx, ty = b[0] - a[0], b[1] - a[1]
        L = math.hypot(tx, ty) or 1
        tx, ty = tx / L, ty / L
        nx, ny = -ty, tx
        p = pts[i]
        if not region.contains([(p[0] + nx * 6, p[1] + ny * 6)])[0]:
            nx, ny = -nx, -ny
        d = depth * rng.uniform(0.6, 1.1)
        dx, dy = nx + tx * tilt, ny + ty * tilt
        dl = math.hypot(dx, dy)
        dx, dy = dx / dl, dy / dl
        s0 = (p[0] + nx * inset, p[1] + ny * inset)
        s1 = (s0[0] + dx * d, s0[1] + dy * d)
        c = lerp(s0, s1, 0.5)
        c = (c[0] - dy * d * curve, c[1] + dx * d * curve)
        if region.contains([s1, c]).all():
            out.append(qd(s0, c, s1))
    return out


def stripe_shape(guide, w):
    """Slender closed stripe (tapered at both ends) around a guide curve."""
    c = resample(cr_sample(guide, n=10), 2)
    n = len(c)
    L, R = [], []
    for i, p in enumerate(c):
        t = i / (n - 1)
        hw = w * math.sin(math.pi * t) ** 0.8 / 2
        a, b = c[max(0, i - 1)], c[min(n - 1, i + 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]
        ll = math.hypot(tx, ty) or 1
        L.append((p[0] - ty / ll * hw, p[1] + tx / ll * hw))
        R.append((p[0] + ty / ll * hw, p[1] - tx / ll * hw))
    pts = resample(L, 6) + resample(R[::-1], 6)[1:-1]
    return cr(pts, True, corners=(0, len(resample(L, 6)) - 1))








def rrect_d(x, y, w, h, r):
    a = f'A {fm(r)} {fm(r)} 0 0 1'
    return (f'M {fm(x + r)} {fm(y)} L {fm(x + w - r)} {fm(y)} {a} {fm(x + w)} {fm(y + r)} '
            f'L {fm(x + w)} {fm(y + h - r)} {a} {fm(x + w - r)} {fm(y + h)} '
            f'L {fm(x + r)} {fm(y + h)} {a} {fm(x)} {fm(y + h - r)} L {fm(x)} {fm(y + r)} {a} {fm(x + r)} {fm(y)} Z')


# Dropped from the catalogue (2026-10-12 review: fur reads spiky, below the quality bar); kept as a study.
@study(id='wild-fox', name='Fox portrait', category='animals', level='advanced',
          tags=['fox', 'woodland', 'autumn', 'realistic', 'portrait', 'boho', 'forest'],
          detailWidth=1.4, coarse=True)
def fox():
    rng = random.Random(77)
    paths, detail = [], []
    rp, rd = [], []
    # ears
    ear = [(232, 102), (254, 70), (278, 44), (304, 20), (316, 56), (326, 94), (332, 124)]
    rp.append(cr(ear, corners=(3,)))
    rp.append(cr([(200, 110), (218, 108), (232, 102)]))
    ear_in = [(246, 106), (268, 74), (298, 40), (306, 78), (314, 116)]
    rd.append(cr(ear_in, corners=(2,)))
    # cheek ruff and jaw: soft locks of fur
    cd_, _, ruff_pts = locks([(332, 124), (346, 154), (362, 188), (374, 218)], 16, 3, rng, 0.6, 0)
    rp.append(cd_)
    jd, _, jaw_pts = locks([(374, 218), (346, 236), (314, 254), (284, 266)], 13, 3, rng, 0.6, 0)
    rp.append(jd)
    chin = [(284, 266), (262, 278), (240, 292), (222, 306), (200, 312)]
    rp.append(cr(chin))
    # eye
    eye = [(224, 180), (234, 170), (250, 164), (266, 166), (278, 170), (266, 181), (249, 187), (233, 186)]
    rp.append(cr(eye, True, corners=(0, 4)))
    ec = (251, 176)
    rp.append(circle(ec[0], ec[1], 9.5))
    rp.append(cr([(ec[0], ec[1] - 9), (ec[0] + 2.6, ec[1]), (ec[0], ec[1] + 9), (ec[0] - 2.6, ec[1])], True,
                  corners=(0, 2)))
    rd.append(circle(ec[0] - 4.5, ec[1] - 4.5, 2))
    for k in range(20):
        a = 2 * math.pi * k / 20
        if abs(math.cos(a)) < 0.3:
            continue
        rd.append(ln((ec[0] + 4.5 * math.cos(a), ec[1] + 5.5 * math.sin(a)), (ec[0] + 8.5 * math.cos(a),
                                                                            ec[1] + 8.5 * math.sin(a))))
    rd.append(cr([(222, 170), (240, 158), (260, 155), (284, 163)]))
    # dark tear line running from the eye toward the muzzle
    rd.append(stripe_shape([(228, 186), (226, 204), (220, 222)], 4))
    # muzzle bridge, nose, mouth
    bridge = [(222, 192), (222, 216), (216, 238), (211, 250)]
    rd.append(cr(bridge))
    nose = [(200, 248), (212, 250), (220, 256), (217, 266), (207, 273), (200, 274)]
    rp.append(cr(nose))
    rd.append(cr([(205, 257), (210, 260), (211, 266)]))
    rp.append(cr([(200, 274), (200, 282), (208, 290), (222, 290), (232, 284)]))
    # white cheek boundary
    cbd, _, _ = locks([(236, 196), (256, 216), (282, 228), (314, 230), (350, 222)], 8, 6, rng, 0.45, 0)
    rd.append(cbd)
    # whiskers
    for a, b, bend in (((234, 262), (320, 244), -5), ((236, 270), (326, 268), -2), ((234, 278), (312, 294), 3)):
        m = lerp(a, b, 0.5)
        rd.append(qd(a, (m[0], m[1] + bend), b))
    # fur: along the outline, inside the ears, down the brow and along the cheek boundary
    head_poly = (cr_sample([(200, 110), (232, 102)], n=6) + cr_sample(ear, n=8)[1:] + ruff_pts + jaw_pts +
                 cr_sample(chin, n=8) + [(200, 312)])
    head_reg = Region([head_poly])
    rd += edge_fur(cr_sample(ear, n=8)[2:] + ruff_pts + jaw_pts, head_reg, rng, 7, 15, 0.5)
    rd += edge_fur(cr_sample(ear_in, n=8), Region([cr_sample(ear_in, n=8)]), rng, 7, 11, 0.25)
    brow = Region([[(204, 114), (244, 108), (262, 136), (248, 156), (226, 162), (210, 176), (204, 176)]])
    rd += [h for h in hairs(brow, rng, 26, 11, lambda x, y: math.atan2(1.4, -(x - 200) / 40 - 0.15), 8.0,
                            (200, 106, 264, 178), 0.1)
           if float(re.match(r'M (-?[\d.]+)', h).group(1)) >= 204]
    rd += edge_fur(resample(cr_sample([(236, 196), (256, 216), (282, 228), (314, 230), (350, 222)], n=8), 2),
                   Region([[(236, 196), (256, 216), (282, 228), (314, 230), (350, 222), (340, 160), (270, 150)]]),
                   rng, 8, 12, 0.3)
    # neck and chest bib
    rp.append(cr([(298, 266), (306, 300), (322, 342), (352, 374), (392, 392)]))
    # chest fur: soft V-shaped flow lines under the chin and fur along the neck
    for k in range(6):
        x0 = 210 + k * 14
        y0 = 322 - k * 6
        rd.append(qd((x0, y0), (x0 + 4 + k * 2, y0 + 26), (x0 + 2 + k * 5, y0 + 50 + (k % 2) * 8)))
    for k in range(4):
        x0 = 218 + k * 18
        y0 = 360 - k * 4
        rd.append(qd((x0, y0), (x0 + 5, y0 + 16), (x0 + 3 + k * 3, y0 + 30)))
    neck = cr_sample([(298, 266), (306, 300), (322, 342), (352, 374), (392, 392)], n=8)
    rd += edge_fur(neck, Region([neck + [(200, 396), (200, 300)]]), rng, 9, 12, -0.4)
    paths += [both(d) for d in rp]
    detail += [both(d) for d in rd]
    return paths, chunks(detail, 30)


def tube_pts(ctrl, w0, w1, n=60):
    """Outline polygon (closed) of a tapered tube with a pointed-round tip."""
    cen = resample(cr_sample(ctrl, n=16), max(plen(cr_sample(ctrl, n=16)) / n, 0.5))
    m = len(cen)
    L, R = [], []
    for i, p in enumerate(cen):
        t = i / (m - 1)
        hw = (w0 + (w1 - w0) * t ** 0.9) / 2
        a, b = cen[max(0, i - 1)], cen[min(m - 1, i + 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]
        ll = math.hypot(tx, ty) or 1
        L.append((p[0] - ty / ll * hw, p[1] + tx / ll * hw))
        R.append((p[0] + ty / ll * hw, p[1] - tx / ll * hw))
    e, a = cen[-1], cen[-2]
    ux, uy = e[0] - a[0], e[1] - a[1]
    ul = math.hypot(ux, uy) or 1
    tip = (e[0] + ux / ul * w1 * 0.6, e[1] + uy / ul * w1 * 0.6)
    return L + [tip] + R[::-1], cen


@template(id='wild-stag', name='Stag head', category='animals', level='advanced',
          tags=['deer', 'stag', 'antlers', 'woodland', 'christmas', 'winter', 'realistic', 'vintage', 'rustic'],
          detailWidth=1.4, coarse=True)
def stag():
    rng = random.Random(9)
    paths, detail = [], []
    rp, rd = [], []
    # ---- antler (right): main beam plus tines, merged by clipping outlines against each other ----
    beam = ([(224, 116), (238, 96), (262, 80), (296, 66), (330, 44), (356, 18), (366, 6)], 18, 5)
    tines = [([(236, 100), (222, 84), (212, 66), (210, 48)], 11, 4),
             ([(272, 76), (270, 52), (264, 30), (256, 10)], 12, 4),
             ([(316, 54), (318, 34), (314, 16), (306, 4)], 11, 4),
             ([(300, 64), (330, 70), (358, 82), (380, 100)], 11, 4)]
    parts = [tube_pts(*beam)] + [tube_pts(*t) for t in tines]
    polys = [p for p, _ in parts]
    for k, (poly, cen) in enumerate(parts):
        others = Region([q for i, q in enumerate(polys) if i != k])
        loop = poly + [poly[0]] if k else poly
        for run in clip(resample(loop, 1.0), others, False, 3, 0.5):
            rp.append(fit(run, 0.5))
        # grooves along each tine/beam
        for off in (-0.22, 0.2):
            line_ = offset_open(cen, off * (beam[1] if k == 0 else tines[k - 1][1]))
            line_ = line_[int(len(line_) * 0.15):int(len(line_) * 0.8)]
            for run in clip(line_, others, False, 6, 0.8):
                rd.append(fit(run, 0.6))
    # burr (coronet) at the base of the antler
    burr = [(214, 120), (220, 112), (226, 114), (232, 110), (238, 116), (236, 124)]
    rp.append(cr(burr, corners=(1, 2, 3, 4)))
    # ---- head ----
    head = [(200, 116), (214, 120), (236, 124), (248, 142), (256, 168), (258, 196), (252, 228), (242, 262),
            (234, 292), (230, 318), (224, 338), (212, 348), (200, 350)]
    rp.append(cr(head))
    # ear
    ear = [(250, 148), (282, 128), (322, 118), (352, 126), (338, 146), (304, 164), (262, 176)]
    rp.append(cr(ear, corners=(3,)))
    rd.append(cr([(262, 158), (296, 140), (334, 128)]))
    for k in range(5):
        a = lerp((268, 166), (330, 140), k / 5)
        rd.append(qd(a, (a[0] + 6, a[1] - 6), (a[0] + 14, a[1] - 10)))
    # eye with lid and lashes line
    eye = [(240, 192), (248, 186), (258, 188), (262, 196), (254, 202), (244, 200)]
    rp.append(cr(eye, True))
    rp.append(circle(252, 194, 3.4))
    rd.append(cr([(236, 186), (248, 178), (262, 182)]))
    rd.append(cr([(238, 208), (248, 212), (258, 208)]))
    # tear duct groove
    rd.append(cr([(240, 202), (236, 216), (238, 232)]))
    # muzzle: nose pad, nostrils, mouth
    nose = [(200, 314), (212, 314), (222, 320), (224, 332), (214, 338), (200, 338)]
    rp.append(cr(nose))
    rp.append(cr([(207, 324), (215, 320), (219, 326), (213, 331)], True, corners=(0,)))
    rd.append(cr([(200, 338), (200, 346)]))
    rd.append(cr([(200, 346), (210, 350), (220, 346)]))
    # forehead whorl and fur strokes following the long face
    face = Region([cr_sample(head, n=8) + [(200, 350)]]).minus(
        offset_closed(cr_sample(eye, True, n=6), 5), offset_closed(cr_sample(nose, n=6) + [(200, 314)], 5))
    fband = offset_closed(cr_sample(head, n=8) + [(200, 350)], -16)
    if abs(ccw_area(fband)) > abs(ccw_area(cr_sample(head, n=8) + [(200, 350)])):
        fband = offset_closed(cr_sample(head, n=8) + [(200, 350)], 16)
    face = face.minus([p for p in fband if p[1] > 170] + [(200, 300)])
    fur = hairs(face, rng, 90, 10,
                lambda x, y: math.atan2(y - 150, (x - 200) * 0.6) if y > 160 else math.atan2(y - 150, x - 200) + 0.6,
                8.5, (200, 116, 260, 340), 0.12)
    rd += [h for h in fur if float(re.match(r'M (-?[\d.]+)', h).group(1)) >= 203]
    # ---- neck and chest ruff ----
    rp.append(cr([(250, 236), (272, 270), (296, 310), (318, 352), (334, 394)]))
    for k in range(6):
        y = 280 + k * 18
        x = 214 + k * 2
        rd.append(cr([(x + 20, y), (x + 34, y + 12), (x + 40, y + 28)]))
    neck_reg = Region([[(236, 270), (276, 276), (300, 316), (322, 360), (334, 396), (202, 396), (202, 352),
                        (222, 346)]])
    fur2 = hairs(neck_reg, rng, 80, 13, lambda x, y: math.atan2(1, 0.25 * (x - 200) / 60), 9.0,
                 (200, 270, 336, 396), 0.15)
    rd += [h for h in fur2 if float(re.match(r'M (-?[\d.]+)', h).group(1)) >= 203]
    paths += [both(d) for d in rp]
    detail += [both(d) for d in rd]
    return paths, chunks(detail, 30)


@template(id='wild-cat-portrait', name='Cat face portrait', category='animals', level='advanced',
          tags=['cat', 'kitten', 'pet', 'portrait', 'realistic', 'tabby', 'gift'],
          detailWidth=1.4, coarse=True)
def cat_portrait():
    rng = random.Random(15)
    paths, detail = [], []
    rp, rd = [], []
    # ears
    ear = [(230, 100), (252, 78), (278, 54), (302, 34), (314, 70), (322, 104), (326, 132)]
    rp.append(cr(ear, corners=(3,)))
    rp.append(cr([(200, 98), (216, 98), (230, 100)]))
    ear_in = [(246, 108), (270, 80), (296, 54), (304, 90), (310, 124)]
    rd.append(cr(ear_in, corners=(2,)))
    for k in range(6):
        base = lerp((256, 120), (310, 128), (k + 0.6) / 6.5)
        tip = lerp(base, (290, 60), 0.4 + 0.14 * math.sin(k * 1.7))
        rd.append(qd(base, (lerp(base, tip, 0.5)[0] - 4, lerp(base, tip, 0.5)[1]), tip))
    # cheeks with fluffy locks, jaw and chin
    cd_, cs_, cheek_pts = locks([(326, 132), (338, 164), (348, 196), (352, 222)], 12, 3, rng, 0.55, 0)
    rp.append(cd_)
    rd += cs_
    jd, js, jaw_pts = locks([(352, 222), (334, 248), (304, 268), (270, 284)], 10, 3, rng, 0.55, 0)
    rp.append(jd)
    rd += js
    chin = [(270, 284), (244, 294), (222, 300), (200, 302)]
    rp.append(cr(chin))
    # eye: almond with iris fibres, slit pupil and highlight
    ec = (254, 180)
    eye = [(222, 184), (234, 168), (254, 160), (276, 165), (288, 176), (276, 192), (254, 199), (234, 195)]
    rp.append(cr(eye, True, corners=(0, 4)))
    rp.append(circle(ec[0], ec[1], 15.5))
    rp.append(cr([(ec[0], ec[1] - 14), (ec[0] + 4.5, ec[1]), (ec[0], ec[1] + 14), (ec[0] - 4.5, ec[1])], True,
                  corners=(0, 2)))
    rd.append(circle(ec[0] - 7, ec[1] - 7, 3))
    for k in range(30):
        a = 2 * math.pi * k / 30
        x0, y0 = ec[0] + 7.5 * math.cos(a), ec[1] + 7.5 * math.sin(a)
        if abs(x0 - ec[0]) < 5.5:
            x0 = ec[0] + 5.5 * (1 if math.cos(a) >= 0 else -1)
            y0 = ec[1] + 13 * math.sin(a) * 0.9
        x1, y1 = ec[0] + 14 * math.cos(a), ec[1] + 14 * math.sin(a)
        if math.dist((x1, y1), (ec[0] - 6, ec[1] - 7)) < 5 or abs(math.cos(a)) < 0.25:
            continue
        rd.append(ln((x0, y0), (x1, y1)))
    rd.append(cr([(220, 176), (232, 160), (256, 152), (282, 158), (294, 170)]))  # upper lid fold
    # nose, mouth, whisker pads, whiskers
    nose = [(200, 226), (212, 223), (218, 228), (210, 238), (200, 244)]
    rp.append(cr(nose))
    rp.append(cr([(200, 244), (200, 252), (208, 262), (220, 263), (230, 256)]))
    rd.append(cr([(202, 230), (208, 230), (210, 234)]))
    for x, y in ((226, 244), (236, 240), (246, 244), (232, 252), (242, 252)):
        rd.append(circle(x, y, 1.4))
    for a, b, bend in (((238, 238), (372, 214), -10), ((242, 246), (382, 240), -6), ((240, 254), (378, 268), -2),
                       ((236, 262), (360, 292), 4)):
        m = lerp(a, b, 0.5)
        rd.append(qd(a, (m[0], m[1] + bend), b))
    # tabby markings drawn as clusters of fur strokes
    for g, w in (([(214, 104), (217, 124), (212, 144)], 6), ([(230, 110), (237, 128), (229, 148)], 6),
                 ([(246, 122), (256, 136), (250, 150)], 5)):
        rd.append(stripe_shape(g, w))
    for g, w in (([(296, 188), (318, 196), (340, 208)], 6), ([(294, 202), (316, 216), (334, 234)], 6),
                 ([(282, 218), (300, 234), (314, 250)], 5)):
        rd.append(stripe_shape(g, w))
    # fur along the outline and around the eye
    head_poly = cr_sample([(200, 98), (230, 100)], n=6) + cr_sample(ear, n=8)[1:] + cheek_pts + jaw_pts + \
        cr_sample(chin, n=8) + [(200, 302)]
    head_reg = Region([head_poly + [(200, 302)]])
    rd += edge_fur(cr_sample(ear, n=8)[2:] + cheek_pts + jaw_pts, head_reg, rng, 7, 14, 0.5)
    rd += edge_fur(cr_sample(ear_in, n=8), Region([cr_sample(ear_in, n=8)]), rng, 8, 10, 0.2)
    rd += edge_fur(cr_sample(chin, n=8), head_reg, rng, 9, 10, -0.3)
    # chest fluff: soft locks
    rp.append(cr([(296, 274), (304, 306), (322, 346), (352, 376), (390, 392)]))
    for y0, x1, amp in ((326, 280, 5), (356, 306, 6), (386, 334, 6)):
        row = resample(cr_sample([(200, y0 + 6), ((200 + x1) / 2, y0 + 2), (x1, y0 - 10)], n=10), 22)
        if len(row) % 2 == 0:
            row = resample(cr_sample([(200, y0 + 6), ((200 + x1) / 2, y0 + 2), (x1, y0 - 10)], n=10), 19)
        rd.append(scallop_d(row, -amp))
    paths += [both(d) for d in rp]
    detail += [both(d) for d in rd]
    detail.append(stripe_shape([(200, 104), (201, 124), (200, 146)], 6))
    return paths, chunks(detail, 30)


@template(id='wild-sleeping-cat', name='Sleeping cat', category='animals', level='intermediate',
          tags=['cat', 'kitten', 'pet', 'sleep', 'cosy', 'cute', 'tabby', 'baby'])
def sleeping_cat():
    rng = random.Random(21)
    paths, detail = [], []
    # cushion
    cush = [(36, 318), (60, 296), (140, 290), (260, 290), (344, 296), (370, 318), (360, 346), (300, 362),
            (200, 366), (100, 362), (44, 346)]
    # head
    head = [(92, 250), (96, 214), (104, 196), (100, 168), (124, 184), (146, 182), (164, 166), (172, 196),
            (180, 222), (178, 252), (164, 276), (132, 284), (104, 274)]
    head_pts = cr_sample(head, True, n=8, corners=(3, 7))
    paths.append(cr(head, True, corners=(3, 7)))
    # body: big curled mound behind the head
    body = [(166, 178), (196, 150), (246, 138), (298, 152), (336, 190), (348, 238), (334, 278), (306, 300)]
    body_d = cr_sample(body, n=10)
    hreg = Region([head_pts])
    paths.append(' '.join(fit(r, 0.5) for r in clip(body_d, hreg, False, 4)))
    # tail wrapping round the front, tip resting by the face
    tail_out = [(306, 300), (282, 318), (230, 328), (170, 326), (120, 314), (86, 296), (72, 274), (82, 262)]
    tail_in = [(300, 286), (270, 300), (224, 308), (170, 308), (130, 298), (104, 284), (94, 270), (82, 262)]
    paths.append(cr(tail_out))
    paws_reg = Region([ellipse_pts(150, 300, 18, 11), ellipse_pts(188, 304, 18, 11)])
    def paw_poly(cx, cy):
        return cr_sample([(cx - 18, cy + 8), (cx - 16, cy - 6), (cx, cy - 12), (cx + 16, cy - 6), (cx + 18, cy + 8)], n=8)
    pawr = Region([head_pts, paw_poly(146, 296), paw_poly(184, 302)])
    paths.append(' '.join(fit(r, 0.5) for r in clip(cr_sample(tail_in, n=10), pawr, False, 4)))
    # front paws peeking over the tail
    for cx, cy in ((146, 296), (184, 302)):
        pp = cr_sample([(cx - 18, cy + 8), (cx - 16, cy - 6), (cx, cy - 12), (cx + 16, cy - 6), (cx + 18, cy + 8)], n=8)
        paths.append(' '.join(fit(r, 0.5) for r in clip(pp, hreg, False, 3)))
        for dx in (-6, 6):
            detail.append(ln((cx + dx, cy - 9), (cx + dx * 0.9, cy - 3)))
    # cushion drawn behind everything
    creg = Region([cr_sample(tail_out, n=8) + cr_sample(tail_in, n=8)[::-1], body_d + [(230, 300), (166, 178)],
                   head_pts, cr_sample(tail_in, n=8) + [(166, 200), (300, 200)]])
    cdense = cr_sample(cush, True, n=10)
    paths.append(' '.join(fit(r, 0.5) for r in clip(cdense, creg, False, 4)))
    cseam = cr_sample([(48, 324), (120, 344), (200, 350), (280, 344), (356, 324)], n=10)
    detail.append(' '.join(fit(r, 0.5) for r in clip(cseam, creg, False, 4)))
    for x, y in ((36, 318), (370, 318)):
        sgn = -1 if x < 200 else 1
        detail.append(cr([(x, y), (x + 10 * sgn, y + 6), (x + 14 * sgn, y + 16)]) + ' ' +
                      cr([(x, y), (x + 14 * sgn, y + 2), (x + 22 * sgn, y + 8)]))
    # face: closed eyes, nose, mouth, whiskers, inner ears
    for ex in (118, 154):
        paths.append(cr([(ex - 10, 232), (ex, 238), (ex + 10, 232)]))
        detail.append(ln((ex - 6, 237), (ex - 9, 242)) + ' ' + ln((ex + 4, 239), (ex + 5, 244)))
    paths.append(cr([(130, 252), (136, 250), (142, 252), (136, 258)], True, corners=(0, 2)))
    detail.append(cr([(136, 258), (132, 264), (126, 264)]) + ' ' + cr([(136, 258), (140, 264), (146, 264)]))
    for a, b in (((118, 258), (70, 250)), ((118, 263), (72, 266)), ((154, 258), (200, 246)), ((154, 263), (204, 262))):
        detail.append(qd(a, (lerp(a, b, 0.5)[0], lerp(a, b, 0.5)[1] - 3), b))
    detail.append(cr([(106, 200), (106, 180), (122, 192)]))
    detail.append(cr([(150, 190), (162, 176), (164, 198)]))
    # tabby stripes over the back, radiating from the spine
    breg = Region([body_d + [(170, 280), (166, 178)]]).minus(head_pts)
    spine = cr_sample([(200, 152), (250, 144), (300, 160), (334, 200)], n=10)
    for t in (0.08, 0.24, 0.4, 0.56, 0.72, 0.88):
        p = spine[int(t * (len(spine) - 1))]
        q = lerp(p, (230, 262), 0.42)
        mid = lerp(p, q, 0.5)
        sh = stripe_shape([p, (mid[0] + 6, mid[1]), q], 9)
        detail.append(sh)
    # tail stripes
    for t in (0.12, 0.3, 0.48, 0.66, 0.82):
        a = cr_sample(tail_out, n=10)[int(t * 70)]
        b = cr_sample(tail_in, n=10)[int(t * 70)]
        detail.append(qd(lerp(a, b, 0.05), lerp(lerp(a, b, 0.5), (a[0] - 4, a[1]), 0.3), lerp(a, b, 0.95)))
    # fur along the back
    detail += edge_fur(body_d[8:-6], Region([body_d + [(230, 260)]]), rng, 12, 10, 0.4)
    def T(d):
        return move_d(scale_d(d, 1.04, (200, 250)), 0, -52)
    return [T(d) for d in paths], [T(d) for d in chunks(detail, 30)]


def leaf_d(base, ang, L, w, vein=True):
    """Leaf shape from base pointing at ang (degrees, 0 = up, clockwise); returns (outline, midrib)."""
    a = math.radians(ang)
    ux, uy = math.sin(a), -math.cos(a)
    nx, ny = -uy, ux

    def Q(t, s):
        return (base[0] + ux * L * t + nx * s, base[1] + uy * L * t + ny * s)
    out = cr([Q(0, 0), Q(0.25, w * 0.85), Q(0.6, w * 0.9), Q(1, 0), Q(0.6, -w * 0.9), Q(0.25, -w * 0.85)], True,
             corners=(0, 3))
    mid = cr([Q(0.02, 0), Q(0.5, w * 0.08), Q(0.88, 0)])
    veins = []
    for t in (0.25, 0.42, 0.59, 0.74):
        for sgn in (1, -1):
            p0 = Q(t, w * 0.04 * sgn)
            p1 = Q(t + 0.14, w * 0.62 * sgn * (1.1 - t))
            veins.append(qd(p0, Q(t + 0.05, w * 0.4 * sgn * (1.1 - t)), p1))
    return out, mid, veins


@template(id='wild-hummingbird', name='Hummingbird and blossom', category='wildlife', level='intermediate',
          tags=['hummingbird', 'bird', 'flower', 'garden', 'botanical', 'summer', 'realistic', 'spring'])
def hummingbird():
    rng = random.Random(8)
    paths, detail = [], []
    # ---- bird ----
    head = [(200, 172), (184, 150), (168, 140), (150, 142), (138, 156), (140, 172), (152, 184), (168, 192)]
    body = [(168, 192), (186, 206), (206, 228), (226, 254), (246, 278), (262, 298)]
    back = [(200, 172), (224, 186), (246, 210), (262, 238), (274, 266), (278, 290)]
    paths.append(cr(head))
    paths.append(cr(body))
    paths.append(cr(back))
    # beak
    paths.append(cr([(142, 160), (110, 170), (78, 182), (64, 188)]))
    paths.append(cr([(144, 168), (112, 176), (80, 185), (64, 188)]))
    # eye
    paths.append(circle(160, 158, 4.5))
    detail.append(circle(158.5, 156.5, 1.2))
    detail.append(cr([(150, 152), (160, 150), (170, 154)]))
    # tail fan
    tail_base = [(262, 298), (278, 290)]
    for k, ang in enumerate((150, 165, 180, 195)):
        a = math.radians(ang)
        b0 = lerp(tail_base[0], tail_base[1], k / 3)
        tip = (b0[0] + 64 * math.sin(a) * -1 + 14, b0[1] - 64 * math.cos(a))
        pts = [b0, (lerp(b0, tip, 0.5)[0] + 7, lerp(b0, tip, 0.5)[1]), tip,
               (lerp(b0, tip, 0.5)[0] - 6, lerp(b0, tip, 0.5)[1] + 2)]
        paths.append(cr(pts, True, corners=(0, 2)))
        detail.append(ln(lerp(b0, tip, 0.1), lerp(b0, tip, 0.8)))
    # throat gorget scales and belly feathering
    breg = Region([cr_sample(head, n=8) + cr_sample(body, n=8) + cr_sample(back[::-1], n=8)])
    gorget = Region([[(146, 176), (168, 194), (196, 214), (210, 200), (190, 182), (170, 172), (152, 170)]])
    detail += scale_rows(gorget, 140, 214, 168, 214, 11, 8, shaft=False)
    belly = Region([[(196, 214), (226, 254), (250, 286), (266, 270), (246, 230), (222, 200)]])
    detail += [h for h in hairs(belly, rng, 30, 8, lambda x, y: math.atan2(1, 0.8), 7, (190, 196, 270, 290), 0.2)]
    # wings: raised, long and pointed, primaries drawn as nested feather lines
    def wing(root_a, root_b, tip, n, bend):
        lead = cr_sample([root_a, lerp(root_a, tip, 0.5), tip], n=12)
        mid = lerp(root_a, tip, 0.5)
        lead = cr_sample([root_a, (mid[0] - bend, mid[1] - bend * 0.3), tip], n=12)
        trail = cr_sample([tip, (lerp(root_b, tip, 0.55)[0] + bend * 1.2, lerp(root_b, tip, 0.55)[1] + bend * 0.6),
                           root_b], n=12)
        outline = cr(resample(lead, 8) + resample(trail, 8)[1:], corners=(len(resample(lead, 8)) - 1,))
        lines = []
        for k in range(1, n):
            f = k / n
            r0 = lerp(root_a, root_b, f)
            e = lerp(tip, trail[int(len(trail) * f * 0.9)], 0.15 + 0.85 * f)
            c = lerp(r0, e, 0.5)
            lines.append(qd(r0, (c[0] + bend * 0.4, c[1] + bend * 0.2), e))
        # coverts near the root
        cov = [lerp(lerp(root_a, root_b, k / 5), tip, 0.18) for k in range(6)]
        lines.append(scallop_d(cov, 3))
        return outline, lines
    w2o, w2l = wing((214, 180), (236, 196), (346, 60), 6, 10)
    w1o, w1l = wing((204, 176), (226, 192), (300, 30), 7, 12)
    w1reg = Region([cr_sample([(204, 176), (300, 30), (226, 192)], True, n=4)])
    paths.append(w1o)
    detail += w1l
    # back wing is partly hidden by the front one
    w2pts = sample_d(w2o, 8)
    paths.append(' '.join(fit(r, 0.5) for r in clip(w2pts, Region([sample_d(w1o, 8)]), False, 4)))
    for d in w2l:
        pts = sample_d(d, 8) if 'Q' not in d else cr_sample(
            [tuple(map(float, d.split()[1:3])), tuple(map(float, d.split()[4:6])), tuple(map(float, d.split()[6:8]))], n=10)
        for run in clip(pts, Region([sample_d(w1o, 8)]), False, 4):
            detail.append(fit(run, 0.5))
    bird_p = [move_d(d, 30, 12) for d in paths]
    bird_d = [move_d(d, 30, 12) for d in detail]
    paths, detail = bird_p, bird_d
    # ---- flower: large hanging trumpet blossom on a curving stem; the beak tip is at (94, 200) ----
    paths.append(cr([(6, 8), (36, 36), (56, 72), (58, 100), (52, 114)]))
    for base, ang, L, w in (((32, 32), 78, 84, 18), ((56, 70), 112, 70, 16)):
        lo, lm, lv = leaf_d(base, ang, L, w)
        paths.append(lo)
        detail.append(lm)
        detail += lv
    paths.append(cr([(44, 112), (50, 126), (62, 124), (60, 110)], True))
    detail.append(cr([(50, 114), (52, 122)]) + ' ' + cr([(56, 112), (58, 122)]))
    tube_top = [(60, 124), (74, 144), (88, 164), (100, 178)]
    tube_bot = [(48, 128), (52, 152), (62, 178), (74, 196)]
    paths.append(cr(tube_top))
    paths.append(cr(tube_bot))
    # flared mouth: five rounded lobes around the opening
    mc = (94, 198)
    anchors = [(100, 178)] + [(mc[0] + 27 * math.cos(math.radians(a)), mc[1] + 27 * math.sin(math.radians(a)))
                              for a in (-40, 10, 60, 110)] + [(74, 196)]
    paths.append(scallop_d(anchors, 7))
    detail.append(ellipse(mc[0] + 2, mc[1] + 2, 9, 6, 50))
    for a, b in (((66, 140), (86, 176)), ((58, 146), (72, 182)), ((54, 136), (60, 164))):
        detail.append(cr([a, lerp(lerp(a, b, 0.5), (a[0] + 6, a[1]), 0.2), b]))
    # stamens reaching out of the flower
    for (x, y) in ((126, 236), (114, 242), (132, 226)):
        detail.append(qd((98, 200), ((98 + x) / 2 + 4, (200 + y) / 2 - 4), (x, y)))
        detail.append(ellipse(x, y, 3, 2, 30))
    # bud
    paths.append(cr([(52, 114), (36, 130), (26, 156), (32, 168), (42, 156), (48, 132)], True))
    detail.append(cr([(36, 140), (34, 156)]))
    return paths, chunks(detail, 30)


# === MAIN ===

ORDER_LEVEL = {'beginner': 0, 'intermediate': 1, 'advanced': 2}


def check(t):
    allp = t['paths'] + t.get('detail', [])
    chars = sum(len(d) for d in allp)
    assert len(allp) <= 300, (t['id'], 'too many paths', len(allp))
    if chars > 30000:
        import os
        assert os.environ.get('WILD_NOBUDGET'), (t['id'], 'too many chars', chars)
        print('OVER BUDGET', t['id'], chars)
    for d in allp:
        assert d.startswith('M'), (t['id'], d[:30])
        assert re.fullmatch(r'[MLCQAZ0-9. \-]+', d), (t['id'], d[:60])
        nums = [float(x) for x in re.findall(r'-?\d*\.?\d+', d)]
        # cheap bounds check (arc radii/flags are small numbers so they pass too)
        assert all(-4 <= x <= 404 for x in nums), (t['id'], 'out of bounds', min(nums), max(nums))
    return chars, len(allp)


def q(s):
    assert "'" not in s and '\\' not in s
    return f"'{s}'"


def main():
    import sys
    only = sys.argv[1:]
    out = []
    for meta, fn in TEMPLATES:
        paths, detail = fn()
        paths = [d for d in paths if d]
        detail = [d for d in detail if d]
        if meta.get('coarse'):
            # integer coordinates for the fine detail layer keep big drawings inside the size budget
            detail = [re.sub(r'-?\d+\.\d+', lambda m: fm(round(float(m.group()))), d) for d in detail]
        t = dict(meta)
        t.pop('coarse', None)
        t['paths'] = paths
        if detail:
            t['detail'] = detail
        chars, n = check(t)
        if not only or any(t['id'].startswith(o) for o in only):
            print(f"{t['id']:28s} {t['level']:12s} {n:4d} paths {chars:6d} chars", file=sys.stderr)
        out.append(t)
    out.sort(key=lambda t: ORDER_LEVEL[t['level']])
    lines = [
        '// Template art: birds, insects, sea life, mammals and pets. Original line art authored in this repo',
        '// (see docs/TEMPLATES.md). Generated by scripts/templategen/wildlife.py — edit the generator.',
        "import type { Template } from '../templates.ts';",
        '',
        'export const wildlife: Template[] = [',
    ]
    for t in out:
        lines.append('  {')
        for k in ('id', 'name', 'category', 'level'):
            lines.append(f'    {k}: {q(t[k])},')
        lines.append(f"    tags: [{', '.join(q(x) for x in t['tags'])}],")
        lines.append("    viewBox: '0 0 400 400',")
        for k in ('strokeWidth', 'detailWidth'):
            if k in t:
                lines.append(f'    {k}: {t[k]},')
        for k in ('paths', 'detail'):
            if k in t:
                lines.append(f'    {k}: [')
                for d in t[k]:
                    lines.append(f'      {q(d)},')
                lines.append('    ],')
        lines.append('  },')
    lines.append('];')
    OUT.write_text('\n'.join(lines) + '\n')
    print(f'wrote {len(out)} templates to {OUT.relative_to(ROOT)}', file=sys.stderr)


if __name__ == '__main__':
    main()
