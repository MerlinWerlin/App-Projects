#!/usr/bin/env python3
"""Generator for src/core/templateArt/ornament.ts (frames, patterns, mandalas, lettering).

Run:  python3 scripts/templategen/ornament.py && node scripts/export-templates.ts
      python3 scripts/preview-templates.py /tmp/orn-prev orn-

All art here is original and procedural (symmetry, parametric curves, knot/lattice construction,
hand-placed Bezier flourishes). The generated TypeScript holds static path strings only, so the
app does no geometry work at startup.

Fonts (letter shapes only; every flourish, frame and sprig is drawn here):
  * Lora Bold Italic, (c) The Lora Project Authors - SIL Open Font License 1.1
    (/mnt/skills/examples/canvas-design/canvas-fonts/Lora-BoldItalic.ttf, licence Lora-OFL.txt beside it)
  * Young Serif, (c) Bastien Sozeau - SIL Open Font License 1.1 (YoungSerif-OFL.txt beside it)
  * Gloock, (c) The Gloock Project Authors - SIL Open Font License 1.1 (Gloock-OFL.txt beside it)
  * Poppins Bold, (c) Indian Type Foundry - SIL Open Font License 1.1
    (/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf)
  * TeX Gyre Chorus, (c) B. Jackowski and J. M. Nowacki (GUST) - GUST Font License
    (/usr/share/texmf/fonts/opentype/public/tex-gyre/texgyrechorus-mediumitalic.otf,
    licence: /usr/share/doc/fonts-texgyre/copyright)
Glyph contours are read with fontTools, converted to absolute M/L/Q/C commands and scaled to fit.
"""
from __future__ import annotations

import json
import math
import pathlib
import random
import sys

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'src' / 'core' / 'templateArt' / 'ornament.ts'
CX = CY = 200.0

# ------------------------------------------------------------------------------------------------
# Path model: a path is a list of segments in absolute coordinates.
#   ('M', p) ('L', p) ('Q', c, p) ('C', c1, c2, p) ('A', r, large, sweep, p) ('Z',)
# Arcs are circular only, so similarity transforms keep them exact.
# ------------------------------------------------------------------------------------------------


def fnum(v: float) -> str:
    r = round(v * 10) / 10
    if r == 0:
        return '0'
    if r == int(r):
        return str(int(r))
    return f'{r:.1f}'


def pstr(path) -> str:
    out = []
    for seg in path:
        k = seg[0]
        if k == 'Z':
            out.append('Z')
        elif k == 'A':
            _, r, large, sweep, p = seg
            out.append(f'A{fnum(r)} {fnum(r)} 0 {large} {sweep} {fnum(p[0])} {fnum(p[1])}')
        else:
            out.append(k + ' '.join(f'{fnum(q[0])} {fnum(q[1])}' for q in seg[1:]))
    return ''.join(out)


class Aff:
    """2D affine transform x' = a x + b y + c, y' = d x + e y + f."""

    def __init__(self, a=1.0, b=0.0, c=0.0, d=0.0, e=1.0, f=0.0):
        self.m = (a, b, c, d, e, f)

    def __call__(self, p):
        a, b, c, d, e, f = self.m
        return (a * p[0] + b * p[1] + c, d * p[0] + e * p[1] + f)

    def __mul__(self, o: 'Aff') -> 'Aff':  # self after o
        a, b, c, d, e, f = self.m
        A, B, C, D, E, F = o.m
        return Aff(a * A + b * D, a * B + b * E, a * C + b * F + c, d * A + e * D, d * B + e * E, d * C + e * F + f)

    @property
    def det(self):
        a, b, _, d, e, _ = self.m
        return a * e - b * d


def T(dx, dy):
    return Aff(1, 0, dx, 0, 1, dy)


def S(s, sy=None, cx=0.0, cy=0.0):
    sy = s if sy is None else sy
    return T(cx, cy) * Aff(s, 0, 0, 0, sy, 0) * T(-cx, -cy)


def R(deg, cx=CX, cy=CY):
    """Clockwise rotation on screen (y down) about (cx, cy)."""
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return T(cx, cy) * Aff(c, -s, 0, s, c, 0) * T(-cx, -cy)


def MX(axis=CX):
    return Aff(-1, 0, 2 * axis, 0, 1, 0)


def MY(axis=CY):
    return Aff(1, 0, 0, 0, -1, 2 * axis)


def xf(path, t: Aff):
    sc = math.sqrt(abs(t.det))
    flip = t.det < 0
    out = []
    for seg in path:
        k = seg[0]
        if k == 'Z':
            out.append(seg)
        elif k == 'A':
            _, r, large, sweep, p = seg
            out.append(('A', r * sc, large, (1 - sweep) if flip else sweep, t(p)))
        else:
            out.append((k,) + tuple(t(q) for q in seg[1:]))
    return out


def reverse(path):
    """Reverse an open path made of M/L/Q/C segments."""
    pts = []
    cur = None
    segs = []
    for seg in path:
        if seg[0] == 'M':
            cur = seg[1]
        elif seg[0] in 'LQC':
            segs.append((seg[0], cur) + seg[1:])
            cur = seg[-1]
    out = [('M', segs[-1][-1])]
    for s in reversed(segs):
        if s[0] == 'L':
            out.append(('L', s[1]))
        elif s[0] == 'Q':
            out.append(('Q', s[2], s[1]))
        else:
            out.append(('C', s[3], s[2], s[1]))
    del pts
    return out


def polar(r, deg, cx=CX, cy=CY):
    a = math.radians(deg)
    return (cx + r * math.sin(a), cy - r * math.cos(a))


def circle(c, r):
    x, y = c
    return [('M', (x - r, y)), ('A', r, 1, 0, (x + r, y)), ('A', r, 1, 0, (x - r, y)), ('Z',)]


def arc_path(c, r, a0, a1):
    """Circular arc from angle a0 to a1 (degrees, 0 = up, clockwise positive)."""
    p0 = polar(r, a0, *c)
    p1 = polar(r, a1, *c)
    large = 1 if abs(a1 - a0) > 180 else 0
    sweep = 1 if a1 > a0 else 0
    return [('M', p0), ('A', r, large, sweep, p1)]


def poly(pts, closed=False):
    p = [('M', pts[0])] + [('L', q) for q in pts[1:]]
    if closed:
        p.append(('Z',))
    return p


def line(a, b):
    return [('M', a), ('L', b)]


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def mul(a, s):
    return (a[0] * s, a[1] * s)


def norm(a):
    l = math.hypot(*a) or 1.0
    return (a[0] / l, a[1] / l)


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def smooth(pts, closed=False, k=1.0):
    """Catmull-Rom spline through points, as cubic segments."""
    n = len(pts)
    if n < 2:
        raise ValueError('smooth needs 2+ points')
    path = [('M', pts[0])]
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = pts[(i - 1) % n] if (closed or i > 0) else pts[i]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if (closed or i + 2 < n) else pts[(i + 1) % n]
        c1 = add(p1, mul(sub(p2, p0), k / 6))
        c2 = sub(p2, mul(sub(p3, p1), k / 6))
        path.append(('C', c1, c2, p2))
    if closed:
        path.append(('Z',))
    return path


def join(*paths):
    out = []
    for p in paths:
        out.extend(p)
    return out


def cubic_pt(p0, p1, p2, p3, t):
    u = 1 - t
    return (
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    )


def sample(path, step=1.0):
    """Dense polyline(s) for a path: list of point lists (one per subpath)."""
    subs = []
    cur = None
    start = None
    pts = []
    for seg in path:
        k = seg[0]
        if k == 'M':
            if len(pts) > 1:
                subs.append(pts)
            cur = start = seg[1]
            pts = [cur]
        elif k == 'L':
            n = max(1, int(dist(cur, seg[1]) / step))
            pts += [lerp(cur, seg[1], i / n) for i in range(1, n + 1)]
            cur = seg[1]
        elif k == 'Q':
            c, p = seg[1], seg[2]
            c1 = lerp(cur, c, 2 / 3)
            c2 = lerp(p, c, 2 / 3)
            n = max(2, int((dist(cur, c) + dist(c, p)) / step))
            pts += [cubic_pt(cur, c1, c2, p, i / n) for i in range(1, n + 1)]
            cur = p
        elif k == 'C':
            n = max(2, int((dist(cur, seg[1]) + dist(seg[1], seg[2]) + dist(seg[2], seg[3])) / step))
            pts += [cubic_pt(cur, seg[1], seg[2], seg[3], i / n) for i in range(1, n + 1)]
            cur = seg[3]
        elif k == 'A':
            _, r, large, sweep, p = seg
            # centre from endpoints
            mx, my = (cur[0] + p[0]) / 2, (cur[1] + p[1]) / 2
            d = dist(cur, p)
            if d < 1e-9:
                continue
            h = math.sqrt(max(0.0, r * r - (d / 2) ** 2))
            nx, ny = -(p[1] - cur[1]) / d, (p[0] - cur[0]) / d
            sgn = 1 if large != sweep else -1
            c = (mx + sgn * h * nx, my + sgn * h * ny)
            a0 = math.atan2(cur[1] - c[1], cur[0] - c[0])
            a1 = math.atan2(p[1] - c[1], p[0] - c[0])
            da = a1 - a0
            if sweep and da < 0:
                da += 2 * math.pi
            if not sweep and da > 0:
                da -= 2 * math.pi
            n = max(4, int(abs(da) * r / step))
            pts += [(c[0] + r * math.cos(a0 + da * i / n), c[1] + r * math.sin(a0 + da * i / n)) for i in range(1, n + 1)]
            cur = p
        elif k == 'Z':
            if start and cur and dist(cur, start) > 1e-6:
                n = max(1, int(dist(cur, start) / step))
                pts += [lerp(cur, start, i / n) for i in range(1, n + 1)]
            cur = start
    if len(pts) > 1:
        subs.append(pts)
    return subs


# ------------------------------------------------------------------------------------------------
# Curve fitting (Schneider, "An algorithm for automatically fitting digitized curves").
# ------------------------------------------------------------------------------------------------


def _bez(ctrl, t):
    p0, p1, p2, p3 = ctrl
    u = 1 - t
    return u ** 3 * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t ** 3 * p3


def _bezd(ctrl, t):
    p0, p1, p2, p3 = ctrl
    u = 1 - t
    return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2)


def _bezdd(ctrl, t):
    p0, p1, p2, p3 = ctrl
    return 6 * (1 - t) * (p2 - 2 * p1 + p0) + 6 * t * (p3 - 2 * p2 + p1)


def _chord_params(pts):
    d = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))])
    return d / d[-1] if d[-1] > 0 else d


def _gen_bez(pts, u, t1, t2):
    p0, p3 = pts[0], pts[-1]
    A1 = np.outer(3 * (1 - u) ** 2 * u, t1)
    A2 = np.outer(3 * (1 - u) * u ** 2, t2)
    c11 = np.sum(A1 * A1)
    c12 = np.sum(A1 * A2)
    c22 = np.sum(A2 * A2)
    base = np.outer((1 - u) ** 3 + 3 * (1 - u) ** 2 * u, p0) + np.outer(3 * (1 - u) * u ** 2 + u ** 3, p3)
    tmp = pts - base
    x1 = np.sum(A1 * tmp)
    x2 = np.sum(A2 * tmp)
    det = c11 * c22 - c12 * c12
    seg = np.linalg.norm(p3 - p0)
    if abs(det) > 1e-12:
        a1 = (x1 * c22 - x2 * c12) / det
        a2 = (c11 * x2 - c12 * x1) / det
    else:
        a1 = a2 = seg / 3
    eps = 1e-6 * seg
    if a1 < eps or a2 < eps or a1 > seg * 2 or a2 > seg * 2:
        a1 = a2 = seg / 3
    return [p0, p0 + t1 * a1, p3 + t2 * a2, p3]


def _max_err(pts, ctrl, u):
    d = np.array([np.linalg.norm(_bez(ctrl, t) - p) for p, t in zip(pts, u)])
    i = int(np.argmax(d))
    return d[i], i


def _reparam(pts, ctrl, u):
    out = []
    for p, t in zip(pts, u):
        q = _bez(ctrl, t) - p
        d1 = _bezd(ctrl, t)
        d2 = _bezdd(ctrl, t)
        num = np.dot(q, d1)
        den = np.dot(d1, d1) + np.dot(q, d2)
        out.append(t if abs(den) < 1e-12 else min(1.0, max(0.0, t - num / den)))
    return np.array(out)


def _fit(pts, t1, t2, err, depth=0):
    if len(pts) == 2:
        seg = np.linalg.norm(pts[1] - pts[0]) / 3
        return [[pts[0], pts[0] + t1 * seg, pts[1] + t2 * seg, pts[1]]]
    u = _chord_params(pts)
    ctrl = _gen_bez(pts, u, t1, t2)
    e, split = _max_err(pts, ctrl, u)
    if e < err:
        return [ctrl]
    if e < err * 4:
        for _ in range(6):
            u = _reparam(pts, ctrl, u)
            ctrl = _gen_bez(pts, u, t1, t2)
            e, split = _max_err(pts, ctrl, u)
            if e < err:
                return [ctrl]
    split = min(max(split, 1), len(pts) - 2)
    tc = pts[split - 1] - pts[split + 1]
    n = np.linalg.norm(tc)
    tc = tc / n if n > 0 else t2
    return _fit(pts[: split + 1], t1, tc, err, depth + 1) + _fit(pts[split:], -tc, t2, err, depth + 1)


def _tangent(pts, i, direction, span=3):
    j = min(len(pts) - 1, max(0, i + direction * span))
    v = pts[j] - pts[i]
    n = np.linalg.norm(v)
    return v / n if n > 0 else np.array([1.0, 0.0])


def fit_points(points, err=0.5, closed=False, corner_deg=50.0, straight_tol=0.25):
    """Fit a dense polyline with cubic Beziers; splits at corners; near-straight pieces become L."""
    pts = np.array(points, dtype=float)
    # dedupe consecutive
    keep = [0]
    for i in range(1, len(pts)):
        if np.linalg.norm(pts[i] - pts[keep[-1]]) > 1e-6:
            keep.append(i)
    pts = pts[keep]
    if closed and np.linalg.norm(pts[0] - pts[-1]) < 1e-6:
        pts = pts[:-1]
    n = len(pts)
    if n < 2:
        return []
    # corner detection
    corners = []
    if n > 4:
        span = 3
        for i in range(n):
            if not closed and (i < span or i > n - 1 - span):
                continue
            a = pts[(i - span) % n] if closed else pts[i - span]
            b = pts[(i + span) % n] if closed else pts[i + span]
            v1 = pts[i] - a
            v2 = b - pts[i]
            l1, l2 = np.linalg.norm(v1), np.linalg.norm(v2)
            if l1 == 0 or l2 == 0:
                continue
            ang = math.degrees(math.acos(max(-1, min(1, np.dot(v1, v2) / (l1 * l2)))))
            if ang > corner_deg:
                corners.append((i, ang))
        # keep local maxima only
        cs = []
        for i, ang in corners:
            if all(not (abs(i - j) <= 3 or (closed and abs(i - j) >= n - 3)) or ang >= a2 for j, a2 in corners):
                if not cs or abs(cs[-1] - i) > 3:
                    cs.append(i)
        corners = cs
    if closed:
        if corners:
            start = corners[0]
            pts = np.concatenate([pts[start:], pts[:start], pts[start:start + 1]])
            corners = [(c - start) % n for c in corners] + [n]
            corners = sorted(set(corners))
        else:
            pts = np.concatenate([pts, pts[:1]])
            corners = [len(pts) - 1]
            # split closed smooth curve into two so tangents are continuous at the seam
        breaks = [0] + [c for c in corners if c > 0]
    else:
        breaks = [0] + [c for c in corners] + [n - 1]
    breaks = sorted(set(breaks))
    beziers = []
    smooth_closed = closed and len(breaks) == 2
    for bi in range(len(breaks) - 1):
        seg = pts[breaks[bi]: breaks[bi + 1] + 1]
        if len(seg) < 2:
            continue
        if smooth_closed:
            # continuous tangent at seam
            tv = pts[1] - pts[-2]
            tv = tv / (np.linalg.norm(tv) or 1)
            t1, t2 = tv, -tv
        else:
            t1 = _tangent(seg, 0, 1)
            t2 = _tangent(seg, len(seg) - 1, -1)
        beziers += _fit(seg, t1, t2, err)
    path = [('M', tuple(beziers[0][0]))]
    for b in beziers:
        p0, p1, p2, p3 = b
        chord = p3 - p0
        L = np.linalg.norm(chord)
        straight = False
        if L > 0:
            nrm = np.array([-chord[1], chord[0]]) / L
            if abs(np.dot(p1 - p0, nrm)) < straight_tol and abs(np.dot(p2 - p0, nrm)) < straight_tol:
                straight = True
        if straight:
            path.append(('L', tuple(p3)))
        else:
            path.append(('C', tuple(p1), tuple(p2), tuple(p3)))
    if closed:
        path.append(('Z',))
    return path


