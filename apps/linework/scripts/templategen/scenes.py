#!/usr/bin/env python3
"""Generator for src/core/templateArt/scenes.ts (buildings, landscapes, fantasy, still life, faces).

Dev-time only. Every template is original line art constructed here from parametric curves,
hand-placed Catmull-Rom / Bezier control points and seeded procedural detail. A tiny
"painter's" line-art engine draws objects back to front: each opaque shape erases the parts
of earlier strokes that fall inside it, so overlaps read correctly without manual trimming.
Dense polylines are then fitted with cubic Beziers (Schneider) and written as 1-decimal
absolute SVG path data.

Usage:
  python3 scripts/templategen/scenes.py                 # write src/core/templateArt/scenes.ts
  python3 scripts/templategen/scenes.py --preview DIR [id ...]   # also render PNGs to DIR
"""
from __future__ import annotations

import json
import math
import pathlib
import sys

import numpy as np
from matplotlib.path import Path as MPath
from scipy.spatial import cKDTree

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'src' / 'core' / 'templateArt' / 'scenes.ts'

# ------------------------------------------------------------------------------------------------
# geometry helpers
# ------------------------------------------------------------------------------------------------


def A(pts):
    return np.asarray(pts, dtype=float).reshape(-1, 2)


def catmull(ctrl, closed=False, step=0.6, alpha=0.5):
    """Centripetal Catmull-Rom spline through control points, sampled densely."""
    P = A(ctrl)
    if closed:
        P = np.vstack([P[-1], P, P[0], P[1]])
    else:
        P = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        t0 = 0.0
        t1 = t0 + max(np.linalg.norm(p1 - p0), 1e-6) ** alpha
        t2 = t1 + max(np.linalg.norm(p2 - p1), 1e-6) ** alpha
        t3 = t2 + max(np.linalg.norm(p3 - p2), 1e-6) ** alpha
        n = max(2, int(np.linalg.norm(p2 - p1) / step))
        for t in np.linspace(t1, t2, n, endpoint=False):
            a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
            a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
            a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
            b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2
            b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3
            out.append((t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2)
    out.append(P[-2] if not closed else P[1])
    return A(out)


def cubic(p0, p1, p2, p3, n=None):
    p0, p1, p2, p3 = map(np.asarray, (p0, p1, p2, p3))
    if n is None:
        n = max(8, int((np.linalg.norm(p1 - p0) + np.linalg.norm(p2 - p1) + np.linalg.norm(p3 - p2)) / 0.6))
    t = np.linspace(0, 1, n)[:, None]
    u = 1 - t
    return u ** 3 * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t ** 3 * p3


def bchain(*segs):
    """Chain of cubic segments: bchain(p0, (c1, c2, p1), (c1, c2, p2), ...)."""
    pts = [np.asarray(segs[0], float)]
    out = [pts[0][None]]
    cur = pts[0]
    for c1, c2, p in segs[1:]:
        seg = cubic(cur, c1, c2, p)
        out.append(seg[1:])
        cur = np.asarray(p, float)
    return np.vstack(out)


def arc(cx, cy, rx, ry, a0, a1, rot=0.0, step=0.6):
    """Elliptical arc, angles in degrees (0 = +x, counter-clockwise in math sense, y down screen)."""
    span = abs(a1 - a0) * math.pi / 180 * max(rx, ry)
    n = max(6, int(span / step))
    t = np.radians(np.linspace(a0, a1, n))
    x = rx * np.cos(t)
    y = ry * np.sin(t)
    r = math.radians(rot)
    return A(np.c_[cx + x * math.cos(r) - y * math.sin(r), cy + x * math.sin(r) + y * math.cos(r)])


def ell(cx, cy, rx, ry, rot=0.0):
    return arc(cx, cy, rx, ry, 0, 360, rot)[:-1]


def circ(cx, cy, r):
    return ell(cx, cy, r, r)


def rect(x, y, w, h):
    return A([(x, y), (x + w, y), (x + w, y + h), (x, y + h)])


def tf(pts, dx=0.0, dy=0.0, s=1.0, rot=0.0, ox=0.0, oy=0.0, sx=None, sy=None):
    """Scale/rotate about (ox, oy) then translate."""
    P = A(pts) - [ox, oy]
    P = P * [sx if sx is not None else s, sy if sy is not None else s]
    r = math.radians(rot)
    c, si = math.cos(r), math.sin(r)
    P = np.c_[P[:, 0] * c - P[:, 1] * si, P[:, 0] * si + P[:, 1] * c]
    return P + [ox + dx, oy + dy]


def mirror(pts, axis):
    P = A(pts).copy()
    P[:, 0] = 2 * axis - P[:, 0]
    return P


def resample(P, step=0.5, closed=False):
    """Insert points so no segment is longer than step; keeps the original vertices."""
    P = A(P)
    if closed:
        P = np.vstack([P, P[:1]])
    out = [P[0]]
    for a, b in zip(P[:-1], P[1:]):
        d = np.linalg.norm(b - a)
        n = int(math.ceil(d / step))
        if n > 1:
            for k in range(1, n):
                out.append(a + (b - a) * k / n)
        out.append(b)
    return A(out)


def plen(P):
    P = A(P)
    return float(np.sum(np.linalg.norm(np.diff(P, axis=0), axis=1))) if len(P) > 1 else 0.0


def offset_closed(P, d):
    """Approximate offset of a closed smooth curve (positive = outward for CCW-on-screen?)."""
    P = A(P)
    n = len(P)
    nxt = np.roll(P, -1, axis=0)
    prv = np.roll(P, 1, axis=0)
    t = nxt - prv
    t /= np.linalg.norm(t, axis=1)[:, None] + 1e-9
    nrm = np.c_[t[:, 1], -t[:, 0]]
    Q = P + nrm * d
    # make the sign mean "outward": compare areas
    if abs(area(Q)) < abs(area(P)) and d > 0 or abs(area(Q)) > abs(area(P)) and d < 0:
        Q = P - nrm * d
    return Q


def offset_open(P, d):
    P = A(P)
    t = np.gradient(P, axis=0)
    t /= np.linalg.norm(t, axis=1)[:, None] + 1e-9
    return P + np.c_[t[:, 1], -t[:, 0]] * d


def area(P):
    P = A(P)
    x, y = P[:, 0], P[:, 1]
    return 0.5 * float(np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y))


def along(P, t):
    """Point and unit tangent at fraction t of arc length."""
    P = A(P)
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    cum = np.r_[0, np.cumsum(seg)]
    s = t * cum[-1]
    i = int(np.clip(np.searchsorted(cum, s) - 1, 0, len(seg) - 1))
    u = (s - cum[i]) / max(seg[i], 1e-9)
    p = P[i] + (P[i + 1] - P[i]) * u
    tg = (P[i + 1] - P[i]) / max(seg[i], 1e-9)
    return p, tg


def sub(P, t0, t1):
    """Sub-curve between arc-length fractions t0..t1."""
    P = resample(P, 0.5)
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    cum = np.r_[0, np.cumsum(seg)] / max(np.sum(seg), 1e-9)
    m = (cum >= t0) & (cum <= t1)
    return P[m]


def lerp(a, b, t):
    return (1 - t) * np.asarray(a, float) + t * np.asarray(b, float)


# ------------------------------------------------------------------------------------------------
# region helpers (point-in-polygon with holes)
# ------------------------------------------------------------------------------------------------


class Region:
    """Union of polygons minus holes. inside(points) -> bool mask; margin keeps points off edges."""

    def __init__(self, polys, holes=()):
        self.polys = [A(p) for p in polys]
        self.holes = [A(h) for h in holes]
        self.mp = [MPath(p) for p in self.polys]
        self.mh = [MPath(h) for h in self.holes]
        bnd = []
        for i, p in enumerate(self.polys):
            Q = resample(p, 0.4, True)
            if len(self.polys) > 1:
                inner = np.zeros(len(Q), bool)
                for j, mp in enumerate(self.mp):
                    if j != i:
                        inner |= mp.contains_points(Q)
                Q = Q[~inner] if (~inner).any() else Q[:1]
            bnd.append(Q)
        bnd += [resample(h, 0.4, True) for h in self.holes]
        self.tree = cKDTree(np.vstack(bnd))

    def inside(self, pts, margin=0.0):
        pts = A(pts)
        m = np.zeros(len(pts), bool)
        for mp in self.mp:
            m |= mp.contains_points(pts)
        for mh in self.mh:
            m &= ~mh.contains_points(pts)
        if margin:
            d, _ = self.tree.query(pts)
            m &= d > margin
        return m

    def dist(self, pts):
        return self.tree.query(A(pts))[0]


def R(*polys, holes=()):
    return Region(polys, holes)


def runs(P, keep, minlen=1.5):
    """Split polyline P where keep is False; return kept sub-polylines."""
    out = []
    cur = []
    for p, k in zip(P, keep):
        if k:
            cur.append(p)
        else:
            if len(cur) > 1 and plen(cur) >= minlen:
                out.append(A(cur))
            cur = []
    if len(cur) > 1 and plen(cur) >= minlen:
        out.append(A(cur))
    return out


def clip_in(P, region, margin=1.2, minlen=1.5):
    P = resample(P, 0.5)
    return runs(P, region.inside(P, margin) if margin else region.inside(P), minlen)


def clip_out(P, region, margin=1.2, minlen=1.5):
    P = resample(P, 0.5)
    ins = region.inside(P)
    if margin:
        ins |= region.dist(P) <= margin
    return runs(P, ~ins, minlen)


def hatch(region, angle, spacing, margin=1.5, phase=0.0, minlen=2.0, wobble=0.0, rng=None, bbox=None):
    """Parallel straight hatching clipped into a region (angle in degrees, screen coords)."""
    allp = np.vstack(region.polys)
    lo, hi = (allp.min(0), allp.max(0)) if bbox is None else (np.array(bbox[:2]), np.array(bbox[2:]))
    c = (lo + hi) / 2
    rad = np.linalg.norm(hi - lo) / 2 + 2
    a = math.radians(angle)
    d = np.array([math.cos(a), math.sin(a)])
    nrm = np.array([-d[1], d[0]])
    out = []
    k = -rad + phase % spacing
    while k <= rad:
        p0 = c + nrm * k - d * rad
        p1 = c + nrm * k + d * rad
        seg = resample(A([p0, p1]), 0.5)
        if wobble and rng is not None:
            seg = seg + nrm * rng.normal(0, wobble) * 0
        out += clip_in(seg, region, margin, minlen)
        k += spacing
    return out


# ------------------------------------------------------------------------------------------------
# the painter
# ------------------------------------------------------------------------------------------------


class Art:
    def __init__(self):
        self.items = []  # [layer, polyline, closed]

    def line(self, P, layer='main', closed=False):
        P = A(P)
        if len(P) >= 2:
            self.items.append([layer, P, closed])
        return P

    def detail(self, P, closed=False):
        return self.line(P, 'detail', closed)

    def lines(self, Ps, layer='main'):
        for P in Ps:
            self.line(P, layer)

    def erase(self, region, margin=0.9):
        """Remove existing strokes inside region (painter's occlusion)."""
        if not isinstance(region, Region):
            region = Region([region])
        new = []
        for layer, P, closed in self.items:
            Q = resample(P, 0.5, closed)
            ins = region.inside(Q)
            # keep points that sit right on the occluder outline (it will be redrawn anyway)
            d = region.dist(Q)
            gone = ins & (d > margin)
            if not gone.any():
                new.append([layer, P, closed])
                continue
            for r in runs(Q, ~gone, 1.0):
                new.append([layer, r, False])
        self.items = new

    def shape(self, P, layer='main', opaque=True, holes=()):
        """Closed outline; opaque shapes hide what is behind them."""
        P = A(P)
        if opaque:
            self.erase(Region([P], holes))
        self.line(P, layer, True)
        return P

    def fit(self, box=(12, 12, 388, 388), scale_max=1.6):
        """Uniformly scale and centre the whole drawing into box."""
        allp = np.vstack([P for _, P, _ in self.items])
        lo, hi = allp.min(0), allp.max(0)
        bw, bh = box[2] - box[0], box[3] - box[1]
        s = min(bw / (hi[0] - lo[0]), bh / (hi[1] - lo[1]), scale_max)
        c = (lo + hi) / 2
        tc = np.array([(box[0] + box[2]) / 2, (box[1] + box[3]) / 2])
        for it in self.items:
            it[1] = (it[1] - c) * s + tc
        return s

    def keep_out(self, region, margin=1.0, layer=None):
        """Erase strokes (optionally of one layer) inside region without drawing anything."""
        if not isinstance(region, Region):
            region = Region([region])
        new = []
        for lay, P, closed in self.items:
            if layer and lay != layer:
                new.append([lay, P, closed])
                continue
            Q = resample(P, 0.5, closed)
            gone = region.inside(Q) & (region.dist(Q) > margin)
            if not gone.any():
                new.append([lay, P, closed])
                continue
            for r in runs(Q, ~gone, 1.0):
                new.append([lay, r, False])
        self.items = new


# ------------------------------------------------------------------------------------------------
# Bezier fitting (Schneider) and SVG formatting
# ------------------------------------------------------------------------------------------------


def _bz(ctrl, t):
    t = np.asarray(t)[:, None]
    u = 1 - t
    return u ** 3 * ctrl[0] + 3 * u * u * t * ctrl[1] + 3 * u * t * t * ctrl[2] + t ** 3 * ctrl[3]


def _bzd(ctrl, t):
    t = np.asarray(t)[:, None]
    u = 1 - t
    return 3 * u * u * (ctrl[1] - ctrl[0]) + 6 * u * t * (ctrl[2] - ctrl[1]) + 3 * t * t * (ctrl[3] - ctrl[2])


def _bzdd(ctrl, t):
    t = np.asarray(t)[:, None]
    u = 1 - t
    return 6 * u * (ctrl[2] - 2 * ctrl[1] + ctrl[0]) + 6 * t * (ctrl[3] - 2 * ctrl[2] + ctrl[1])


def _unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else v


def _gen(P, u, t1, t2):
    p0, p3 = P[0], P[-1]
    a1 = t1[None] * (3 * (1 - u) ** 2 * u)[:, None]
    a2 = t2[None] * (3 * (1 - u) * u * u)[:, None]
    C = np.zeros((2, 2))
    X = np.zeros(2)
    tmp = P - _bz(np.array([p0, p0, p3, p3]), u)
    C[0, 0] = np.sum(a1 * a1)
    C[0, 1] = C[1, 0] = np.sum(a1 * a2)
    C[1, 1] = np.sum(a2 * a2)
    X[0] = np.sum(a1 * tmp)
    X[1] = np.sum(a2 * tmp)
    det = C[0, 0] * C[1, 1] - C[0, 1] * C[1, 0]
    seg = np.linalg.norm(p3 - p0)
    if abs(det) > 1e-12:
        al = (X[0] * C[1, 1] - X[1] * C[0, 1]) / det
        ar = (C[0, 0] * X[1] - C[1, 0] * X[0]) / det
    else:
        al = ar = seg / 3
    eps = 1e-6 * seg
    if al < eps or ar < eps or al > seg * 2 or ar > seg * 2:
        al = ar = seg / 3
    return np.array([p0, p0 + t1 * al, p3 + t2 * ar, p3])


def _reparam(ctrl, P, u):
    d = _bz(ctrl, u) - P
    d1 = _bzd(ctrl, u)
    d2 = _bzdd(ctrl, u)
    num = np.sum(d * d1, axis=1)
    den = np.sum(d1 * d1 + d * d2, axis=1)
    with np.errstate(divide='ignore', invalid='ignore'):
        nu = np.where(np.abs(den) > 1e-12, u - num / den, u)
    nu = np.clip(nu, 0, 1)
    return nu if np.all(np.diff(nu) >= 0) else u


def _fit(P, t1, t2, err, depth=0):
    if len(P) == 2 or depth > 14:
        d = np.linalg.norm(P[-1] - P[0]) / 3
        return [np.array([P[0], P[0] + t1 * d, P[-1] + t2 * d, P[-1]])]
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    u = np.r_[0, np.cumsum(seg)]
    u = u / u[-1]
    ctrl = _gen(P, u, t1, t2)
    for it in range(8):
        e = np.sum((_bz(ctrl, u) - P) ** 2, axis=1)
        i = int(np.argmax(e))
        if e[i] < err * err:
            return [ctrl]
        if e[i] > 16 * err * err and it > 0:
            break
        u = _reparam(ctrl, P, u)
        ctrl = _gen(P, u, t1, t2)
    e = np.sum((_bz(ctrl, u) - P) ** 2, axis=1)
    i = int(np.argmax(e))
    if e[i] < err * err:
        return [ctrl]
    i = min(max(i, 1), len(P) - 2)
    tc = _unit(P[i - 1] - P[i + 1])
    return _fit(P[: i + 1], t1, tc, err, depth + 1) + _fit(P[i:], -tc, t2, err, depth + 1)


def _corners(P, closed, ang=28.0):
    """Indices of sharp vertices (turning angle above ang)."""
    n = len(P)
    idx = []
    rng = range(n) if closed else range(1, n - 1)
    for i in rng:
        a = P[i - 1] - P[i]
        b = P[(i + 1) % n] - P[i]
        la, lb = np.linalg.norm(a), np.linalg.norm(b)
        if la < 1e-6 or lb < 1e-6:
            continue
        c = np.dot(a, b) / (la * lb)
        turn = 180 - math.degrees(math.acos(max(-1, min(1, c))))
        if turn > ang:
            idx.append(i)
    return idx


def _dedupe(P):
    keep = [0]
    for i in range(1, len(P)):
        if np.linalg.norm(P[i] - P[keep[-1]]) > 0.05:
            keep.append(i)
    return P[keep]


def fmt(v):
    r = round(float(v) * 10) / 10
    r = min(max(r, -3.0), 403.0)
    if r == 0:
        return '0'
    s = f'{r:.1f}'
    return s[:-2] if s.endswith('.0') else s


def _pt(p):
    return f'{fmt(p[0])} {fmt(p[1])}'


def _chord_dev(P):
    a, b = P[0], P[-1]
    d = b - a
    L = np.linalg.norm(d)
    if L < 1e-9:
        return float(np.max(np.linalg.norm(P - a, axis=1)))
    return float(np.max(np.abs((P[:, 0] - a[0]) * d[1] - (P[:, 1] - a[1]) * d[0]) / L))


def to_d(P, closed=False, err=0.45):
    """Polyline -> compact absolute SVG path data with L for straight parts and C for curves."""
    P = _dedupe(A(P))
    if closed and len(P) > 2 and np.linalg.norm(P[0] - P[-1]) < 0.3:
        P = P[:-1]
    if len(P) < 2:
        return ''
    cs = _corners(P, closed)
    if closed:
        if cs:
            k = cs[0]
            P = np.vstack([P[k:], P[: k + 1]])
            cs = [c - k if c >= k else c - k + len(P) - 1 for c in cs]
            cs = sorted(set([0] + cs + [len(P) - 1]))
        else:
            P = np.vstack([P, P[:1]])
            cs = [0, len(P) - 1]
    else:
        cs = [0] + cs + [len(P) - 1]
    out = [f'M {_pt(P[0])}']
    smooth_closed = closed and len(cs) == 2
    for a, b in zip(cs[:-1], cs[1:]):
        Q = P[a: b + 1]
        if len(Q) < 2:
            continue
        if _chord_dev(Q) < 0.3:
            out.append(f'L {_pt(Q[-1])}')
            continue
        Qr = resample(Q, 1.0)
        if smooth_closed:
            t = _unit(P[1] - P[-2])
            t1, t2 = t, -t
        else:
            t1 = _unit(Qr[min(2, len(Qr) - 1)] - Qr[0])
            t2 = _unit(Qr[max(-3, -len(Qr))] - Qr[-1])
        for c in _fit(Qr, t1, t2, err):
            out.append(f'C {_pt(c[1])} {_pt(c[2])} {_pt(c[3])}')
    if closed:
        out.append('Z')
    return ' '.join(out)


def pack(ds, max_paths):
    """Join path strings so there are at most max_paths of them."""
    ds = [d for d in ds if d and ' ' in d and len(d.split()) > 3]
    if len(ds) <= max_paths:
        return ds
    per = math.ceil(len(ds) / max_paths)
    return [' '.join(ds[i: i + per]) for i in range(0, len(ds), per)]


CANVAS = Region([A([(-50, -50), (450, -50), (450, 450), (-50, 450)])], holes=[A([(1, 1), (399, 1), (399, 399), (1, 399)])])


def finish(art, meta, err=0.45, max_main=120, max_detail=170):
    art.keep_out(CANVAS, 0)
    main, det = [], []
    for layer, P, closed in art.items:
        d = to_d(P, closed, err)
        if not d or len(d.split()) <= 3:
            continue
        (main if layer == 'main' else det).append(d)
    t = dict(meta)
    t['paths'] = pack(main, max_main)
    if det:
        t['detail'] = pack(det, max_detail)
    return t


# ------------------------------------------------------------------------------------------------
# templates
# ------------------------------------------------------------------------------------------------

TEMPLATES = []


def template(tid):
    def deco(fn):
        TEMPLATES.append((tid, fn))
        return fn
    return deco


def meta(id, name, category, level, tags):
    return dict(id=id, name=name, category=category, level=level, tags=tags)


# ==== TEMPLATES ====


def blob(ctrl, step=0.6):
    return catmull(ctrl, closed=True, step=step)


def union_shape(art, polys, layer='main', opaque=True, minlen=3.0):
    """Outline of the union of closed polygons (clouds, foliage, bubbles)."""
    polys = [A(p) for p in polys]
    reg = Region(polys)
    if opaque:
        art.erase(reg)
    for i, p in enumerate(polys):
        others = [q for j, q in enumerate(polys) if j != i]
        Q = resample(p, 0.5, True)
        keep = ~Region(others).inside(Q) if others else np.ones(len(Q), bool)
        if keep.all():
            art.line(p, layer, True)
        elif keep.any():
            k = int(np.argmin(keep))
            Q2 = np.vstack([Q[k:], Q[:k]])
            art.lines(runs(Q2, np.r_[keep[k:], keep[:k]], minlen), layer)
    return reg


def ribbon(center, w, notch=None, w1=None):
    """Closed ribbon strip along a centre line; optional V notch depth at the end."""
    C = resample(A(center), 1.0)
    n = len(C)
    ws = np.linspace(w, w if w1 is None else w1, n)[:, None] / 2
    t = np.gradient(C, axis=0)
    t /= np.linalg.norm(t, axis=1)[:, None]
    nrm = np.c_[-t[:, 1], t[:, 0]]
    L = C + nrm * ws
    Rr = C - nrm * ws
    end = []
    if notch:
        end = [C[-1] - t[-1] * notch]
    return np.vstack([L, end, Rr[::-1]]) if notch else np.vstack([L, Rr[::-1]])


def sparkle(cx, cy, r, pinch=0.18, rot=0.0):
    """Four-point star with concave sides."""
    pts = []
    for i in range(4):
        a0 = math.radians(rot + 90 * i)
        a1 = math.radians(rot + 90 * (i + 1))
        p0 = (cx + r * math.cos(a0), cy + r * math.sin(a0))
        p3 = (cx + r * math.cos(a1), cy + r * math.sin(a1))
        c1 = (cx + r * pinch * math.cos(a0), cy + r * pinch * math.sin(a0))
        c2 = (cx + r * pinch * math.cos(a1), cy + r * pinch * math.sin(a1))
        seg = cubic(p0, c1, c2, p3)
        pts.append(seg[:-1])
    return np.vstack(pts)


def star5(cx, cy, ro, ri=None, rot=-90.0):
    ri = ro * 0.45 if ri is None else ri
    pts = []
    for i in range(10):
        a = math.radians(rot + 36 * i)
        r = ro if i % 2 == 0 else ri
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return A(pts)


def circle_x(c1, r1, c2, r2):
    """Intersection points of two circles."""
    c1, c2 = np.asarray(c1, float), np.asarray(c2, float)
    d = np.linalg.norm(c2 - c1)
    a = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
    h = math.sqrt(max(r1 * r1 - a * a, 0))
    m = c1 + a * (c2 - c1) / d
    perp = np.array([-(c2 - c1)[1], (c2 - c1)[0]]) / d
    return m + h * perp, m - h * perp


def ang(c, p):
    return math.degrees(math.atan2(p[1] - c[1], p[0] - c[0]))