def refit(path, err=0.4, closed=None):
    """Resample and refit a path (e.g. after offsetting) into compact cubics."""
    out = []
    for sub in sample(path, 0.7):
        c = closed if closed is not None else dist(sub[0], sub[-1]) < 0.05
        out += fit_points(sub, err, closed=c)
    return out


# ------------------------------------------------------------------------------------------------
# Offsetting and interlaced bands (knots, strapwork).
# ------------------------------------------------------------------------------------------------


def offset_poly(pts, d, closed=False, min_turn_deg=0.4):
    """Offset a dense polyline by d (left of travel direction) with mitred joins, one output point
    per input point. Collinear runs are offset as single segments so sharp corners do not leave
    swallowtails on the inner side."""
    P = np.array(pts, dtype=float)
    n = len(P)
    if n < 3:
        return _offset_vertices(P, d, closed)
    keep = []
    for i in range(n):
        if not closed and (i == 0 or i == n - 1):
            keep.append(i)
            continue
        a, b = P[i - 1], P[(i + 1) % n]
        v1, v2 = P[i] - a, b - P[i]
        l1, l2 = np.linalg.norm(v1), np.linalg.norm(v2)
        if l1 == 0 or l2 == 0:
            continue
        c = float(np.dot(v1, v2) / (l1 * l2))
        if math.degrees(math.acos(max(-1.0, min(1.0, c)))) >= min_turn_deg:
            keep.append(i)
    if len(keep) < (2 if not closed else 3):
        return _offset_vertices(P, d, closed)
    V = P[keep]
    O = np.array(_offset_vertices(V, d, closed))
    out = np.zeros_like(P)
    cum = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(np.vstack([P, P[:1]]) if closed else P, axis=0), axis=1))])
    kk = len(keep)
    segs = range(kk) if closed else range(kk - 1)
    for s in segs:
        i0 = keep[s]
        i1 = keep[(s + 1) % kk]
        idxs = list(range(i0, i1 + 1)) if i1 > i0 else list(range(i0, n)) + list(range(0, i1 + 1))
        L0 = cum[i0]
        span = (cum[i1] - L0) if i1 > i0 else (cum[n] - L0 + cum[i1])
        for i in idxs:
            Li = (cum[i] - L0) if (i >= i0) else (cum[n] - L0 + cum[i])
            u = Li / span if span > 0 else 0.0
            out[i] = O[s] + (O[(s + 1) % kk] - O[s]) * u
    return list(out)


def _offset_vertices(pts, d, closed=False):
    """Mitred offset of polyline vertices."""
    pts = np.array(pts, dtype=float)
    n = len(pts)
    out = []
    for i in range(n):
        if closed:
            a = pts[i - 1]
            b = pts[(i + 1) % n]
        else:
            a = pts[max(0, i - 1)]
            b = pts[min(n - 1, i + 1)]
        if not closed and (i == 0 or i == n - 1):
            v = b - a
            v = v / (np.linalg.norm(v) or 1)
            nv = np.array([v[1], -v[0]])
            out.append(pts[i] + nv * d)
            continue
        v1 = pts[i] - a
        v2 = b - pts[i]
        v1 = v1 / (np.linalg.norm(v1) or 1)
        v2 = v2 / (np.linalg.norm(v2) or 1)
        n1 = np.array([v1[1], -v1[0]])
        n2 = np.array([v2[1], -v2[0]])
        m = n1 + n2
        ml = np.linalg.norm(m)
        if ml < 1e-6:
            out.append(pts[i] + n1 * d)
            continue
        m = m / ml
        cosh = max(0.2, float(np.dot(m, n1)))
        out.append(pts[i] + m * (d / cosh))
    return out


def seg_intersect(p, p2, q, q2):
    r = (p2[0] - p[0], p2[1] - p[1])
    s = (q2[0] - q[0], q2[1] - q[1])
    den = r[0] * s[1] - r[1] * s[0]
    if abs(den) < 1e-12:
        return None
    t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / den
    u = ((q[0] - p[0]) * r[1] - (q[1] - p[1]) * r[0]) / den
    if 0 <= t < 1 and 0 <= u < 1:
        return t, u
    return None


def interlace(strands, width, gap=2.6, closed=True, err=0.35, min_sep=2.0, extra_cuts=None, centre=False, win=1.6):
    """Draw strands (dense polylines) as ribbons of `width` that alternate over/under at crossings.

    Returns list of paths (ribbon edges with gaps where a strand passes under another)."""
    S = [np.array(s, dtype=float) for s in strands]
    # arc lengths
    arcl = []
    for s in S:
        seg = np.linalg.norm(np.diff(np.vstack([s, s[:1]]) if closed else s, axis=0), axis=1)
        arcl.append(np.concatenate([[0.0], np.cumsum(seg)]))
    # find crossings: (strand a, pos a, strand b, pos b, point)
    crosses = []
    for a in range(len(S)):
        sa = S[a]
        na = len(sa)
        ea = na if closed else na - 1
        for b in range(a, len(S)):
            sb = S[b]
            nb = len(sb)
            eb = nb if closed else nb - 1
            # bounding-box prefilter per segment pair using numpy
            A0 = sa[:ea]
            A1 = np.roll(sa, -1, axis=0)[:ea] if closed else sa[1:]
            B0 = sb[:eb]
            B1 = np.roll(sb, -1, axis=0)[:eb] if closed else sb[1:]
            minax = np.minimum(A0[:, 0], A1[:, 0])[:, None]
            maxax = np.maximum(A0[:, 0], A1[:, 0])[:, None]
            minay = np.minimum(A0[:, 1], A1[:, 1])[:, None]
            maxay = np.maximum(A0[:, 1], A1[:, 1])[:, None]
            minbx = np.minimum(B0[:, 0], B1[:, 0])[None, :]
            maxbx = np.maximum(B0[:, 0], B1[:, 0])[None, :]
            minby = np.minimum(B0[:, 1], B1[:, 1])[None, :]
            maxby = np.maximum(B0[:, 1], B1[:, 1])[None, :]
            cand = np.argwhere((minax <= maxbx) & (maxax >= minbx) & (minay <= maxby) & (maxay >= minby))
            for i, j in cand:
                if a == b and abs(i - j) <= 2 or (a == b and closed and abs(i - j) >= na - 2):
                    continue
                if a == b and j <= i:
                    continue
                r = seg_intersect(A0[i], A1[i], B0[j], B1[j])
                if r is None:
                    continue
                t, u = r
                pa = arcl[a][i] + t * (arcl[a][i + 1] - arcl[a][i])
                pb = arcl[b][j] + u * (arcl[b][j + 1] - arcl[b][j])
                pt = A0[i] + t * (A1[i] - A0[i])
                if any(c[0] == a and c[2] == b and np.linalg.norm(c[4] - pt) < 0.8 for c in crosses):
                    continue  # same crossing found on adjacent segments (vertex hit)
                crosses.append([a, pa, b, pb, pt])
    # passes per strand, sorted by position
    passes = {k: [] for k in range(len(S))}
    for ci, (a, pa, b, pb, pt) in enumerate(crosses):
        passes[a].append((pa, ci, 0))
        passes[b].append((pb, ci, 1))
    for k in passes:
        passes[k].sort()
    over = {}  # (ci, side) -> bool

    def assign(k, idx, val):
        # alternate along strand k starting at pass idx with value val; propagate to partners
        stack = [(k, idx, val)]
        while stack:
            k, idx, val = stack.pop()
            lst = passes[k]
            m = len(lst)
            for step in range(m):
                if closed:
                    pos, ci, side = lst[(idx + step) % m]
                    v = val if step % 2 == 0 else not val
                else:
                    jj = step
                    pos, ci, side = lst[jj]
                    v = val if (jj - idx) % 2 == 0 else not val
                key = (ci, side)
                if key in over:
                    if over[key] != v:
                        raise ValueError('interlace: non-alternating knot')
                    continue
                over[key] = v
                other = (ci, 1 - side)
                if other not in over:
                    ok = crosses[ci][2] if side == 0 else crosses[ci][0]
                    opos = crosses[ci][3] if side == 0 else crosses[ci][1]
                    oidx = next(i for i, x in enumerate(passes[ok]) if x[1] == ci and x[2] == 1 - side)
                    stack.append((ok, oidx, not v))

    for k in range(len(S)):
        if passes[k] and (passes[k][0][1], passes[k][0][2]) not in over:
            assign(k, 0, True)
    # cut edges
    out = []
    centres = []
    half = width / 2
    for k, s in enumerate(S):
        unders = [crosses[ci][4] for (_, ci, side) in passes[k] if not over[(ci, side)]]
        under_other = []
        for (pos, ci, side) in passes[k]:
            if not over[(ci, side)]:
                ok = crosses[ci][2] if side == 0 else crosses[ci][0]
                opos = crosses[ci][3] if side == 0 else crosses[ci][1]
                under_other.append((crosses[ci][4], ok, pos, opos))
        for sgn in ((1, -1, 0) if centre else (1, -1)):
            e = np.array(offset_poly(s, sgn * half, closed)) if sgn else np.array(s)
            keep = np.ones(len(e), dtype=bool)
            Lk = arcl[k][-1]
            for (pt, ok, pos, opos) in under_other:
                da = np.abs(arcl[k][:len(e)] - pos)
                if closed:
                    da = np.minimum(da, Lk - da)
                near = (da < width * win) & (np.linalg.norm(e - pt, axis=1) < width * win)
                if not near.any():
                    continue
                so = S[ok]
                Lo = arcl[ok][-1]
                db = np.abs(arcl[ok][:len(so)] - opos)
                if closed:
                    db = np.minimum(db, Lo - db)
                local = so[db < width * win]
                for idx in np.where(near)[0]:
                    dmin = np.min(np.linalg.norm(local - e[idx], axis=1))
                    if dmin < half + gap:
                        keep[idx] = False
            if extra_cuts:
                for (pt, rad) in extra_cuts:
                    keep &= np.linalg.norm(e - np.array(pt), axis=1) >= rad
            # split into runs
            runs = []
            if keep.all() and closed:
                runs.append((list(e), True))
            else:
                idxs = np.arange(len(e))
                if closed and not keep.all():
                    first_cut = int(np.argmin(keep))
                    idxs = np.roll(idxs, -first_cut)
                cur = []
                for i in idxs:
                    if keep[i]:
                        cur.append(e[i])
                    else:
                        if len(cur) > 2:
                            runs.append((cur, False))
                        cur = []
                if len(cur) > 2:
                    runs.append((cur, False))
            for pts, cl in runs:
                if not cl and np.linalg.norm(np.array(pts[0]) - np.array(pts[-1])) < 1 and len(pts) < 4:
                    continue
                fp = fit_points(pts, err, closed=cl, corner_deg=60)
                (centres if sgn == 0 else out).append(fp)
    return (out, centres) if centre else out


# ------------------------------------------------------------------------------------------------
# Common ornamental motifs
# ------------------------------------------------------------------------------------------------


def frame(origin, u, v):
    """Local frame: point (s, t) -> origin + s*u + t*v."""
    return Aff(u[0], v[0], origin[0], u[1], v[1], origin[1])


def radial_frame(r, deg, cx=CX, cy=CY):
    """Frame at polar position: s along the radius (outward), t clockwise tangent."""
    o = polar(r, deg, cx, cy)
    a = math.radians(deg)
    u = (math.sin(a), -math.cos(a))
    v = (math.cos(a), math.sin(a))
    return frame(o, u, v)


def petal_local(length, width, tip=0.0, belly=0.45, pinch=0.0):
    """Petal along +s from (0,0) to (length, 0); half-width `width`. `tip` > 0 rounds the tip."""
    w = width
    a = belly
    if tip > 0:
        return [('M', (0, 0)), ('C', (length * a * 0.6, w * (1.15 - pinch)), (length * (1 - tip * 0.2), w * 1.1 * tip + w * 0.55), (length, 0)),
                ('C', (length * (1 - tip * 0.2), -w * 1.1 * tip - w * 0.55), (length * a * 0.6, -w * (1.15 - pinch)), (0, 0)), ('Z',)]
    return [('M', (0, 0)), ('C', (length * a * 0.5, w * 1.35), (length * (a + 0.35), w * 1.0), (length, 0)),
            ('C', (length * (a + 0.35), -w * 1.0), (length * a * 0.5, -w * 1.35), (0, 0)), ('Z',)]


def teardrop_local(length, width):
    """Teardrop: round end at s=0 side, point at s=length."""
    w = width
    return [('M', (length, 0)), ('C', (length * 0.55, w * 0.55), (0, w * 1.25), (0, 0)),
            ('C', (0, -w * 1.25), (length * 0.55, -w * 0.55), (length, 0)), ('Z',)]


def scroll_curl(center, r, turns=1.25, start_deg=0.0, cw=True, shrink=0.55, step=6):
    """Spiral curl (logarithmic-ish) sampled and fitted; ends at the outer radius."""
    pts = []
    n = int(turns * 360 / step)
    for i in range(n + 1):
        t = i / n
        ang = start_deg + (1 if cw else -1) * turns * 360 * t
        rr = r * (shrink + (1 - shrink) * t) * (t ** 0.0)
        rr = r * math.exp(math.log(shrink) * (1 - t))
        pts.append(polar(rr, ang, *center))
    return fit_points(pts, 0.25)


def spiral_pts(center, r_out, r_in, turns, start_deg, cw=True, n=None):
    n = n or int(turns * 48) + 2
    pts = []
    for i in range(n + 1):
        t = i / n
        rr = r_in * (r_out / r_in) ** t
        ang = start_deg + (1 if cw else -1) * turns * 360 * (1 - t)
        pts.append(polar(rr, ang, *center))
    return pts


def ring_copies(path, n, offset=0.0, cx=CX, cy=CY):
    out = []
    for i in range(n):
        out.append(xf(path, R(offset + 360 * i / n, cx, cy)))
    return out


def scallop_ring(r, h, n, offset=0.0, inward=False, cx=CX, cy=CY):
    """Circular-arc bumps of sagitta h between n points on radius r (outward unless inward)."""
    c = 2 * r * math.sin(math.pi / n)
    rho = (c * c / 4 + h * h) / (2 * h)
    large = 1 if h > c / 2 else 0
    path = [('M', polar(r, offset, cx, cy))]
    for i in range(n):
        p1 = polar(r, offset + 360 * (i + 1) / n, cx, cy)
        path.append(('A', rho, large, 0 if inward else 1, p1))
    path.append(('Z',))
    return path


def mirror_pair(path, axis_t: Aff):
    return [path, xf(path, axis_t)]


# ------------------------------------------------------------------------------------------------
# Template registry
# ------------------------------------------------------------------------------------------------

TEMPLATES = []


def template(id, name, category, level, tags, stroke=None, detail_w=None):
    def deco(fn):
        TEMPLATES.append(dict(id=id, name=name, category=category, level=level, tags=tags, fn=fn,
                              stroke=stroke, detail_w=detail_w))
        return fn
    return deco


def as_strings(paths):
    out = []
    for p in paths:
        if not p:
            continue
        s = pstr(p)
        if s and len(s) > 3:
            out.append(s)
    return out


def check_bounds(tid, strings):
    import re
    for s in strings:
        nums = re.findall(r'-?\d+(?:\.\d+)?', s)
        for v in nums:
            if float(v) < -4 or float(v) > 404:
                print(f'WARNING {tid}: value {v} out of bounds', file=sys.stderr)
                return


def build(only=None):
    out = []
    for t in TEMPLATES:
        if only and not any(t['id'].startswith(o) for o in only):
            continue
        res = t['fn']()
        main, detail = res if isinstance(res, tuple) else (res, [])
        ms = as_strings(main)
        ds = as_strings(detail)
        check_bounds(t['id'], ms + ds)
        chars = sum(len(s) for s in ms + ds)
        print(f"{t['id']:28s} {t['level']:12s} paths={len(ms):3d} detail={len(ds):3d} chars={chars}", file=sys.stderr)
        if chars > 30000 or len(ms) + len(ds) > 300:
            print(f"  BUDGET EXCEEDED for {t['id']}", file=sys.stderr)
        out.append((t, ms, ds))
    return out


def write_ts(items):
    lines = [
        '// Template art: frames, patterns, mandalas and lettering. Original line art authored in this repo.',
        '// generated by scripts/templategen/ornament.py — edit the generator, then run it and',
        '// `node scripts/export-templates.ts`. Lettering shapes come from open-licence fonts (OFL / GUST),',
        '// see the generator header; every flourish, frame and motif is drawn by the generator.',
        "import type { Template } from '../templates.ts';",
        '',
        'export const ornament: Template[] = [',
    ]
    for t, ms, ds in items:
        lines.append('  {')
        lines.append(f"    id: {json.dumps(t['id'])},")
        lines.append(f"    name: {json.dumps(t['name'])},")
        lines.append(f"    category: {json.dumps(t['category'])},")
        lines.append(f"    level: {json.dumps(t['level'])},")
        lines.append(f"    tags: {json.dumps(t['tags'])},")
        lines.append("    viewBox: '0 0 400 400',")
        if t['stroke'] is not None:
            lines.append(f"    strokeWidth: {t['stroke']},")
        if t['detail_w'] is not None:
            lines.append(f"    detailWidth: {t['detail_w']},")
        lines.append('    paths: [')
        for s in ms:
            lines.append(f'      {json.dumps(s)},')
        lines.append('    ],')
        if ds:
            lines.append('    detail: [')
            for s in ds:
                lines.append(f'      {json.dumps(s)},')
            lines.append('    ],')
        lines.append('  },')
    lines.append('];')
    lines.append('')
    OUT.write_text('\n'.join(lines))


# Art modules are appended below.


# ------------------------------------------------------------------------------------------------
# Mandala motifs (polar construction around the canvas centre)
# ------------------------------------------------------------------------------------------------


def polar_shape(r0, r1, a, profile, h, n=32, closed_base=False, cx=CX, cy=CY, err=0.45):
    """Symmetric petal-like shape on the ring: radius r0 -> r1 at angle a, angular half-width h*profile(t).

    Open at the base (it sits on a ring line) unless closed_base."""
    ts = [math.sin(math.pi / 2 * i / n) for i in range(n + 1)]
    left = [polar(r0 + (r1 - r0) * t, a - h * profile(t), cx, cy) for t in ts]
    right = [polar(r0 + (r1 - r0) * t, a + h * profile(t), cx, cy) for t in ts]
    pts = left + right[::-1][1:]
    return fit_points(pts, err, closed=closed_base)


def prof_pointed(p=1.0, q=1.0):
    return lambda t: max(0.0, (1 - t ** q)) ** p


def prof_round(t):
    return math.sqrt(max(0.0, 1 - t * t))


def prof_lotus(t):
    # bulges then sweeps to a fine point
    return max(0.0, math.sin(math.pi * (0.5 + 0.5 * t)) * (1 + 0.6 * math.sin(math.pi * t)))


def prof_flame(t):
    # ogee: wide belly, concave near the tip
    return max(0.0, (1 - t) ** 1.6 * (1 + 1.9 * t))


def prof_tear(t):
    # teardrop: zero at base, round belly, point at tip
    return max(0.0, math.sin(math.pi * min(1.0, t)) ** 0.8 * (1 - t) ** 0.6 * 1.6)


def beads(r, n, br, offset=0.0, cx=CX, cy=CY):
    return [circle(polar(r, offset + 360 * i / n, cx, cy), br) for i in range(n)]


def lattice(r0, r1, n, offset=0.0):
    out = []
    da = 360 / n
    for i in range(n):
        a = offset + da * i
        out.append(line(polar(r0, a), polar(r1, a + da)))
        out.append(line(polar(r0, a + da), polar(r1, a)))
    return out


def dot(p):
    """A dot: a very short stroke, rendered round by the line cap (use in the main layer)."""
    return [('M', (p[0] - 0.1, p[1])), ('L', (p[0] + 0.1, p[1]))]


def dots(r, n, offset=0.0, cx=CX, cy=CY):
    return join(*[dot(polar(r, offset + 360 * i / n, cx, cy)) for i in range(n)])


def ring_c(r):
    return circle((CX, CY), r)


def zigzag(r0, r1, n, offset=0.0):
    pts = []
    for i in range(2 * n + 1):
        a = offset + 180 * i / n
        pts.append(polar(r1 if i % 2 else r0, a))
    return poly(pts[:-1], closed=True)


def wave_ring(r, amp, n, offset=0.0):
    pts = [polar(r + amp * math.sin(math.radians(i * 360 * n / (n * 24))), offset + 360 * i / (n * 24)) for i in range(n * 24)]
    pts = [polar(r + amp * math.sin(2 * math.pi * n * i / (n * 24)), offset + 360 * i / (n * 24)) for i in range(n * 24)]
    return fit_points(pts, 0.3, closed=True)


def curl_local(L, r, turns=1.0, cw=True):
    """Stem along +s ending in a spiral curl of radius r; local coords."""
    pts = []
    n = 60
    for i in range(n + 1):
        t = i / n
        if t < 0.35:
            s = L * t / 0.35
            pts.append((s * (1 - r / L), 0.0))
        else:
            u = (t - 0.35) / 0.65
            ang = math.pi * 2 * turns * u
            rr = r * (1 - 0.75 * u)
            sx = L - r
            # circle tangent to the stem, curling to +t side when cw
            sg = 1 if cw else -1
            pts.append((sx + rr * math.sin(ang), sg * (r - rr * math.cos(ang))))
    return pts


@template('orn-mandala-lotus', 'Lotus mandala', 'mandalas', 'advanced',
          ['ornamental', 'geometric', 'mandala', 'lotus', 'meditation', 'gift'], stroke=3, detail_w=1.5)
def mandala_lotus():
    M, D = [], []
    M.append(ring_c(7))
    M.append(join(*[polar_shape(7, 24, i * 45, prof_round, 17) for i in range(8)]))
    D.append(join(*[polar_shape(10, 19, i * 45, prof_round, 7) for i in range(8)]))
    M.append(ring_c(27))
    M.append(join(*beads(31.5, 20, 2.4)))
    M.append(ring_c(36))
    M.append(join(*[polar_shape(36, 64, i * 22.5, prof_pointed(1.0, 1.6), 10.5) for i in range(16)]))
    D.append(join(*[polar_shape(40, 57, i * 22.5, prof_pointed(1.0, 1.6), 5.2) for i in range(16)]))
    D.append(join(*[line(polar(42, i * 22.5), polar(53, i * 22.5)) for i in range(16)]))
    M.append(dots(60, 16, 11.25))
    M.append(ring_c(67))
    M.append(ring_c(79))
    D.append(join(*lattice(67, 79, 40)))
    M.append(join(*[polar_shape(79, 126, i * 22.5, prof_lotus, 9.6) for i in range(16)]))
    D.append(join(*[polar_shape(84, 116, i * 22.5, prof_lotus, 5.6) for i in range(16)]))
    D.append(join(*[polar_shape(89, 106, i * 22.5, prof_lotus, 2.4) for i in range(16)]))
    D.append(join(*[polar_shape(96, 116, i * 22.5 + 11.25, prof_tear, 2.6) for i in range(16)]))
    M.append(dots(121, 16, 11.25))
    M.append(ring_c(129))
    M.append(join(*beads(134, 48, 2.1)))
    M.append(ring_c(139))
    M.append(join(*[polar_shape(139, 176, i * 15, prof_flame, 7.3) for i in range(24)]))
    D.append(join(*[polar_shape(144, 165, i * 15, prof_flame, 3.6) for i in range(24)]))
    M.append(dots(170, 24))
    D.append(join(*[polar_shape(150, 171, i * 15 + 7.5, prof_tear, 1.9) for i in range(24)]))
    M.append(dots(176, 24, 7.5))
    M.append(scallop_ring(180, 4.5, 72))
    return M, D


def curl_pts(base, base_dir, center, R, turns=1.15, side=1, decay=0.55, stem_k=0.4, n=70):
    """Filigree curl in a local frame: a stem from `base` (heading base_dir) that rolls into a spiral.

    The spiral starts at its outer side point (center + side*R*t-axis) heading +s, then turns toward
    the centre line (for side=+1 the curl rolls toward -t)."""
    cs, ct = center
    pts_sp = []
    for i in range(n + 1):
        u = i / n
        th = turns * 2 * math.pi * u
        r = R * math.exp(math.log(decay) * u * turns)
        phi = math.pi / 2 - th
        pts_sp.append((cs + r * math.cos(phi), ct + side * r * math.sin(phi)))
    p0 = pts_sp[0]
    L = dist(base, p0)
    c1 = add(base, mul(norm(base_dir), L * stem_k))
    c2 = sub(p0, (L * stem_k, 0))
    stem = [cubic_pt(base, c1, c2, p0, i / 30) for i in range(30)]
    return stem + pts_sp


def heart_scroll(fr: Aff, L, W, turns=1.1, spread=0.35):
    """Two mirrored curls rising from a common base point: a lyre/heart filigree. Local s outward."""
    out = []
    for side in (1, -1):
        pts = curl_pts((0, 0), (1, side * spread), (L - W * 0.5, side * W * 0.5), W * 0.5, turns, side)
        out.append(fit_points([fr(p) for p in pts], 0.5))
    return join(*out)


def local_shape(fr: Aff, path):
    return xf(path, fr)


@template('orn-mandala-filigree', 'Filigree mandala', 'mandalas', 'advanced',
          ['ornamental', 'mandala', 'filigree', 'lace', 'vintage', 'wedding'], stroke=3, detail_w=1.5)
def mandala_filigree():
    M, D = [], []
    M.append(join(*[polar_shape(0, 19, i * 60, prof_round, 26) for i in range(6)]))
    M.append(dot((CX, CY)))
    D.append(join(*[polar_shape(4, 14, i * 60, prof_round, 10) for i in range(6)]))
    M.append(ring_c(23))
    # ring of 12 heart scrolls
    D.append(join(*[heart_scroll(radial_frame(24, i * 30), 25, 7.6, 1.05) for i in range(12)]))
    M.append(dots(46, 12, 15))
    M.append(ring_c(52))
    M.append(ring_c(56))
    # big round petals with scroll inside
    M.append(join(*[polar_shape(56, 104, i * 30, prof_round, 12.5) for i in range(12)]))
    D.append(join(*[polar_shape(61, 98, i * 30, prof_round, 8.4) for i in range(12)]))
    D.append(join(*[heart_scroll(radial_frame(63, i * 30), 24, 9, 1.1) for i in range(12)]))
    D.append(join(*[polar_shape(76, 100, i * 30 + 15, prof_tear, 3.2) for i in range(12)]))
    M.append(dots(66, 12, 15))
    M.append(ring_c(108))
    M.append(scallop_ring(108, 6.5, 36))
    M.append(dots(112.5, 36, 5))
    # spade leaves alternating with filigree curls
    M.append(join(*[polar_shape(117, 160, i * 15, prof_flame, 5.6) for i in range(24)]))
    D.append(join(*[polar_shape(122, 150, i * 15, prof_flame, 2.4) for i in range(24)]))
    D.append(join(*[heart_scroll(radial_frame(125, i * 15 + 7.5), 22, 5.6, 1.0, 0.25) for i in range(24)]))
    M.append(dots(154, 24, 7.5))
    # outer lace
    M.append(ring_c(165))
    M.append(scallop_ring(165, 7, 48))
    D.append(scallop_ring(172, 3.2, 48, 3.75))
    M.append(dots(180.5, 48, 3.75))
    return M, D


@template('orn-mandala-star', 'Star lattice mandala', 'mandalas', 'advanced',
          ['geometric', 'ornamental', 'mandala', 'star', 'lattice'], stroke=3, detail_w=1.5)
def mandala_star():
    M, D = [], []
    # centre: 8-point star polygon {8/3} inside a circle
    pts = [polar(22, i * 135) for i in range(8)]
    M.append(poly(pts, closed=True))
    M.append(ring_c(24))
    D.append(ring_c(8))
    # octagram of two squares, with inner octagon
    M.append(poly([polar(58, 45 + 90 * i) for i in range(4)], closed=True))
    M.append(poly([polar(58, 90 * i) for i in range(4)], closed=True))
    D.append(poly([polar(34, 22.5 + 45 * i) for i in range(8)], closed=True))
    M.append(dots(46, 8, 22.5))
    M.append(ring_c(60))
    M.append(ring_c(72))
    D.append(join(*lattice(60, 72, 48)))
    # gothic arches with nested arch and a trefoil-like trio of beads
    def arch(r0, r1, a, hw, k=0.55):
        p0 = polar(r0, a - hw)
        p1 = polar(r0, a + hw)
        sh = polar(r0 + (r1 - r0) * 0.55, a - hw)
        sh2 = polar(r0 + (r1 - r0) * 0.55, a + hw)
        tip = polar(r1, a)
        return [('M', p0), ('L', sh), ('C', polar(r0 + (r1 - r0) * 0.85, a - hw * 1.0), polar(r1 - (r1 - r0) * 0.12, a - hw * 0.3), tip),
                ('C', polar(r1 - (r1 - r0) * 0.12, a + hw * 0.3), polar(r0 + (r1 - r0) * 0.85, a + hw * 1.0), sh2), ('L', p1)]
    M.append(join(*[arch(72, 122, i * 22.5, 10.2) for i in range(16)]))
    D.append(join(*[arch(77, 112, i * 22.5, 6.6) for i in range(16)]))
    D.append(join(*[polar_shape(84, 107, i * 22.5, prof_tear, 2.9) for i in range(16)]))
    D.append(join(*[line(polar(77, i * 22.5), polar(83, i * 22.5)) for i in range(16)]))
    # small diamonds between arch tips
    D.append(join(*[poly([polar(108, i * 22.5 + 11.25), polar(115, i * 22.5 + 9.2), polar(122, i * 22.5 + 11.25), polar(115, i * 22.5 + 13.3)], True) for i in range(16)]))
    M.append(ring_c(125))
    # zigzag band with dots in the teeth
    M.append(zigzag(125, 138, 32))
    M.append(dots(134, 32, 5.625))
    M.append(ring_c(138))
    # alternating long and short petals
    M.append(join(*[polar_shape(138, 174 if i % 2 == 0 else 160, i * 11.25, prof_pointed(1.0, 1.4), 4.6) for i in range(32)]))
    D.append(join(*[line(polar(142, i * 11.25), polar(166 if i % 2 == 0 else 153, i * 11.25)) for i in range(32)]))
    M.append(dots(168, 16, 11.25))
    M.append(ring_c(178))
    M.append(join(*beads(183, 64, 1.9)))
    return M, D