def crescent(c1, r1, c2, r2):
    """Closed crescent: disc (c1, r1) minus disc (c2, r2)."""
    p, q = circle_x(c1, r1, c2, r2)
    a_p, a_q = ang(c1, p), ang(c1, q)
    # outer arc goes the long way round, away from c2
    mid = ang(c1, c2)
    def span(a0, a1, avoid):
        # choose direction from a0 to a1 that does not pass the avoid angle
        d = (a1 - a0) % 360
        test = (avoid - a0) % 360
        return (a0, a0 + d) if test > d else (a0, a0 - (360 - d))
    o0, o1 = span(a_p, a_q, mid)
    outer = arc(c1[0], c1[1], r1, r1, o0, o1)
    b_q, b_p = ang(c2, q), ang(c2, p)
    i0, i1 = span(b_q, b_p, mid + 180)
    # inner arc must lie inside disc 1: pick the span whose midpoint is inside
    inner = arc(c2[0], c2[1], r2, r2, i0, i1)
    midp = inner[len(inner) // 2]
    if np.linalg.norm(midp - c1) > r1:
        d = (i1 - i0)
        inner = arc(c2[0], c2[1], r2, r2, i0, i0 + (d - 360 if d > 0 else d + 360))
    return np.vstack([outer, inner[1:-1]])


def cloud(cx, cy, w, h, n=4, seed=0):
    """Cumulus cloud as circles on a flat-ish base."""
    rng = np.random.default_rng(seed)
    polys = []
    xs = np.linspace(cx - w / 2 + h * 0.45, cx + w / 2 - h * 0.45, n)
    for i, x in enumerate(xs):
        t = 1 - abs((i - (n - 1) / 2) / ((n - 1) / 2 + 1e-9))
        r = h * (0.38 + 0.32 * t) * (0.92 + 0.16 * rng.random())
        polys.append(circ(x, cy + h / 2 - r * (1.0 if i in (0, n - 1) else 1.25), r))
    base = A([(cx - w / 2 + h * 0.3, cy + h / 2), (cx + w / 2 - h * 0.3, cy + h / 2)])
    return polys, base


def draw_cloud(a, polys, base=None, layer='main'):
    """Cloud = union of bumps plus a flat base strip between the first and last bump centres."""
    c0 = A(polys[0]).mean(0)
    c1 = A(polys[-1]).mean(0)
    y = max(A(p)[:, 1].max() for p in polys) - 0.5
    r = min(A(p)[:, 1].max() - A(p).mean(0)[1] for p in polys)
    under = A([(c0[0], y - r * 1.6), (c1[0], y - r * 1.6), (c1[0], y), (c0[0], y)])
    union_shape(a, list(polys) + [under], layer)


@template('scn-gift-box')
def gift_box():
    a = Art()
    body = rect(108, 196, 184, 170)
    a.shape(body)
    lid = A([(94, 152), (306, 152), (306, 198), (94, 198)])
    for x in (184, 216):
        a.line([(x, 198), (x, 366)])
    for (x, y, r) in [(140, 236, 10), (260, 250, 9), (146, 318, 9), (258, 326, 10), (236, 218, 6),
                      (156, 278, 6), (270, 290, 6), (130, 350, 5), (238, 352, 5), (140, 210, 5)]:
        a.detail(star5(x, y, r, r * 0.48), True)
    a.keep_out(rect(181, 196, 38, 172), 0.5, 'detail')
    a.shape(lid)
    for x in (184, 216):
        a.line([(x, 152), (x, 198)])
    # ribbon tails falling over the lid
    tl = ribbon(catmull([(196, 150), (186, 180), (170, 214), (160, 236)]), 22, notch=10, w1=26)
    a.shape(tl)
    a.shape(mirror(tl, 200))
    # loops
    lp = blob([(200, 146), (176, 122), (140, 92), (106, 86), (94, 110), (110, 136), (150, 150), (186, 154)])
    a.shape(lp)
    a.shape(mirror(lp, 200))
    for side in (1, -1):
        a.detail(tf(catmull([(186, 140), (156, 118), (122, 104)]), 0) if side == 1 else
                 mirror(catmull([(186, 140), (156, 118), (122, 104)]), 200))
        a.detail(tf(catmull([(180, 150), (150, 140), (116, 124)]), 0) if side == 1 else
                 mirror(catmull([(180, 150), (150, 140), (116, 124)]), 200))
    knot = blob([(186, 134), (200, 129), (214, 134), (218, 152), (200, 160), (182, 152)])
    a.shape(knot)
    a.detail(catmull([(193, 138), (195, 146), (193, 154)]))
    a.detail(catmull([(207, 138), (205, 146), (207, 154)]))
    # gift tag on a string
    a.fit((18, 18, 382, 382), 1.3)
    return finish(a, meta('scn-gift-box', 'Wrapped gift with bow', 'stilllife', 'beginner',
                          ['gift', 'birthday', 'christmas', 'thanks', 'cute', 'present', 'bow', 'card']))


@template('scn-moon-stars')
def moon_stars():
    a = Art()
    cl1, b1 = cloud(266, 312, 190, 70, 4, seed=3)
    cl2, b2 = cloud(110, 330, 140, 52, 3, seed=5)
    moon = crescent((190, 182), 118, (240, 150), 100)
    a.shape(moon)
    # a few craters as fine detail
    for x, y, r in [(112, 210, 10), (130, 250, 6), (100, 170, 5), (150, 280, 7)]:
        P = circ(x, y, r)
        if Region([moon]).inside(P, 2).all():
            a.detail(P, True)
    for (x, y, r) in [(300, 70, 20), (345, 160, 12), (60, 70, 14), (300, 215, 9), (58, 268, 8), (250, 34, 7)]:
        a.shape(sparkle(x, y, r))
    for (x, y, r) in [(352, 92, 7), (60, 330, 7), (360, 250, 8), (205, 372, 7), (28, 205, 7)]:
        a.shape(star5(x, y, r * 1.6, r * 0.75))
    for polys, base in ((cl1, b1), (cl2, b2)):
        draw_cloud(a, polys, base)
    return finish(a, meta('scn-moon-stars', 'Crescent moon and stars', 'fantasy', 'beginner',
                          ['whimsical', 'baby', 'stylized', 'moon', 'stars', 'night', 'clouds', 'nursery']))

@template('scn-simple-house')
def simple_house():
    a = Art()
    # tree behind, right
    a.line([(318, 352), (316, 300), (322, 250)])
    a.line([(336, 352), (334, 300), (330, 250)])
    crown = [circ(326, 214, 34), circ(300, 236, 24), circ(352, 238, 24), circ(326, 252, 26), circ(312, 186, 22),
             circ(342, 190, 22)]
    union_shape(a, crown)
    a.shape(rect(246, 96, 26, 50))
    a.shape(rect(240, 88, 38, 12))
    for (x, y, r) in [(262, 70, 7), (272, 50, 9), (290, 26, 11)]:
        a.shape(circ(x, y, r))
    body = rect(108, 196, 184, 156)
    a.shape(body)
    roof = A([(200, 84), (316, 192), (302, 206), (200, 112), (98, 206), (84, 192)])
    a.shape(roof)
    # attic window
    a.shape(circ(200, 158, 18))
    a.line([(200, 140), (200, 176)])
    a.line([(182, 158), (218, 158)])
    # door with arched top
    door = np.vstack([A([(178, 352), (178, 286)]), arc(200, 286, 22, 22, 180, 360), A([(222, 352)])])
    a.shape(door)
    a.shape(circ(212, 320, 3))
    for x0 in (126, 236):
        a.shape(rect(x0, 228, 40, 44))
        a.line([(x0 + 20, 228), (x0 + 20, 272)])
        a.line([(x0, 250), (x0 + 40, 250)])
        a.shape(rect(x0 - 5, 272, 50, 8))
    a.line([(30, 352), (370, 352)])
    # path
    a.line(catmull([(180, 352), (172, 372), (150, 396)]))
    a.line(catmull([(220, 352), (236, 372), (262, 396)]))
    # bushes by the house
    draw_cloud(a, [circ(76, 338, 14), circ(96, 330, 22), circ(118, 338, 14)])
    a.fit((18, 18, 382, 382), 1.3)
    return finish(a, meta('scn-simple-house', 'Little house', 'places', 'beginner',
                          ['cute', 'stylized', 'house', 'home', 'kids', 'card']))


@template('scn-jack-o-lantern')
def jack_o_lantern():
    a = Art()
    cy = 240
    lobes = [(-104, 60, 84), (104, 60, 84), (-58, 70, 100), (58, 70, 100), (0, 66, 110)]
    for dx, rx, ry in lobes:
        P = blob([(200 + dx, cy - ry + 10), (200 + dx + rx * 0.8, cy - ry * 0.75), (200 + dx + rx, cy),
                  (200 + dx + rx * 0.75, cy + ry * 0.82), (200 + dx, cy + ry), (200 + dx - rx * 0.75, cy + ry * 0.82),
                  (200 + dx - rx, cy), (200 + dx - rx * 0.8, cy - ry * 0.75)])
        a.shape(P)
    # stem
    stem = blob([(186, 134), (184, 112), (190, 88), (200, 70), (214, 64), (220, 74), (210, 92), (208, 114),
                 (214, 134), (200, 140)])
    a.shape(stem)
    a.detail(catmull([(196, 132), (196, 108), (204, 84)]))
    # curly vine and a leaf
    a.line(catmull([(214, 120), (240, 106), (262, 112), (266, 130), (250, 136), (244, 124), (254, 118)]))
    lf = blob([(214, 104), (226, 82), (248, 70), (276, 72), (266, 92), (244, 104)])
    a.shape(lf)
    a.detail(catmull([(218, 102), (240, 88), (268, 76)]))
    # face
    eye = blob([(140, 228), (168, 186), (192, 228)], step=0.4)
    eye = A([(140, 226), (166, 186), (192, 226)])
    a.shape(eye)
    a.shape(mirror(eye, 200))
    a.shape(A([(200, 238), (214, 262), (186, 262)]))
    mouth_top = [(118, 268), (140, 282), (160, 278), (170, 292), (186, 284), (200, 294), (214, 284), (230, 292),
                 (240, 278), (260, 282), (282, 268)]
    mouth_bot = [(282, 268), (268, 304), (240, 322), (230, 306), (214, 324), (200, 330), (186, 324), (170, 306),
                 (160, 322), (132, 304), (118, 268)]
    a.shape(A(mouth_top[:-1] + mouth_bot[:-1]))
    a.fit((18, 18, 382, 382), 1.3)
    return finish(a, meta('scn-jack-o-lantern', 'Jack-o\u2019-lantern', 'fantasy', 'beginner',
                          ['halloween', 'cute', 'stylized', 'pumpkin', 'autumn', 'card']))


# helpers:scn-rose-window
def arc_between(c, p_from, p_to, longway=False):
    c = np.asarray(c, float)
    r = float(np.linalg.norm(np.asarray(p_from) - c))
    a0 = ang(c, p_from)
    a1 = ang(c, p_to)
    d = (a1 - a0 + 180) % 360 - 180
    if longway:
        d = d - 360 if d > 0 else d + 360
    return arc(c[0], c[1], r, r, a0, a0 + d)


def pointed_arch(L, R, k=0.75, up=None):
    """Gothic two-centred arch from L to R (open polyline L -> apex -> R)."""
    L, R = np.asarray(L, float), np.asarray(R, float)
    w = np.linalg.norm(R - L)
    r = w * k
    c1 = L + (R - L) * k
    c2 = R + (L - R) * k
    p, q = circle_x(c1, r, c2, r)
    mid = (L + R) / 2
    if up is None:
        d = R - L
        up = np.array([d[1], -d[0]])
    apex = p if np.dot(p - mid, up) > 0 else q
    a1 = arc_between(c1, L, apex)
    a2 = arc_between(c2, apex, R)
    return np.vstack([a1, a2[1:]]), apex


def foil(cx, cy, r, n, lobe=0.42, rot=0.0):
    """Cusped n-foil (trefoil, quatrefoil...) as a closed curve of lobes."""
    pts = []
    for i in range(n):
        th = math.radians(rot + 360 * i / n - 90)
        rl = r * lobe / (1 + lobe) * 1.25
        lc = (cx + (r - rl) * math.cos(th), cy + (r - rl) * math.sin(th))
        # lobe arc spanning ~ 250 degrees
        a_mid = math.degrees(th)
        pts.append(arc(lc[0], lc[1], rl, rl, a_mid - 125, a_mid + 125))
    # connect consecutive lobes at cusps
    return np.vstack(pts)


@template('scn-rose-window')
def rose_window():
    a = Art()
    C = np.array([200.0, 200.0])
    n = 12

    def P(r, deg):
        t = math.radians(deg - 90)
        return C + r * np.array([math.cos(t), math.sin(t)])

    # outer mouldings
    a.line(circ(200, 200, 194), closed=True)
    a.line(circ(200, 200, 181), closed=True)
    a.line(circ(200, 200, 170), closed=True)
    # voussoir joints in the outer ring
    for i in range(48):
        th = 360 * i / 48 + 3.75
        a.detail([P(182.5, th), P(192.5, th)])
    a.detail(circ(200, 200, 175.5), closed=True)
    # spokes (colonnettes) and lancets
    r0, r1 = 68, 120
    for i in range(n):
        th = 360 * i / n
        lo, hi = th - 15, th + 15
        # lancet sides offset from the spoke lines
        def side(deg, off, ra, rb):
            u = P(1, deg) - C
            nrm = np.array([-u[1], u[0]])
            sgn = 1 if deg < th else -1
            return [C + u * ra + nrm * off * sgn, C + u * rb + nrm * off * sgn]
        for off, ra, rb, layer in ((5, r0, r1, 'main'), (10.5, r0 + 6, r1, 'detail')):
            Ls = side(lo, off, ra, rb)
            Rs = side(hi, off, ra, rb)
            arch, apex = pointed_arch(Ls[1], Rs[1], 0.8, up=P(1, th) - C)
            base = arc_between(C, Rs[0], Ls[0])
            outline = np.vstack([A([Ls[0]]), arch, A([Rs[0]]), base[1:-1]]) if layer == 'main' else None
            if layer == 'main':
                a.line(np.vstack([A([Ls[0], Ls[1]]), arch[1:], A([Rs[0]]), base[1:]]), 'main', True)
                head_apex = apex
            else:
                a.detail(np.vstack([A([Ls[0], Ls[1]]), arch[1:], A([Rs[0]]), base[1:]]), True)
                inner_apex = apex
                inner = np.vstack([A([Ls[0], Ls[1]]), arch[1:], A([Rs[0]]), base[1:]])
        # trefoil in the head of each lancet
        hc = P(np.linalg.norm(inner_apex - C) - 15, th)
        tre = foil(hc[0], hc[1], 10.5, 3, rot=th)
        a.detail(tre, True)
        # quarry glazing below the trefoil: diamond lattice
        reg = Region([inner])
        hole = circ(hc[0], hc[1], 13.5)
        lat = Region([inner], holes=[hole])
        for ang_ in (th + 30, th - 30):
            for seg in hatch(lat, ang_ - 90, 9, margin=1.6, minlen=3, phase=0.0, bbox=None):
                a.detail(seg)
        # spoke centre line between lancets
    # roundels between the lancet heads
    for i in range(n):
        th = 360 * i / n + 15
        c = P(150, th)
        a.line(circ(c[0], c[1], 15.5), closed=True)
        a.detail(foil(c[0], c[1], 11.5, 4, rot=th + 45), True)
        a.detail(circ(c[0], c[1], 3), closed=True)
        # small dagger between roundel and ring
    # central rosette
    a.line(circ(200, 200, 62), closed=True)
    a.detail(circ(200, 200, 56), closed=True)
    cusps = []
    for i in range(16):
        th = 360 * i / 16
        c = P(44, th)
        cusps.append(circ(c[0], c[1], 9.5))
    union_shape(a, cusps + [circ(200, 200, 40)], layer='detail')
    a.line(circ(200, 200, 30), closed=True)
    for i in range(8):
        th = 360 * i / 8
        b = P(10, th)
        tip = P(27, th)
        u = P(1, th) - C
        nrm = np.array([-u[1], u[0]])
        pet = np.vstack([cubic(b, b + u * 6 + nrm * 8, tip - u * 6 + nrm * 7, tip),
                         cubic(tip, tip - u * 6 - nrm * 7, b + u * 6 - nrm * 8, b)[1:]])
        a.detail(pet, True)
    a.line(circ(200, 200, 8), closed=True)
    # corner spandrels: quarter tracery in the square around the circle
    for cx, cy in ((0, 0), (400, 0), (0, 400), (400, 400)):
        sx = 1 if cx == 0 else -1
        sy = 1 if cy == 0 else -1
        c = (cx + sx * 34, cy + sy * 34)
        a.detail(foil(c[0], c[1], 20, 3, rot=math.degrees(math.atan2(-sy, -sx)) + 90), True)
        a.detail(circ(c[0], c[1], 4), closed=True)
    return finish(a, meta('scn-rose-window', 'Gothic rose window', 'places', 'advanced',
                          ['gothic', 'ornamental', 'geometric', 'cathedral', 'tracery', 'stained-glass',
                           'architecture', 'dark-academia']), err=0.4)


# helpers:scn-mountain-lake
def jag(pts, rough, rng, levels=4):
    """Midpoint-displacement roughening of a polyline (perpendicular offsets)."""
    P = [np.asarray(p, float) for p in pts]
    amp = rough
    for _ in range(levels):
        Q = [P[0]]
        for a_, b_ in zip(P[:-1], P[1:]):
            m = (a_ + b_) / 2
            d = b_ - a_
            L = np.linalg.norm(d)
            nrm = np.array([-d[1], d[0]]) / max(L, 1e-9)
            Q += [m + nrm * rng.uniform(-1, 1) * amp * min(1.0, L / 30), b_]
        P = Q
        amp *= 0.55
    return A(P)


def pine(x, base, h, w, rng, tiers=None):
    """Stylised fir with drooping tiers. Returns closed outline and trunk lines."""
    tiers = tiers or max(5, int(h / 22))
    top = base - h
    body = h * 0.9
    ys = top + body * (np.linspace(0, 1, tiers + 1)[1:] ** 0.85)
    right = [np.array([[x, top]])]
    prev = np.array([x, top])
    for i, yt in enumerate(ys):
        wi = w * ((i + 1) / tiers) ** 0.9 * rng.uniform(0.88, 1.08)
        tip = np.array([x + wi, yt + rng.uniform(-1.5, 1.5)])
        if i:
            notch = np.array([x + w * (i / tiers) ** 0.9 * 0.58, prev[1] - rng.uniform(1, 4)])
            right.append(A([notch]))
            start = notch
        else:
            start = prev
        d = tip - start
        seg = cubic(start, start + d * [0.55, 0.12], tip - d * [0.12, 0.45], tip)
        right.append(seg[1:])
        prev = tip
    right.append(A([(x + w * 0.06, top + body + 2)]))
    R_ = np.vstack(right)
    L_ = mirror(R_, x)[::-1]
    outline = np.vstack([R_, L_[1:-1]])
    trunk = [A([(x - w * 0.07, top + body - 4), (x - w * 0.07, base)]),
             A([(x + w * 0.07, top + body - 4), (x + w * 0.07, base)])]
    return outline, trunk


@template('scn-mountain-lake')
def mountain_lake():
    rng = np.random.default_rng(7)
    a = Art()
    frame = circ(200, 200, 186)
    shore_y = 262
    # sun and soft clouds
    sun = circ(314, 96, 24)
    a.line(sun, closed=True)
    for k in range(3):
        y = 132 + k * 8
        a.detail(catmull([(250 + k * 14, y), (300 + k * 6, y - 1), (356 - k * 10, y + 1)]))
    for (x, y, s) in [(96, 74, 1.0), (122, 62, 0.8), (230, 46, 0.9)]:
        a.line(np.vstack([cubic((x - 9 * s, y), (x - 6 * s, y - 5 * s), (x - 2 * s, y - 4 * s), (x, y)),
                          cubic((x, y), (x + 2 * s, y - 4 * s), (x + 6 * s, y - 5 * s), (x + 9 * s, y))[1:]]))
    # far range
    far = jag([(0, 214), (36, 184), (70, 196), (104, 170), (140, 200), (196, 176), (240, 192), (300, 160),
               (346, 184), (400, 168)], 6, rng)
    farpoly = np.vstack([far, A([(400, shore_y), (0, shore_y)])])
    a.shape(farpoly, layer='detail')
    for seg in hatch(Region([farpoly]), 8, 6.5, margin=2.5, minlen=4):
        a.detail(seg)
    # main massif
    peakA = (158, 74)
    saddle = (226, 156)
    peakB = (282, 108)
    sil = jag([(0, 236), (52, 192), (96, 140), (128, 112), peakA, (186, 108), (206, 134), saddle, (250, 130),
               peakB, (316, 140), (352, 170), (400, 204)], 7, rng)
    M = np.vstack([sil, A([(404, shore_y), (-4, shore_y)])])
    a.shape(M)
    Mreg = Region([M])
    divA = jag([peakA, (150, 120), (136, 168), (126, 214), (112, shore_y)], 5, rng)
    gully = jag([saddle, (232, 196), (228, shore_y)], 4, rng)
    divB = jag([peakB, (276, 150), (266, 200), (270, shore_y)], 5, rng)
    # snow caps with fingers running down gullies
    snowA = jag([(118, 122), (130, 118), (138, 136), (146, 124), (152, 150), (160, 116), (170, 132), (178, 114),
                 (192, 126)], 2.5, rng, 2)
    snowB = jag([(258, 132), (266, 126), (272, 150), (280, 128), (288, 144), (296, 124), (310, 136)], 2.5, rng, 2)
    a.line(snowA)
    a.line(snowB)
    snow_reg = Region([np.vstack([snowA, A([(192, 40), (118, 40)])]), np.vstack([snowB, A([(310, 60), (258, 60)])])])
    faceA = np.vstack([divA, A([(-10, shore_y + 5), (-10, -10), (peakA[0], -10)])])
    faceB = np.vstack([gully, A([(270, shore_y + 5)]), divB[::-1], A([(peakB[0], -10), (saddle[0], -10)])])
    for face, sp, angd in ((faceA, 4.2, 58), (faceB, 4.2, 62)):
        for seg in hatch(Region([face]), angd, sp, margin=0.5, minlen=3):
            for s2 in clip_in(seg, Mreg, 2.2, 3):
                a.lines(clip_out(s2, snow_reg, 2.0, 3), 'detail')
    # ridge lines and a few lit-side gullies
    a.detail(divA)
    a.detail(divB)
    a.detail(gully)
    for g in ([(178, 150), (186, 190), (196, 236)], [(304, 160), (312, 196), (326, 230)],
              [(60, 214), (70, 236)], [(352, 196), (362, 226)], [(196, 138), (204, 168), (212, 210)],
              [(170, 128), (168, 160), (176, 200), (172, 236)], [(296, 150), (294, 182), (302, 220), (298, 250)],
              [(332, 170), (336, 206), (346, 240)], [(246, 150), (250, 190), (246, 230)]):
        a.detail(jag(g, 3, rng, 3))
    # distant tree line on the far shore
    xs = np.arange(-2, 404, 7.0)
    pts = []
    for x in xs:
        hgt = rng.uniform(7, 15)
        pts += [(x, shore_y), (x + 3.5, shore_y - hgt)]
    pts.append((404, shore_y))
    tl = A(pts)
    a.erase(Region([np.vstack([tl, A([(404, shore_y + 2), (-2, shore_y + 2)])])]))
    a.line(tl, 'detail')
    a.line(A([(-4, shore_y), (404, shore_y)]))
    # lake ripples
    for i in range(16):
        y = shore_y + 8 + i * 5.2 + i * i * 0.08
        x = 30
        while x < 380:
            L = rng.uniform(14, 48)
            if rng.random() < 0.62:
                a.detail([(x, y + rng.uniform(-0.6, 0.6)), (x + L, y + rng.uniform(-0.6, 0.6))])
            x += L + rng.uniform(8, 24)
    # foreground shore with rocks and grass
    shore = catmull([(-4, 350), (60, 344), (120, 352), (180, 360), (240, 356), (300, 346), (404, 352)])
    a.erase(Region([np.vstack([shore, A([(404, 404), (-4, 404)])])]))
    a.line(shore)
    for (cx, cy, rx, ry) in [(170, 352, 26, 14), (204, 360, 18, 10), (280, 346, 20, 11)]:
        rk = blob([(cx - rx, cy + ry * 0.4), (cx - rx * 0.7, cy - ry * 0.6), (cx - rx * 0.1, cy - ry),
                   (cx + rx * 0.6, cy - ry * 0.7), (cx + rx, cy + ry * 0.3), (cx + rx * 0.4, cy + ry * 0.9),
                   (cx - rx * 0.5, cy + ry)])
        a.shape(rk)
        reg = Region([rk])
        for seg in hatch(Region([rk, ]), 70, 3.6, margin=1.6, minlen=2, bbox=(cx, cy - ry, cx + rx, cy + ry)):
            a.detail(seg)
    for (gx, gy) in [(120, 384), (232, 380), (256, 392), (150, 396), (330, 382), (200, 388)]:
        for k in range(5):
            dx = (k - 2) * 2.6
            hgt = 12 - abs(k - 2) * 2.5 + rng.uniform(-1, 1)
            a.detail(catmull([(gx + dx, gy), (gx + dx * 1.4, gy - hgt * 0.6), (gx + dx * 2.4, gy - hgt)]))
    # foreground firs, back to front
    firs = [(134, 354, 124, 34), (270, 352, 116, 32), (50, 368, 262, 64), (354, 368, 246, 60)]
    for (x, base, h, w) in firs:
        out, trunk = pine(x, base, h, w, rng)
        for t_ in trunk:
            a.line(t_)
        a.shape(out)
        # shade the left half of each tree with short vertical strokes
        reg = Region([out])
        half = Region([A([(x - w * 1.3, base - h), (x - 1.5, base - h), (x - 1.5, base), (x - w * 1.3, base)])])
        for seg in hatch(reg, 90, 3.4, margin=1.8, minlen=3, bbox=(x - w * 1.3, base - h, x - 1, base)):
            a.lines(clip_in(seg, half, 0, 3), 'detail')
    # birds in the sky and the circular frame
    a.keep_out(Region([frame]).__class__([A([(-10, -10), (410, -10), (410, 410), (-10, 410)])], holes=[frame]), 0)
    a.line(frame, closed=True)
    return finish(a, meta('scn-mountain-lake', 'Mountain lake with firs', 'places', 'advanced',
                          ['realistic', 'landscape', 'mountains', 'lake', 'forest', 'pine', 'nature', 'journal']),
                  err=0.5)


# helpers:scn-lighthouse
def spiral_pts(cx, cy, r0, r1, a0, a1, step=0.5):
    span = abs(a1 - a0) * math.pi / 180 * max(r0, r1)
    n = max(10, int(span / step))
    t = np.linspace(0, 1, n)
    angs = np.radians(a0 + (a1 - a0) * t)
    r = r0 + (r1 - r0) * t
    return np.c_[cx + r * np.cos(angs), cy + r * np.sin(angs)]


def curl_wave(x0, y0, w, h):
    """Wave rolling to the right: back slope + curl, and the hollow front face."""
    crest = np.array([x0 + 0.62 * w, y0 - h])
    back = cubic((x0, y0), (x0 + 0.3 * w, y0 - 0.05 * h), (x0 + 0.38 * w, y0 - h), crest)
    R = h * 0.42
    curl = spiral_pts(crest[0], crest[1] + R, R, R * 0.25, -90, 200)
    front = cubic((crest[0] + R * 0.98, crest[1] + R * 1.25), (crest[0] + R * 0.9, y0 - h * 0.3),
                  (x0 + 0.8 * w, y0 - h * 0.08), (x0 + 0.9 * w, y0 - h * 0.05))
    lip = np.vstack([back, curl[1:]])
    foam = cubic((x0 + 0.18 * w, y0 - 0.02 * h + 6), (x0 + 0.36 * w, y0 - 0.1 * h + 4),
                 (x0 + 0.44 * w, y0 - 0.72 * h + 6), (x0 + 0.56 * w, y0 - 0.86 * h + 6))
    body = np.vstack([back, A([(crest[0] + R, crest[1] + R)]), front[1:], A([(x0 + w, y0 + 60), (x0, y0 + 60)])])
    return lip, front, foam, body


def gull(x, y, s):
    return np.vstack([cubic((x - 10 * s, y + 1 * s), (x - 7 * s, y - 5 * s), (x - 3 * s, y - 5 * s), (x, y)),
                      cubic((x, y), (x + 3 * s, y - 5 * s), (x + 7 * s, y - 5 * s), (x + 10 * s, y + 1 * s))[1:]])


@template('scn-lighthouse')
def lighthouse():
    rng = np.random.default_rng(11)
    a = Art()
    cx = 200
    # light beams
    for side in (-1, 1):
        a.detail([(cx + side * 26, 70), (cx + side * 190, 32)])
        a.detail([(cx + side * 26, 88), (cx + side * 190, 120)])
    # clouds and gulls
    draw_cloud(a, [circ(66, 152, 13), circ(86, 144, 19), circ(108, 152, 13)])
    draw_cloud(a, [circ(306, 176, 10), circ(322, 168, 15), circ(340, 176, 10)])
    for (x, y, s_) in [(310, 230, 1.1), (338, 214, 0.8), (80, 214, 0.9)]:
        a.line(gull(x, y, s_))
    # distant sea lines
    for i, y in enumerate((300, 309, 318)):
        for x0, x1 in ((14, 120), (150, 250), (280, 386)):
            j = rng.uniform(-10, 10)
            a.detail([(x0 + j + i * 6, y), (x1 + j - i * 6, y)])
    a.line([(4, 292), (396, 292)])
    # tower: tapered with a slight curve on the sides
    yb, yt = 296, 118
    def half(y):
        t = (yb - y) / (yb - yt)
        return 46 - 16 * t
    ys = np.linspace(yb, yt, 60)
    lside = A([(cx - half(y), y) for y in ys])
    rside = A([(cx + half(y), y) for y in ys])
    tower = np.vstack([lside, rside[::-1]])
    a.shape(tower)
    # bands (curved like a cylinder)
    for y0, y1 in ((150, 176), (210, 238)):
        for y in (y0, y1):
            hw = half(y)
            a.line(arc(cx, y, hw, 7, 0, 180)[::-1])
        # hatch the band
        band = np.vstack([arc(cx, y0, half(y0), 7, 0, 180)[::-1], arc(cx, y1, half(y1), 7, 0, 180)])
        for seg in hatch(Region([band]), 90, 4.2, margin=1.8, minlen=2):
            a.detail(seg)
    # bricks hint at the base
    for k, y in enumerate((262, 274, 286)):
        hw = half(y)
        a.detail(arc(cx, y, hw, 6, 15, 165)[::-1])
    # door and windows
    door = np.vstack([A([(cx - 13, 296), (cx - 13, 270)]), arc(cx, 270, 13, 13, 180, 360), A([(cx + 13, 296)])])
    a.shape(door)
    a.detail([(cx, 257), (cx, 296)])
    for wy in (196, 132):
        wnd = np.vstack([A([(cx - 7, wy + 10), (cx - 7, wy)]), arc(cx, wy, 7, 7, 180, 360), A([(cx + 7, wy + 10)])])
        a.shape(wnd)
        a.detail([(cx - 7, wy + 3), (cx + 7, wy + 3)])
    # gallery deck and railing
    a.shape(rrect_pts(cx - 44, 108, 88, 10, 3))
    lant = rect(cx - 22, 58, 44, 30)
    a.shape(lant)
    for x in (cx - 8, cx + 8):
        a.line([(x, 58), (x, 88)])
    a.shape(circ(cx, 74, 6))
    a.shape(rrect_pts(cx - 40, 86, 80, 5, 2))
    for x in np.arange(cx - 32, cx + 33, 8):
        a.detail([(x, 91), (x, 108)])
    a.line([(cx - 40, 91), (cx - 40, 108)])
    a.line([(cx + 40, 91), (cx + 40, 108)])
    a.detail([(cx - 40, 100), (cx + 40, 100)])
    # roof
    roof = np.vstack([A([(cx - 30, 58)]), cubic((cx - 30, 58), (cx - 24, 40), (cx - 10, 34), (cx, 32)),
                      cubic((cx, 32), (cx + 10, 34), (cx + 24, 40), (cx + 30, 58))[1:]])
    a.shape(roof)
    a.shape(circ(cx, 26, 6))
    a.line([(cx, 20), (cx, 8)])
    # rocks: faceted polygons with shaded right facets
    rocks = [
        ([(108, 336), (114, 306), (136, 288), (164, 290), (184, 312), (180, 340)], (142, 300), 0.55),
        ([(196, 344), (202, 308), (226, 292), (256, 296), (276, 318), (270, 346)], (236, 306), 0.5),
        ([(58, 348), (66, 322), (92, 310), (120, 318), (134, 348)], (96, 322), 0.55),
        ([(262, 350), (272, 322), (300, 312), (326, 324), (338, 352)], (300, 324), 0.5),
        ([(146, 350), (152, 322), (180, 312), (206, 318), (220, 348)], (182, 326), 0.5),
    ]
    for pts, ridge, sh_t in rocks:
        P = A(pts)
        a.shape(P)
        lo, hi = P.min(0), P.max(0)
        top = P[np.argmin(P[:, 1])]
        # facet edges from a ridge point to the base and to a top vertex
        rp = np.asarray(ridge, float)
        a.detail([top, rp])
        a.detail([rp, (rp[0] + 6, hi[1])])
        a.detail([rp, P[1]])
        right = Region([A([top, (hi[0] + 6, lo[1] - 6), (hi[0] + 6, hi[1] + 6), (rp[0] + 6, hi[1] + 6), rp])])
        for seg in hatch(Region([P]), 66, 3.6, margin=1.8, minlen=2):
            a.lines(clip_in(seg, right, 1.5, 2), 'detail')
    # big waves in front
    waves = [(-30, 366, 120, 44), (84, 374, 120, 40), (196, 366, 120, 44), (306, 374, 116, 40)]
    for (x0, y0, w, h) in waves:
        lip, front, foam, body = curl_wave(x0, y0, w, h)
        a.erase(Region([body]))
        a.line(lip)
        a.line(front)
        a.detail(foam)
    for y, x0, x1 in ((384, 20, 120), (390, 140, 250), (384, 262, 380)):
        a.detail([(x0, y), (x1, y)])
    return finish(a, meta('scn-lighthouse', 'Lighthouse on the rocks', 'places', 'intermediate',
                          ['stylized', 'lighthouse', 'sea', 'coast', 'waves', 'nautical', 'card']))


def rrect_pts(x, y, w, h, r):
    pts = np.vstack([arc(x + w - r, y + r, r, r, -90, 0), arc(x + w - r, y + h - r, r, r, 0, 90),
                     arc(x + r, y + h - r, r, r, 90, 180), arc(x + r, y + r, r, r, 180, 270)])
    return pts


# helpers:scn-castle-hill
def crenel_top(x0, x1, y, mw=9.0, gap=7.0, mh=8.0):
    """Battlement top line from x0 to x1 at wall height y (merlons rise to y - mh)."""
    pts = [(x0, y - mh)]
    x = x0
    up = True
    n = max(1, round((x1 - x0 + gap) / (mw + gap)))
    mw = (x1 - x0 - (n - 1) * gap) / n
    for i in range(n):
        xa, xb = x0 + i * (mw + gap), x0 + i * (mw + gap) + mw
        pts += [(xa, y - mh), (xb, y - mh)]
        if i < n - 1:
            pts += [(xb, y), (xb + gap, y)]
    return pts


def cone_roof(cx, y, w, h, flare=6.0):
    """Conical roof with flared eaves, apex at (cx, y - h)."""
    L = (cx - w / 2 - flare, y)
    Rr = (cx + w / 2 + flare, y)
    ap = (cx, y - h)
    left = cubic(L, (cx - w / 2 + 2, y - h * 0.18), (cx - w * 0.12, y - h * 0.6), ap)
    right = cubic(ap, (cx + w * 0.12, y - h * 0.6), (cx + w / 2 - 2, y - h * 0.18), Rr)
    eave = arc(cx, y, w / 2 + flare, 5, 0, 180)
    return np.vstack([left, right[1:], eave[1:-1]])


def flag(x, y, s=1.0, side=1):
    pole = A([(x, y), (x, y - 20 * s)])
    f_ = np.vstack([cubic((x, y - 20 * s), (x + side * 8 * s, y - 24 * s), (x + side * 12 * s, y - 16 * s),
                          (x + side * 22 * s, y - 19 * s)),
                    A([(x + side * 16 * s, y - 14 * s)]),
                    cubic((x + side * 22 * s, y - 9 * s), (x + side * 12 * s, y - 6 * s), (x + side * 8 * s, y - 14 * s),
                          (x, y - 11 * s))])
    f_ = np.vstack([cubic((x, y - 20 * s), (x + side * 8 * s, y - 24 * s), (x + side * 12 * s, y - 16 * s),
                          (x + side * 22 * s, y - 19 * s)),
                    A([(x + side * 16 * s, y - 14.5 * s), (x + side * 22 * s, y - 10 * s)]),
                    cubic((x + side * 22 * s, y - 10 * s), (x + side * 12 * s, y - 7 * s), (x + side * 8 * s, y - 15 * s),
                          (x, y - 11 * s))[1:]])
    return pole, f_


def arched(x0, y_bottom, w, h):
    """Round-headed opening as closed polygon."""
    r = w / 2
    return np.vstack([A([(x0, y_bottom), (x0, y_bottom - h + r)]), arc(x0 + r, y_bottom - h + r, r, r, 180, 360),
                      A([(x0 + w, y_bottom)])])


def shingles(a, poly, dy=6.0, w=7.0, margin=1.6):
    """Fish-scale roof tiles: rows of small downward arcs clipped into the roof outline."""
    P = A(poly)
    reg = Region([P])
    lo, hi = P.min(0), P.max(0)
    for i, y in enumerate(np.arange(lo[1] + dy * 1.4, hi[1] - 1, dy)):
        off = (i % 2) * w / 2
        x = lo[0] - w + off
        while x < hi[0] + w:
            arc_ = arc(x + w / 2, y, w / 2, dy * 0.7, 0, 180)
            for seg in clip_in(arc_, reg, margin, 2.5):
                a.detail(seg)
            x += w


def bricks(a, region, rng, n, bw=12, bh=6):
    for _ in range(n):
        lo = np.vstack(region.polys).min(0)
        hi = np.vstack(region.polys).max(0)
        x = rng.uniform(lo[0], hi[0])
        y = rng.uniform(lo[1], hi[1])
        y = round(y / bh) * bh
        for k in range(rng.integers(2, 4)):
            off = (k % 2) * bw / 2
            yy = y + k * bh
            xs = x - off
            for seg in clip_in(A([(xs, yy), (xs + bw * 1.8, yy)]), region, 3, 4):
                a.detail(seg)
            for vx in (xs + bw * 0.4, xs + bw * 1.4):
                for seg in clip_in(A([(vx, yy), (vx, yy + bh)]), region, 3, 2.5):
                    a.detail(seg)


@template('scn-castle-hill')
def castle_hill():
    rng = np.random.default_rng(21)
    a = Art()
    # sky
    moon = crescent((346, 58), 32, (361, 47), 28)
    a.shape(moon)
    for (x, y, r) in [(44, 50, 10), (120, 28, 7), (386, 150, 7), (262, 34, 6), (26, 150, 6), (360, 22, 5)]:
        a.shape(sparkle(x, y, r))
    for (x, y) in [(86, 80), (250, 70), (384, 110), (54, 112), (150, 60)]:
        a.detail(circ(x, y, 1.6), True)
    for y, x0, x1 in ((118, 270, 360), (126, 290, 380), (96, 30, 90)):
        a.detail(catmull([(x0, y), ((x0 + x1) / 2, y - 2), (x1, y)]))
    # bats
    def bat(x, y, s):
        return np.vstack([cubic((x, y), (x - 4 * s, y - 6 * s), (x - 10 * s, y - 6 * s), (x - 14 * s, y - 2 * s)),
                          cubic((x - 14 * s, y - 2 * s), (x - 11 * s, y + 0 * s), (x - 9 * s, y + 1 * s), (x - 8 * s, y + 3 * s))[1:],
                          cubic((x - 8 * s, y + 3 * s), (x - 6 * s, y + 1 * s), (x - 3 * s, y + 1 * s), (x, y + 3 * s))[1:]])
    for (x, y, s_) in [(282, 66, 0.9), (330, 140, 0.8), (70, 190, 0.8)]:
        b = bat(x, y, s_)
        a.line(np.vstack([b, mirror(b, x)[::-1][1:]]), closed=True)
    # hill
    hill = catmull([(-4, 300), (40, 286), (100, 268), (150, 258), (200, 256), (250, 258), (300, 268), (360, 292),
                    (404, 310)])
    H = np.vstack([hill, A([(404, 404), (-4, 404)])])
    a.shape(H)
    # contour hatching on the left flank and right flank
    for k in range(1, 18):
        off = k * 6.0
        line_ = hill.copy()
        line_[:, 1] += off
        reg = Region([H])
        for seg in clip_in(line_, reg, 2, 3):
            # keep strokes on the flanks only, fading toward the centre
            xs = seg[:, 0]
            m = (np.abs(xs - 200) > 70 + 120 * (1 - k / 18) ** 2)
            for r_ in runs(seg, m, 4):
                a.detail(r_)
    # winding road from the gate
    road_c = catmull([(200, 262), (204, 290), (222, 318), (206, 352), (184, 404)])
    road = ribbon(road_c, 14, w1=78)
    a.shape(road)
    for t in np.linspace(0.25, 0.95, 8):
        p, tg = along(road_c, t)
        hw = (14 + (78 - 14) * t) / 2 * 0.5
        nrm = np.array([-tg[1], tg[0]])
        q = p + nrm * rng.uniform(-hw, hw)
        a.detail(A([q - tg * 2 * (1 + t * 3), q + tg * 2 * (1 + t * 3)]))
    # trees on the hill: cypresses and round trees
    for (x, y, h) in [(48, 296, 46), (64, 292, 36), (330, 292, 44), (348, 300, 34), (96, 284, 30), (312, 284, 30)]:
        cyp = blob([(x, y - h), (x + h * 0.16, y - h * 0.55), (x + h * 0.14, y - h * 0.1), (x, y), (x - h * 0.14, y - h * 0.1),
                    (x - h * 0.16, y - h * 0.55)])
        a.shape(cyp)
        a.detail(catmull([(x, y - h * 0.85), (x + 1, y - h * 0.4), (x, y - h * 0.05)]))
    for (x, y, r) in [(24, 330, 18), (380, 340, 20), (126, 346, 14), (282, 352, 16)]:
        union_shape(a, [circ(x, y - r, r * 0.8), circ(x - r * 0.6, y - r * 0.5, r * 0.6), circ(x + r * 0.6, y - r * 0.5, r * 0.6)])
        a.line([(x, y), (x, y + 10)])
    # --- castle ---
    base = 262
    # tall central tower (behind the keep)
    a.shape(rect(186, 84, 28, 50))
    a.shape(rrect_pts(182, 80, 36, 8, 2))
    r_ = cone_roof(200, 80, 36, 46, 4)
    a.shape(r_)
    shingles(a, r_, 6, 7)
    a.shape(arched(195, 120, 10, 22))
    pole, fl = flag(200, 34, 0.9, 1)
    a.line(pole)
    a.shape(fl)
    # keep
    keep = np.vstack([A([(160, base), (160, 140)]), A(crenel_top(156, 244, 140, 9, 7, 9))[::1], A([(240, 140), (240, base)])])
    keep = A([(160, base)] + [(160, 140), (156, 140)] + crenel_top(156, 244, 140) + [(244, 140), (240, 140), (240, base)])
    a.shape(keep)
    a.line([(156, 140), (244, 140)])
    a.line([(160, 146), (240, 146)])
    bricks(a, Region([rect(162, 150, 76, 70)]), rng, 6)
    a.shape(arched(186, 196, 28, 36))
    a.line([(200, 160), (200, 196)])
    a.detail([(186, 178), (214, 178)])
    # corbelled turret on the keep's right corner
    tur = A([(232, 154), (232, 112), (248, 112), (248, 154)])
    tur_b = np.vstack([A([(248, 154)]), cubic((248, 154), (248, 162), (243, 166), (240, 170)),
                       cubic((240, 170), (237, 166), (232, 162), (232, 154))[1:]])
    a.shape(np.vstack([A([(232, 112), (248, 112)]), tur_b]))
    a.shape(cone_roof(240, 112, 16, 34, 3))
    a.shape(arched(237, 140, 6, 14))
    # curtain walls
    for (x0, x1, top) in ((112, 160, 206), (240, 288, 212)):
        w_ = A([(x0, base), (x0, top)] + crenel_top(x0, x1, top, 8, 6, 8) + [(x1, top), (x1, base)])
        a.shape(w_)
        a.line([(x0, top + 5), (x1, top + 5)])
        bricks(a, Region([rect(x0 + 2, top + 10, x1 - x0 - 4, base - top - 14)]), rng, 3)
    # gate
    gate = arched(184, base, 32, 40)
    a.shape(gate)
    g_in = Region([gate])
    for x in np.arange(188, 214, 6):
        for seg in clip_in(A([(x, base - 40), (x, base)]), g_in, 1.5, 2):
            a.detail(seg)
    for y in np.arange(base - 32, base, 7):
        for seg in clip_in(A([(184, y), (216, y)]), g_in, 1.5, 2):
            a.detail(seg)
    vous = arc(200, base - 24, 22, 22, 180, 360)
    a.line(vous)
    for i in range(1, 8):
        th = 180 + 180 * i / 8
        p0 = (200 + 16 * math.cos(math.radians(th)), base - 24 + 16 * math.sin(math.radians(th)))
        p1 = (200 + 22 * math.cos(math.radians(th)), base - 24 + 22 * math.sin(math.radians(th)))
        a.detail([p0, p1])
    # side round towers (in front)
    for (cx, top, roof_h, side) in ((112, 150, 70, -1), (288, 164, 62, 1)):
        w = 36
        body = A([(cx - w / 2, base + 2), (cx - w / 2, top), (cx + w / 2, top), (cx + w / 2, base + 2)])
        a.shape(body)
        band = rrect_pts(cx - w / 2 - 4, top - 10, w + 8, 12, 2)
        a.shape(band)
        for k in range(1, 5):
            x = cx - w / 2 - 4 + (w + 8) * k / 5
            a.detail([(x, top - 9), (x, top + 1)])
        r_ = cone_roof(cx, top - 10, w + 4, roof_h, 5)
        a.shape(r_)
        shingles(a, r_, 6.5, 8)
        pole, fl = flag(cx, top - 10 - roof_h, 0.8, side)
        a.line(pole)
        a.shape(fl)
        a.shape(arched(cx - 4, top + 34, 8, 18))
        a.shape(arched(cx - 4, top + 74, 8, 16))
        # cylinder shading strokes on the shadow side
        for x in np.arange(cx + w / 2 - 3, cx + w / 2 - 14, -3.3):
            a.detail([(x, top + 3), (x, base - 1)])
        bricks(a, Region([rect(cx - w / 2 + 2, top + 40, w * 0.55, base - top - 50)]), rng, 2, bw=8, bh=5)
    return finish(a, meta('scn-castle-hill', 'Castle under a crescent moon', 'fantasy', 'advanced',
                          ['gothic', 'whimsical', 'castle', 'fairytale', 'moon', 'night', 'halloween', 'stylized']),
                  err=0.45)


# helpers:scn-mushroom-house
def little_flower(a, x, y, r, n=5, stem=0.0, rot=0.0):
    if stem:
        a.line(catmull([(x, y + r), (x + 1.5, y + r + stem * 0.5), (x, y + r + stem)]))
    pts = []
    for i in range(n):
        th = rot + 360 * i / n
        c = (x + r * 0.62 * math.cos(math.radians(th - 90)), y + r * 0.62 * math.sin(math.radians(th - 90)))
        pts.append(ell(c[0], c[1], r * 0.42, r * 0.3, th - 90 + 90 * 0))
    pts = [tf(ell(0, 0, r * 0.48, r * 0.3), x + r * 0.55 * math.cos(math.radians(rot + 360 * i / n - 90)),
              y + r * 0.55 * math.sin(math.radians(rot + 360 * i / n - 90)), rot=rot + 360 * i / n - 90) for i in range(n)]
    union_shape(a, pts)
    a.shape(circ(x, y, r * 0.24))


def grass_tuft(a, x, y, s=1.0, n=5, rng=None):
    for k in range(n):
        dx = (k - (n - 1) / 2) * 2.8 * s
        h = (13 - abs(k - (n - 1) / 2) * 3) * s
        a.detail(catmull([(x + dx, y), (x + dx * 1.3, y - h * 0.6), (x + dx * 2.2, y - h)]))


@template('scn-mushroom-house')
def mushroom_house():
    rng = np.random.default_rng(5)
    a = Art()
    # smoke from the chimney
    for (x, y, r) in [(276, 46, 6), (288, 30, 8), (306, 14, 9)]:
        a.shape(circ(x, y, r))
    # chimney
    ch = A([(262, 98), (262, 60), (284, 60), (284, 98)])
    a.shape(ch)
    a.shape(rrect_pts(258, 52, 30, 9, 2))
    # stem / house
    stem = np.vstack([cubic((142, 340), (134, 290), (150, 240), (150, 196)),
                      A([(250, 196)]), cubic((250, 196), (250, 240), (266, 290), (258, 340))[1:]])
    a.shape(stem)
    # underside of the cap with gills
    under = np.vstack([cubic((76, 186), (120, 214), (280, 214), (324, 186)),
                       cubic((324, 186), (280, 196), (120, 196), (76, 186))[1:]])
    under = blob([(74, 184), (130, 204), (200, 212), (270, 204), (326, 184), (270, 196), (200, 199), (130, 196)])
    # cap
    cap = np.vstack([cubic((60, 188), (44, 120), (120, 56), (200, 54)), cubic((200, 54), (280, 56), (356, 120), (340, 188))[1:],
                     cubic((340, 188), (320, 198), (296, 192), (276, 200))[1:], cubic((276, 200), (250, 208), (226, 200), (200, 206))[1:],
                     cubic((200, 206), (174, 200), (150, 208), (124, 200))[1:], cubic((124, 200), (104, 192), (80, 198), (60, 188))[1:]])
    gill_band = np.vstack([cubic((84, 196), (130, 236), (270, 236), (316, 196)), cubic((316, 196), (260, 206), (140, 206), (84, 196))[1:]])
    a.shape(gill_band)
    for i in range(1, 22):
        t = i / 22
        p_out = cubic((84, 196), (130, 236), (270, 236), (316, 196), 23)[i]
        p_in = (200 + (p_out[0] - 200) * 0.45, 200)
        a.detail([p_in, p_out])
    a.erase(Region([stem]))
    a.line(stem, closed=True)
    a.shape(cap)
    for (x0, y0, x1, y1) in [(160, 230, 158, 262), (240, 222, 244, 250), (170, 290, 166, 318), (238, 286, 242, 326),
                             (152, 254, 150, 280)]:
        a.detail(catmull([(x0, y0), ((x0 + x1) / 2 + 1, (y0 + y1) / 2), (x1, y1)]))
    # spots on the cap
    capreg = Region([cap])
    spots = [(120, 120, 18, 13), (176, 84, 14, 10), (244, 92, 20, 14), (300, 140, 15, 12), (196, 148, 22, 15),
             (90, 168, 10, 8), (150, 172, 10, 7), (262, 164, 12, 8), (316, 96, 8, 6), (84, 132, 8, 6)]
    for (x, y, rx, ry) in spots:
        sp = ell(x, y, rx, ry, rng.uniform(-15, 15))
        if capreg.inside(sp, 3).all():
            a.shape(sp)
    # highlight strokes along the cap top
    a.detail(cubic((92, 120), (110, 90), (140, 72), (170, 66)))
    # door
    door = arched(178, 340, 44, 66)
    a.shape(door)
    for x in (189, 200, 211):
        a.detail([(x, 276), (x, 340)])
    a.shape(circ(212, 312, 3))
    for y in (290, 326):
        a.detail(rect(173, y - 3, 7, 6), True)
    # round window with flower box
    a.shape(circ(230, 238, 18))
    a.line(circ(230, 238, 13), closed=True)
    a.detail([(230, 225), (230, 251)])
    a.detail([(217, 238), (243, 238)])
    a.shape(circ(170, 232, 11))
    a.line(circ(170, 232, 7), closed=True)
    for (x, y, rot) in [(212, 262, -62), (216, 260, -30), (244, 260, 30), (248, 262, 62)]:
        a.shape(tf(ell(0, -6, 3.5, 7), x, y, rot=rot))
    box = rect(210, 260, 40, 11)
    a.shape(box)
    # ground line, step and pebble path
    gl = catmull([(4, 350), (60, 346), (130, 342), (270, 342), (340, 346), (396, 350)])
    a.erase(Region([np.vstack([gl, A([(396, 404), (4, 404)])])]), 0.9)
    a.line(gl)
    a.shape(blob([(170, 344), (200, 341), (230, 344), (232, 352), (200, 355), (168, 352)]))
    for (x, y, rx, ry) in [(196, 366, 16, 6), (184, 381, 18, 6.5), (204, 397, 22, 7)]:
        a.shape(ell(x, y, rx, ry))
    # lantern on a post
    a.line([(300, 344), (300, 270)])
    a.line(catmull([(300, 272), (312, 262), (322, 268)]))
    lan = A([(316, 276), (328, 276), (332, 300), (312, 300)])
    a.line([(322, 268), (322, 276)])
    a.shape(lan)
    a.shape(rect(310, 300, 24, 4))
    a.detail(blob([(322, 282), (325, 288), (322, 295), (319, 288)], 0.3), True)
    # small mushrooms
    for (x, y, s_) in [(92, 346, 1.0), (118, 348, 0.7), (346, 350, 0.85)]:
        st = A([(x - 6 * s_, y), (x - 5 * s_, y - 22 * s_), (x + 5 * s_, y - 22 * s_), (x + 6 * s_, y)])
        st = np.vstack([cubic((x - 7 * s_, y), (x - 8 * s_, y - 10 * s_), (x - 4 * s_, y - 16 * s_), (x - 5 * s_, y - 22 * s_)),
                        cubic((x + 5 * s_, y - 22 * s_), (x + 4 * s_, y - 16 * s_), (x + 8 * s_, y - 10 * s_), (x + 7 * s_, y))])
        a.shape(st)
        mc = np.vstack([cubic((x - 24 * s_, y - 20 * s_), (x - 22 * s_, y - 40 * s_), (x + 22 * s_, y - 40 * s_), (x + 24 * s_, y - 20 * s_)),
                        cubic((x + 24 * s_, y - 20 * s_), (x + 10 * s_, y - 24 * s_), (x - 10 * s_, y - 24 * s_), (x - 24 * s_, y - 20 * s_))[1:]])
        a.shape(mc)
        a.detail(circ(x - 8 * s_, y - 30 * s_, 3.5 * s_), True)
        a.detail(circ(x + 7 * s_, y - 31 * s_, 2.5 * s_), True)
    for (x, y) in [(40, 350), (150, 344), (262, 344), (376, 352)]:
        grass_tuft(a, x, y)
    for (x, y, r) in [(54, 314, 12), (370, 312, 12)]:
        little_flower(a, x, y, r, stem=20)
    # fireflies
    for (x, y) in [(46, 252), (356, 228), (70, 222), (352, 40)]:
        a.shape(sparkle(x, y, 6))
    a.fit()
    return finish(a, meta('scn-mushroom-house', 'Mushroom fairy house', 'fantasy', 'intermediate',
                          ['whimsical', 'cute', 'fairy', 'mushroom', 'cottagecore', 'house', 'kids', 'card']))


# helpers:scn-potion-shelf
def cork(a, cx, y_top, w, h):
    c = np.vstack([cubic((cx - w / 2, y_top + h), (cx - w / 2 - 1, y_top + h * 0.4), (cx - w / 2 + 1, y_top + 1), (cx - w / 2 + 3, y_top)),
                   A([(cx + w / 2 - 3, y_top)]),
                   cubic((cx + w / 2 - 3, y_top), (cx + w / 2 - 1, y_top + 1), (cx + w / 2 + 1, y_top + h * 0.4), (cx + w / 2, y_top + h))[1:]])
    a.shape(c)
    a.detail([(cx - w / 2 + 3, y_top + h * 0.45), (cx + w / 2 - 3, y_top + h * 0.45)])


def wavy(x0, x1, y, amp=2.0, n=3):
    xs = np.linspace(x0, x1, 80)
    return np.c_[xs, y + amp * np.sin((xs - x0) / (x1 - x0) * n * 2 * math.pi)]


def cobweb(a, cx, cy, r, a0, a1, spokes=6, rings=5):
    """Corner cobweb: radial threads and sagging rings."""
    angs = np.linspace(a0, a1, spokes)
    ends = [(cx + r * math.cos(math.radians(t)), cy + r * math.sin(math.radians(t))) for t in angs]
    for e in ends:
        a.detail([(cx, cy), e])
    for k in range(1, rings + 1):
        rr = r * k / (rings + 0.6)
        for t0, t1 in zip(angs[:-1], angs[1:]):
            p0 = np.array([cx + rr * math.cos(math.radians(t0)), cy + rr * math.sin(math.radians(t0))])
            p1 = np.array([cx + rr * math.cos(math.radians(t1)), cy + rr * math.sin(math.radians(t1))])
            m = (p0 + p1) / 2
            toward = np.array([cx, cy]) - m
            mid = m + toward * 0.12
            a.detail(cubic(p0, lerp(p0, mid, 0.66), lerp(p1, mid, 0.66), p1))


@template('scn-potion-shelf')
def potion_shelf():
    rng = np.random.default_rng(13)
    a = Art()
    shelf_y = 318
    # cobweb and spider
    cobweb(a, 2, 2, 92, 0, 90, 6, 5)
    a.detail([(64, 40), (64, 116)])
    a.shape(ell(64, 122, 5, 6))
    a.shape(circ(64, 113, 3.5))
    for s_ in (-1, 1):
        for k in range(3):
            a.detail(catmull([(64 + s_ * 4, 119 + k * 3), (64 + s_ * 10, 114 + k * 4), (64 + s_ * 13, 122 + k * 5)]))
    # candle on the right with drips and flame
    cx = 352
    a.shape(np.vstack([A([(cx - 15, shelf_y)]), A([(cx - 15, 206)]),
                       cubic((cx - 15, 206), (cx - 12, 212), (cx - 9, 222), (cx - 8, 236)),
                       cubic((cx - 8, 236), (cx - 7, 242), (cx - 3, 242), (cx - 2, 232))[1:],
                       cubic((cx - 2, 232), (cx - 1, 220), (cx + 3, 214), (cx + 6, 224))[1:],
                       cubic((cx + 6, 224), (cx + 8, 232), (cx + 12, 232), (cx + 13, 214))[1:],
                       A([(cx + 15, 206), (cx + 15, shelf_y)])]))
    a.shape(ell(cx, 206, 15, 4))
    a.line([(cx, 204), (cx, 194)])
    flame = np.vstack([cubic((cx, 192), (cx - 9, 186), (cx - 8, 172), (cx, 154)), cubic((cx, 154), (cx + 8, 172), (cx + 9, 186), (cx, 192))[1:]])
    a.shape(flame)
    a.detail(np.vstack([cubic((cx, 188), (cx - 4, 184), (cx - 4, 176), (cx, 168)), cubic((cx, 168), (cx + 4, 176), (cx + 4, 184), (cx, 188))[1:]]), True)
    for k, r in enumerate((26, 34)):
        a.detail(arc(cx, 178, r * 0.8, r, -150, -30))
    a.shape(ell(cx, shelf_y - 2, 26, 6))
    # 1. round flask with bubbling liquid
    fx, fy, fr = 82, 266, 46
    body = circ(fx, fy, fr)
    neck_l, neck_r = fx - 11, fx + 11
    a.shape(np.vstack([A([(neck_l, 170), (neck_l, fy - fr + 3)]), arc(fx, fy, fr, fr, -104, 284)[1:-1],
                       A([(neck_r, fy - fr + 3), (neck_r, 170)])]))
    a.shape(rrect_pts(neck_l - 4, 164, 30, 8, 3))
    cork(a, fx, 144, 20, 21)
    liq = Region([body])
    for seg in clip_in(wavy(fx - fr, fx + fr, 262, 2.2, 3), liq, 1.5, 3):
        a.line(seg)
    for (x, y, r) in [(70, 286, 6), (94, 280, 4), (84, 298, 3.5), (100, 300, 5), (62, 302, 3), (88, 246, 3), (80, 232, 4.5), (86, 212, 3), (78, 186, 2.5)]:
        a.detail(circ(x, y, r), True)
    a.detail(arc(fx, fy, fr - 8, fr - 8, 200, 245))
    a.shape(ell(fx, shelf_y - 4, 22, 4))
    # 2. tall bottle with label
    bx = 158
    tall = np.vstack([A([(bx - 22, shelf_y - 2), (bx - 22, 190)]), cubic((bx - 22, 190), (bx - 22, 172), (bx - 9, 170), (bx - 9, 156))[1:],
                      A([(bx - 9, 138), (bx + 9, 138), (bx + 9, 156)]),
                      cubic((bx + 9, 156), (bx + 9, 170), (bx + 22, 172), (bx + 22, 190))[1:], A([(bx + 22, shelf_y - 2)])])
    a.shape(tall)
    a.shape(rrect_pts(bx - 12, 134, 24, 7, 3))
    cork(a, bx, 116, 16, 20)
    lab = rrect_pts(bx - 17, 226, 34, 52, 4)
    a.shape(lab)
    a.detail(rrect_pts(bx - 13, 230, 26, 44, 3), True)
    a.shape(crescent((bx - 1, 252), 11, (bx + 5, 248), 9.5))
    a.shape(sparkle(bx + 8, 240, 4.5))
    for seg in clip_in(wavy(bx - 22, bx + 22, 204, 1.6, 2), Region([tall]), 1.5, 3):
        a.line(seg)
    a.detail([(bx - 15, 196), (bx - 15, 216)])
    a.detail([(bx - 15, 286), (bx - 15, 304)])
    # 3. crystal ball on an ornate stand
    gx, gy, gr = 252, 222, 46
    stand = np.vstack([A([(gx - 34, shelf_y - 2)]), cubic((gx - 34, shelf_y - 2), (gx - 30, shelf_y - 14), (gx - 22, shelf_y - 20), (gx - 20, 276)),
                       cubic((gx - 20, 276), (gx - 26, 272), (gx - 28, 262), (gx - 30, 258))[1:],
                       A([(gx + 30, 258)]),
                       cubic((gx + 30, 258), (gx + 28, 262), (gx + 26, 272), (gx + 20, 276))[1:],
                       cubic((gx + 20, 276), (gx + 22, shelf_y - 20), (gx + 30, shelf_y - 14), (gx + 34, shelf_y - 2))[1:]])
    a.shape(stand)
    a.detail(np.vstack([A([(gx - 21, 286)]), cubic((gx - 21, 286), (gx - 8, 290), (gx + 8, 290), (gx + 21, 286))[1:]]))
    for k in (-1, 0, 1):
        a.detail(circ(gx + k * 13, 298, 3.2), True)
    ball = circ(gx, gy, gr)
    a.shape(ball)
    a.detail(arc(gx, gy, gr - 9, gr - 9, 195, 250))
    a.detail(arc(gx, gy, gr - 9, gr - 9, 258, 266))
    # swirling mist inside
    for (y, x0, x1, amp) in [(gy + 4, gx - 34, gx + 30, 5), (gy + 18, gx - 28, gx + 36, 4), (gy - 10, gx - 22, gx + 16, 4)]:
        xs = np.linspace(x0, x1, 60)
        a.detail(np.c_[xs, y + amp * np.sin((xs - x0) / (x1 - x0) * 2 * math.pi)])
    for (x, y, r) in [(gx + 20, gy - 24, 7), (gx - 20, gy + 32, 4), (gx + 30, gy - 4, 3.5)]:
        a.shape(sparkle(x, y, r))
    # 4. small vial with heart label, in front-right of ball
    vx = 302
    vial = np.vstack([A([(vx - 9, 236), (vx - 9, shelf_y - 10)]), arc(vx, shelf_y - 10, 9, 8, 180, 0)[::-1][1:-1][::-1],
                      A([(vx + 9, shelf_y - 10), (vx + 9, 236)])])
    a.shape(vial)
    a.shape(rrect_pts(vx - 12, 230, 24, 7, 3))
    cork(a, vx, 214, 14, 17)
    a.line(wavy(vx - 9, vx + 9, 262, 1.3, 1))
    heart = np.vstack([cubic((vx, 290), (vx - 10, 282), (vx - 7, 272), (vx, 278)), cubic((vx, 278), (vx + 7, 272), (vx + 10, 282), (vx, 290))[1:]])
    a.shape(heart)
    # garland of hanging charms
    g = catmull([(96, 26), (180, 58), (270, 64), (360, 40), (396, 28)])
    a.line(g)
    charms = [(0.12, 'star', 34), (0.3, 'moon', 22), (0.48, 'star', 30), (0.64, 'gem', 44), (0.8, 'star', 26)]
    for t, kind, L in charms:
        p, _ = along(g, t)
        x, y = p
        a.detail([(x, y), (x, y + L)])
        yc = y + L
        if kind == 'star':
            a.shape(star5(x, yc + 11, 12, 5.2))
        elif kind == 'moon':
            a.shape(crescent((x, yc + 14), 14, (x + 7, yc + 9), 12))
        else:
            gem = A([(x, yc), (x + 9, yc + 8), (x + 9, yc + 22), (x, yc + 32), (x - 9, yc + 22), (x - 9, yc + 8)])
            a.shape(gem)
            a.detail([(x, yc), (x, yc + 32)])
            a.detail([(x - 9, yc + 8), (x, yc + 13), (x + 9, yc + 8)])
            a.detail([(x - 9, yc + 22), (x, yc + 27), (x + 9, yc + 22)])
    # shelf with brackets
    a.shape(rect(8, shelf_y, 384, 14))
    a.line([(8, shelf_y + 5), (392, shelf_y + 5)])
    for x in (60, 340):
        br = np.vstack([A([(x - 6, shelf_y + 14), (x - 6, shelf_y + 18)]), cubic((x - 6, shelf_y + 18), (x - 6, shelf_y + 46), (x + 20, shelf_y + 40), (x + 10, shelf_y + 28)),
                        cubic((x + 10, shelf_y + 28), (x + 4, shelf_y + 22), (x - 2, shelf_y + 30), (x + 4, shelf_y + 34))[1:]])
        a.line(br)
        a.line(mirror(br, x - 6))
    # wood grain
    for (x0, x1, y) in [(30, 120, shelf_y + 9.5), (170, 260, shelf_y + 9.5), (300, 370, shelf_y + 9.5)]:
        a.detail([(x0, y), (x1, y)])
    a.fit((10, 10, 390, 390), 1.1)
    return finish(a, meta('scn-potion-shelf', 'Potion shelf and crystal ball', 'fantasy', 'intermediate',
                          ['gothic', 'halloween', 'whimsical', 'dark-academia', 'potion', 'witch', 'magic', 'candle']))


# helpers:scn-books-candle
def book_spine(a, x0, x1, y0, y1, rot, rng, style=0):
    """Book lying flat, spine towards the viewer."""
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    R_ = lambda P: tf(P, rot=rot, ox=cx, oy=cy)
    h = y1 - y0
    outline = np.vstack([A([(x0 + 6, y0)]), A([(x1 - 6, y0)]), arc(x1 - 6, cy, 6, h / 2, -90, 90)[1:-1],
                         A([(x1 - 6, y1), (x0 + 6, y1)]), arc(x0 + 6, cy, 6, h / 2, 90, 270)[1:-1]])
    a.shape(R_(outline))
    # raised bands near the ends
    for bx in (x0 + 22, x0 + 30, x1 - 30, x1 - 22):
        a.detail(R_(A([(bx, y0 + 1.5), (bx, y1 - 1.5)])))
    if style == 0:
        lab = rrect_pts(cx - 34, cy - h * 0.28, 68, h * 0.56, 3)
        a.line(R_(lab), closed=True)
        a.detail(R_(rrect_pts(cx - 30, cy - h * 0.28 + 3.5, 60, h * 0.56 - 7, 2)), True)
        for dx in (-50, 50):
            d = A([(cx + dx, cy - 5), (cx + dx + 4, cy), (cx + dx, cy + 5), (cx + dx - 4, cy)])
            a.detail(R_(d), True)
    elif style == 1:
        for yy in (cy - h * 0.18, cy + h * 0.18):
            a.detail(R_(A([(x0 + 40, yy), (x1 - 40, yy)])))
        a.detail(R_(star5(cx, cy, 6, 2.6, -90)), True)
        a.detail(R_(circ(cx - 26, cy, 2.2)), True)
        a.detail(R_(circ(cx + 26, cy, 2.2)), True)
    else:
        lab = rect(cx - 22, y0 + 3, 44, h - 6)
        a.line(R_(lab), closed=True)
        for k in range(3):
            yy = y0 + 3 + (h - 6) * (k + 1) / 4
            a.detail(R_(A([(cx - 16, yy), (cx + 16, yy)])))


def book_pages(a, x0, x1, y0, y1, rot, spacing=3.0):
    """Book lying flat with the page edges towards the viewer: boards + page block + rounded spine."""
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    R_ = lambda P: tf(P, rot=rot, ox=cx, oy=cy)
    h = y1 - y0
    board = 3.5
    outline = np.vstack([A([(x1, y0), (x1, y0 + board), (x1 - 4, y0 + board), (x1 - 4, y1 - board), (x1, y1 - board),
                            (x1, y1), (x0 + 10, y1)]), arc(x0 + 10, cy, 10, h / 2, 90, 270)[1:-1]])
    outline = np.vstack([A([(x0 + 10, y0), (x1, y0), (x1, y0 + board), (x1 - 4, y0 + board), (x1 - 4, y1 - board),
                            (x1, y1 - board), (x1, y1), (x0 + 10, y1)]), arc(x0 + 10, cy, 10, h / 2, 90, 270)[1:-1]])
    a.shape(R_(outline))
    # inner edge of the boards and the page block
    a.line(R_(A([(x0 + 12, y0 + board), (x1 - 4, y0 + board)])))
    a.line(R_(A([(x0 + 12, y1 - board), (x1 - 4, y1 - board)])))
    blk = np.vstack([A([(x0 + 14, y0 + board), (x1 - 4, y0 + board), (x1 - 4, y1 - board), (x0 + 14, y1 - board)]),
                     arc(x0 + 14, cy, 5, h / 2 - board, 90, 270)[1:-1]])
    reg = Region([R_(blk)])
    n = int((h - 2 * board) / spacing)
    for k in range(1, n):
        yy = y0 + board + (h - 2 * board) * k / n
        seg = R_(A([(x0 + 16, yy), (x1 - 6, yy)]))
        a.lines(clip_in(seg, reg, 1.0, 4), 'detail')
    a.detail(R_(arc(x0 + 12, cy, 6, h / 2 - board, 90, 270)))
    # ribbon bookmark hanging out
    return R_


@template('scn-books-candle')
def books_candle():
    rng = np.random.default_rng(31)
    a = Art()
    table = 374
    # books, bottom to top
    book_spine(a, 40, 316, 330, table, 0, rng, 0)
    book_pages(a, 58, 300, 298, 330, -1.2, 3.1)
    book_spine(a, 50, 286, 264, 298, 1.6, rng, 1)
    R4 = book_pages(a, 84, 276, 238, 264, -2.0, 3.0)
    # bookmark ribbon from the top book
    rb = R4(ribbon(catmull([(268, 262), (274, 276), (270, 292)]), 7, notch=4))
    a.shape(rb)
    book_spine(a, 96, 262, 212, 238, 2.5, rng, 2)
    # chamberstick candle on top
    cx = 172
    base_y = 212
    a.shape(ell(cx, base_y - 4, 46, 8))
    a.line(arc(cx, base_y - 6, 40, 5, 180, 360))
    handle = np.vstack([arc(cx + 54, base_y - 6, 10, 8, 200, 520)])
    a.erase(Region([ell(cx, base_y - 4, 46, 8)]))
    a.shape(ell(cx, base_y - 4, 46, 8))
    a.line(arc(cx + 52, base_y - 8, 9, 7, 140, 400))
    a.shape(ell(cx, base_y - 12, 14, 4))
    cw = 15
    top = 96
    body = np.vstack([A([(cx - cw, base_y - 12), (cx - cw, top)]),
                      cubic((cx - cw, top), (cx - cw + 2, top + 8), (cx - cw + 5, top + 18), (cx - cw + 5, top + 30)),
                      cubic((cx - cw + 5, top + 30), (cx - cw + 5, top + 37), (cx - cw + 11, top + 37), (cx - cw + 11, top + 26))[1:],
                      cubic((cx - cw + 11, top + 26), (cx - cw + 11, top + 14), (cx + 2, top + 10), (cx + 4, top + 20))[1:],
                      cubic((cx + 4, top + 20), (cx + 5, top + 26), (cx + 10, top + 26), (cx + 10, top + 16))[1:],
                      cubic((cx + 10, top + 16), (cx + 10, top + 10), (cx + cw - 2, top + 6), (cx + cw, top))[1:],
                      A([(cx + cw, base_y - 12)])])
    a.shape(body)
    a.shape(ell(cx, top, cw, 4))
    a.line([(cx, top - 2), (cx + 1, top - 12)])
    flame = np.vstack([cubic((cx + 1, top - 10), (cx - 11, top - 16), (cx - 9, top - 34), (cx + 2, top - 58)),
                       cubic((cx + 2, top - 58), (cx + 11, top - 34), (cx + 12, top - 16), (cx + 1, top - 10))[1:]])
    a.shape(flame)
    inner = np.vstack([cubic((cx + 1, top - 14), (cx - 5, top - 18), (cx - 4, top - 28), (cx + 1, top - 38)),
                       cubic((cx + 1, top - 38), (cx + 6, top - 28), (cx + 6, top - 18), (cx + 1, top - 14))[1:]])
    a.detail(inner, True)
    for r in (34, 46):
        a.detail(arc(cx + 1, top - 30, r * 0.85, r, -160, -110))
        a.detail(arc(cx + 1, top - 30, r * 0.85, r, -70, -20))
    # drip on the candle body: wax pool lines
    a.detail([(cx - cw + 2, top + 48), (cx - cw + 2, top + 70)])
    # inkwell
    ix = 342
    well = np.vstack([A([(ix - 30, table)]), cubic((ix - 30, table), (ix - 34, table - 20), (ix - 30, table - 34), (ix - 14, table - 38)),
                      A([(ix - 12, table - 46), (ix + 12, table - 46), (ix + 14, table - 38)]),
                      cubic((ix + 14, table - 38), (ix + 30, table - 34), (ix + 34, table - 20), (ix + 30, table))[1:]])
    # quill: shaft, vanes and barbs (drawn before the inkwell so the well hides the shaft)
    p0, p1, p2, p3 = (ix - 2, table - 40), (ix + 4, 220), (ix - 10, 110), (ix - 52, 24)
    shaft = cubic(p0, p1, p2, p3, 300)
    sh_len = plen(shaft)
    T = np.linspace(0, 1, len(shaft))
    tg = np.gradient(shaft, axis=0)
    tg /= np.linalg.norm(tg, axis=1)[:, None]
    nrm = np.c_[-tg[:, 1], tg[:, 0]]
    t0 = 0.3
    def width(t, W):
        u = np.clip((t - t0) / (1 - t0), 0, 1)
        return W * np.sin(np.pi * u ** 0.75) ** 0.7 * (1 - 0.15 * u)
    wl = width(T, 36)
    wr = width(T, 22)
    left = shaft + nrm * wl[:, None]
    right = shaft - nrm * wr[:, None]
    m = T >= t0
    vane = np.vstack([left[m], right[m][::-1]])
    a.shape(vane)
    a.line(shaft)
    # barbs: angled toward the tip, a few splits in the vane
    splits_l = {0.54, 0.72}
    splits_r = {0.6}
    for side, w_, sgn, splits in ((left, wl, 1, splits_l), (right, wr, -1, splits_r)):
        for t in np.arange(t0 + 0.03, 0.985, 0.021):
            i = int(t * (len(shaft) - 1))
            j = min(len(shaft) - 1, int(min(t + 0.05, 1) * (len(shaft) - 1)))
            if any(abs(t - s_) < 0.006 for s_ in splits):
                continue
            q0 = shaft[i] + nrm[i] * sgn * 1.8
            q1 = shaft[j] + nrm[j] * sgn * w_[j] * 0.92
            a.detail(cubic(q0, lerp(q0, q1, 0.4) + nrm[i] * sgn * 1.5, lerp(q0, q1, 0.75), q1, 12))
    # down tuft at the base of the vane
    for k in range(6):
        i = int((t0 - 0.01 * k) * (len(shaft) - 1))
        for sgn in (1, -1):
            q0 = shaft[i]
            q1 = shaft[i] + nrm[i] * sgn * (10 - k) - tg[i] * (6 + k)
            a.detail(cubic(q0, lerp(q0, q1, 0.3) + tg[i] * 3, lerp(q0, q1, 0.7), q1, 10))
    a.shape(well)
    a.shape(rrect_pts(ix - 16, table - 52, 32, 8, 3))
    a.detail(arc(ix, table - 18, 24, 12, 200, 250))
    lab = rrect_pts(ix - 16, table - 26, 32, 14, 2)
    a.line(lab, closed=True)
    # table line
    a.line([(4, table), (396, table)])
    # a moth drawn to the flame
    mx, my, mrot = 82, 112, -18
    M_ = lambda P: tf(P, mx, my, rot=mrot)
    fore = blob([(2, -4), (20, -24), (44, -30), (50, -20), (40, -4), (14, 4)])
    hind = blob([(2, 2), (26, 6), (34, 18), (24, 30), (8, 22)])
    for sgn in (1, -1):
        mir = (lambda P: P) if sgn == 1 else (lambda P: mirror(P, 0))
        a.shape(M_(mir(hind)))
        a.shape(M_(mir(fore)))
        a.detail(M_(mir(catmull([(8, -6), (24, -18), (42, -22)]))))
        a.detail(M_(mir(catmull([(10, -2), (28, -6), (42, -10)]))))
        a.detail(M_(mir(circ(30, -12, 4))), True)
        a.detail(M_(mir(catmull([(8, 6), (20, 12), (26, 22)]))))
        a.detail(M_(mir(arc(20, 18, 6, 5, 200, 340))))
        ant = catmull([(1.5, -12), (6, -24), (14, -32)])
        a.line(M_(mir(ant)))
        for k in range(1, 6):
            p_, tg_ = along(ant, k / 6.5)
            nr = np.array([-tg_[1], tg_[0]])
            a.detail(M_(mir(A([p_, p_ + nr * 3 - tg_ * 1]))))
            a.detail(M_(mir(A([p_, p_ - nr * 3 - tg_ * 1]))))
    a.shape(M_(ell(0, 4, 4, 15)))
    for y_ in (0, 5, 10):
        a.detail(M_(A([(-3.5, y_), (3.5, y_)])))
    a.shape(M_(circ(0, -12, 3.5)))
    # small sealed letter leaning on the stack? keep the table clear: a few wax drips on the table
    a.fit((12, 12, 388, 388), 1.08)
    return finish(a, meta('scn-books-candle', 'Old books, candle and quill', 'fantasy', 'advanced',
                          ['dark-academia', 'vintage', 'gothic', 'books', 'candle', 'quill', 'library', 'journal']),
                  err=0.45)


# helpers:scn-watch-key
NUMERALS = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']


def numeral_strokes(txt, h=13.0, w1=3.4, gap=2.6):
    """Roman numeral as stroke segments centred at the origin, upright (y down), with serifs."""
    glyphs = []
    x = 0.0
    for ch in txt:
        if ch == 'I':
            glyphs.append(([[(x, -h / 2), (x, h / 2)]], x - 1.6, x + 1.6))
            x += gap + 0.6
        elif ch == 'V':
            glyphs.append(([[(x - w1, -h / 2), (x, h / 2), (x + w1, -h / 2)]], x - w1 - 1.4, x + w1 + 1.4))
            x += 2 * w1 + gap
        elif ch == 'X':
            glyphs.append(([[(x - w1, -h / 2), (x + w1, h / 2)], [(x + w1, -h / 2), (x - w1, h / 2)]], x - w1 - 1.4, x + w1 + 1.4))
            x += 2 * w1 + gap
    # recentre: shift glyph origins so letters are spaced
    out = []
    pos = 0.0
    spans = []
    for strokes, lo, hi in glyphs:
        wid = hi - lo
        dx = pos - lo
        out += [A(s_) + [dx, 0] for s_ in strokes]
        spans.append((pos, pos + wid))
        pos += wid + 0.8
    total = pos - 0.8
    out = [s_ - [total / 2, 0] for s_ in out]
    # serif bars across the whole numeral, top and bottom
    out.append(A([(-total / 2, -h / 2), (total / 2, -h / 2)]))
    out.append(A([(-total / 2, h / 2), (total / 2, h / 2)]))
    return out


def key_shape(a, L=300.0, xf=lambda P: P):
    """Ornate skeleton key along +x: bow at the origin, tip at x = -L."""
    lobes = [circ(18 * math.cos(math.radians(t)), 18 * math.sin(math.radians(t)), 15) for t in (-62, 0, 62)]
    core = circ(0, 0, 15)
    neck = A([(-30, -7), (-6, -10), (-6, 10), (-30, 7)])
    # shaft with collars
    shaft = A([(-L + 8, -5.5), (-26, -5.5), (-26, 5.5), (-L + 8, 5.5)])
    a.shape(xf(shaft))
    for cxk in (-34, -44):
        a.shape(xf(blob([(cxk - 4, 0), (cxk - 3, -8.5), (cxk, -9.5), (cxk + 3, -8.5), (cxk + 4, 0), (cxk + 3, 8.5),
                         (cxk, 9.5), (cxk - 3, 8.5)])))
    a.shape(xf(blob([(-L + 120, 0), (-L + 117, -7.5), (-L + 112, -8), (-L + 107, -7.5), (-L + 104, 0), (-L + 107, 7.5),
                     (-L + 112, 8), (-L + 117, 7.5)])))
    # bit with wards
    bit = A([(-L + 12, 5.5), (-L + 12, 30), (-L + 20, 30), (-L + 20, 22), (-L + 28, 22), (-L + 28, 34), (-L + 38, 34),
             (-L + 38, 24), (-L + 46, 24), (-L + 46, 5.5)])
    a.shape(xf(bit))
    a.detail(xf(A([(-L + 16, 12), (-L + 42, 12)])))
    a.shape(xf(circ(-L + 6, 0, 7)))
    a.shape(xf(blob([(-30, -6), (-14, -9), (-8, 0), (-14, 9), (-30, 6)])))
    bow_parts = [circ(4, 0, 22)] + [circ(4 + 22 * math.cos(math.radians(t)), 22 * math.sin(math.radians(t)), 8.5)
                                    for t in (-90, -30, 30, 90)]
    union_shape(a, [xf(p) for p in bow_parts])
    a.line(xf(foil(4, 0, 15, 4, rot=45)), closed=True)
    a.detail(xf(circ(4, 0, 3.5)), True)
    for t in (-90, -30, 30, 90):
        c = (4 + 22 * math.cos(math.radians(t)), 22 * math.sin(math.radians(t)))
        a.detail(xf(circ(c[0], c[1], 3)), True)


@template('scn-watch-key')
def watch_key():
    rng = np.random.default_rng(41)
    a = Art()
    # key lying across the bottom, partly under the watch
    k_rot = -10
    xf = lambda P: tf(P, 356, 330, rot=k_rot)
    key_shape(a, 310, xf)
    # watch chain arcing from the bow ring to a fob on the right
    W = np.array([168.0, 196.0])
    R = 116
    chain_path = catmull([(168, 30), (230, 14), (300, 30), (350, 80), (366, 150), (352, 214)])
    n_links = 19
    for i in range(n_links):
        t0, t1 = i / n_links, (i + 1) / n_links
        p0, tg = along(chain_path, (t0 + t1) / 2)
        L = plen(chain_path) / n_links
        rot_ = math.degrees(math.atan2(tg[1], tg[0]))
        if i % 2 == 0:
            a.shape(ell(p0[0], p0[1], L * 0.72, 7, rot_))
            a.detail(ell(p0[0], p0[1], L * 0.72 - 6, 2.2, rot_), True)
        else:
            a.shape(ell(p0[0], p0[1], L * 0.7, 2.6, rot_))
    # T-bar fob at the end
    end = chain_path[-1]
    a.shape(rrect_pts(end[0] - 22, end[1] + 2, 44, 8, 4))
    a.shape(circ(end[0], end[1] + 6, 5))
    # bow ring and crown
    a.shape(ell(168, 40, 22, 24))
    a.line(ell(168, 40, 15, 17), closed=True)
    crown = rrect_pts(154, 52, 28, 18, 4)
    a.shape(crown)
    for x in np.arange(158, 180, 4):
        a.detail([(x, 54), (x, 68)])
    a.shape(rect(160, 70, 16, 12))
    a.detail([(160, 75), (176, 75)])
    # case
    a.shape(circ(W[0], W[1], R))
    a.line(circ(W[0], W[1], R - 9), closed=True)
    # knurled bezel between the two rings
    for i in range(120):
        th = 360 * i / 120
        p0 = W + (R - 7.5) * np.array([math.cos(math.radians(th)), math.sin(math.radians(th))])
        p1 = W + (R - 1.5) * np.array([math.cos(math.radians(th)), math.sin(math.radians(th))])
        a.detail([p0, p1])
    a.detail(circ(W[0], W[1], R - 15), True)
    # minute track
    a.detail(circ(W[0], W[1], R - 22), True)
    for i in range(60):
        th = math.radians(6 * i - 90)
        u = np.array([math.cos(th), math.sin(th)])
        if i % 5 == 0:
            a.line([W + u * (R - 29), W + u * (R - 17)])
        else:
            a.detail([W + u * (R - 22), W + u * (R - 17)])
    # roman numerals, radial
    for i, txt in enumerate(NUMERALS):
        th = 30 * i
        c = W + (R - 44) * np.array([math.sin(math.radians(th)), -math.cos(math.radians(th))])
        for st in numeral_strokes(txt, 14, 3.3, 2.4):
            a.detail(tf(st, c[0], c[1], rot=th))
    # inner chapter ring with filigree scallops
    a.detail(circ(W[0], W[1], R - 56), True)
    for i in range(24):
        th = 15 * i
        c = W + (R - 61) * np.array([math.sin(math.radians(th)), -math.cos(math.radians(th))])
        a.detail(tf(arc(0, 0, 4.5, 4.5, 0, 180), c[0], c[1], rot=th))
    # sub-seconds dial
    sc = W + np.array([0, 37])
    a.line(circ(sc[0], sc[1], 15), closed=True)
    for i in range(12):
        th = math.radians(30 * i - 90)
        u = np.array([math.cos(th), math.sin(th)])
        a.detail([sc + u * 10.5, sc + u * 14])
    a.detail([sc, sc + np.array([7, -6])])
    a.detail(circ(sc[0], sc[1], 2), True)
    # hands: breguet hour hand and long minute hand
    def hand(length, width, deg, moon_r=0.0):
        th = math.radians(deg)
        u = np.array([math.sin(th), -math.cos(th)])
        n_ = np.array([-u[1], u[0]])
        tail = W - u * 16
        tip = W + u * length
        pts = np.vstack([cubic(tail + n_ * 2, W + n_ * width, W + u * length * 0.6 + n_ * width * 0.8, tip),
                         cubic(tip, W + u * length * 0.6 - n_ * width * 0.8, W - n_ * width, tail - n_ * 2)[1:]])
        return pts, u
    hp, hu = hand(52, 5, 300)
    a.shape(hp)
    ring_c = W + hu * 36
    a.shape(circ(ring_c[0], ring_c[1], 7.5))
    a.line(circ(ring_c[0], ring_c[1], 4), closed=True)
    mp, mu = hand(84, 4, 52)
    a.shape(mp)
    ring_c = W + mu * 62
    a.shape(circ(ring_c[0], ring_c[1], 6))
    a.line(circ(ring_c[0], ring_c[1], 3), closed=True)
    a.shape(circ(W[0], W[1], 8))
    a.line(circ(W[0], W[1], 3), closed=True)
    # glint on the crystal
    a.detail(arc(W[0], W[1], R - 30, R - 30, 205, 235))
    a.fit((10, 10, 390, 390), 1.1)
    return finish(a, meta('scn-watch-key', 'Pocket watch and ornate key', 'stilllife', 'advanced',
                          ['vintage', 'ornamental', 'steampunk', 'watch', 'clock', 'key', 'dark-academia', 'realistic']),
                  err=0.4)


# helpers:scn-teapot-cups
def lathe(profile, cx):
    """Closed outline from a right-hand half profile [(dx, y), ...] top to bottom, mirrored about cx."""
    right = catmull([(cx + dx, y) for dx, y in profile])
    left = mirror(right, cx)[::-1]
    return np.vstack([right, left[1:-1]]), right


def vine_band(a, cx, y, half_w, ry, rng, n=5, flower_r=7.0, region=None):
    """Front-facing decorative vine wrapped around a round body (between -70..70 degrees)."""
    th = np.linspace(-1.25, 1.25, 120)
    xs = cx + half_w * np.sin(th)
    ys = y + ry * np.cos(th) * 0.35 + 4 * np.sin(th * 6)
    stem = np.c_[xs, ys]
    a.detail(stem)
    for k in range(n):
        t = (k + 0.5) / n
        i = int(t * (len(stem) - 1))
        p = stem[i]
        squash = math.cos(th[i]) * 0.75 + 0.25
        petals = [tf(ell(0, -flower_r * 0.55, flower_r * 0.36, flower_r * 0.55), p[0], p[1], rot=72 * j, sx=squash, sy=1)
                  for j in range(5)]
        petals = [tf(tf(ell(0, -flower_r * 0.55, flower_r * 0.34, flower_r * 0.55), 0, 0, rot=72 * j), p[0], p[1], sx=squash, sy=1)
                  for j in range(5)]
        union_shape(a, petals, layer='detail')
        a.detail(tf(circ(0, 0, flower_r * 0.22), p[0], p[1], sx=squash, sy=1), True)
        if k < n - 1:
            j = int((t + 0.5 / n) * (len(stem) - 1))
            q = stem[j]
            for sgn in (1, -1):
                lf = petal_pts(q, -90 + sgn * 50 + 0, 10, 3.5)
                a.erase(Region([lf]))
                a.detail(lf, True)


def petal_pts(base, deg, length, w):
    """Almond leaf from base pointing at deg (0 = right, screen angles)."""
    t = math.radians(deg)
    u = np.array([math.cos(t), math.sin(t)])
    n_ = np.array([-u[1], u[0]])
    b = np.asarray(base, float)
    tip = b + u * length
    return np.vstack([cubic(b, b + u * length * 0.3 + n_ * w * 1.3, b + u * length * 0.75 + n_ * w * 1.1, tip),
                      cubic(tip, b + u * length * 0.75 - n_ * w * 1.1, b + u * length * 0.3 - n_ * w * 1.3, b)[1:]])


@template('scn-teapot-cups')
def teapot_cups():
    rng = np.random.default_rng(17)
    a = Art()
    cx = 168
    # handle (behind the body)
    outer = catmull([(96, 214), (56, 206), (30, 238), (40, 284), (82, 314), (104, 306)])
    inner = catmull([(104, 290), (80, 294), (56, 274), (52, 246), (66, 226), (94, 230)])
    a.shape(np.vstack([outer, inner]))
    # spout
    sc_ = catmull([(244, 284), (290, 278), (320, 248), (336, 210), (352, 180)])
    spout = ribbon(sc_, 54, w1=15)
    a.shape(spout)
    a.shape(ell(352, 180, 8.5, 4, 30))
    # body
    body, half = lathe([(46, 186), (78, 200), (100, 236), (102, 278), (86, 314), (58, 334)], cx)
    a.shape(body)
    # band lines and vine decoration
    def hw(y):
        i = int(np.argmin(np.abs(half[:, 1] - y)))
        return half[i, 0] - cx
    for y in (238, 300):
        a.detail(arc(cx, y, hw(y) - 1.5, 10, 0, 180))
    vine_band(a, cx, 260, hw(268) - 14, 10, rng, 5, 9)
    for k in range(13):
        th = -1.3 + 2.6 * k / 12
        x = cx + (hw(222) - 6) * math.sin(th)
        a.detail(circ(x, 224 + 6 * math.cos(th), 2.2), True)
    # foot
    a.shape(rrect_pts(cx - 60, 332, 120, 12, 5))
    # lid
    a.shape(ell(cx, 186, 50, 8))
    lid = np.vstack([A([(cx - 42, 184)]), cubic((cx - 42, 184), (cx - 40, 160), (cx - 20, 152), (cx, 150)),
                     cubic((cx, 150), (cx + 20, 152), (cx + 40, 160), (cx + 42, 184))[1:]])
    a.shape(np.vstack([lid, arc(cx, 184, 42, 6, 0, 180)[1:-1]]))
    a.detail(arc(cx, 170, 34, 5, 10, 170))
    a.shape(rrect_pts(cx - 7, 140, 14, 12, 3))
    a.shape(circ(cx, 132, 11))
    a.detail(arc(cx, 132, 6.5, 6.5, 200, 250))
    # glints
    # steam from the spout
    for k, dx in enumerate((0, 16)):
        a.detail(catmull([(356 + dx * 0.3, 168 - k * 6), (346 + dx, 142), (364 + dx, 120), (354 + dx, 94)]))
    # cup and saucer
    ux, uy = 318, 300
    a.shape(ell(ux, 360, 70, 15))
    a.line(ell(ux, 358, 44, 8), closed=True)
    cup_h = np.vstack([catmull([(ux + 40, 314), (ux + 62, 312), (ux + 66, 330), (ux + 46, 344)]),
                       catmull([(ux + 40, 336), (ux + 54, 330), (ux + 52, 320), (ux + 40, 322)])])
    a.shape(cup_h)
    cup, chalf = lathe([(46, 300), (44, 320), (36, 340), (22, 356)], ux)
    a.shape(cup)
    a.shape(ell(ux, 300, 46, 9))
    a.detail(ell(ux, 301, 39, 5.5), True)
    for y in (318,):
        a.detail(arc(ux, y, 43.5, 8, 0, 180))
    for k in range(5):
        th = -1.0 + 2.0 * k / 4
        p = (ux + 34 * math.sin(th), 332 + 6 * math.cos(th))
        sq = math.cos(th) * 0.7 + 0.3
        petals = [tf(tf(ell(0, -3.6, 2.2, 3.6), 0, 0, rot=72 * j), p[0], p[1], sx=sq, sy=1) for j in range(5)]
        union_shape(a, petals, layer='detail')
    # steam over the cup
    # second cup behind-left (small, upside-down on its saucer)? keep a sugar bowl with lump instead
    a.fit((12, 16, 388, 384), 1.1)
    return finish(a, meta('scn-teapot-cups', 'Teapot and teacup', 'stilllife', 'intermediate',
                          ['vintage', 'botanical', 'tea', 'teapot', 'cup', 'cottagecore', 'thanks', 'card']))


# helpers:scn-birthday-cake
def tier(cx, top, bottom, rx, ry):
    """Cylinder outline (front view from slightly above): returns body polygon and top ellipse."""
    body = np.vstack([A([(cx - rx, top), (cx - rx, bottom)]), arc(cx, bottom, rx, ry, 180, 0)[1:-1][::-1][::-1],
                      A([(cx + rx, bottom), (cx + rx, top)])])
    body = np.vstack([A([(cx - rx, top), (cx - rx, bottom)]), arc(cx, bottom, rx, ry, 180, 0), A([(cx + rx, top)]),
                      arc(cx, top, rx, ry, 0, -180)[1:-1]])
    return body, ell(cx, top, rx, ry)


def shell_border(a, cx, y, rx, ry, n, size, layer='main'):
    """Beaded piping along the front half of an ellipse."""
    beads = []
    for i in range(n + 1):
        th = math.pi * (i / n)
        beads.append(circ(cx + rx * math.cos(th), y + ry * math.sin(th) - size * 0.2, size))
    union_shape(a, beads, layer)
    for b in beads:
        c = b.mean(0)
        a.detail(arc(c[0], c[1], size * 0.5, size * 0.5, 200, 260))


@template('scn-birthday-cake')
def birthday_cake():
    rng = np.random.default_rng(23)
    a = Art()
    cx = 200
    # confetti
    for (x, y, r) in [(52, 70, 9), (346, 60, 10), (70, 190, 6), (340, 180, 7), (30, 128, 5), (372, 120, 5)]:
        a.shape(sparkle(x, y, r))
    for (x, y) in [(110, 40), (300, 26), (24, 240), (378, 238), (100, 40), (290, 110)]:
        a.detail(circ(x, y, 3), True)
    # stand
    a.shape(np.vstack([A([(cx - 18, 350), (cx - 26, 382)]), arc(cx, 382, 52, 8, 180, 0), A([(cx + 18, 350)])]))
    a.shape(ell(cx, 348, 156, 20))
    a.line(arc(cx, 348, 146, 15, 10, 170))
    # bottom tier
    b_body, b_top = tier(cx, 256, 334, 122, 18)
    a.shape(b_body)
    a.line(b_top, closed=True)
    # swags on the bottom tier with pearls at the joins
    n_sw = 6
    for i in range(n_sw):
        th0 = math.pi * (i / n_sw)
        th1 = math.pi * ((i + 1) / n_sw)
        x0 = cx - 122 * math.cos(th0)
        x1 = cx - 122 * math.cos(th1)
        y0 = 272 + 18 * math.sin(th0)
        y1 = 272 + 18 * math.sin(th1)
        m = ((x0 + x1) / 2, (y0 + y1) / 2 + 22)
        a.detail(cubic((x0, y0), (x0 + (x1 - x0) * 0.2, m[1]), (x1 - (x1 - x0) * 0.2, m[1]), (x1, y1)))
        a.detail(cubic((x0, y0 + 5), (x0 + (x1 - x0) * 0.25, m[1] + 6), (x1 - (x1 - x0) * 0.25, m[1] + 6), (x1, y1 + 5)))
        if 0 < i:
            a.shape(circ(x0, y0, 4.5))
    shell_border(a, cx, 334, 122, 18, 20, 6.5)
    # top tier with drip icing
    t_body, t_top = tier(cx, 180, 254, 82, 13)
    a.shape(t_body)
    a.line(t_top, closed=True)
    xs = np.linspace(cx - 82, cx + 82, 400)
    th = np.arccos(np.clip((cx - xs) / 82, -1, 1))
    base_y = 180 + 13 * np.sin(th) + 10
    drip = base_y.copy()
    centers = np.linspace(cx - 70, cx + 70, 9)
    for k, c in enumerate(centers):
        L = [16, 26, 12, 30, 18, 24, 14, 28, 20][k]
        drip += L * np.exp(-((xs - c) / 6.5) ** 4)
    a.line(np.c_[xs, drip])
    shell_border(a, cx, 254, 82, 13, 14, 5.5)
    # candles
    for i, (x, h) in enumerate([(152, 58), (176, 70), (200, 64), (224, 70), (248, 58)]):
        th_ = math.acos(np.clip((cx - x) / 82, -1, 1))
        yb = 180 + 6 * math.sin(th_) + (i % 2) * 2
        c_ = rrect_pts(x - 6, yb - h, 12, h, 2)
        a.shape(c_)
        reg = Region([c_])
        for k in range(int(h / 9)):
            y = yb - h + 6 + k * 9
            for seg in clip_in(A([(x - 8, y + 5), (x + 8, y - 3)]), reg, 1.5, 2):
                a.detail(seg)
        a.line([(x, yb - h), (x, yb - h - 6)])
        fl = np.vstack([cubic((x, yb - h - 4), (x - 8, yb - h - 9), (x - 6, yb - h - 20), (x, yb - h - 30)),
                        cubic((x, yb - h - 30), (x + 6, yb - h - 20), (x + 8, yb - h - 9), (x, yb - h - 4))[1:]])
        a.shape(fl)
    # dots under the swags
    for i in range(6):
        th = math.pi * ((i + 0.5) / 6)
        x = cx - 122 * math.cos(th) * 0.98
        y = 272 + 18 * math.sin(th) + 34
        a.detail(circ(x, y, 3), True)
    a.fit((12, 12, 388, 388), 1.1)
    return finish(a, meta('scn-birthday-cake', 'Birthday cake with candles', 'stilllife', 'intermediate',
                          ['birthday', 'cute', 'cake', 'party', 'celebration', 'candles', 'card']))


# helpers:scn-christmas-baubles
def holly_leaf(base, deg, length, width, spikes=3):
    """Holly leaf with spiny scalloped edge."""
    t = math.radians(deg)
    u = np.array([math.cos(t), math.sin(t)])
    n_ = np.array([-u[1], u[0]])
    b = np.asarray(base, float)
    side = []
    pts_r, pts_l = [], []
    for k in range(spikes + 1):
        s = (k + 0.5) / (spikes + 0.5) if k < spikes else 1.0
        wv = width * math.sin(math.pi * min(s, 0.97)) ** 0.8
        pts_r.append(b + u * length * s + n_ * wv * (1.15 if k < spikes else 0))
        pts_l.append(b + u * length * s - n_ * wv * (1.15 if k < spikes else 0))
    def edge(pts, sgn):
        out = [b[None]]
        prev = b
        for p in pts:
            m = (prev + p) / 2 - n_ * sgn * width * 0.22
            out.append(cubic(prev, lerp(prev, m, 0.7), lerp(p, m, 0.7), p)[1:])
            prev = p
        return np.vstack(out)
    R_ = edge(pts_r, 1)
    L_ = edge(pts_l, -1)
    outline = np.vstack([R_, L_[::-1][1:-1]])
    vein = A([b, b + u * length * 0.92])
    return outline, vein


def snowflake(cx, cy, r, rot=0.0):
    out = []
    for i in range(6):
        th = math.radians(rot + 60 * i)
        u = np.array([math.cos(th), math.sin(th)])
        n_ = np.array([-u[1], u[0]])
        c = np.array([cx, cy])
        out.append(A([c + u * r * 0.18, c + u * r]))
        for f_, L in ((0.45, 0.28), (0.72, 0.2)):
            p = c + u * r * f_
            out.append(A([p, p + (u * 0.6 + n_ * 0.8) * r * L]))
            out.append(A([p, p + (u * 0.6 - n_ * 0.8) * r * L]))
    out.append(ngon_pts(cx, cy, r * 0.18, 6, rot))
    return out


def ngon_pts(cx, cy, r, n, rot=0.0):
    return A([(cx + r * math.cos(math.radians(rot + 360 * i / n)), cy + r * math.sin(math.radians(rot + 360 * i / n)))
              for i in range(n)])


def sphere_band(cx, cy, R, y, tilt=0.18):
    """Horizontal band line around a sphere at height y (front half, curved)."""
    hw = math.sqrt(max(R * R - (y - cy) ** 2, 0))
    return arc(cx, y, hw, hw * tilt, 0, 180)[::-1]


@template('scn-christmas-baubles')
def christmas_baubles():
    rng = np.random.default_rng(29)
    a = Art()
    top = np.array([200.0, 66.0])
    balls = [(96, 232, 64), (200, 286, 80), (306, 222, 60)]
    # ribbons from the bow to each cap
    for (x, y, R) in balls:
        a.line(catmull([top + [0, 6], ((top[0] + x) / 2, (top[1] + y - R) / 2 + 6), (x, y - R - 22)]))
    for idx, (x, y, R) in enumerate(balls):
        reg = Region([circ(x, y, R)])
        a.shape(circ(x, y, R))
        if idx == 0:
            # bands: zigzag, dots, waves
            ys = [y - R * 0.45, y - R * 0.25, y + R * 0.2, y + R * 0.42]
            for yy in ys:
                a.lines(clip_in(sphere_band(x, y, R, yy), reg, 1.0, 3))
            hw = math.sqrt(R * R - (y - R * 0.35 - y) ** 2)
            # zigzag between first two bands
            zz = []
            n = 11
            for k in range(n + 1):
                th = math.pi * k / n
                yy = (y - R * 0.43) if k % 2 == 0 else (y - R * 0.27)
                hwk = math.sqrt(R * R - (yy - y) ** 2) - 3
                zz.append((x - hwk * math.cos(th), yy + hwk * 0.18 * math.sin(th)))
            for seg in clip_in(A(zz), reg, 3, 3):
                a.detail(seg)
            # dots between middle bands
            for k in range(7):
                th = math.pi * (k + 0.5) / 7
                hwk = R * 0.92
                p = (x - hwk * math.cos(th), y - 2 + hwk * 0.18 * math.sin(th))
                a.detail(circ(p[0], p[1], 3.5 * (0.5 + 0.5 * math.sin(th))), True)
            # little stars in the lower band
            for k in range(4):
                th = math.pi * (k + 0.5) / 4
                hwk = math.sqrt(R * R - (R * 0.31) ** 2) - 6
                p = (x - hwk * math.cos(th), y + R * 0.31 + hwk * 0.18 * math.sin(th))
                a.detail(star5(p[0], p[1], 6 * (0.6 + 0.4 * math.sin(th)), 2.6 * (0.6 + 0.4 * math.sin(th))), True)
        elif idx == 1:
            # medallion with a snowflake, framed by scallops, and bands above/below
            a.line(circ(x, y + 4, 36), closed=True)
            a.detail(circ(x, y + 4, 31), True)
            for st in snowflake(x, y + 4, 26, 90):
                a.detail(st, closed=len(st) == 6)
            for k in range(16):
                th = 360 * k / 16
                c = (x + 36 * math.cos(math.radians(th)), y + 4 + 36 * math.sin(math.radians(th)))
                a.detail(tf(arc(0, 0, 4.4, 4.4, 180, 360), c[0], c[1], rot=th + 90))
            for yy, lay in ((y - R * 0.66, 'main'), (y - R * 0.56, 'detail'), (y + R * 0.66, 'main'), (y + R * 0.76, 'detail')):
                a.lines(clip_in(sphere_band(x, y, R, yy), reg, 1.0, 3), lay)
            # sparkles either side of the medallion
            for sx in (-1, 1):
                a.detail(sparkle(x + sx * 58, y + 2, 9), True)
                a.detail(circ(x + sx * 52, y - 26, 3), True)
                a.detail(circ(x + sx * 52, y + 32, 3), True)
        else:
            # globe meridians with an equator band of diamonds
            for lon in (-62, -36, -12, 12, 36, 62):
                lat = np.radians(np.linspace(-88, 88, 120))
                xs = x + R * math.sin(math.radians(lon)) * np.cos(lat)
                ys = y - R * np.sin(lat)
                for seg in clip_in(np.c_[xs, ys], Region([circ(x, y, R)], holes=[A([(x - R, y - 9), (x + R, y - 9), (x + R, y + 11), (x - R, y + 11)])]), 2.5, 4):
                    a.detail(seg)
            for yy in (y - 9, y + 11):
                a.lines(clip_in(sphere_band(x, y, R, yy, 0.12), reg, 1.0, 3))
            for k in range(7):
                th = math.pi * (k + 0.5) / 7
                hwk = R * 0.93
                p = (x - hwk * math.cos(th), y + 1 + hwk * 0.12 * math.sin(th))
                sq = 0.35 + 0.65 * math.sin(th)
                a.detail(A([(p[0], p[1] - 7), (p[0] + 6 * sq, p[1]), (p[0], p[1] + 7), (p[0] - 6 * sq, p[1])]), True)
        # glint
        a.detail(arc(x, y, R - 10, R - 10, 200, 235))
        # cap
        cap = rrect_pts(x - 15, y - R - 14, 30, 18, 3)
        a.shape(cap)
        for cx_ in np.arange(x - 9, x + 10, 6):
            a.detail([(cx_, y - R - 12), (cx_, y - R + 2)])
        a.shape(ell(x, y - R - 20, 6, 7))
    # holly sprig at the top where the ribbons meet
    for (deg, L) in ((-170, 78), (-10, 78), (-125, 62), (-55, 62)):
        o, v = holly_leaf((200, 60), deg, L, 16, 3)
        a.shape(o)
        a.detail(v)
    for (bx, by) in [(190, 66), (210, 66), (200, 78)]:
        a.shape(circ(bx, by, 8))
        a.detail(arc(bx, by, 4, 4, 200, 260))
    a.fit((12, 12, 388, 388), 1.2)
    final = a
    return finish(final, meta('scn-christmas-baubles', 'Christmas bauble trio', 'stilllife', 'intermediate',
                              ['christmas', 'ornamental', 'bauble', 'ornament', 'holly', 'winter', 'snowflake', 'card']))


# helpers:scn-wedding-rings
def sprig(a, stem_ctrl, n_leaves, leaf_len, leaf_w, rng, side_alt=True, flowers=()):
    st = catmull(stem_ctrl)
    a.line(st)
    L = plen(st)
    for k in range(n_leaves):
        t = 0.08 + 0.88 * k / max(n_leaves - 1, 1)
        p, tg = along(st, t)
        base_ang = math.degrees(math.atan2(tg[1], tg[0]))
        sgn = 1 if (k % 2 == 0 or not side_alt) else -1
        ll = leaf_len * (0.65 + 0.35 * math.sin(math.pi * min(t + 0.15, 1)))
        lf = petal_pts(p, base_ang + sgn * 48 + rng.uniform(-6, 6), ll, leaf_w * ll / leaf_len)
        a.shape(lf)
        tip = lf[len(lf) // 2]
        a.detail(lerp(p, tip, np.linspace(0.1, 0.8, 8)[:, None]))
    tipp = st[-1]
    a.shape(petal_pts(tipp, math.degrees(math.atan2(*(st[-1] - st[-5])[::-1])), leaf_len * 0.6, leaf_w * 0.6))
    for (t, r) in flowers:
        p, _ = along(st, t)
        blossom(a, p[0], p[1], r)
    return st


def blossom(a, x, y, r):
    pts = [tf(ell(0, -r * 0.55, r * 0.42, r * 0.58), x, y, rot=72 * j + 18) for j in range(5)]
    union_shape(a, pts)
    a.shape(circ(x, y, r * 0.24))
    for j in range(5):
        p = (x + r * 0.42 * math.cos(math.radians(72 * j - 90 + 18)), y + r * 0.42 * math.sin(math.radians(72 * j - 90 + 18)))
        a.detail([(x + r * 0.26 * math.cos(math.radians(72 * j - 90 + 18)), y + r * 0.26 * math.sin(math.radians(72 * j - 90 + 18))), p])


@template('scn-wedding-rings')
def wedding_rings():
    rng = np.random.default_rng(37)
    a = Art()
    # sprigs behind
    sprig(a, [(196, 366), (120, 352), (64, 302), (44, 230), (62, 156)], 12, 34, 9, rng, flowers=[(0.35, 13)])
    sprig(a, [(204, 366), (280, 352), (336, 302), (356, 230), (338, 156)], 12, 34, 9, rng, flowers=[(0.55, 12)])
    blossom(a, 200, 364, 19)
    blossom(a, 174, 352, 12)
    blossom(a, 228, 354, 13)
    # rings
    A_c, A_r, A_t = np.array([166.0, 236.0]), (72, 64), -8
    B_c, B_r, B_t = np.array([248.0, 252.0]), (66, 58), 10
    band = 11
    def ring_parts(c, r, t):
        outer = ell(c[0], c[1], r[0], r[1], t)
        inner = ell(c[0], c[1], r[0] - band, r[1] - band, t)
        mid = ell(c[0], c[1], r[0] - band * 0.45, r[1] - band * 0.45, t)
        return outer, inner, mid
    Ao, Ai, Am = ring_parts(A_c, A_r, A_t)
    Bo, Bi, Bm = ring_parts(B_c, B_r, B_t)
    bandA = Region([Ao], holes=[Ai])
    bandB = Region([Bo], holes=[Bi])
    a.erase(bandA)
    a.line(Ao, closed=True)
    a.line(Ai, closed=True)
    a.detail(sub(Am, 0.55, 0.85))
    # ring B over ring A
    a.erase(bandB)
    a.line(Bo, closed=True)
    a.line(Bi, closed=True)
    a.detail(sub(Bm, 0.05, 0.3))
    # at the upper crossing ring A passes over B: redraw A there
    box = Region([rect(196, 150, 60, 66)])
    allA = Art()
    allA.line(Ao, closed=True)
    allA.line(Ai, closed=True)
    keep = []
    for lay, P, closed in a.items:
        Q = resample(P, 0.5, closed)
        gone = bandA.inside(Q) & box.inside(Q) & (bandA.dist(Q) > 0.9)
        if gone.any():
            keep += [[lay, r_, False] for r_ in runs(Q, ~gone, 1.0)]
        else:
            keep.append([lay, P, closed])
    a.items = keep
    for P in (Ao, Ai):
        Q = resample(P, 0.5, True)
        m = box.inside(Q) & bandB.inside(Q)
        a.lines(runs(Q, m, 1.0))
    # gem on ring A (at its top)
    gx, gy = A_c[0] + 8, A_c[1] - A_r[1] - 2
    a.erase(Region([A([(gx - 24, gy + 6), (gx + 24, gy + 6), (gx + 24, gy - 50), (gx - 24, gy - 50)])]))
    a.line(np.vstack([arc(gx, gy + 12, 18, 9, 180, 360)]), )
    # setting / prongs
    a.shape(A([(gx - 16, gy + 6), (gx - 10, gy - 6), (gx + 10, gy - 6), (gx + 16, gy + 6)]))
    for sx in (-1, 1):
        a.line([(gx + sx * 9, gy - 6), (gx + sx * 14, gy - 16)])
    # brilliant cut diamond: crown and pavilion
    girdle_y = gy - 18
    crown = A([(gx - 22, girdle_y), (gx - 13, girdle_y - 12), (gx + 13, girdle_y - 12), (gx + 22, girdle_y)])
    pav = A([(gx + 22, girdle_y), (gx, girdle_y + 22)])
    gem = A([(gx - 22, girdle_y), (gx - 13, girdle_y - 12), (gx + 13, girdle_y - 12), (gx + 22, girdle_y), (gx, girdle_y + 22)])
    a.shape(gem)
    a.line([(gx - 22, girdle_y), (gx + 22, girdle_y)])
    for p, q in [((gx - 13, girdle_y - 12), (gx - 6, girdle_y)), ((gx + 13, girdle_y - 12), (gx + 6, girdle_y)),
                 ((gx - 6, girdle_y), (gx, girdle_y - 12)), ((gx + 6, girdle_y), (gx, girdle_y - 12)),
                 ((gx - 6, girdle_y), (gx, girdle_y + 22)), ((gx + 6, girdle_y), (gx, girdle_y + 22)),
                 ((gx - 22, girdle_y), (gx - 6, girdle_y + 8)), ((gx + 22, girdle_y), (gx + 6, girdle_y + 8))]:
        a.detail([p, q])
    for (x, y, r) in [(gx - 34, girdle_y - 18, 7), (gx + 36, girdle_y - 6, 5)]:
        a.shape(sparkle(x, y, r))
    # little hearts
    def heart(x, y, s):
        return np.vstack([cubic((x, y + 8 * s), (x - 12 * s, y - 1 * s), (x - 7 * s, y - 10 * s), (x, y - 4 * s)),
                          cubic((x, y - 4 * s), (x + 7 * s, y - 10 * s), (x + 12 * s, y - 1 * s), (x, y + 8 * s))[1:]])
    for (x, y, s_) in [(200, 96, 1.1)]:
        a.shape(heart(x, y, s_))
    a.fit((12, 12, 388, 388), 1.15)
    return finish(a, meta('scn-wedding-rings', 'Wedding rings with a floral sprig', 'stilllife', 'intermediate',
                          ['wedding', 'love', 'botanical', 'rings', 'engagement', 'anniversary', 'card']))


# helpers:scn-hot-air-balloons
def balloon(a, cx, top, H, W, pattern=0, gores=6):
    """Hot-air balloon: envelope with gores and a band, ropes and basket. H = envelope height."""
    # half profile (u from 0 at top to 1 at mouth)
    prof = [(0.0, 0.0), (0.58, 0.06), (0.92, 0.2), (1.0, 0.38), (0.9, 0.58), (0.62, 0.78), (0.3, 0.94), (0.24, 1.0)]
    right = catmull([(cx + W / 2 * x, top + H * y) for x, y in prof])
    left = mirror(right, cx)[::-1]
    env = np.vstack([right, left[1:-1]])
    mouth_y = top + H
    def hw(y):
        i = int(np.argmin(np.abs(right[:, 1] - y)))
        return right[i, 0] - cx
    # ropes and basket first (envelope drawn over their tops)
    bw = W * 0.2
    bt = mouth_y + H * 0.15
    bh = H * 0.13
    for sx in (-1, 1):
        a.line([(cx + sx * hw(mouth_y - 1), mouth_y), (cx + sx * bw / 2 * 0.9, bt)])
    a.detail([(cx - hw(mouth_y - 1) * 0.35, mouth_y), (cx - bw * 0.15, bt)])
    a.detail([(cx + hw(mouth_y - 1) * 0.35, mouth_y), (cx + bw * 0.15, bt)])
    basket = A([(cx - bw / 2, bt), (cx + bw / 2, bt), (cx + bw / 2 * 0.86, bt + bh), (cx - bw / 2 * 0.86, bt + bh)])
    a.shape(basket)
    a.shape(rrect_pts(cx - bw / 2 - 2, bt - 3, bw + 4, 6, 2.5))
    breg = Region([basket])
    for k in range(1, 4):
        x = cx - bw / 2 + bw * k / 4
        a.lines(clip_in(A([(x, bt + 2), (x * 0.86 + cx * 0.14, bt + bh)]), breg, 1.2, 2), 'detail')
    a.lines(clip_in(A([(cx - bw, bt + bh * 0.5), (cx + bw, bt + bh * 0.5)]), breg, 1.2, 2), 'detail')
    a.shape(env)
    reg = Region([env])
    # gores
    fs = np.sin(np.linspace(-1.2, 1.2, gores)) / math.sin(1.2)
    ys = np.linspace(top + 2, mouth_y - 1, 120)
    for f_ in fs:
        if abs(f_) > 0.97:
            continue
        pts = np.c_[cx + f_ * np.array([hw(y) for y in ys]), ys]
        a.lines(clip_in(pts, reg, 2.0, 4), "detail")
    # decorative band around the widest part
    y0, y1 = top + H * 0.46, top + H * 0.58
    band = lambda y: np.c_[cx + np.linspace(-1, 1, 80) * hw(y), y + np.cos(np.linspace(-1, 1, 80) * math.pi / 2) * H * 0.035]
    a.erase(Region([np.vstack([band(y0), band(y1)[::-1]])]), 0.8)
    for y in (y0, y1):
        a.lines(clip_in(band(y), reg, 0.8, 3))
    breg2 = Region([np.vstack([band(y0), band(y1)[::-1]])])
    if pattern == 0:
        # zigzag
        n = 12
        pts = []
        for k in range(n + 1):
            t = -1 + 2 * k / n
            yy = (y0 + 2.5) if k % 2 == 0 else (y1 - 2.5)
            pts.append((cx + t * hw(yy) * 0.98, yy + math.cos(t * math.pi / 2) * H * 0.035))
        a.lines(clip_in(A(pts), breg2, 0.5, 2), 'detail')
    elif pattern == 1:
        # scallops
        n = 9
        for k in range(n):
            t0, t1 = -1 + 2 * k / n, -1 + 2 * (k + 1) / n
            p0 = np.array([cx + t0 * hw(y0 + 2) * 0.98, y0 + 2 + math.cos(t0 * math.pi / 2) * H * 0.035])
            p1 = np.array([cx + t1 * hw(y0 + 2) * 0.98, y0 + 2 + math.cos(t1 * math.pi / 2) * H * 0.035])
            m = (p0 + p1) / 2 + [0, (y1 - y0) * 0.75]
            a.lines(clip_in(cubic(p0, lerp(p0, m, 0.6) + [0, 3], lerp(p1, m, 0.6) + [0, 3], p1), breg2, 0.3, 2), 'detail')
    else:
        # dots
        n = 7
        for k in range(n):
            t = -1 + 2 * (k + 0.5) / n
            yy = (y0 + y1) / 2
            p = (cx + t * hw(yy) * 0.92, yy + math.cos(t * math.pi / 2) * H * 0.035)
            r = (y1 - y0) * 0.26 * (0.55 + 0.45 * math.cos(t * math.pi / 2))
            a.detail(circ(p[0], p[1], r), True)
    # top cap ring
    a.detail(np.c_[cx + np.linspace(-1, 1, 40) * hw(top + H * 0.06), top + H * 0.06 + np.cos(np.linspace(-1, 1, 40) * math.pi / 2) * H * 0.02])
    # mouth skirt
    a.shape(rrect_pts(cx - hw(mouth_y - 1) - 1, mouth_y - 3, 2 * hw(mouth_y - 1) + 2, 7, 2.5))
    return env


@template('scn-hot-air-balloons')
def hot_air_balloons():
    rng = np.random.default_rng(43)
    a = Art()
    # distant small balloon, clouds, birds
    balloon(a, 336, 40, 74, 56, 2, 5)
    draw_cloud(a, [circ(282, 224, 12), circ(304, 214, 20), circ(330, 218, 16), circ(350, 226, 11)])
    balloon(a, 104, 112, 150, 118, 1, 6)
    draw_cloud(a, [circ(36, 334, 14), circ(62, 322, 22), circ(92, 326, 18), circ(116, 336, 12)])
    balloon(a, 238, 26, 206, 168, 0, 7)
    draw_cloud(a, [circ(196, 368, 13), circ(222, 354, 23), circ(256, 358, 20), circ(286, 368, 12)])
    for (x, y, s_) in [(40, 66, 0.9), (64, 52, 0.7), (370, 290, 0.9), (150, 60, 0.7)]:
        a.line(gull(x, y, s_))
    a.fit((10, 10, 390, 390), 1.1)
    return finish(a, meta('scn-hot-air-balloons', 'Hot-air balloons', 'stilllife', 'intermediate',
                          ['whimsical', 'birthday', 'baby', 'balloon', 'travel', 'adventure', 'clouds', 'card']))


# helpers:scn-rose-window-arch
def rose_head(a, x, y, r, rot=0.0, rng=None):
    """Stylised open rose: scalloped outer petals, cupped inner petals and a spiral heart."""
    R_ = lambda P: tf(P, x, y, rot=rot)
    outer = []
    for i in range(5):
        th = math.radians(72 * i - 90)
        outer.append(circ(r * 0.5 * math.cos(th), r * 0.5 * math.sin(th) + r * 0.04, r * 0.52))
    union_shape(a, [R_(p) for p in outer])
    # petal separations (short curved strokes from the scallop dips inward)
    for i in range(5):
        th = math.radians(72 * i - 90 + 36)
        p0 = np.array([r * 0.92 * math.cos(th), r * 0.92 * math.sin(th) + r * 0.04])
        p1 = np.array([r * 0.62 * math.cos(th + 0.25), r * 0.62 * math.sin(th + 0.25)])
        a.detail(R_(cubic(p0, lerp(p0, p1, 0.4) + [0, 0], lerp(p0, p1, 0.8), p1, 10)))
    # cupped middle petals
    cup = np.vstack([arc(0, r * 0.05, r * 0.6, r * 0.5, 160, 380)])
    a.line(R_(arc(0, r * 0.02, r * 0.58, r * 0.52, 200, 340)))
    a.line(R_(arc(0, -r * 0.02, r * 0.62, r * 0.5, 15, 165)))
    a.line(R_(arc(r * 0.05, -r * 0.05, r * 0.38, r * 0.34, 120, 300)))
    a.line(R_(arc(-r * 0.05, 0, r * 0.4, r * 0.34, 300, 470)))
    a.line(R_(spiral_pts(0, 0, r * 0.26, r * 0.06, -60, 400)))


def rose_leaf(base, deg, length, w, rng):
    """Serrated rose leaflet."""
    t = math.radians(deg)
    u = np.array([math.cos(t), math.sin(t)])
    n_ = np.array([-u[1], u[0]])
    b = np.asarray(base, float)
    pts_r, pts_l = [], []
    N = 9
    for k in range(N + 1):
        s = k / N
        wv = w * math.sin(math.pi * s) ** 0.75 * (1.0 - 0.25 * s)
        jag = (0.1 * w) if (0 < k < N) else 0
        pts_r.append(b + u * length * s + n_ * (wv + (jag if k % 2 else 0)))
        pts_l.append(b + u * length * s - n_ * (wv + (jag if k % 2 else 0)))
    R_ = catmull(pts_r)
    L_ = catmull(pts_l)
    outline = np.vstack([R_, L_[::-1][1:-1]])
    vein = A([b + u * 2, b + u * length * 0.85])
    veins = []
    for s in (0.3, 0.5, 0.7):
        p = b + u * length * s
        for sg in (1, -1):
            veins.append(A([p, p + u * length * 0.14 + n_ * sg * w * 0.6]))
    return outline, [vein]


def leaf_cluster(a, base, deg, rng, size=1.0):
    """Three-leaflet rose leaf on a short stalk."""
    b = np.asarray(base, float)
    t = math.radians(deg)
    u = np.array([math.cos(t), math.sin(t)])
    tip = b + u * 16 * size
    a.line([b, tip])
    for d, L, w_ in ((0, 24, 9), (-55, 18, 7), (55, 18, 7)):
        o, vs = rose_leaf(tip if d == 0 else b + u * 9 * size, deg + d, L * size, w_ * size, rng)
        a.shape(o)
        for v in vs:
            a.detail(v)


@template('scn-rose-window-arch')
def rose_window_arch():
    rng = np.random.default_rng(53)
    a = Art()
    cx = 200
    x0, x1 = 118, 282
    spring = 176
    sill = 330
    r = (x1 - x0) / 2
    # stones around the window (light detail)
    for (sx, sy, w, h) in [(40, 60, 46, 22), (30, 86, 34, 22), (66, 86, 30, 22), (40, 230, 44, 22), (54, 256, 30, 20),
                          (318, 70, 44, 22), (336, 96, 40, 22), (330, 250, 46, 22), (316, 276, 34, 20), (350, 276, 30, 20),
                          (34, 150, 36, 20), (350, 160, 34, 22)]:
        a.detail(rrect_pts(sx, sy, w, h, 4), True)
    # architrave with voussoirs and keystone
    R_out = r + 22
    outer = np.vstack([A([(x0 - 22, sill)]), A([(x0 - 22, spring)]), arc(cx, spring, R_out, R_out, 180, 360)[1:-1],
                       A([(x1 + 22, spring), (x1 + 22, sill)])])
    a.shape(outer)
    a.line(np.vstack([A([(x0, sill), (x0, spring)]), arc(cx, spring, r, r, 180, 360)[1:-1], A([(x1, spring), (x1, sill)])]))
    nv = 13
    for i in range(1, nv):
        th = math.radians(180 + 180 * i / nv)
        if i == nv // 2 or i == nv // 2 + 1:
            continue
        a.line([(cx + r * math.cos(th), spring + r * math.sin(th)), (cx + R_out * math.cos(th), spring + R_out * math.sin(th))])
    kw = 15
    key = A([(cx - kw * 0.75, spring - r + 1), (cx - kw, spring - R_out - 8), (cx + kw, spring - R_out - 8), (cx + kw * 0.75, spring - r + 1)])
    a.shape(key)
    a.detail(rect(cx - 6, spring - R_out - 2, 12, 14), True)
    # jamb blocks
    for y in np.arange(spring + 26, sill, 30):
        a.line([(x0 - 22, y), (x0, y)])
        a.line([(x1, y), (x1 + 22, y)])
    # sash: inner frame, mullion, transom, panes, fanlight
    fr = 8
    inner = np.vstack([A([(x0 + fr, sill - 2), (x0 + fr, spring)]), arc(cx, spring, r - fr, r - fr, 180, 360)[1:-1],
                       A([(x1 - fr, spring), (x1 - fr, sill - 2)])])
    a.line(inner, closed=True)
    a.line([(x0 + fr, spring), (x1 - fr, spring)])
    a.line([(x0 + fr, spring + 6), (x1 - fr, spring + 6)])
    a.line([(cx - 3, spring + 6), (cx - 3, sill - 2)])
    a.line([(cx + 3, spring + 6), (cx + 3, sill - 2)])
    for y in (spring + 56, spring + 106):
        a.detail([(x0 + fr, y), (cx - 3, y)])
        a.detail([(cx + 3, y), (x1 - fr, y)])
    for x in ((x0 + fr + cx - 3) / 2, (cx + 3 + x1 - fr) / 2):
        a.detail([(x, spring + 6), (x, sill - 2)])
    # fanlight sunburst
    a.line(arc(cx, spring, 22, 22, 180, 360))
    for i in range(1, 8):
        th = math.radians(180 + 180 * i / 8)
        a.detail([(cx + 22 * math.cos(th), spring + 22 * math.sin(th)), (cx + (r - fr) * math.cos(th), spring + (r - fr) * math.sin(th))])
    # glass reflections
    for (px, py) in [(x0 + 22, spring + 30), (cx + 16, spring + 80)]:
        a.detail([(px, py + 14), (px + 14, py)])
        a.detail([(px + 4, py + 18), (px + 18, py + 4)])
    # sill and corbels
    a.shape(rrect_pts(x0 - 34, sill, (x1 - x0) + 68, 14, 3))
    a.line([(x0 - 34, sill + 6), (x1 + 34, sill + 6)])
    for x in (x0 - 4, x1 + 4):
        a.shape(np.vstack([A([(x - 12, sill + 14), (x + 12, sill + 14)]), cubic((x + 12, sill + 14), (x + 12, sill + 30), (x + 2, sill + 30), (x, sill + 40)),
                           cubic((x, sill + 40), (x - 2, sill + 30), (x - 12, sill + 30), (x - 12, sill + 14))[1:]]))
    # climbing rose: main cane up the left jamb, over the arch and down the right side
    cane = catmull([(30, 400), (60, 360), (88, 300), (86, 230), (96, 160), (130, 96), (190, 66), (250, 74), (300, 108),
                    (322, 160), (318, 220)])
    a.erase(Region([np.vstack([offset_open(cane, 3), offset_open(cane, -3)[::-1]])]), 0.5)
    a.line(cane)
    a.line(catmull([(64, 352), (40, 330), (30, 300)]))
    a.line(catmull([(300, 108), (330, 96), (360, 104)]))
    # leaves along the cane
    for t, side in [(0.06, 1), (0.13, -1), (0.2, 1), (0.3, -1), (0.37, 1), (0.47, -1), (0.55, 1), (0.63, -1), (0.72, 1),
                    (0.8, -1), (0.9, 1), (0.97, -1)]:
        p, tg = along(cane, t)
        deg = math.degrees(math.atan2(tg[1], tg[0])) + side * 55
        leaf_cluster(a, p, deg, rng, 1.2)
    # roses and buds
    for t, rr, rot in [(0.24, 26, -10), (0.42, 22, 20), (0.6, 28, 0), (0.76, 20, -25), (0.92, 24, 15)]:
        p, tg = along(cane, t)
        rose_head(a, p[0], p[1], rr, rot)
    for (bx, by, rot) in [(32, 298, -20), (362, 102, 30), (150, 76, -60)]:
        bud = tf(np.vstack([cubic((0, 8), (-8, 2), (-6, -8), (0, -14)), cubic((0, -14), (6, -8), (8, 2), (0, 8))[1:]]), bx, by, rot=rot)
        a.shape(bud)
        a.detail(tf(cubic((0, 6), (-3, 0), (-2, -6), (0, -11)), bx, by, rot=rot))
    a.fit((10, 10, 390, 390), 1.1)
    return finish(a, meta('scn-rose-window-arch', 'Arched window with climbing roses', 'places', 'intermediate',
                          ['vintage', 'botanical', 'roses', 'window', 'cottagecore', 'architecture', 'romantic', 'love']),
                  max_detail=180)


# helpers:scn-cottage-garden
def lattice(a, poly, spacing=8.0):
    reg = Region([A(poly)])
    for ang_ in (55, -55):
        for seg in hatch(reg, ang_, spacing, margin=1.2, minlen=2):
            a.detail(seg)


def hollyhock(a, x, base, h, rng, lean=0.0):
    stem = catmull([(x, base), (x + lean * 0.5, base - h * 0.5), (x + lean, base - h)])
    a.line(sub(stem, 0, 0.9))
    # flowers from the bottom (big) to the top (buds)
    n = 6
    for k in range(n):
        t = 0.3 + 0.68 * k / (n - 1)
        p, _ = along(stem, t)
        r = 11 * (1 - 0.55 * k / (n - 1))
        side = -1 if k % 2 else 1
        c = p + [side * r * 0.45, 0]
        if k < n - 2:
            union_shape(a, [circ(c[0] + r * 0.55 * math.cos(math.radians(72 * j)), c[1] + r * 0.55 * math.sin(math.radians(72 * j)), r * 0.55)
                            for j in range(5)])
            a.detail(circ(c[0], c[1], r * 0.25), True)
        else:
            a.shape(ell(c[0], c[1], r * 0.45, r * 0.6))
    for k in range(3):
        t = 0.1 + 0.12 * k
        p, tg = along(stem, t)
        side = 1 if k % 2 == 0 else -1
        lf = petal_pts(p, -90 + side * 60, 20, 8)
        a.shape(lf)


@template('scn-cottage-garden')
def cottage_garden():
    rng = np.random.default_rng(61)
    a = Art()
    ground = 328
    # smoke and chimney (behind roof)
    for (x, y, r) in [(316, 56, 6), (326, 40, 8), (342, 24, 10)]:
        a.shape(circ(x, y, r))
    ch = rect(298, 70, 28, 80)
    a.shape(ch)
    a.shape(rect(294, 64, 36, 9))
    bricks(a, Region([rect(299, 74, 26, 70)]), rng, 4, bw=9, bh=6)
    # house walls
    body = rect(70, 206, 260, ground - 206)
    a.shape(body)
    # timber beams hint
    a.line([(70, 226), (330, 226)])
    # roof
    roof = A([(48, 214), (112, 104), (288, 104), (352, 214)])
    a.shape(roof)
    a.line([(112, 104), (288, 104)])
    shingles(a, roof, 10, 15, 2.0)
    a.shape(rrect_pts(108, 98, 184, 9, 4))
    # dormers
    for dx in (148, 252):
        dw = A([(dx - 24, 196), (dx - 24, 154), (dx + 24, 154), (dx + 24, 196)])
        a.shape(dw)
        a.shape(A([(dx - 32, 158), (dx, 126), (dx + 32, 158)]))
        a.shape(rect(dx - 13, 162, 26, 28))
        a.detail([(dx, 162), (dx, 190)])
        a.detail([(dx - 13, 176), (dx + 13, 176)])
    # eave fascia
    a.shape(rrect_pts(44, 210, 312, 9, 3))
    # windows with leaded lattice and window boxes
    for wx in (90, 252):
        w = rect(wx, 238, 58, 50)
        a.shape(rect(wx - 5, 233, 68, 60))
        a.shape(w)
        a.line([(wx + 29, 238), (wx + 29, 288)])
        lattice(a, rect(wx, 238, 29, 50), 9)
        lattice(a, rect(wx + 29, 238, 29, 50), 9)
        a.shape(rect(wx - 8, 292, 74, 14))
        for k in range(5):
            x = wx - 2 + k * 15
            union_shape(a, [circ(x + 5 * math.cos(math.radians(72 * j)), 290 + 5 * math.sin(math.radians(72 * j)), 4.6) for j in range(5)])
            a.detail(circ(x, 290, 1.8), True)
    # door with porch hood
    door = arched(182, ground, 36, 62)
    a.shape(door)
    a.detail([(200, 268), (200, ground)])
    a.shape(circ(208, 298, 2.5))
    a.detail(arc(200, 284, 8, 8, 180, 360))
    hood = A([(172, 262), (200, 240), (228, 262)])
    a.shape(np.vstack([hood, A([(222, 262), (200, 248), (178, 262)])]))
    a.shape(A([(172, 262), (200, 240), (228, 262), (222, 264), (200, 247), (178, 264)]))
    # garden path
    a.line(catmull([(186, ground), (176, 360), (150, 400)]))
    a.line(catmull([(214, ground), (230, 360), (262, 400)]))
    for (x, y, rx, ry) in [(200, 346, 12, 5), (196, 366, 16, 6), (204, 388, 20, 7)]:
        a.detail(ell(x, y, rx, ry), True)
    a.line([(4, ground), (182, ground)])
    a.line([(218, ground), (396, ground)])
    # hollyhocks behind the fence
    for (x, h, lean) in [(30, 150, 4), (54, 120, -3), (350, 140, -4), (372, 112, 3)]:
        hollyhock(a, x, ground + 20, h, rng, lean)
    # picket fence
    def picket(x):
        return A([(x - 5, 378), (x - 5, 338), (x, 330), (x + 5, 338), (x + 5, 378)])
    for y in (346, 366):
        for (xa, xb) in ((4, 168), (232, 396)):
            a.shape(rect(xa, y - 3.5, xb - xa, 7))
    for x in list(np.arange(14, 168, 21)) + list(np.arange(240, 396, 21)):
        a.shape(picket(x))
    a.fit((10, 10, 390, 390), 1.1)
    return finish(a, meta('scn-cottage-garden', 'Cosy cottage with garden', 'places', 'intermediate',
                          ['cottagecore', 'vintage', 'cottage', 'house', 'home', 'garden', 'flowers', 'card']),
                  max_detail=180)


# helpers:scn-townhouses
def sash_window(a, x, y, w, h, arched_top=False, panes=(2, 3), shutters=False, box=False):
    if arched_top:
        outer = arched(x - 3, y + h + 3, w + 6, h + 6)
        inner = arched(x, y + h, w, h)
    else:
        outer = rect(x - 3, y - 3, w + 6, h + 6)
        inner = rect(x, y, w, h)
    a.shape(outer)
    a.line(inner, closed=True)
    reg = Region([inner])
    nx, ny = panes
    for i in range(1, nx):
        a.lines(clip_in(A([(x + w * i / nx, y - 20), (x + w * i / nx, y + h)]), reg, 0.5, 2), 'detail')
    for j in range(1, ny):
        a.lines(clip_in(A([(x, y + h * j / ny), (x + w, y + h * j / ny)]), reg, 0.5, 2), 'detail')
    a.shape(rect(x - 6, y + h + 3, w + 12, 5))
    if shutters:
        for sx in (x - 3 - w * 0.45, x + w + 3):
            sh = rect(sx, y - 3, w * 0.45, h + 6)
            a.shape(sh)
            for k in range(1, int((h + 6) / 5)):
                a.detail([(sx + 2, y - 3 + k * 5), (sx + w * 0.45 - 2, y - 3 + k * 5)])
    if box:
        a.shape(rect(x - 4, y + h + 8, w + 8, 9))
        for k in range(4):
            cx_ = x + (k + 0.5) * w / 4
            union_shape(a, [circ(cx_ + 3.2 * math.cos(math.radians(72 * j)), y + h + 6 + 3.2 * math.sin(math.radians(72 * j)), 3) for j in range(5)])


def shopfront(a, x0, x1, top, base, kind, rng):
    w = x1 - x0
    # fascia sign
    a.shape(rect(x0 + 4, top, w - 8, 16))
    a.detail(rect(x0 + 9, top + 4, w - 18, 8), True)
    # awning
    aw_top = top + 20
    aw_bot = aw_top + 24
    aw = A([(x0 + 4, aw_top), (x1 - 4, aw_top), (x1 + 2, aw_bot), (x0 - 2, aw_bot)])
    # scalloped valance
    n = 6
    sc = [(x1 + 2, aw_bot)]
    for k in range(n):
        xa = x1 + 2 - (w + 4) * k / n
        xb = x1 + 2 - (w + 4) * (k + 1) / n
        sc += list(arc((xa + xb) / 2, aw_bot, (xa - xb) / 2, 6, 0, 180)[1:])
    awp = np.vstack([A([(x0 + 4, aw_top), (x1 - 4, aw_top)]), A(sc)])
    a.shape(awp)
    a.line([(x0 - 2, aw_bot), (x1 + 2, aw_bot)])
    if kind % 2 == 0:
        for k in range(1, n):
            xt = x0 + 4 + (w - 8) * k / n
            xb = x0 - 2 + (w + 4) * k / n
            a.detail([(xt, aw_top), (xb, aw_bot)])
    # shop window and door
    sy = aw_bot + 10
    door_w = 22
    if kind in (0, 2):
        dx = x1 - 10 - door_w
        win = (x0 + 8, dx - 8)
    else:
        dx = x0 + 10
        win = (dx + door_w + 8, x1 - 8)
    d = rect(dx, sy, door_w, base - sy)
    a.shape(d)
    a.line(rect(dx + 4, sy + 4, door_w - 8, (base - sy) * 0.5), closed=True)
    a.shape(circ(dx + door_w - 5, sy + (base - sy) * 0.65, 1.8))
    ww = rect(win[0], sy, win[1] - win[0], base - sy - 12)
    a.shape(ww)
    a.shape(rect(win[0] - 2, base - 12, win[1] - win[0] + 4, 12))
    for k in range(1, 3):
        xm = win[0] + (win[1] - win[0]) * k / 3
        a.detail([(xm, sy), (xm, base - 12)])
    a.detail([(win[0], sy + 12), (win[1], sy + 12)])
    # display inside the window
    wy = base - 12
    if kind == 0:
        for k, h in enumerate((16, 24, 18)):
            cxk = win[0] + (win[1] - win[0]) * (k + 0.5) / 3
            a.detail(rrect_pts(cxk - 6, wy - h, 12, h, 3), True)
    elif kind == 1:
        for k in range(3):
            cxk = win[0] + (win[1] - win[0]) * (k + 0.5) / 3
            a.detail(ell(cxk, wy - 9, 9, 6), True)
            a.detail(arc(cxk, wy - 9, 5, 3, 200, 340))
    elif kind == 2:
        for k in range(4):
            cxk = win[0] + (win[1] - win[0]) * (k + 0.5) / 4
            a.detail(rect(cxk - 4, wy - 22 + (k % 2) * 4, 8, 22 - (k % 2) * 4), True)
    else:
        for k in range(3):
            cxk = win[0] + (win[1] - win[0]) * (k + 0.5) / 3
            a.detail(A([(cxk - 7, wy), (cxk - 5, wy - 10), (cxk + 5, wy - 10), (cxk + 7, wy)]), True)
            a.detail(circ(cxk, wy - 16, 6), True)


@template('scn-townhouses')
def townhouses():
    rng = np.random.default_rng(71)
    a = Art()
    street = 372
    houses = [(14, 108, 128, 'stepped'), (108, 206, 150, 'bell'), (206, 296, 118, 'pointed'), (296, 386, 128, 'cornice')]
    for idx, (x0, x1, top, kind) in enumerate(houses):
        w = x1 - x0
        cx = (x0 + x1) / 2
        if kind == 'stepped':
            pts = [(x0, street), (x0, top)]
            steps = 4
            peak = top - 84
            for k in range(steps):
                y_ = top - (k + 1) * (top - peak) / (steps + 0.4)
                x_ = x0 + (k + 0.6) * (w / 2) / (steps + 0.6)
                pts += [(x_, pts[-1][1]), (x_, y_)]
            pts += [(cx - 8, pts[-1][1]), (cx - 8, peak), (cx + 8, peak)]
            right = [(2 * cx - px, py) for px, py in pts[::-1]]
            outline = A(pts + right[2:-1] + [(x1, top), (x1, street)])
            outline = A(pts + [(cx + 8, peak)] + [(2 * cx - px, py) for px, py in pts[::-1]][3:])
            a.shape(outline)
            a.shape(circ(cx, top - 40, 10))
            a.detail(circ(cx, top - 40, 6.5), True)
            for k in range(4):
                th = math.radians(45 * k)
                a.detail([(cx - 6.5 * math.cos(th), top - 40 - 6.5 * math.sin(th)), (cx + 6.5 * math.cos(th), top - 40 + 6.5 * math.sin(th))])
        elif kind == 'bell':
            peak = top - 72
            left = catmull([(x0, top), (x0 + 6, top - 10), (x0 + 22, top - 18), (x0 + 26, top - 40), (cx - 14, peak + 8)])
            right = mirror(left, cx)[::-1]
            arch_ = arc(cx, peak + 8, 14, 14, 180, 360)
            outline = np.vstack([A([(x0, street)]), left, arch_[1:-1], right, A([(x1, street)])])
            a.shape(outline)
            a.shape(ell(cx, top - 26, 9, 12))
            a.detail(ell(cx, top - 26, 5, 8), True)
            a.line([(cx, peak - 6), (cx, peak - 18)])
            a.shape(circ(cx, peak - 20, 3))
        elif kind == 'pointed':
            peak = top - 80
            outline = A([(x0, street), (x0, top), (cx, peak), (x1, top), (x1, street)])
            a.shape(outline)
            a.line(A([(x0 + 10, top), (cx, peak + 12), (x1 - 10, top)]))
            a.line([(x0 + 10, top), (x1 - 10, top)])
            a.shape(arched(cx - 9, top - 8, 18, 30))
            a.detail([(cx, top - 38), (cx, top - 8)])
            a.line([(cx, peak), (cx, peak - 12)])
            a.shape(star5(cx, peak - 18, 6, 2.6))
            # timber framing on the upper floors
            hf = []
            for fi in range(2):
                fy = top + 14 + fi * 58
                ww = (w - 34) / 2
                for k in range(2):
                    hf.append(rect(x0 + 11 + k * (ww + 12) - 8, fy - 7, ww + 16, 64))
            treg = Region([rect(x0 + 2, top + 2, w - 4, 242 - top)], holes=hf)
            for y in (top + 4, top + 66, top + 124):
                a.lines(clip_in(A([(x0, y), (x1, y)]), Region([rect(x0, top, w, 246 - top)]), 1, 3))
            for (pa, pb) in [((x0 + 2, top + 6), (x0 + 10, top + 62)), ((x1 - 2, top + 6), (x1 - 10, top + 62)),
                             ((cx - 4, top + 6), (cx + 4, top + 62)), ((cx + 4, top + 68), (cx - 4, top + 120))]:
                a.lines(clip_in(A([pa, pb]), treg, 1, 3), 'detail')
        else:
            outline = A([(x0, street), (x0, top), (x1, top), (x1, street)])
            a.shape(outline)
            a.shape(rect(x0 - 4, top - 12, w + 8, 12))
            for x in np.arange(x0 + 2, x1 - 2, 7):
                a.detail(rect(x, top, 4, 4), True)
            # balustrade
            a.shape(rect(x0, top - 34, w, 5))
            for x in np.arange(x0 + 14, x1 - 8, 11):
                a.shape(rrect_pts(x - 2.5, top - 29, 5, 17, 2.5))
            for x in (x0, x1 - 6):
                a.shape(rect(x, top - 34, 6, 22))
        # string course between shop and upper floors
        a.line([(x0, 246), (x1, 246)])
        a.line([(x0, 250), (x1, 250)])
        # upper floor windows
        floors = []
        y = top + 14
        while y + 46 < 244:
            floors.append(y)
            y += 54
        for fi, fy in enumerate(floors):
            ww = (w - 34) / 2
            for k in range(2):
                wx = x0 + 11 + k * (ww + 12)
                sash_window(a, wx, fy, ww, 38, arched_top=(kind == 'bell' or (kind == 'stepped' and fi == 0)),
                            panes=(2, 3), shutters=False, box=(kind == 'cornice' and fi == 0))
        if kind == 'stepped':
            reg = None
            holes = []
            for fi, fy in enumerate(floors):
                ww = (w - 34) / 2
                for k in range(2):
                    wx = x0 + 11 + k * (ww + 12)
                    holes.append(rect(wx - 8, fy - 6, ww + 16, 60))
            breg = Region([rect(x0 + 2, top + 2, w - 4, 244 - top)], holes=holes)
            bricks(a, breg, rng, 7, bw=10, bh=6)
        shopfront(a, x0, x1, 256, street, idx, rng)
    # pavement and street lamp
    a.line([(4, street), (396, street)])
    a.line([(4, street + 12), (396, street + 12)])
    for x in np.arange(30, 396, 46):
        a.detail([(x, street), (x - 4, street + 12)])
    # hanging bracket signs
    for (bx, by, d) in ((206, 214, -1),):
        a.line([(bx, by), (bx + d * 30, by)])
        a.line(catmull([(bx, by + 10), (bx + d * 10, by + 6), (bx + d * 18, by)]))
        a.detail(spiral_pts(bx + d * 8, by + 4, 4, 1, 0, 300))
        sx = bx + d * 24
        a.line([(sx, by), (sx, by + 6)])
        a.shape(circ(sx, by + 15, 9))
        a.detail(circ(sx, by + 15, 5.5), True)
    a.fit((8, 8, 392, 392), 1.1)
    return finish(a, meta('scn-townhouses', 'European townhouse row', 'places', 'advanced',
                          ['vintage', 'architecture', 'street', 'shops', 'city', 'travel', 'houses', 'realistic']),
                  err=0.45, max_detail=175)


@template('scn-eye-study')
def eye_study():
    rng = np.random.default_rng(83)
    a = Art()
    inner = np.array([104.0, 222.0])
    outer = np.array([306.0, 206.0])
    upper = cubic(inner, (136, 168), (236, 134), outer, 300)
    lower = cubic(outer, (262, 248), (160, 262), inner, 300)
    opening = np.vstack([upper, lower[1:-1]])
    open_reg = Region([opening])
    # iris and pupil
    ic = np.array([204.0, 204.0])
    IR = 56
    PR = 21
    hl = np.array([186.0, 188.0])
    HR = 9
    iris_art = Art()
    iris_art.line(circ(ic[0], ic[1], IR), closed=True)
    iris_art.detail(circ(ic[0], ic[1], IR - 5), closed=True)
    # collarette: wavy ring
    th = np.linspace(0, 2 * math.pi, 400)
    rr = 33 + 2.2 * np.sin(th * 14) + 1.2 * np.sin(th * 5 + 1)
    iris_art.detail(np.c_[ic[0] + rr * np.cos(th), ic[1] + rr * np.sin(th)], closed=True)
    hole = Region([circ(hl[0], hl[1], HR + 3), circ(ic[0], ic[1], PR + 2)])
    n = 108
    for i in range(n):
        t = 2 * math.pi * i / n + rng.uniform(-0.01, 0.01)
        r0 = PR + 5 + rng.uniform(0, 4)
        r1 = (IR - 7) * rng.uniform(0.62, 1.0) if i % 3 else IR - 7
        wob = rng.uniform(-0.05, 0.05)
        pts = np.array([[ic[0] + r * math.cos(t + wob * (r - r0) / 30), ic[1] + r * math.sin(t + wob * (r - r0) / 30)]
                        for r in np.linspace(r0, r1, 12)])
        for seg in clip_out(pts, hole, 0.5, 2):
            iris_art.detail(seg)
    # crypts: a few small loops in the iris
    for k in range(9):
        t = 2 * math.pi * k / 9 + 0.3
        c = ic + 42 * np.array([math.cos(t), math.sin(t)])
        P = tf(ell(0, 0, 5, 2.2), c[0], c[1], rot=math.degrees(t))
        if not hole.inside(P).any():
            iris_art.detail(P, True)
    iris_art.shape(circ(ic[0], ic[1], PR))
    iris_art.shape(circ(hl[0], hl[1], HR))
    preg = Region([circ(ic[0], ic[1], PR)], holes=[circ(hl[0], hl[1], HR + 2.5), circ(226, 214, 5.5)])
    for ang_ in (35, -55):
        for seg in hatch(preg, ang_, 2.8, margin=1.6, minlen=1.5):
            iris_art.detail(seg)
    iris_art.shape(circ(226, 214, 3.2))
    # clip the eyeball contents to the opening
    iris_art.keep_out(Region([rect(-10, -10, 420, 420)], holes=[opening]), 0)
    a.items += iris_art.items
    # caruncle in the inner corner
    car = blob([(110, 221), (120, 214), (127, 220), (121, 226)], 0.4)
    a.erase(Region([car]))
    a.line(car, closed=True)
    # lids
    a.line(upper)
    a.line(lower)
    # lid thickness lines
    a.detail(cubic(outer + [-8, 6], (258, 254), (164, 268), inner + [14, 8]))
    # crease and socket contours
    a.line(cubic((98, 192), (132, 104), (252, 66), (330, 178)))
    a.detail(cubic((140, 280), (186, 300), (250, 292), (292, 260)))
    # upper lashes: sweep up and curl outwards, longer toward the outer corner
    ts_ = []
    for g in range(13):
        tc = 0.12 + 0.86 * g / 12
        ts_ += [tc - 0.012, tc + 0.012] if g % 2 == 0 else [tc]
    for t in ts_:
        p, tg = along(upper, t)
        nrm = np.array([tg[1], -tg[0]])
        if nrm[1] > 0:
            nrm = -nrm
        L = 30 + 30 * t ** 1.2 + rng.uniform(-3, 3)
        out = tg * (0.0 + 0.7 * t)
        q0 = p + nrm * 1.0
        q1 = q0 + (nrm * 1.0 + out * 0.0) * L * 0.45
        q2 = q0 + (nrm * 0.9 + out * 0.3) * L * 0.8
        q3 = q0 + (nrm * 0.85 + out * 1.0) * L
        a.detail(cubic(q0, q1, q2, q3, 16))
    # lower lashes: short, slightly outward
    for i in range(26):
        t = 0.06 + 0.8 * i / 25
        p, tg = along(lower, t)
        nrm = np.array([-tg[1], tg[0]])
        if nrm[1] < 0:
            nrm = -nrm
        L = 7 + 14 * (1 - t) ** 1.2 + rng.uniform(-2, 2)
        sweep = -tg * (2 + 8 * (1 - t))
        a.detail(cubic(p + nrm * 9, p + nrm * (9 + L * 0.5), p + nrm * (9 + L * 0.9) + sweep * 0.5, p + nrm * (9 + L) + sweep, 10))
    # eyebrow: rows of hair strokes following the brow's flow
    top_c = cubic((74, 124), (132, 70), (250, 46), (348, 94), 200)
    bot_c = cubic((80, 140), (140, 98), (252, 74), (344, 100), 200)
    for i in range(120):
        t = (i + rng.uniform(0, 0.8)) / 120
        p_t, tg = along(top_c, t)
        p_b, _ = along(bot_c, t)
        u = rng.uniform(0.0, 0.85)
        base = lerp(p_b, p_t, u)
        ang_ = math.atan2(tg[1], tg[0]) - (1.0 - t) ** 2 * 1.15 - 0.12 + rng.uniform(-0.08, 0.08)
        L = (14 + 6 * math.sin(math.pi * t)) * rng.uniform(0.8, 1.15)
        d = np.array([math.cos(ang_), math.sin(ang_)])
        tip = base + d * L
        hair = cubic(base, base + d * L * 0.35, tip - d * L * 0.3 - np.array([-d[1], d[0]]) * 1.2, tip, 10)
        a.detail(hair)
    a.fit((14, 30, 386, 370), 1.15)
    return finish(a, meta('scn-eye-study', 'Eye study', 'faces', 'advanced',
                          ['realistic', 'eye', 'portrait', 'anatomy', 'lashes', 'study', 'sketch']),
                  err=0.45, max_detail=170)


@template('scn-profile-portrait')
def profile_portrait():
    rng = np.random.default_rng(91)
    a = Art()
    # face profile (facing left), forehead to under the chin
    face = catmull([(172, 92), (158, 112), (150, 136), (148, 156), (150, 168), (146, 182), (138, 198), (128, 212),
                    (126, 219), (131, 224), (141, 226), (146, 231), (145, 238), (139, 245), (143, 250), (147, 253),
                    (142, 259), (145, 266), (153, 273), (150, 284), (152, 298), (162, 308), (176, 312)], step=0.4)
    jaw = catmull([(176, 312), (196, 312), (216, 302), (232, 286), (240, 268)], step=0.5)
    neck_front = catmull([(170, 312), (175, 336), (178, 356), (168, 376), (150, 398)])
    neck_back = catmull([(238, 284), (240, 318), (250, 352), (270, 380), (300, 398)])
    # nostril and lips detail
    nostril = catmull([(140, 220), (146, 222), (148, 217)])
    lip_line = catmull([(146, 252), (152, 253), (157, 251)])
    # closed eye with lashes, brow
    lid = catmull([(162, 176), (170, 181), (180, 182), (190, 178)])
    brow = catmull([(158, 158), (170, 153), (184, 152), (198, 156)])
    # hair mass: front edge (hairline down behind the jaw) and back edge (crown, back, cascade)
    front = catmull([(172, 92), (196, 104), (210, 132), (214, 166), (222, 204), (236, 238), (252, 268), (262, 300),
                     (270, 336), (282, 372), (300, 398)])
    back = catmull([(172, 92), (192, 56), (240, 40), (296, 56), (330, 98), (344, 150), (342, 206), (350, 256),
                    (366, 306), (380, 350), (392, 398)])
    def wave(P, phase=0.0, amp=11.0):
        P = resample(P, 1.0)
        L = len(P)
        t = np.linspace(0, 1, L)
        m = np.clip((t - 0.35) / 0.65, 0, 1)
        off = amp * np.sin(m * 3.2 * math.pi + phase) * m ** 0.8
        return P + np.c_[off, np.zeros(L)]
    front = wave(front)
    back = wave(back, 0.25)
    hair = np.vstack([front, back[::-1][1:-1]])
    a.line(front)
    a.line(back)
    # strands between the two edges
    nF = resample(front, 1.0)
    nB = resample(back, 1.0)
    def at(P, t):
        return along(P, t)[0]
    n_str = 19
    hair_reg = Region([hair])
    for k in range(1, n_str):
        s = k / n_str
        pts = []
        for t in np.linspace(0.05 + 0.1 * (1 - abs(2 * s - 1)), 1.0, 90):
            p = lerp(at(front, t), at(back, t), s)
            # gentle waves growing toward the ends
            w = 2.5 * math.sin(t * 7 + s * 5) * t
            pts.append(p + np.array([w, 0]))
        P = catmull(pts[::3], step=0.6)
        a.lines(clip_in(P, hair_reg, 2.0, 6), 'detail')
    # flowers tucked behind the ear area
    a.erase(Region([circ(232, 120, 20), circ(256, 96, 16), circ(214, 98, 13)]))
    blossom(a, 232, 120, 22)
    blossom(a, 258, 94, 16)
    blossom(a, 212, 96, 12)
    for (bx, by, deg) in [(246, 140, 40), (270, 112, -10), (198, 112, 160)]:
        lf = petal_pts((bx, by), deg, 26, 8)
        a.shape(lf)
        a.detail(lerp(np.array([bx, by]), lf[len(lf) // 2], np.linspace(0.1, 0.8, 6)[:, None]))
    # face lines on top
    a.erase(Region([np.vstack([face, jaw[1:], A([(240, 268), (214, 166), (210, 132), (196, 104)])])]), 0.5)
    a.line(face)
    a.line(jaw)
    a.line(neck_front)
    a.line(neck_back)
    a.detail(nostril)
    a.detail(lip_line)
    a.line(lid)
    for k in range(6):
        p, tg = along(lid, 0.15 + 0.14 * k)
        nrm = np.array([-tg[1], tg[0]])
        if nrm[1] < 0:
            nrm = -nrm
        a.detail(cubic(p, p + nrm * 4, p + nrm * 7 - tg * 2, p + nrm * 9 - tg * 4, 8))
    a.detail(brow)
    # ear lobe with a pearl earring peeking from the hair
    a.line(catmull([(226, 214), (232, 222), (230, 232), (222, 234)]))
    a.line(arc(224, 246, 6, 8, -60, 240))
    a.detail(catmull([(186, 368), (204, 374), (226, 372)]))
    a.fit((14, 10, 386, 392), 1.2)
    return finish(a, meta('scn-profile-portrait', 'Profile portrait with flowers', 'faces', 'advanced',
                          ['stylized', 'botanical', 'portrait', 'woman', 'face', 'hair', 'line-art', 'elegant']),
                  err=0.35)


@template('scn-hand-flower')
def hand_flower():
    rng = np.random.default_rng(97)
    a = Art()
    # flower: a tulip on a long stem held between thumb and index finger
    stem = catmull([(188, 400), (186, 330), (184, 240), (178, 160), (170, 110)])
    a.line(stem)
    lf = np.vstack([catmull([(185, 300), (160, 262), (142, 214), (140, 176)]), catmull([(140, 176), (166, 214), (182, 252), (185, 290)])])
    lf = np.vstack([catmull([(184, 196), (158, 182), (136, 156), (126, 120)]), catmull([(126, 120), (150, 146), (170, 166), (183, 180)])[1:]])
    a.shape(lf)
    a.detail(catmull([(182, 190), (156, 168), (136, 136)]))
    # tulip head
    cx, cy = 168, 92
    back_l = catmull([(cx - 4, cy + 22), (cx - 26, cy + 4), (cx - 30, cy - 26), (cx - 22, cy - 48)])
    outer = np.vstack([catmull([(cx, cy + 24), (cx - 26, cy + 12), (cx - 34, cy - 18), (cx - 26, cy - 50), (cx - 12, cy - 30),
                                (cx, cy - 56), (cx + 12, cy - 30), (cx + 26, cy - 50), (cx + 34, cy - 18), (cx + 26, cy + 12),
                                (cx, cy + 24)])])
    outer = np.vstack([cubic((cx, cy + 26), (cx - 30, cy + 22), (cx - 38, cy - 20), (cx - 26, cy - 52)),
                       cubic((cx - 26, cy - 52), (cx - 20, cy - 40), (cx - 14, cy - 34), (cx - 6, cy - 30))[1:],
                       cubic((cx - 6, cy - 30), (cx - 4, cy - 44), (cx - 2, cy - 54), (cx + 2, cy - 62))[1:],
                       cubic((cx + 2, cy - 62), (cx + 8, cy - 52), (cx + 10, cy - 42), (cx + 10, cy - 30))[1:],
                       cubic((cx + 10, cy - 30), (cx + 18, cy - 34), (cx + 24, cy - 42), (cx + 30, cy - 52))[1:],
                       cubic((cx + 30, cy - 52), (cx + 40, cy - 20), (cx + 30, cy + 22), (cx, cy + 26))[1:]])
    a.shape(outer)
    a.detail(cubic((cx - 6, cy - 30), (cx - 14, cy - 10), (cx - 12, cy + 10), (cx - 2, cy + 24)))
    a.detail(cubic((cx + 10, cy - 30), (cx + 16, cy - 10), (cx + 14, cy + 10), (cx + 4, cy + 24)))
    # the hand: a loose fist around the stem, seen from the thumb side, wrist going down-right
    # back of the hand and wrist (drawn first; fingers overlap it)
    palm = np.vstack([catmull([(252, 224), (276, 226), (290, 256), (286, 300), (276, 340), (272, 400)]),
                      A([(232, 400)]), catmull([(232, 400), (234, 372), (240, 351)])[1:]])
    a.shape(np.vstack([palm, A([(240, 230)])]))
    fingers = [
        # pinky, ring, middle, index (bottom to top); each: top edge, tip, bottom edge
        [(250, 326), (214, 322), (192, 328), (186, 338), (194, 348), (222, 350), (240, 351)],
        [(250, 296), (206, 292), (180, 298), (174, 310), (182, 322), (220, 324), (250, 328)],
        [(250, 262), (200, 256), (172, 262), (164, 276), (172, 290), (218, 294), (250, 298)],
        [(254, 226), (222, 216), (188, 216), (166, 226), (158, 242), (166, 256), (210, 258), (250, 264)],
    ]
    for pts in fingers:
        P = catmull(pts)
        closed = np.vstack([P, A([(262, pts[-1][1] - 4), (262, pts[0][1] + 2)])])
        a.erase(Region([closed]), 0.6)
        a.line(P)
    # thumb resting over the index finger, tip against the stem
    thumb = np.vstack([catmull([(282, 236), (262, 208), (232, 194), (204, 192), (184, 198)]),
                       cubic((184, 198), (174, 202), (176, 214), (186, 214))[1:],
                       catmull([(186, 214), (212, 216), (240, 222), (262, 238)])[1:]])
    a.erase(Region([thumb]), 0.6)
    a.line(thumb)
    # lace cuff at the wrist
    cuff_top = 360
    xs_l, xs_r = 224, 296
    cuff = np.vstack([A([(xs_l - 6, 404), (xs_l - 2, cuff_top + 6)]), A([(xs_r + 2, cuff_top - 2)]), A([(xs_r + 8, 404)])])
    sc = []
    n = 5
    for k in range(n):
        x0_ = xs_l - 2 + (xs_r - xs_l + 4) * k / n
        x1_ = xs_l - 2 + (xs_r - xs_l + 4) * (k + 1) / n
        y0_ = cuff_top + 6 - 8 * k / n
        y1_ = cuff_top + 6 - 8 * (k + 1) / n
        sc.append(cubic((x0_, y0_), (x0_ - 1, y0_ - 13), (x1_ + 1, y1_ - 13), (x1_, y1_)))
    lace = np.vstack(sc)
    body = np.vstack([A([(xs_l - 6, 404)]), lace, A([(xs_r + 8, 404)])])
    a.erase(Region([body]), 0.6)
    a.line(np.vstack([A([(xs_l - 6, 404)]), lace, A([(xs_r + 8, 404)])]))
    a.line(catmull([(xs_l - 4, cuff_top + 20), (258, cuff_top + 15), (xs_r + 5, cuff_top + 8)]))
    for k in range(n):
        x_ = xs_l + 2 + (xs_r - xs_l - 4) * (k + 0.5) / n
        y_ = cuff_top + 4 - 8 * (k + 0.5) / n
        a.detail(circ(x_, y_ - 1, 2.6), True)
    for x_ in (240, 260, 280):
        a.detail(catmull([(x_, cuff_top + 26), (x_ + 2, 388), (x_ + 3, 402)]))
    # nail, creases, knuckles
    a.detail(catmull([(190, 200), (184, 204), (186, 211)]))
    a.detail(catmull([(222, 204), (226, 214)]))
    for (x, y0, y1) in [(206, 262, 270), (210, 298, 306), (214, 330, 338)]:
        a.detail(catmull([(x, y0), (x + 2, y1)]))
    a.detail(catmull([(268, 268), (272, 300), (266, 330)]))
    # a few leaves of light around the bloom
    for (x, y, r) in [(222, 52, 7), (110, 76, 6), (232, 128, 5)]:
        a.shape(sparkle(x, y, r))
    a.fit((20, 14, 380, 392), 1.4)
    return finish(a, meta('scn-hand-flower', 'Hand holding a tulip', 'faces', 'intermediate',
                          ['stylized', 'botanical', 'hand', 'flower', 'tulip', 'line-art', 'love', 'thanks']), err=0.35)


# ==== END OF TEMPLATES ====

# ------------------------------------------------------------------------------------------------
# output
# ------------------------------------------------------------------------------------------------

KEYS = ['id', 'name', 'category', 'level', 'tags']


def build(only=None):
    out = []
    for tid, fn in TEMPLATES:
        if only and tid not in only:
            continue
        t = fn()
        assert t['id'] == tid
        t['viewBox'] = '0 0 400 400'
        out.append(t)
    return out


def _lit(v):
    return json.dumps(v, ensure_ascii=False).replace('"', "'")


def write_ts(ts):
    lines = [
        '// Template art: scenes (buildings, landscapes, fantasy & gothic, still life, faces & figures).',
        '// generated by scripts/templategen/scenes.py — edit the generator, then run it and',
        '// `node scripts/export-templates.ts`. Original line art authored in this repo (docs/TEMPLATES.md).',
        "import type { Template } from '../templates.ts';",
        '',
        'export const scenes: Template[] = [',
    ]
    for t in ts:
        lines.append('  {')
        for k in KEYS + ['viewBox']:
            lines.append(f'    {k}: {_lit(t[k])},')
        for k in ('strokeWidth', 'detailWidth'):
            if k in t:
                lines.append(f'    {k}: {t[k]},')
        for k in ('paths', 'detail'):
            if k in t:
                lines.append(f'    {k}: [')
                for d in t[k]:
                    lines.append(f"      '{d}',")
                lines.append('    ],')
        lines.append('  },')
    lines.append('];')
    lines.append('')
    OUT.write_text('\n'.join(lines))


def svg_of(t):
    sw = t.get('strokeWidth', 4)
    dw = t.get('detailWidth', 2)
    s = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
         f'<g fill="none" stroke="#22201C" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">']
    s += [f'<path d="{d}"/>' for d in t['paths']]
    s.append('</g>')
    if t.get('detail'):
        s.append(f'<g fill="none" stroke="#22201C" stroke-width="{dw}" stroke-linecap="round" '
                 'stroke-linejoin="round">')
        s += [f'<path d="{d}"/>' for d in t['detail']]
        s.append('</g>')
    s.append('</svg>')
    return '\n'.join(s)


def preview(ts, outdir):
    from playwright.sync_api import sync_playwright
    out = pathlib.Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={'width': 800, 'height': 800})
        for t in ts:
            svg = svg_of(t).replace('<svg ', '<svg style="width:800px;height:800px;display:block" ', 1)
            pg.set_content(f'<html><body style="margin:0;background:#fff">{svg}</body></html>')
            pg.screenshot(path=str(out / f"{t['id']}.png"))
        b.close()


def stats(t):
    n = sum(len(d) for d in t['paths'] + t.get('detail', []))
    k = len(t['paths']) + len(t.get('detail', []))
    return n, k


if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == '--preview':
        only = set(args[2:]) or None
        ts = build(only)
        for t in ts:
            n, k = stats(t)
            print(f"{t['id']:28s} {t['level']:12s} chars={n:6d} paths={k}")
        preview(ts, args[1])
    else:
        ts = build()
        for t in ts:
            n, k = stats(t)
            print(f"{t['id']:28s} {t['level']:12s} chars={n:6d} paths={k}")
            assert n <= 30000 and k <= 300, t['id']
        write_ts(ts)
        print(f'wrote {len(ts)} templates to {OUT.relative_to(ROOT)}')