@template('orn-mandala-petal', 'Petal mandala', 'mandalas', 'intermediate',
          ['ornamental', 'mandala', 'flower', 'stylized'])
def mandala_petal():
    M, D = [], []
    M.append(ring_c(12))
    M.append(join(*[polar_shape(12, 42, i * 45, prof_round, 20) for i in range(8)]))
    D.append(join(*[line(polar(18, i * 45), polar(34, i * 45)) for i in range(8)]))
    M.append(ring_c(46))
    M.append(join(*[polar_shape(46, 104, i * 45 + 22.5, prof_lotus, 15) for i in range(8)]))
    M.append(join(*[polar_shape(46, 88, i * 45, prof_round, 11) for i in range(8)]))
    D.append(join(*[polar_shape(54, 92, i * 45 + 22.5, prof_lotus, 7) for i in range(8)]))
    D.append(join(*[polar_shape(52, 78, i * 45, prof_round, 5.5) for i in range(8)]))
    M.append(ring_c(112))
    M.append(scallop_ring(112, 9, 24))
    M.append(join(*[polar_shape(124, 172, i * 22.5, prof_flame, 8) for i in range(16)]))
    D.append(join(*[polar_shape(131, 160, i * 22.5, prof_flame, 3.5) for i in range(16)]))
    M.append(dots(150, 16, 11.25))
    return M, D


@template('orn-mandala-simple', 'Simple flower mandala', 'mandalas', 'beginner',
          ['mandala', 'flower', 'cute', 'kids'], stroke=5)
def mandala_simple():
    M = []
    M.append(ring_c(26))
    M.append(join(*[polar_shape(26, 90, i * 45, prof_round, 17) for i in range(8)]))
    M.append(join(*[polar_shape(70, 128, i * 45 + 22.5, prof_pointed(1.0, 1.5), 11) for i in range(8)]))
    M.append(ring_c(150))
    M.append(scallop_ring(150, 14, 16))
    return M, []


# ------------------------------------------------------------------------------------------------
# Raster union -> outline (used to outline thick skeletons such as snowflake arms)
# ------------------------------------------------------------------------------------------------

RS = 8  # raster pixels per unit


class Canvas:
    def __init__(self, scale=RS):
        from PIL import Image, ImageDraw
        self.s = scale
        self.img = Image.new('L', (400 * scale, 400 * scale), 0)
        self.d = ImageDraw.Draw(self.img)

    def _p(self, p):
        return (p[0] * self.s, p[1] * self.s)

    def disc(self, c, r, fill=255):
        x, y = self._p(c)
        rr = r * self.s
        self.d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=fill)

    caps = True

    def stroke(self, a, b, w, fill=255):
        if not self.caps:
            d = norm(sub(b, a))
            nv = (-d[1] * w / 2, d[0] * w / 2)
            self.polygon([add(a, nv), add(b, nv), sub(b, nv), sub(a, nv)], fill)
            return
        self.d.line([self._p(a), self._p(b)], fill=fill, width=max(1, int(round(w * self.s))))
        self.disc(a, w / 2, fill)
        self.disc(b, w / 2, fill)

    def polyline(self, pts, w, fill=255):
        for a, b in zip(pts, pts[1:]):
            self.stroke(a, b, w, fill)

    def polygon(self, pts, fill=255):
        self.d.polygon([self._p(p) for p in pts], fill=fill)

    def path(self, path, fill=255):
        for sub in sample(path, 0.5):
            self.polygon(sub, fill)

    def outlines(self, err=0.35, min_len=6.0, smooth_sigma=0.35, corner_deg=55):
        from scipy.ndimage import gaussian_filter
        from skimage import measure
        a = np.asarray(self.img, dtype=float) / 255.0
        if smooth_sigma:
            a = gaussian_filter(a, smooth_sigma * self.s)
        out = []
        for c in measure.find_contours(a, 0.5):
            pts = [(q[1] / self.s, q[0] / self.s) for q in c[::2]]
            if len(pts) < 4:
                continue
            per = sum(dist(p, q) for p, q in zip(pts, pts[1:]))
            if per < min_len:
                continue
            closed = dist(pts[0], pts[-1]) < 0.5
            out.append(fit_points(pts, err, closed=closed, corner_deg=corner_deg))
        return out


# ------------------------------------------------------------------------------------------------
# Geometric pieces
# ------------------------------------------------------------------------------------------------


@template('orn-flower-of-life', 'Flower of life', 'mandalas', 'intermediate',
          ['geometric', 'sacred-geometry', 'circles', 'meditation'], stroke=3, detail_w=1.5)
def flower_of_life():
    M, D = [], []
    r = 50
    centres = set()
    for q in range(-2, 3):
        for rr in range(-2, 3):
            s = -q - rr
            if max(abs(q), abs(rr), abs(s)) <= 2:
                x = CX + r * (q + rr / 2)
                y = CY + r * rr * math.sqrt(3) / 2
                centres.add((round(x, 3), round(y, 3)))
    # draw centre ring first, then outward
    for c in sorted(centres, key=lambda c: (round(dist(c, (CX, CY))), math.atan2(c[1] - CY, c[0] - CX))):
        M.append(circle(c, r))
    M.append(ring_c(3 * r * 0.9999 + 0.01 if False else 3 * r))
    M.append(ring_c(3 * r + 10))
    # bead ring and petal ticks between the two boundary circles
    M.append(dots(3 * r + 5, 36))
    # lace edge: scallops with a dot in each
    M.append(scallop_ring(3 * r + 10, 6, 48))
    D.append(scallop_ring(3 * r + 16, 4, 96))
    M.append(dots(3 * r + 13.5, 48, 3.75))
    return M, D


def hidden_clip(path, occluders, step=0.5, pad=0.0):
    """Visible pieces of `path` outside every occluder polygon (lists of points). Returns paths."""
    from skimage.measure import points_in_poly
    out = []
    for sub in sample(path, step):
        arr = np.array(sub)
        inside = np.zeros(len(arr), dtype=bool)
        for occ in occluders:
            inside |= points_in_poly(arr, np.array(occ))
        run = []
        for p, hid in zip(sub, inside):
            if not hid:
                run.append(p)
            else:
                if len(run) > 1:
                    out.append(fit_points(run, 0.3, corner_deg=40))
                run = []
        if len(run) > 1:
            closed = (not inside.any()) and dist(run[0], run[-1]) < 0.6
            out.append(fit_points(run, 0.3, closed=closed, corner_deg=40))
    return out


def kite(a, r_tip, r_base, hw):
    return [(CX, CY), polar(r_base, a - hw), polar(r_tip, a), polar(r_base, a + hw)]


@template('orn-compass-rose', 'Compass rose', 'mandalas', 'intermediate',
          ['vintage', 'geometric', 'compass', 'map', 'nautical', 'travel'], stroke=3, detail_w=1.5)
def compass_rose():
    M, D = [], []
    M.append(ring_c(166))
    M.append(ring_c(152))
    D.append(join(*[line(polar(152, i * 5), polar(152 + (9 if i % 18 == 0 else 7 if i % 9 == 0 else 5 if i % 2 == 0 else 3), i * 5)) for i in range(72) if i % 72 not in (0, 71, 1)]))
    D.append(ring_c(146))
    M += text_line('N', 'poppins', (189, 6, 211, 30))
    layers = [
        [kite(i * 90, 144, 30, 45) for i in range(4)],
        [kite(45 + i * 90, 108, 26, 45) for i in range(4)],
        [kite(22.5 + i * 45, 82, 22, 22.5) for i in range(8)],
    ]
    occ = [(CX - 18, CY - 18)]  # placeholder replaced below
    occ = []
    hub = [polar(19, i * 10) for i in range(36)]
    for li, layer in enumerate(layers):
        for k in layer:
            a = math.degrees(math.atan2(k[2][0] - CX, CY - k[2][1]))
            outline = poly(k[1:], closed=False)
            outline = poly([k[1], k[2], k[3]])
            M.extend(hidden_clip(outline, occ + [hub]))
            D.extend(hidden_clip(line(polar(19, a), k[2]), occ))
            # hatch the left half of the two upper layers
            if li < 2:
                tip = k[2]
                base = k[1]
                for t in np.arange(0.12, 0.96, 0.075 if li == 0 else 0.1):
                    p = lerp(polar(19, a), tip, t)
                    # the left edge: from base to tip; intersect a line perpendicular to the axis
                    q = lerp(base, tip, max(0.0, (t * dist(polar(19, a), tip) - 0) / dist(polar(19, a), tip)))
                    # project: find point on left edge with same axial distance as p
                    ax = norm(sub(tip, (CX, CY)))
                    dp = (p[0] - CX) * ax[0] + (p[1] - CY) * ax[1]
                    db = (base[0] - CX) * ax[0] + (base[1] - CY) * ax[1]
                    dt = (tip[0] - CX) * ax[0] + (tip[1] - CY) * ax[1]
                    if dp <= db + 1.5 or dp >= dt - 3:
                        continue
                    u = (dp - db) / (dt - db)
                    q = lerp(base, tip, u)
                    q = lerp(q, p, 0.12)
                    p2 = lerp(p, q, 0.1)
                    D.extend(hidden_clip(line(p2, q), occ + [hub]))
        occ = occ + layer
    M.append(ring_c(19))
    M.append(ring_c(11))
    M.append(dot((CX, CY)))
    D.append(join(*[polar_shape(11, 19, i * 45 + 22.5, prof_round, 15) for i in range(8)]))
    return M, D



# ------------------------------------------------------------------------------------------------
# Font outlines (letter shapes only)
# ------------------------------------------------------------------------------------------------

_CF = '/mnt/skills/examples/canvas-design/canvas-fonts/'
FONTS = {
    'lora-bi': _CF + 'Lora-BoldItalic.ttf',
    'young': _CF + 'YoungSerif-Regular.ttf',
    'gloock': _CF + 'Gloock-Regular.ttf',
    'poppins': '/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf',
    'chorus': '/usr/share/texmf/fonts/opentype/public/tex-gyre/texgyrechorus-mediumitalic.otf',
}
_font_cache = {}


def _font(key):
    if key not in _font_cache:
        from fontTools.ttLib import TTFont
        f = TTFont(FONTS[key])
        _font_cache[key] = (f, f.getGlyphSet(), f.getBestCmap(), _kerning(f))
    return _font_cache[key]


def _kerning(font):
    """Pair kerning (x advance adjustments) from GPOS PairPos lookups."""
    kern = {}
    if 'GPOS' not in font:
        return kern
    gpos = font['GPOS'].table
    if not gpos.LookupList:
        return kern
    for lk in gpos.LookupList.Lookup:
        subs = []
        for st in lk.SubTable:
            if lk.LookupType == 9:
                if st.ExtensionLookupType == 2:
                    subs.append(st.ExtSubTable)
            elif lk.LookupType == 2:
                subs.append(st)
        for st in subs:
            cov = st.Coverage.glyphs
            if st.Format == 1:
                for g1, ps in zip(cov, st.PairSet):
                    for pvr in ps.PairValueRecord:
                        v = pvr.Value1
                        xa = getattr(v, 'XAdvance', 0) if v else 0
                        if xa:
                            kern.setdefault((g1, pvr.SecondGlyph), xa)
            elif st.Format == 2:
                c1 = st.ClassDef1.classDefs if st.ClassDef1 else {}
                c2 = st.ClassDef2.classDefs if st.ClassDef2 else {}
                second_by_class = {}
                for g, c in c2.items():
                    second_by_class.setdefault(c, []).append(g)
                for g1 in cov:
                    rec = st.Class1Record[c1.get(g1, 0)]
                    for ci, r2 in enumerate(rec.Class2Record):
                        v = r2.Value1
                        xa = getattr(v, 'XAdvance', 0) if v else 0
                        if xa and ci in second_by_class:
                            for g2 in second_by_class[ci]:
                                kern.setdefault((g1, g2), xa)
    return kern


def _glyph_contours(gs, gname, t):
    from fontTools.pens.basePen import BasePen

    contours = []
    state = {'cur': None}

    class P(BasePen):
        def _moveTo(self, p):
            state['cur'] = [('M', t(p))]

        def _lineTo(self, p):
            state['cur'].append(('L', t(p)))

        def _curveToOne(self, a, b, c):
            state['cur'].append(('C', t(a), t(b), t(c)))

        def _qCurveToOne(self, a, b):
            state['cur'].append(('Q', t(a), t(b)))

        def _closePath(self):
            state['cur'].append(('Z',))
            contours.append(state['cur'])

        _endPath = _closePath

    gs[gname].draw(P(gs))
    return contours


def text_contours(text, key, size, x, baseline, tracking=0.0, kerning=True, adjust=None):
    """Glyph contours for `text` scaled to `size` per em, starting at (x, baseline).

    Returns (list of glyph paths, advance width). `adjust` maps character index -> extra advance (em/1000)
    applied before that character."""
    font, gs, cmap, kern = _font(key)
    upm = font['head'].unitsPerEm
    sc = size / upm
    pen_x = 0.0
    glyphs = []
    prev = None
    for idx, ch in enumerate(text):
        if adjust and idx in adjust:
            pen_x += adjust[idx] * upm / 1000
        gname = cmap[ord(ch)]
        if ch == ' ':
            pen_x += gs[gname].width + tracking * upm / 1000
            prev = None
            continue
        if kerning and prev is not None:
            pen_x += kern.get((prev, gname), 0)
        ox = pen_x
        t = (lambda ox: (lambda p: (x + (p[0] + ox) * sc, baseline - p[1] * sc)))(ox)
        glyphs.append(join(*_glyph_contours(gs, gname, t)))
        pen_x += gs[gname].width + tracking * upm / 1000
        prev = gname
    return glyphs, pen_x * sc


def bbox(paths):
    xs, ys = [], []
    for p in paths:
        for sub in sample(p, 2.0):
            for q in sub:
                xs.append(q[0])
                ys.append(q[1])
    return min(xs), min(ys), max(xs), max(ys)


def fit_into(paths, box):
    """Uniformly scale+translate paths so their bbox fits box=(x0,y0,x1,y1), centred."""
    x0, y0, x1, y1 = bbox(paths)
    bx0, by0, bx1, by1 = box
    s = min((bx1 - bx0) / (x1 - x0), (by1 - by0) / (y1 - y0))
    w, h = (x1 - x0) * s, (y1 - y0) * s
    ox = bx0 + ((bx1 - bx0) - w) / 2
    oy = by0 + ((by1 - by0) - h) / 2
    t = T(ox, oy) * S(s) * T(-x0, -y0)
    return [xf(p, t) for p in paths], t


def text_line(text, key, box, tracking=0.0, kerning=True, adjust=None):
    g, _ = text_contours(text, key, 100, 0, 0, tracking, kerning, adjust)
    out, _t = fit_into(g, box)
    return out


def fill_mask(paths, step=0.4):
    """Even-odd raster fill of closed paths at RS px/unit (boolean array)."""
    from PIL import Image, ImageDraw
    acc = np.zeros((400 * RS, 400 * RS), dtype=bool)
    for p in paths:
        for sub in sample(p, step):
            layer = Image.new('1', (400 * RS, 400 * RS), 0)
            ImageDraw.Draw(layer).polygon([(q[0] * RS, q[1] * RS) for q in sub], fill=1)
            acc ^= np.asarray(layer, dtype=bool)
    return acc


def mask_outlines(a, err=0.35, sigma=0.3, min_len=6.0, corner_deg=60):
    from scipy.ndimage import gaussian_filter
    from skimage import measure
    f = gaussian_filter(a.astype(float), sigma * RS) if sigma else a.astype(float)
    out = []
    for c in measure.find_contours(f, 0.5):
        pts = [(q[1] / RS, q[0] / RS) for q in c[::2]]
        if len(pts) < 6:
            continue
        per = sum(dist(p, q) for p, q in zip(pts, pts[1:]))
        if per < min_len:
            continue
        out.append(fit_points(pts, err, closed=True, corner_deg=corner_deg))
    return out


def disk(r):
    rr = int(round(r * RS))
    yy, xx = np.mgrid[-rr:rr + 1, -rr:rr + 1]
    return (xx * xx + yy * yy) <= rr * rr


def bold_outline(paths, grow, err=0.35, sigma=0.3, extra=None):
    """Thicken filled shapes by `grow` units (raster dilation) and return the outlines of the union.

    `extra` is an optional boolean mask OR-ed in before outlining (e.g. flourishes drawn as strokes)."""
    from scipy.ndimage import binary_dilation
    a = fill_mask(paths)
    if grow > 0:
        a = binary_dilation(a, structure=disk(grow))
    if extra is not None:
        a |= extra
    return mask_outlines(a, err, sigma)


def stroke_mask(paths, width):
    """Boolean mask of paths stroked at `width` (round caps/joins)."""
    cv = Canvas()
    for p in paths:
        for sub in sample(p, 0.5):
            cv.polyline(sub, width)
    return np.asarray(cv.img) > 127



# ------------------------------------------------------------------------------------------------
# Lettering
# ------------------------------------------------------------------------------------------------


def sparkle(c, r, thin=0.28, rot=0.0):
    """Four-point sparkle star with concave sides."""
    pts = []
    for i in range(4):
        a = rot + i * 90
        tip = polar(r, a, *c)
        nxt = polar(r, a + 90, *c)
        pts.append(tip)
    path = [('M', pts[0])]
    for i in range(4):
        a = pts[i]
        b = pts[(i + 1) % 4]
        path.append(('Q', lerp(c, lerp(a, b, 0.5), thin), b))
    path.append(('Z',))
    return path


def swash(pts, k=1.0):
    return smooth(pts, False, k)


def curl_end(p, direction_deg, r, turns=1.2, cw=True):
    """Spiral curl that starts at p heading direction_deg (0 = up, clockwise) and rolls inward."""
    # centre is perpendicular to the heading
    side = 90 if cw else -90
    c = polar(r, direction_deg + side, *p)
    a0 = math.degrees(math.atan2(p[0] - c[0], -(p[1] - c[1])))
    pts = []
    n = int(60 * turns)
    for i in range(n + 1):
        u = i / n
        ang = a0 + (1 if cw else -1) * 360 * turns * u
        rr = r * (1 - 0.72 * u)
        pts.append(polar(rr, ang, *c))
    return pts


def flourish(pts_main, end_curls=(), err=0.3):
    """Smooth flourish through pts_main; optional curls appended at the start/end."""
    path_pts = []
    sp = sample(smooth(pts_main), 0.6)[0]
    for (where, r, turns, cw) in end_curls:
        if where == 'end':
            d = sub(sp[-1], sp[-4])
            ang = math.degrees(math.atan2(d[0], -d[1]))
            sp = sp + curl_end(sp[-1], ang, r, turns, cw)[1:]
        else:
            d = sub(sp[0], sp[3])
            ang = math.degrees(math.atan2(d[0], -d[1]))
            sp = (curl_end(sp[0], ang, r, turns, cw)[1:])[::-1] + sp
    return fit_points(sp, err, corner_deg=70)


def leaf_shape(base, tip, w, bend=0.0):
    """Leaf outline from base to tip with half-width w; bend curves the midrib sideways."""
    ax = sub(tip, base)
    L = math.hypot(*ax)
    u = mul(ax, 1 / L)
    v = (-u[1], u[0])
    fr = frame(base, u, v)
    path = [('M', (0, 0)), ('C', (L * 0.25, w * 1.25 + bend * L * 0.1), (L * 0.7, w * 0.95 + bend * L * 0.15), (L, bend * L * 0.12)),
            ('C', (L * 0.7, -w * 0.95 + bend * L * 0.15), (L * 0.25, -w * 1.25 + bend * L * 0.1), (0, 0)), ('Z',)]
    rib = [('M', (L * 0.05, 0)), ('Q', (L * 0.55, bend * L * 0.12), (L * 0.85, bend * L * 0.11))]
    return xf(path, fr), xf(rib, fr)


@template('orn-happy-birthday', 'Happy Birthday lettering', 'lettering', 'intermediate',
          ['birthday', 'card', 'lettering', 'stylized', 'party'], stroke=3, detail_w=2)
def happy_birthday():
    M, D = [], []
    letters = text_line('Happy', 'lora-bi', (72, 58, 328, 164)) + text_line('Birthday', 'lora-bi', (34, 174, 366, 290))
    M += letters
    D += shadow_lines(letters, 4.2, 4.2)
    M += divider(322, 140)
    for c, r in [((44, 64), 13), ((358, 86), 10), ((350, 168), 7), ((40, 166), 7), ((200, 360), 9), ((92, 358), 6), ((308, 358), 6)]:
        M.append(sparkle(c, r))
    for p in [(76, 32), (330, 40), (24, 118), (376, 128), (146, 370), (254, 370)]:
        M.append(dot(p))
    return M, D



def shadow_lines(paths, dx, dy, gap=0.6):
    """Drop-shadow edges: the parts of the (dx, dy)-shifted outline that fall outside the letters."""
    from scipy.ndimage import binary_dilation
    m = fill_mask(paths)
    if gap > 0:
        m = binary_dilation(m, structure=disk(gap))
    out = []
    for p in paths:
        for sub in sample(xf(p, T(dx, dy)), 0.4):
            run = []
            for q in sub:
                ix, iy = int(q[0] * RS), int(q[1] * RS)
                inside = 0 <= ix < m.shape[1] and 0 <= iy < m.shape[0] and m[iy, ix]
                if not inside:
                    run.append(q)
                else:
                    if len(run) > 3:
                        out.append(fit_points(run, 0.3, corner_deg=55))
                    run = []
            if len(run) > 3:
                closed = len(run) == len(sub)
                out.append(fit_points(run, 0.3, closed=closed, corner_deg=55))
    return out


def divider(cy, half=130, cx=CX, scale=1.0, centre='diamond'):
    """Symmetric swash divider: two mirrored S-scrolls with curls, a small branch and a centre jewel."""
    out = []
    s = scale
    right = [(cx + 10 * s, cy), (cx + 34 * s, cy + 8 * s), (cx + 66 * s, cy + 5 * s), (cx + 98 * s, cy - 5 * s), (cx + (half - 14) * s, cy - 6 * s)]
    main = flourish(right, end_curls=[('end', 7 * s, 1.15, True)])
    branch = flourish([(cx + 50 * s, cy + 7.6 * s), (cx + 64 * s, cy + 11 * s), (cx + 76 * s, cy + 17 * s)], end_curls=[('end', 5 * s, 0.95, True)])
    for p in (main, branch):
        out.append(p)
        out.append(xf(p, MX(cx)))
    if centre == 'diamond':
        out.append(poly([(cx, cy - 7 * s), (cx + 5 * s, cy), (cx, cy + 7 * s), (cx - 5 * s, cy)], closed=True))
    elif centre == 'heart':
        out.append(heart((cx, cy + 1 * s), 8 * s))
    return out


def heart(c, size):
    """Heart of width ~2*size centred at c (point at the bottom)."""
    x, y = c
    w = size
    return [('M', (x, y + w * 0.95)),
            ('C', (x - w * 0.45, y + w * 0.6), (x - w * 1.05, y + w * 0.15), (x - w * 1.0, y - w * 0.35)),
            ('C', (x - w * 0.95, y - w * 0.85), (x - w * 0.25, y - w * 1.0), (x, y - w * 0.5)),
            ('C', (x + w * 0.25, y - w * 1.0), (x + w * 0.95, y - w * 0.85), (x + w * 1.0, y - w * 0.35)),
            ('C', (x + w * 1.05, y + w * 0.15), (x + w * 0.45, y + w * 0.6), (x, y + w * 0.95)), ('Z',)]



def holly_leaf(base, tip, w, spikes=4, bend=0.0):
    """Holly leaf outline (concave scallops between spines) plus midrib and side veins."""
    ax = sub(tip, base)
    L = math.hypot(*ax)
    u = mul(ax, 1 / L)
    v = (-u[1], u[0])
    fr = frame(base, u, v)

    def mid(t):  # curved midrib offset
        return bend * L * 0.12 * math.sin(math.pi * t)

    def prof(t):
        return math.sin(math.pi * min(1, t) ** 0.85) ** 0.9

    path = [('M', (0, 0))]
    for side in (1, -1):
        ts = [0.08 + (0.92 - 0.08) * k / spikes for k in range(spikes + 1)]
        if side == 1:
            seq = ts
        else:
            seq = ts[::-1]
        pts = []
        for k, t in enumerate(seq):
            pts.append((L * t, mid(t) + side * w * prof(t) * 1.18))
        # from current point walk the spines
        if side == 1:
            cur = (0, 0)
            path.append(('Q', (L * 0.03, w * 0.35), pts[0]))
            for a, b in zip(pts, pts[1:]):
                m = lerp(a, b, 0.5)
                ctrl = (m[0], mid(m[0] / L) + (m[1] - mid(m[0] / L)) * 0.28)
                path.append(('Q', ctrl, b))
            path.append(('Q', (L * 0.97, mid(1) + w * 0.12), (L, mid(1))))
        else:
            path.append(('Q', (L * 0.97, mid(1) - w * 0.12), pts[0]))
            for a, b in zip(pts, pts[1:]):
                m = lerp(a, b, 0.5)
                ctrl = (m[0], mid(m[0] / L) + (m[1] - mid(m[0] / L)) * 0.28)
                path.append(('Q', ctrl, b))
            path.append(('Q', (L * 0.03, -w * 0.35), (0, 0)))
    path.append(('Z',))
    rib = fit_points([(L * t, mid(t)) for t in np.linspace(0.0, 0.9, 20)], 0.2)
    veins = []
    for k in range(1, spikes):
        t = 0.08 + (0.92 - 0.08) * k / spikes
        for side in (1, -1):
            a = (L * (t - 0.08), mid(t - 0.08))
            b = (L * t, mid(t) + side * w * prof(t) * 0.62)
            veins.append([('M', a), ('Q', (L * (t - 0.02), mid(t) + side * w * prof(t) * 0.25), b)])
    return xf(path, fr), xf(rib, fr), [xf(vv, fr) for vv in veins]


def berry(c, r):
    hl = [('M', polar(r * 0.55, -70, *c)), ('A', r * 0.55, 0, 0, polar(r * 0.55, -10, *c))]
    return circle(c, r), hl


def holly_sprig(origin, scale=1.0, rot=0.0, leaves=None, berries=None):
    """Holly leaves with berries in front (leaf lines hidden behind the berries); returns (main, detail)."""
    M, D = [], []
    t = T(origin[0], origin[1]) * R(rot, 0, 0) * S(scale)
    leaves = leaves or [((0, 0), (-62, -30), 17, 0.6), ((0, 0), (58, -34), 16, -0.5), ((0, 0), (-8, 62), 15, 0.4)]
    berries = berries or [((-2, -14), 9), ((14, -4), 8.5), ((-14, 4), 8)]
    occ = []
    for c, r in berries:
        o, hl = berry(c, r)
        o = xf(o, t)
        M.append(o)
        D.append(xf(hl, t))
        occ.append(sample(o, 0.5)[0])
    for b, tp, w, bend in leaves:
        lf, rib, veins = holly_leaf(b, tp, w, 4, bend)
        M += hidden_clip(xf(lf, t), occ)
        D += hidden_clip(xf(rib, t), occ)
        for v in veins:
            D += hidden_clip(xf(v, t), occ)
    return M, D


@template('orn-merry-christmas', 'Merry Christmas lettering', 'lettering', 'intermediate',
          ['christmas', 'card', 'lettering', 'holly', 'winter', 'script'], stroke=3, detail_w=1.6)
def merry_christmas():
    M, D = [], []
    l1 = text_line('Merry', 'chorus', (46, 126, 266, 214))
    l2 = text_line('Christmas', 'chorus', (36, 206, 364, 306))
    letters = bold_outline(l1 + l2, 2.0)
    M += letters
    D += shadow_lines(letters, 3.8, 3.8)
    hm, hd = holly_sprig((306, 100), 1.12, 14)
    M += hm
    D += hd
    M += divider(344, 120, scale=0.95)
    for c, r in [((56, 84), 10), ((122, 64), 6), ((196, 92), 7), ((372, 204), 6), ((40, 330), 6), ((360, 326), 6)]:
        M.append(sparkle(c, r))
    return M, D



def laurel_branch(c, r, a0, a1, step=10.0, leaf_len=24.0, leaf_w=6.5, splay=32.0, side=1, tip_leaf=True):
    """Laurel branch along a circular arc from angle a0 to a1 (degrees); leaves alternate sides.

    Returns (main, detail): leaf outlines + stem in main, midribs in detail."""
    M, D = [], []
    n = max(2, int(abs(a1 - a0) / 2))
    stem_pts = [polar(r, a0 + (a1 - a0) * i / n, *c) for i in range(n + 1)]
    M.append(fit_points(stem_pts, 0.3))
    direction = 1 if a1 > a0 else -1
    k = 0
    a = a0 + direction * step * 0.6
    while (a - a1) * direction < -step * 0.3:
        p = polar(r, a, *c)
        tangent = a + direction * 90  # heading along the arc
        sgn = 1 if k % 2 == 0 else -1
        ang = tangent + sgn * splay
        tip = polar(leaf_len, ang, *p)
        lf, rib = leaf_shape(p, tip, leaf_w, bend=0.0)
        M.append(lf)
        D.append(rib)
        a += direction * step * 0.5
        k += 1
    if tip_leaf:
        p = stem_pts[-1]
        tip = polar(leaf_len * 0.9, a1 + direction * 90, *p)
        lf, rib = leaf_shape(p, tip, leaf_w * 0.9)
        M.append(lf)
        D.append(rib)
    return M, D


@template('orn-thank-you', 'Thank You laurel', 'lettering', 'intermediate',
          ['thanks', 'card', 'lettering', 'laurel', 'botanical', 'vintage'], stroke=3, detail_w=1.6)
def thank_you():
    M, D = [], []
    l1 = text_line('Thank', 'young', (88, 120, 312, 200))
    l2 = text_line('you', 'young', (128, 206, 272, 276))
    M += l1 + l2
    D += shadow_lines(l1 + l2, 3.6, 3.6)
    # open laurel wreath: two mirrored branches from the bottom up each side
    lm, ld = laurel_branch((200, 200), 160, 188, 322, step=11, leaf_len=27, leaf_w=7, splay=34)
    for p in lm:
        M.append(p)
        M.append(xf(p, MX()))
    for p in ld:
        D.append(p)
        D.append(xf(p, MX()))
    # little bow knot at the bottom where the stems cross
    M.append(heart((200, 368), 7))
    M += [sparkle((200, 92), 9), dot((176, 98)), dot((224, 98))]
    D += divider(304, 70, scale=0.62)
    return M, D


@template('orn-love-hearts', 'Love script with hearts', 'lettering', 'intermediate',
          ['love', 'wedding', 'valentine', 'lettering', 'heart', 'script'], stroke=3, detail_w=1.6)
def love_hearts():
    M, D = [], []
    letters = bold_outline(text_line('Love', 'chorus', (44, 116, 356, 290)), 2.6)
    M += letters
    D += shadow_lines(letters, 4, 4)
    M.append(heart((200, 76), 24))
    D.append(heart((200, 77), 15))
    M.append(heart((150, 88), 10))
    M.append(heart((250, 88), 10))
    M += divider(322, 130, scale=0.95, centre='heart')
    for c, r in [((106, 72), 7), ((294, 72), 7), ((46, 120), 8), ((354, 112), 8), ((60, 300), 6), ((340, 300), 6)]:
        M.append(sparkle(c, r))
    return M, D


@template('orn-mr-and-mrs', 'Mr & Mrs lettering', 'lettering', 'intermediate',
          ['wedding', 'love', 'card', 'lettering', 'script', 'ornamental'], stroke=3, detail_w=1.6)
def mr_and_mrs():
    M, D = [], []
    amp = bold_outline(text_line('&', 'chorus', (124, 112, 276, 292)), 2.6)
    mr = bold_outline(text_line('Mr', 'gloock', (54, 70, 170, 148)), 0.7)
    mrs = bold_outline(text_line('Mrs', 'gloock', (214, 254, 352, 332)), 0.7)
    M += mr + amp + mrs
    # leafy vines either side of the ampersand
    for sgn in (1, -1):
        vine = [(200 + sgn * 70, 200), (200 + sgn * 96, 190), (200 + sgn * 124, 200), (200 + sgn * 150, 214)]
        M.append(flourish(vine, end_curls=[('end', 6, 1.1, sgn > 0)]))
        for (t, side) in [(0.25, 1), (0.5, -1), (0.72, 1)]:
            sp = sample(smooth(vine), 0.5)[0]
            i = int(t * (len(sp) - 1))
            p = sp[i]
            d = norm(sub(sp[i + 2], sp[i - 2]))
            ang = math.degrees(math.atan2(d[0], -d[1])) + side * 50 * (1 if sgn > 0 else -1)
            lf, rib = leaf_shape(p, polar(17, ang, *p), 5)
            M.append(lf)
            D.append(rib)
    M.append(heart((200, 352), 10))
    D += divider(352, 120, scale=0.8, centre='none')
    for c, r in [((44, 196), 7), ((356, 196), 7), ((200, 64), 9)]:
        M.append(sparkle(c, r))
    return M, D


@template('orn-hello', 'Hello block letters', 'lettering', 'beginner',
          ['lettering', 'card', 'kids', 'cute', 'hello'], stroke=5)
def hello():
    M = []
    M += text_line('Hello', 'poppins', (40, 132, 360, 252), tracking=10)
    M.append(flourish([(84, 294), (150, 280), (230, 284), (300, 300)], end_curls=[('end', 9, 1.0, True)]))
    M.append(heart((336, 96), 13))
    M.append(sparkle((64, 96), 13))
    return M, []



def inline_lines(paths, inset, err=0.35):
    """Inner offset outline of filled shapes (an engraved 'inline'), for thick letters."""
    from scipy.ndimage import binary_erosion
    a = fill_mask(paths)
    a = binary_erosion(a, structure=disk(inset))
    return mask_outlines(a, err, 0.3, min_len=14)


@template('orn-monogram-a', 'Monogram wreath A', 'lettering', 'advanced',
          ['monogram', 'wedding', 'gift', 'lettering', 'laurel', 'vintage', 'ornamental'], stroke=3, detail_w=1.5)
def monogram():
    M, D = [], []
    letter = text_line('A', 'gloock', (138, 128, 262, 262))
    M += bold_outline(letter, 0.9)
    D += inline_lines(letter, 4.5)
    M.append(ring_c(98))
    M.append(ring_c(106))
    M.append(join(*beads(102, 60, 1.6)))
    D.append(ring_c(92))
    # laurel wreath around the medallion
    lm, ld = laurel_branch((200, 200), 128, 192, 342, step=10.5, leaf_len=25, leaf_w=7, splay=36)
    for p in lm:
        M.append(p)
        M.append(xf(p, MX()))
    for p in ld:
        D.append(p)
        D.append(xf(p, MX()))
    # crest at the top: lyre scroll with a jewel
    M.append(heart_scroll(radial_frame(108, 0), 34, 15, 1.15, 0.45))
    M.append(poly([(200, 150 - 108 + 0), (206, 158 - 108), (200, 166 - 108), (194, 158 - 108)], closed=True))
    # bow at the bottom where the stems meet
    for sg in (1, -1):
        loop = [(200, 330), (200 + sg * 18, 318), (200 + sg * 34, 322), (200 + sg * 30, 340), (200 + sg * 12, 338), (200, 330)]
        M.append(smooth(loop))
        M.append(flourish([(200 + sg * 2, 333), (200 + sg * 12, 350), (200 + sg * 22, 366), (200 + sg * 36, 372)]))
    M.append(circle((200, 331), 5))
    # scattered pearls between wreath leaves and ring
    M.append(dots(116, 24, 7.5))
    return M, D



# ------------------------------------------------------------------------------------------------
# Patterns: knotwork, star tiles, frames
# ------------------------------------------------------------------------------------------------


def plait_strands(W, H, a=1.25, corner_a=1.7):
    """Closed strands of a rectangular Celtic plait in grid units.

    Crossings sit at (i, j) with i + j odd, 1 <= i <= 2W-1, 1 <= j <= 2H-1; walls at 0, 2W, 0, 2H.
    Strands run at 45 degrees and turn back at the walls with rounded loops. Returns list of
    dense point lists (closed)."""
    X, Y = 2 * W, 2 * H
    cross = {(i, j) for i in range(1, X) for j in range(1, Y) if (i + j) % 2 == 1}
    used = set()  # (i, j, dx, dy) directed visits
    strands = []

    def step(i, j, dx, dy):
        """From crossing (i,j) heading (dx,dy): next crossing and heading, plus the curve between."""
        ni, nj = i + dx, j + dy
        if 0 < ni < X and 0 < nj < Y:
            return (ni, nj, dx, dy), [('L', (ni, nj))]
        # reflect off wall(s)
        ndx, ndy = dx, dy
        if not (0 < ni < X):
            ndx = -dx
        if not (0 < nj < Y):
            ndy = -dy
        if ndx != dx and ndy != dy:
            # corner: double bounce -> U-turn loop
            ti, tj = i + ndx * 0 + (ndx * 1 if False else 0), j
            raise RuntimeError('corner hit')
        mi, mj = (i + dx + ndx, j + dy + ndy)
        if (mi, mj) in cross:
            k = a
            c1 = (i + dx * k, j + dy * k)
            c2 = (mi - ndx * k, mj - ndy * k)
            return (mi, mj, ndx, ndy), [('C', c1, c2, (mi, mj))]
        # second bounce near a corner
        ndx2, ndy2 = ndx, ndy
        if not (0 < mi < X):
            ndx2 = -ndx
        if not (0 < mj < Y):
            ndy2 = -ndy
        fi, fj = mi + ndx2 - ndx + 0, mj + ndy2 - ndy + 0
        fi, fj = i + dx + ndx + ndx2, j + dy + ndy + ndy2
        k = corner_a
        c1 = (i + dx * k, j + dy * k)
        c2 = (fi - ndx2 * k, fj - ndy2 * k)
        return (fi, fj, ndx2, ndy2), [('C', c1, c2, (fi, fj))]

    for (i0, j0) in sorted(cross):
        for (dx, dy) in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
            if (i0, j0, dx, dy) in used:
                continue
            path = [('M', (i0, j0))]
            i, j = i0, j0
            while True:
                used.add((i, j, dx, dy))
                used.add((i, j, -dx, -dy))
                (i, j, dx, dy), segs = step(i, j, dx, dy)
                path += segs
                if (i, j, dx, dy) == (i0, j0, path and dx, dy) and (i, j) == (i0, j0) and (i0, j0, dx, dy) in used:
                    break
                if (i, j) == (i0, j0) and (i0, j0, dx, dy) in used:
                    break
            path.append(('Z',))
            strands.append(path)
    return strands


@template('orn-celtic-knot', 'Celtic knot panel', 'patterns', 'advanced',
          ['celtic', 'knot', 'geometric', 'ornamental', 'interlace'], stroke=3, detail_w=1.5)
def celtic_knot():
    M, D = [], []
    W = H = 5
    strands = plait_strands(W, H)
    unit = 300 / (2 * W)
    t = T(50, 50) * S(unit)
    dense = []
    for s in strands:
        pts = sample(xf(s, t), 0.8)[0]
        if dist(pts[0], pts[-1]) < 0.5:
            pts = pts[:-1]
        dense.append(pts)
    edges, mids = interlace(dense, 14, gap=3.2, closed=True, centre=True)
    M += edges
    D += mids
    # border: rounded square with a bead row
    M.append(rrect_path(26, 26, 348, 348, 22))
    M.append(rrect_path(16, 16, 368, 368, 28))
    return M, D


def rrect_path(x, y, w, h, r):
    return [('M', (x + r, y)), ('L', (x + w - r, y)), ('A', r, 0, 1, (x + w, y + r)), ('L', (x + w, y + h - r)),
            ('A', r, 0, 1, (x + w - r, y + h)), ('L', (x + r, y + h)), ('A', r, 0, 1, (x, y + h - r)),
            ('L', (x, y + r)), ('A', r, 0, 1, (x + r, y)), ('Z',)]



def line_hit(p, d, q, e):
    """Intersection of lines p + s d and q + t e."""
    den = d[0] * e[1] - d[1] * e[0]
    if abs(den) < 1e-12:
        return None
    s = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den
    return (p[0] + s * d[0], p[1] + s * d[1])


def hankin_segments(polys, theta):
    """Hankin 'polygons in contact' construction: for each polygon, zigzag segments between edge
    midpoints and the points where rays at contact angle theta meet. Returns list of (a, b) segments."""
    segs = []
    for P in polys:
        n = len(P)
        c = (sum(p[0] for p in P) / n, sum(p[1] for p in P) / n)
        mids = [lerp(P[k], P[(k + 1) % n], 0.5) for k in range(n)]
        for k in range(n):
            m0 = mids[k]
            m1 = mids[(k + 1) % n]
            v = P[(k + 1) % n]
            # ray from m0 toward v rotated inward by theta
            ed = norm(sub(v, m0))
            # inward normal side: rotate toward centre
            a = math.radians(theta)
            r1 = (ed[0] * math.cos(a) - ed[1] * math.sin(a), ed[0] * math.sin(a) + ed[1] * math.cos(a))
            r2 = (ed[0] * math.cos(-a) - ed[1] * math.sin(-a), ed[0] * math.sin(-a) + ed[1] * math.cos(-a))
            ray = r1 if dist(add(m0, r1), c) < dist(add(m0, r2), c) else r2
            hit = line_hit(m0, ray, c, norm(sub(v, c)))
            segs.append((m0, hit))
            segs.append((hit, m1))
    return segs


def chain_strands(segs, tol=0.05):
    """Join segments into strands that run straight through 4-way vertices and turn at 2-way vertices."""
    canon = {}

    def key(p):
        cx_, cy_ = int(math.floor(p[0])), int(math.floor(p[1]))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for q in canon.get((cx_ + dx, cy_ + dy), ()):
                    if abs(q[0] - p[0]) < tol and abs(q[1] - p[1]) < tol:
                        return q
        canon.setdefault((cx_, cy_), []).append(p)
        return p
    adj = {}
    for idx, (a, b) in enumerate(segs):
        adj.setdefault(key(a), []).append((idx, 0))
        adj.setdefault(key(b), []).append((idx, 1))
    used = [False] * len(segs)
    strands = []

    def other_end(idx, end):
        return segs[idx][1 - end]

    def continue_from(idx, end):
        """At the far end of segment idx (end = which endpoint we arrive at), pick next segment."""
        here = segs[idx][end]
        came = sub(here, segs[idx][1 - end])
        cands = [(j, e) for (j, e) in adj[key(here)] if j != idx and not used[j]]
        if not cands:
            return None
        if len(adj[key(here)]) == 2:
            return cands[0]
        best, bd = None, -2
        for (j, e) in cands:
            d = sub(segs[j][1 - e], here)
            cs = (came[0] * d[0] + came[1] * d[1]) / ((math.hypot(*came) * math.hypot(*d)) or 1)
            if cs > bd:
                best, bd = (j, e), cs
        return best if bd > 0.99 else None

    for s0 in range(len(segs)):
        if used[s0]:
            continue
        used[s0] = True
        fwd = [segs[s0][0], segs[s0][1]]
        cur = (s0, 1)
        closed = False
        while True:
            nx = continue_from(*cur)
            if nx is None:
                break
            j, e = nx
            used[j] = True
            fwd.append(segs[j][1 - e])
            cur = (j, 1 - e)
            if key(fwd[-1]) == key(fwd[0]):
                closed = True
                break
        if not closed:
            back = []
            cur = (s0, 0)
            while True:
                nx = continue_from(*cur)
                if nx is None:
                    break
                j, e = nx
                used[j] = True
                back.append(segs[j][1 - e])
                cur = (j, 1 - e)
            fwd = back[::-1] + fwd
        strands.append((fwd, closed))
    return strands


def clip_polyline_rect(pts, x0, y0, x1, y1):
    """Clip an open polyline to a rectangle; returns list of pieces."""
    pieces = []
    cur = []
    dense = []
    for a, b in zip(pts, pts[1:]):
        n = max(1, int(dist(a, b) / 0.5))
        dense += [lerp(a, b, i / n) for i in range(n)]
    dense.append(pts[-1])
    for p in dense:
        if x0 <= p[0] <= x1 and y0 <= p[1] <= y1:
            cur.append(p)
        else:
            if len(cur) > 2:
                pieces.append(cur)
            cur = []
    if len(cur) > 2:
        pieces.append(cur)
    return pieces


def densify(pts, step=0.8, closed=False):
    out = []
    seq = pts + ([pts[0]] if closed else [])
    for a, b in zip(seq, seq[1:]):
        n = max(1, int(dist(a, b) / step))
        out += [lerp(a, b, i / n) for i in range(n)]
    if not closed:
        out.append(pts[-1])
    return out


STAR_THETA = 67.5


@template('orn-star-tile', 'Geometric star tile', 'patterns', 'advanced',
          ['geometric', 'star', 'tile', 'interlace', 'ornamental', 'moroccan'], stroke=2.6, detail_w=1.4)
def star_tile():
    M, D = [], []
    a = 112.0
    t = a / (1 + math.sqrt(2))
    polys = []
    for i in range(-3, 4):
        for j in range(-3, 4):
            c = (CX + i * a, CY + j * a)
            R8 = t / (2 * math.sin(math.pi / 8))
            polys.append([polar(R8, 22.5 + 45 * k, *c) for k in range(8)])
            c2 = (CX + (i + 0.5) * a, CY + (j + 0.5) * a)
            R4 = t / math.sqrt(2)
            polys.append([polar(R4, 90 * k, *c2) for k in range(4)])
    segs = hankin_segments(polys, STAR_THETA)
    strands = chain_strands(segs)
    box = (28.5, 28.5, 371.5, 371.5)
    pieces = []
    for pts, closed in strands:
        if closed:
            dp = densify(pts, 0.8, True)
            if all(box[0] <= p[0] <= box[2] and box[1] <= p[1] <= box[3] for p in dp):
                pieces.append((dp, True))
                continue
            pts = pts + [pts[0]]
        for pc in clip_polyline_rect(pts, *box):
            pieces.append((densify(pc, 0.8), False))
    closed_p = [p for p, c in pieces if c]
    open_p = [p for p, c in pieces if not c]
    M += interlace_mixed(closed_p, open_p, 9.0, gap=2.6, win=3.2)
    # eight-petal rosettes in the stars
    for i in range(-1, 2):
        for j in range(-1, 2):
            c = (CX + i * a, CY + j * a)
            D.append(join(*[polar_shape(4.5, 19, 22.5 + 45 * k, prof_lotus, 9, cx=c[0], cy=c[1]) for k in range(8)]))
            D.append(circle(c, 4.5))
    M.append(poly([(28, 28), (372, 28), (372, 372), (28, 372)], closed=True))
    M.append(poly([(18, 18), (382, 18), (382, 382), (18, 382)], closed=True))
    return M, D


def interlace_mixed(closed_strands, open_strands, width, gap=2.6, win=1.6):
    """Interlace a mix of closed and open strands (open ones are padded to look closed to the engine)."""
    out = []
    # the engine handles one closedness at a time; run it with open strands encoded as closed by
    # walking them forward and back would double crossings, so instead treat all as open, closing
    # closed strands by repeating their first point.
    strands = [s + [s[0]] for s in closed_strands] + open_strands
    return interlace(strands, width, gap=gap, closed=False, win=win)



def ellipse_path(c, rx, ry, n=120):
    pts = [(c[0] + rx * math.sin(2 * math.pi * i / n), c[1] - ry * math.cos(2 * math.pi * i / n)) for i in range(n)]
    return fit_points(pts, 0.2, closed=True, corner_deg=89)


def ellipse_points_by_arclength(c, rx, ry, count, phase=0.0):
    """Points spaced evenly by arc length along an ellipse (angle 0 = top, clockwise)."""
    N = 4000
    pts = [(c[0] + rx * math.sin(2 * math.pi * i / N), c[1] - ry * math.cos(2 * math.pi * i / N)) for i in range(N + 1)]
    cum = [0.0]
    for p, q in zip(pts, pts[1:]):
        cum.append(cum[-1] + dist(p, q))
    L = cum[-1]
    out = []
    j = 0
    for k in range(count):
        target = (phase + k) / count * L
        while cum[j + 1] < target:
            j += 1
        u = (target - cum[j]) / (cum[j + 1] - cum[j])
        out.append((lerp(pts[j], pts[j + 1], u), j / N * 360))
    return out


def s_scroll(pts, r0=6, r1=6, t0=1.1, t1=1.1, cw0=True, cw1=False, err=0.3):
    """Flourish with curls at both ends."""
    return flourish(pts, end_curls=[('start', r0, t0, cw0), ('end', r1, t1, cw1)], err=err)


def mirror_all(paths, axis=CX):
    out = []
    for p in paths:
        out.append(p)
        out.append(xf(p, MX(axis)))
    return out


def vine_leaves(stem, every, leaf_len, leaf_w, splay, side_fn, start=0.5, alt=True, shrink_ends=True):
    """Leaves along a dense stem polyline. side_fn(point, tangent) -> +1/-1 picks the leaf side
    (alternating sides when alt and side_fn returns 0). Returns (leaf outlines, midribs)."""
    L = [0.0]
    for p, q in zip(stem, stem[1:]):
        L.append(L[-1] + dist(p, q))
    total = L[-1]
    leaves, ribs = [], []
    s = every * start
    k = 0
    j = 0
    while s < total - every * 0.4:
        while L[j + 1] < s:
            j += 1
        p = stem[j]
        tng = norm(sub(stem[min(j + 2, len(stem) - 1)], stem[max(j - 2, 0)]))
        side = side_fn(p, tng)
        if side == 0:
            side = 1 if k % 2 == 0 else -1
        nrm = (-tng[1] * side, tng[0] * side)
        ang_r = math.radians(splay)
        d = add(mul(tng, math.cos(ang_r)), mul(nrm, math.sin(ang_r)))
        f = 1.0
        if shrink_ends:
            u = s / total
            f = 0.75 + 0.25 * math.sin(math.pi * u)
        lf, rib = leaf_shape(p, add(p, mul(d, leaf_len * f)), leaf_w * f)
        leaves.append(lf)
        ribs.append(rib)
        s += every
        k += 1
    return leaves, ribs


def palmette(base, height, n=5, spread=110, half_deg=11.0, cup=8.0, inner=True):
    """Fan of n round-tipped petals rising from a small cup at base (pointing up); returns (main, detail)."""
    M, D = [], []
    for i in range(n):
        a = -spread / 2 + spread * i / (n - 1)
        h = height * (1 - 0.3 * abs(a) / (spread / 2))
        M.append(polar_shape(cup, h, a, prof_lotus, half_deg, cx=base[0], cy=base[1]))
        if inner:
            D.append(line(polar(cup + 4, a, *base), polar(h - 8, a, *base)))
    M.append(arc_path(base, cup, -90, 90))
    return M, D


@template('orn-oval-frame', 'Ornate oval frame', 'patterns', 'advanced',
          ['wedding', 'frame', 'invitation', 'vintage', 'ornamental', 'flourish'], stroke=3, detail_w=1.5)
def oval_frame():
    M, D = [], []
    c = (200, 206)
    rx, ry = 108, 136
    M.append(ellipse_path(c, rx, ry))
    M.append(ellipse_path(c, rx + 12, ry + 12))
    D.append(ellipse_path(c, rx - 7, ry - 7))
    lace = ellipse_points_by_arclength(c, rx - 7, ry - 7, 84)
    lp = [('M', lace[0][0])]
    for k in range(1, 85):
        p = lace[k % 84][0]
        lp.append(('A', dist(lace[k - 1][0], p) * 0.56, 0, 0, p))
    D.append(lp)
    D.append(join(*[dot(polar(5.5, ang + 180, *p))[:1] + [('L', polar(5.6, ang + 180, *p))] for p, ang in ellipse_points_by_arclength(c, rx - 7, ry - 7, 84, 0.5)]))
    beads_ = ellipse_points_by_arclength(c, rx + 6, ry + 6, 60, 0.5)
    M.append(join(*[circle(p, 2.0) for p, a in beads_ if not (a < 20 or a > 340 or 160 < a < 200)]))
    top_y = c[1] - ry - 12  # 58
    # --- crest: palmette + big C-scrolls with leaves
    pm, pd = palmette((200, top_y + 2), 44, 5, 112, 11.5, 8)
    M += pm
    D += pd
    M.append(circle((200, top_y + 3), 5))
    crest = []
    crest.append(s_scroll([(208, top_y + 4), (236, top_y - 6), (270, top_y - 4), (298, top_y + 12), (314, top_y + 34)],
                          r0=4, r1=10, t0=0.8, t1=1.25, cw0=False, cw1=True))
    crest.append(flourish([(258, top_y - 5), (270, top_y - 18), (290, top_y - 24), (306, top_y - 16)], end_curls=[('end', 6, 1.1, True)]))
    for base, tip in [((240, top_y - 4), (246, top_y - 20)), ((276, top_y - 20), (284, top_y - 36)), ((300, top_y + 6), (318, top_y + 2))]:
        lf, rib = leaf_shape(base, tip, 5)
        crest.append(lf)
        D.append(rib)
        D.append(xf(rib, MX()))
    M += mirror_all(crest)
    # --- base: pendant drop + scrolls
    bot_y = c[1] + ry + 12  # 354
    M.append(polar_shape(0, 30, 180, prof_lotus, 15, cx=200, cy=bot_y - 1))
    D.append(polar_shape(5, 22, 180, prof_lotus, 8, cx=200, cy=bot_y - 1))
    M.append(circle((200, bot_y - 1), 4.5))
    base = []
    base.append(s_scroll([(208, bot_y - 2), (236, bot_y + 8), (268, bot_y + 6), (296, bot_y - 8), (312, bot_y - 30)],
                         r0=4, r1=10, t0=0.8, t1=1.25, cw0=True, cw1=False))
    base.append(flourish([(250, bot_y + 8), (264, bot_y + 20), (284, bot_y + 24), (300, bot_y + 16)], end_curls=[('end', 6, 1.1, False)]))
    for b0, tip in [((236, bot_y + 8), (242, bot_y + 24)), ((282, bot_y + 23), (298, bot_y + 34))]:
        lf, rib = leaf_shape(b0, tip, 5)
        base.append(lf)
        D.append(rib)
        D.append(xf(rib, MX()))
    M += mirror_all(base)
    # --- side vines: a stem hugging the frame with outward leaves
    stem = []
    for i in range(61):
        a = math.radians(58 + (122 - 58) * i / 60)
        stem.append((c[0] + (rx + 22) * math.sin(a), c[1] - (ry + 22) * math.cos(a)))
    vine = [fit_points(stem, 0.3)]
    def outward(p, t):
        nrm = (-t[1], t[0])
        return 1 if (nrm[0] * (p[0] - c[0]) + nrm[1] * (p[1] - c[1])) > 0 else -1
    lv, rb = vine_leaves(stem, 17, 21, 5.5, 40, outward, start=0.6)
    M += mirror_all(vine + lv)
    D += mirror_all(rb)
    # berries on the vine
    for i in (1, 3):
        a = math.radians(58 + (122 - 58) * (i + 0.5) / 4)
        p = (c[0] + (rx + 38) * math.sin(a), c[1] - (ry + 38) * math.cos(a))
        M.append(circle(p, 3.2))
        M.append(circle((400 - p[0], p[1]), 3.2))
    return M, D



# ------------------------------------------------------------------------------------------------
# Snowflakes (outlined unions of six-fold skeletons)
# ------------------------------------------------------------------------------------------------


def hex_pts(c, r, rot=0.0):
    return [polar(r, rot + 60 * k, *c) for k in range(6)]


def six_fold(cv: Canvas, arm_strokes, arm_polys=(), mirror=True):
    """Stamp an arm (strokes as (a, b, width) in local coords pointing up from the centre) six times."""
    for k in range(6):
        for flip in ((1, -1) if mirror else (1,)):
            t = R(60 * k) * Aff(flip, 0, CX * (1 - flip), 0, 1, 0)
            for a, b, w in arm_strokes:
                cv.stroke(t(a), t(b), w)
            for pts in arm_polys:
                cv.polygon([t(p) for p in pts])


def six_paths(paths, mirror=True):
    out = []
    for k in range(6):
        for flip in ((1, -1) if mirror else (1,)):
            t = R(60 * k) * Aff(flip, 0, CX * (1 - flip), 0, 1, 0)
            out += [xf(p, t) for p in paths]
    return out


def up(r, side=0.0):
    """Local arm coordinate: r along the arm (pointing up from the centre), side offset to the right."""
    return (CX + side, CY - r)


def branch(r0, length, ang=60.0, side=1):
    """Endpoint of a branch leaving the spine at radius r0 at angle ang from the spine (right side)."""
    a = math.radians(ang)
    return up(r0 + length * math.cos(a), side * length * math.sin(a))


@template('orn-snowflake-crystal', 'Crystal snowflake', 'patterns', 'advanced',
          ['christmas', 'winter', 'snowflake', 'geometric', 'ornamental'], stroke=3, detail_w=1.5)
def snowflake_crystal():
    M, D = [], []
    cv = Canvas()
    cv.caps = False
    strokes = [(up(16), up(170), 8)]
    skel = [line(up(30), up(164))]
    for r0, L, w, twigs in [(54, 38, 6, [(0.45, 12), (0.75, 9)]), (90, 48, 6, [(0.35, 15), (0.62, 12), (0.86, 8)]),
                            (126, 34, 5.5, [(0.45, 10), (0.75, 7)]), (150, 18, 5, [])]:
        e = branch(r0, L)
        strokes.append((up(r0), e, w))
        skel.append(line(up(r0, 0), lerp(up(r0), e, 0.86)))
        for (u, tl) in twigs:
            p = lerp(up(r0), e, u)
            # twig parallel to the spine (outward) and a shorter one at 120 degrees (inner side)
            strokes.append((p, (p[0], p[1] - tl), 4.4))
            a2 = math.radians(120)
            strokes.append((p, (p[0] + tl * 0.7 * math.sin(a2), p[1] - tl * 0.7 * math.cos(a2)), 4.4))
    # arrowhead tip
    tip_poly = [up(186), up(170, 9), up(165), up(170, -9)]
    # hexagonal plate on the spine
    plate = hex_pts(up(36), 9.5, 30)
    six_fold(cv, strokes, [tip_poly, plate])
    cv.polygon(hex_pts((CX, CY), 24, 0))
    out = cv.outlines(err=0.5, smooth_sigma=0.12, corner_deg=40)
    M += out
    # inner details
    D += six_paths(skel)
    D.append(poly(hex_pts((CX, CY), 15, 0), closed=True))
    D.append(join(*[line(polar(4, 60 * k), polar(13, 60 * k)) for k in range(6)]))
    D.append(join(*[poly(hex_pts(polar(36, 60 * k), 4.5, 30), closed=True) for k in range(6)]))
    return M, D


# Plate snowflake study: kept out of the catalogue (the crystal and simple flakes cover it better).
def snowflake_plate():
    M, D = [], []
    cv = Canvas()
    cv.polygon(hex_pts((CX, CY), 58, 30))
    strokes = [(up(40), up(150), 18)]
    side_plate_l = [up(104), branch(104, 30, 58, -1), lerp(branch(104, 30, 58, -1), up(130), 0.55), up(126)]
    side_plate_r = [up(104), branch(104, 30, 58, 1), lerp(branch(104, 30, 58, 1), up(130), 0.55), up(126)]
    fan = [up(140), up(150, -24), up(176, -14), up(184), up(176, 14), up(150, 24)]
    six_fold(cv, strokes, [side_plate_l, side_plate_r, fan], mirror=False)
    M += cv.outlines(err=0.3, smooth_sigma=0.3, corner_deg=50)
    # ridges and inner plates
    D.append(poly(hex_pts((CX, CY), 40, 30), closed=True))
    D.append(poly(hex_pts((CX, CY), 18, 0), closed=True))
    det = [line(up(20), up(170)), line(up(160), up(166, -12)), line(up(160), up(166, 12)),
           line(up(112), branch(112, 18, 58, 1)), line(up(112), branch(112, 18, 58, -1))]
    D += six_paths(det, mirror=False)
    D.append(join(*[line(polar(40, 60 * k + 30), polar(58 - 4, 60 * k + 30)) for k in range(6)]))
    return M, D


@template('orn-snowflake-simple', 'Simple snowflake', 'patterns', 'beginner',
          ['christmas', 'winter', 'snowflake', 'kids'], stroke=5)
def snowflake_simple():
    cv = Canvas()
    strokes = [(up(0), up(160), 16), (up(92), branch(92, 46, 55), 13)]
    six_fold(cv, strokes)
    cv.disc((CX, CY), 34)
    out = cv.outlines(err=0.4, smooth_sigma=0.4, corner_deg=55)
    return out + [circle((CX, CY), 14)], []



def notched_rect(x0, y0, x1, y1, r):
    """Rectangle with concave (inverted quarter-circle) corners."""
    return [('M', (x0 + r, y0)), ('L', (x1 - r, y0)), ('A', r, 0, 0, (x1, y0 + r)), ('L', (x1, y1 - r)),
            ('A', r, 0, 0, (x1 - r, y1)), ('L', (x0 + r, y1)), ('A', r, 0, 0, (x0, y1 - r)), ('L', (x0, y0 + r)),
            ('A', r, 0, 0, (x0 + r, y0)), ('Z',)]


@template('orn-vintage-label', 'Vintage label', 'patterns', 'intermediate',
          ['vintage', 'label', 'frame', 'gift', 'journal', 'ornamental'], stroke=3, detail_w=1.5)
def vintage_label():
    M, D = [], []
    x0, y0, x1, y1 = 74, 128, 326, 272
    M.append(notched_rect(x0, y0, x1, y1, 20))
    M.append(notched_rect(x0 - 10, y0 - 10, x1 + 10, y1 + 10, 26))
    D.append(notched_rect(x0 + 7, y0 + 7, x1 - 7, y1 - 7, 15))
    # dotted rule inside top and bottom
    D.append(join(*[dot((x, y0 + 16)) for x in range(110, 292, 8)]))
    D.append(join(*[dot((x, y1 - 16)) for x in range(110, 292, 8)]))
    # crest on top, pendant below
    pm, pd = palmette((200, y0 - 10), 34, 5, 116, 12, 7)
    M += pm
    D += pd
    M.append(polar_shape(0, 26, 180, prof_lotus, 15, cx=200, cy=y1 + 10))
    D.append(polar_shape(4, 19, 180, prof_lotus, 8, cx=200, cy=y1 + 10))
    # scroll pairs top and bottom of the crest
    deco = []
    deco.append(s_scroll([(222, y0 - 12), (244, y0 - 22), (270, y0 - 22), (290, y0 - 14)], r0=3.5, r1=7, t0=0.9, t1=1.2, cw0=False, cw1=True))
    deco.append(s_scroll([(222, y1 + 12), (244, y1 + 22), (270, y1 + 22), (290, y1 + 14)], r0=3.5, r1=7, t0=0.9, t1=1.2, cw0=True, cw1=False))
    for base, tip in [((252, y0 - 22), (262, y0 - 38)), ((252, y1 + 22), (262, y1 + 38))]:
        lf, rib = leaf_shape(base, tip, 4.5)
        deco.append(lf)
        D.append(rib)
        D.append(xf(rib, MX()))
    # side ornaments: C-scrolls framing a diamond
    deco.append(s_scroll([(x1 + 12, 200), (x1 + 26, 186), (x1 + 30, 166), (x1 + 22, 150)], r0=3, r1=6, cw0=True, cw1=False))
    deco.append(s_scroll([(x1 + 12, 200), (x1 + 26, 214), (x1 + 30, 234), (x1 + 22, 250)], r0=3, r1=6, cw0=False, cw1=True))
    deco.append(poly([(x1 + 34, 194), (x1 + 41, 200), (x1 + 34, 206), (x1 + 27, 200)], closed=True))
    M += mirror_all(deco)
    M.append(join(dot((200, y0 - 50)), dot((186, y0 - 46)), dot((214, y0 - 46))))
    sc = S(1.14, cx=200, cy=200)
    M = [xf(p, sc) for p in M]
    D = [xf(p, sc) for p in D]
    return M, D


@template('orn-gift-tag', 'Gift tag', 'patterns', 'beginner',
          ['gift', 'tag', 'christmas', 'birthday', 'label', 'cute'], stroke=5)
def gift_tag():
    M = []
    # tag body with clipped top corners, tilted slightly for charm
    body = [(150, 96), (250, 96), (296, 140), (296, 352), (104, 352), (104, 140)]
    t = R(-8, 200, 220)
    path = poly([t(p) for p in body], closed=True)
    M.append(path)
    M.append(circle(t((200, 136)), 12))
    inner = [(156, 110), (244, 110), (282, 146), (282, 338), (118, 338), (118, 146)]
    M.append(poly([t(p) for p in inner], closed=True))
    # string loop and bow above the hole
    h = t((200, 136))
    M.append(smooth([h, (h[0] - 10, h[1] - 40), (h[0] - 40, h[1] - 80), (h[0] - 20, h[1] - 104)]))
    M.append(heart(t((200, 252)), 34))
    return M, []


@template('orn-scroll-corners', 'Scrollwork corners', 'patterns', 'intermediate',
          ['vintage', 'frame', 'corner', 'journal', 'ornamental', 'flourish'], stroke=3, detail_w=1.5)
def scroll_corners():
    M, D = [], []
    corner = []
    # double bracket along the edges
    corner.append(poly([(26, 120), (26, 26), (120, 26)]))
    corner.append(poly([(36, 104), (36, 36), (104, 36)]))
    # curls at the bracket ends
    corner.append(flourish([(26, 120), (26, 134), (34, 144)], end_curls=[('end', 5, 1.1, False)]))
    corner.append(flourish([(120, 26), (134, 26), (144, 34)], end_curls=[('end', 5, 1.1, True)]))
    # diagonal fleuron in the corner
    corner.append(polar_shape(5, 30, 315, prof_lotus, 15, cx=62, cy=62))
    D.append(polar_shape(9, 23, 315, prof_lotus, 8, cx=62, cy=62))
    for sg in (1, -1):
        corner.append(polar_shape(5, 20, 315 + sg * 58, prof_lotus, 15, cx=62, cy=62))
    # long S-scrolls running along each edge with leaves
    for flipxy in (False, True):
        sc = [s_scroll([(80, 52), (104, 50), (134, 60), (160, 54), (176, 44)], r0=4, r1=7, t0=0.9, t1=1.1, cw0=False, cw1=True)]
        lv = []
        for base, tip in [((104, 50), (110, 36)), ((128, 58), (138, 72)), ((150, 58), (160, 70))]:
            lf, rib = leaf_shape(base, tip, 4.5)
            lv.append(lf)
            D_rib = rib
            lv_rib = rib
            sc.append(lf)
            D.append(rib if not flipxy else xf(rib, Aff(0, 1, 0, 1, 0, 0)))
        if flipxy:
            sc = [xf(p, Aff(0, 1, 0, 1, 0, 0)) for p in sc]  # swap x/y: mirror about the diagonal
        corner += sc
    corner.append(circle((62, 62), 5))
    corner.append(join(dot((76, 76)), dot((85, 85))))
    # mirror the corner to all four
    for p in corner:
        M.append(p)
        M.append(xf(p, MX()))
        M.append(xf(p, MY()))
        M.append(xf(p, MX() * MY()))
    D = [q for p in D for q in (p, xf(p, MX()), xf(p, MY()), xf(p, MX() * MY()))]
    # small centred dividers at top and bottom edges
    for y in (26, 374):
        M.append(poly([(200, y - 6), (206, y), (200, y + 6), (194, y)], closed=True))
        M.append(join(dot((184, y)), dot((216, y))))
    for x in (26, 374):
        M.append(poly([(x - 6, 200), (x, 206), (x + 6, 200), (x, 194)], closed=True))
        M.append(join(dot((x, 184)), dot((x, 216))))
    return M, D



def visible_parts(path, occluders, region=None, step=0.5, err=0.3):
    """Pieces of path outside all occluders and (optionally) inside the region polygon."""
    from skimage.measure import points_in_poly
    out = []
    for sub_ in sample(path, step):
        arr = np.array(sub_)
        hid = np.zeros(len(arr), dtype=bool)
        for occ in occluders:
            hid |= points_in_poly(arr, np.array(occ))
        if region is not None:
            hid |= ~points_in_poly(arr, np.array(region))
        run = []
        for p, h in zip(sub_, hid):
            if not h:
                run.append(p)
            else:
                if len(run) > 2:
                    out.append(fit_points(run, err, corner_deg=40))
                run = []
        if len(run) > 2:
            closed = (not hid.any()) and dist(run[0], run[-1]) < 0.6
            out.append(fit_points(run, err, closed=closed, corner_deg=40))
    return out


def deco_frame(x0, y0, x1, y1, step):
    """Rectangle with stepped (Art Deco) corners."""
    s = step
    return poly([(x0 + 2 * s, y0), (x1 - 2 * s, y0), (x1 - 2 * s, y0 + s), (x1 - s, y0 + s), (x1 - s, y0 + 2 * s), (x1, y0 + 2 * s),
                 (x1, y1 - 2 * s), (x1 - s, y1 - 2 * s), (x1 - s, y1 - s), (x1 - 2 * s, y1 - s), (x1 - 2 * s, y1),
                 (x0 + 2 * s, y1), (x0 + 2 * s, y1 - s), (x0 + s, y1 - s), (x0 + s, y1 - 2 * s), (x0, y1 - 2 * s),
                 (x0, y0 + 2 * s), (x0 + s, y0 + 2 * s), (x0 + s, y0 + s), (x0 + 2 * s, y0 + s)], closed=True)


@template('orn-deco-fans', 'Art Deco fan pattern', 'patterns', 'intermediate',
          ['geometric', 'art-deco', 'fan', 'vintage', 'pattern'], stroke=3, detail_w=1.5)
def deco_fans():
    M, D = [], []
    Rf = 50.0
    inner = deco_frame(46, 46, 354, 354, 12)
    region = [seg[1] for seg in inner if seg[0] in 'ML']
    rows = []
    y = 36.0
    k = 0
    while y < 420:
        xs = [x + (Rf if k % 2 else 0) for x in np.arange(0, 460, 2 * Rf)]
        rows.append([(float(x), y) for x in xs])
        y += Rf * 0.6
        k += 1
    def half_disk(c, r):
        return [polar(r, -90 + 180 * i / 40, *c) for i in range(41)]
    for ri, row in enumerate(rows):
        occ = [half_disk(c, Rf) for later in rows[ri + 1:ri + 3] for c in later]
        for c in row:
            if c[0] < -Rf or c[0] > 400 + Rf:
                continue
            outer = arc_path(c, Rf, -90, 90)
            M += visible_parts(outer, occ, region)
            D += visible_parts(arc_path(c, Rf * 0.78, -90, 90), occ, region)
            D += visible_parts(arc_path(c, Rf * 0.42, -90, 90), occ, region)
            for j in range(1, 10):
                a = -90 + 180 * j / 10
                D += visible_parts(line(polar(Rf * 0.42, a, *c), polar(Rf * 0.78, a, *c)), occ, region)
            for j in range(1, 6):
                a = -90 + 180 * j / 6
                D += visible_parts(line(polar(Rf * 0.08, a, *c), polar(Rf * 0.34, a, *c)), occ, region)
    M.append(inner)
    M.append(deco_frame(32, 32, 368, 368, 12))
    M = [M[-2], M[-1]] + [join(*M[:-2])]
    D = [join(*D)]
    return M, D



def lobed_leaf(spine_ctrl, width, lobes=4, lobe_depth=0.35, curl=None, side=1, n=160):
    """Acanthus-like leaf along a cubic spine: smooth inner edge, scalloped outer edge (side = +1 puts
    the lobes on the left of travel). Optional curl=(r, turns, cw) rolls the spine end into a spiral.
    Returns (outline path, spine path)."""
    p0, p1, p2, p3 = spine_ctrl
    sp = [cubic_pt(p0, p1, p2, p3, i / n) for i in range(n + 1)]
    left, right = [], []
    for i, p in enumerate(sp):
        t = i / n
        tg = norm(sub(sp[min(i + 1, n)], sp[max(i - 1, 0)]))
        nv = (tg[1], -tg[0])  # left normal on screen
        w = width * math.sin(math.pi * min(1.0, t * 1.05)) ** 0.7 * (1 - 0.35 * t)
        lob = 1 + lobe_depth * (abs(math.sin(math.pi * lobes * t)) ** 0.6 - 0.5) * 2 * min(1, t * 4)
        wl = w * (lob if side > 0 else 1.0)
        wr = w * (lob if side < 0 else 1.0) * 0.8
        left.append(add(p, mul(nv, wl)))
        right.append(sub(p, mul(nv, wr)))
    pts = left + right[::-1]
    outline = fit_points(pts, 0.35, closed=True, corner_deg=55)
    spine = fit_points(sp[int(n * 0.06): int(n * 0.9)], 0.3)
    extra = None
    if curl:
        r, turns, cw = curl
        d = sub(sp[-1], sp[-5])
        ang = math.degrees(math.atan2(d[0], -d[1]))
        extra = fit_points(curl_end(sp[-1], ang, r, turns, cw), 0.3)
    return outline, spine, extra


# Damask study: not good enough yet, kept out of the catalogue.
def damask():
    M, D = [], []
    right = []
    rdet = []
    # big acanthus leaf sweeping up from the base and curling over at the top
    o, sp, cu = lobed_leaf([(208, 312), (268, 318), (312, 258), (292, 196)], 15, lobes=4, lobe_depth=0.3,
                           curl=(9, 1.15, False), side=-1)
    right.append(o)
    rdet.append(sp)
    right.append(cu)
    # second, smaller leaf turning downward
    o2, sp2, cu2 = lobed_leaf([(212, 322), (252, 340), (286, 350), (300, 330)], 9, lobes=3, lobe_depth=0.3,
                              curl=(6, 1.1, True), side=1)
    right.append(o2)
    rdet.append(sp2)
    right.append(cu2)
    # scroll flanking the palmette
    right.append(s_scroll([(214, 218), (240, 206), (258, 180), (252, 154), (236, 146)], r0=4, r1=7, t0=0.8, t1=1.2, cw0=True, cw1=False))
    for base, tip in [((252, 186), (272, 176)), ((256, 166), (276, 150))]:
        lf, rib = leaf_shape(base, tip, 5)
        right.append(lf)
        rdet.append(rib)
    # lobe veins on the big leaf
    ctrl = [(208, 312), (268, 318), (312, 258), (292, 196)]
    for k in range(1, 8):
        t0 = 0.1 + 0.105 * k
        p = cubic_pt(*ctrl, t0)
        q = cubic_pt(*ctrl, t0 + 0.06)
        tg = norm(sub(q, p))
        nv = (-tg[1], tg[0])
        w = 15 * math.sin(math.pi * min(1.0, t0 * 1.05)) ** 0.7 * (1 - 0.35 * t0)
        rdet.append(smooth([p, add(add(p, mul(nv, w * 0.45)), mul(tg, 4)), add(add(p, mul(nv, w * 0.8)), mul(tg, 9))]))
    M += mirror_all(right)
    D += mirror_all(rdet)
    # centre: cup, palmette, lyre and finial
    cup = smooth([(170, 268), (178, 290), (200, 300), (222, 290), (230, 268)])
    M.append(cup)
    M.append(line((170, 268), (230, 268)))
    D.append(scallop_line((172, 274), (228, 274), 7, 4))
    pm, pd = palmette((200, 266), 78, 7, 150, 9.5, 12)
    M += pm
    D += pd
    M.append(polar_shape(0, 36, 180, prof_lotus, 15, cx=200, cy=302))
    D.append(polar_shape(5, 26, 180, prof_lotus, 7, cx=200, cy=302))
    # lyre heart scroll above the palmette and the finial
    M.append(heart_scroll(Aff(0, 1, 200, -1, 0, 184), 40, 18, 1.2, 0.45))
    M.append(polar_shape(0, 52, 0, prof_lotus, 13, cx=200, cy=142))
    D.append(polar_shape(8, 40, 0, prof_lotus, 6, cx=200, cy=142))
    M.append(circle((200, 142), 5))
    for sg in (1, -1):
        M.append(polar_shape(0, 26, sg * 42, prof_lotus, 18, cx=200, cy=136))
    M.append(join(dot((200, 76)), dot((200, 66)), dot((186, 82)), dot((214, 82)), dot((200, 370)), dot((188, 362)), dot((212, 362))))
    sc = S(1.36, cx=200, cy=222)
    M = [xf(p, sc) for p in M]
    D = [xf(p, sc) for p in D]
    return M, D


def scallop_line(a, b, n, h):
    """Row of n small arcs from a to b bulging downward (screen) by h."""
    path = [('M', a)]
    for i in range(1, n + 1):
        p = lerp(a, b, i / n)
        c = dist(a, b) / n
        rho = (c * c / 4 + h * h) / (2 * h)
        path.append(('A', rho, 0, 0, p))
    return path



# ------------------------------------------------------------------------------------------------

CATEGORY_ORDER = {'patterns': 0, 'mandalas': 1, 'lettering': 2}


def main():
    items = build()
    items.sort(key=lambda it: CATEGORY_ORDER[it[0]['category']])
    write_ts(items)
    total = sum(len(s) for _, ms, ds in items for s in ms + ds)
    print(f'wrote {len(items)} templates, {total} chars of path data -> {OUT.relative_to(ROOT)}', file=sys.stderr)


if __name__ == '__main__':
    main()
