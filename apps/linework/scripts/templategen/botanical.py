#!/usr/bin/env python3
"""Generator for src/core/templateArt/botanical.ts (botanical & floral line-art templates).

Run:  python3 scripts/templategen/botanical.py && node scripts/export-templates.ts
Check: python3 scripts/preview-templates.py /tmp/bot-prev bot-

All art is original and built here: parametric leaves/petals, phyllotaxis, recursive fronds and
hand-placed curves, with a painter's-algorithm hidden-line pass (objects are drawn front to back and
later outlines are clipped where an earlier closed shape covers them). Dense polylines are fitted
with cubic Beziers (Schneider's algorithm) so the output stays smooth and compact.
Deterministic: every random choice uses a fixed seed.
"""
import math
import pathlib
import random

import numpy as np
from matplotlib.path import Path as MPath

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'src' / 'core' / 'templateArt' / 'botanical.ts'

# =============================================================================================
# geometry helpers
# =============================================================================================


def A(pts):
    return np.asarray(pts, dtype=float).reshape(-1, 2)


def place(pts, x=0.0, y=0.0, ang=0.0, s=1.0, sx=None, sy=None, flip=False):
    """Local shape (pointing up = -y) -> scaled, mirrored, rotated clockwise by ang deg, moved to x,y."""
    p = A(pts).copy()
    if flip:
        p[:, 0] = -p[:, 0]
    p[:, 0] *= s if sx is None else sx
    p[:, 1] *= s if sy is None else sy
    a = math.radians(ang)
    c, si = math.cos(a), math.sin(a)
    out = np.empty_like(p)
    out[:, 0] = x + p[:, 0] * c - p[:, 1] * si
    out[:, 1] = y + p[:, 0] * si + p[:, 1] * c
    return out


def pol(cx, cy, r, deg):
    """Point at distance r, angle deg (0 = up, clockwise)."""
    a = math.radians(deg)
    return (cx + r * math.sin(a), cy - r * math.cos(a))


def catmull(pts, closed=False, n=12):
    """Dense polyline through key points (Catmull-Rom)."""
    p = A(pts)
    if closed:
        P = np.vstack([p[-1], p, p[0], p[1]])
    else:
        P = np.vstack([2 * p[0] - p[1], p, 2 * p[-1] - p[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2] if not closed else P[1])
    return A(out)


def bezpts(p0, p1, p2, p3, n=30):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2, p3 = map(np.asarray, (p0, p1, p2, p3))
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3


def bezchain(*segs, n=30):
    """Chain of cubic segments given as flat list: p0, c1, c2, p1, c1, c2, p2, ..."""
    pts = [A(s)[0] for s in segs]
    out = []
    for i in range(0, len(pts) - 1, 3):
        b = bezpts(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], n)
        out.append(b if not out else b[1:])
    return np.vstack(out)


def arc(cx, cy, r, a0, a1, n=None, ry=None):
    """Arc points, angles in degrees (0 = up, clockwise)."""
    ry = r if ry is None else ry
    n = n or max(8, int(abs(a1 - a0) / 4))
    t = np.radians(np.linspace(a0, a1, n))
    return np.stack([cx + r * np.sin(t), cy - ry * np.cos(t)], 1)


def circ(cx, cy, r, ry=None, n=None):
    ry = r if ry is None else ry
    n = n or max(24, int(2 * math.pi * max(r, ry) / 1.5))
    t = np.linspace(0, 2 * math.pi, n, endpoint=False)
    return np.stack([cx + r * np.sin(t), cy - ry * np.cos(t)], 1)


def resample(p, step=1.2):
    p = A(p)
    if len(p) < 2:
        return p
    d = np.linalg.norm(np.diff(p, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(d)])
    L = s[-1]
    if L < 1e-9:
        return p[:1]
    n = max(2, int(math.ceil(L / step)) + 1)
    u = np.linspace(0, L, n)
    return np.stack([np.interp(u, s, p[:, 0]), np.interp(u, s, p[:, 1])], 1)


def length(p):
    p = A(p)
    return float(np.linalg.norm(np.diff(p, axis=0), axis=1).sum()) if len(p) > 1 else 0.0


def offset_curve(p, d):
    """Parallel curve at signed distance d (left of travel direction for d > 0 in screen coords)."""
    p = A(p)
    t = np.gradient(p, axis=0)
    t /= np.maximum(np.linalg.norm(t, axis=1, keepdims=True), 1e-9)
    n = np.stack([t[:, 1], -t[:, 0]], 1)
    d = np.broadcast_to(np.asarray(d, float), (len(p),))
    return p + n * d[:, None]


def ribbon(center, w0, w1, cap=True):
    """Closed tapered band (stem/branch) around a centre line, width w0 at start -> w1 at end."""
    c = resample(center, 1.5)
    w = np.linspace(w0, w1, len(c)) / 2
    left = offset_curve(c, w)
    right = offset_curve(c, -w)
    if cap:
        return np.vstack([left, right[::-1]])
    return left, right


# =============================================================================================
# Bezier fitting (Schneider) and path formatting
# =============================================================================================


def _unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-12 else v * 0


def _bez_eval(b, t):
    t = np.asarray(t)[:, None]
    return (1 - t) ** 3 * b[0] + 3 * (1 - t) ** 2 * t * b[1] + 3 * (1 - t) * t * t * b[2] + t ** 3 * b[3]


def _generate(pts, u, t1, t2):
    p0, p3 = pts[0], pts[-1]
    b0 = 3 * u * (1 - u) ** 2
    b1 = 3 * u * u * (1 - u)
    A1 = t1[None, :] * b0[:, None]
    A2 = t2[None, :] * b1[:, None]
    C00 = (A1 * A1).sum()
    C01 = (A1 * A2).sum()
    C11 = (A2 * A2).sum()
    base = (1 - u) ** 3 + 3 * u * (1 - u) ** 2
    tmp = pts - (p0[None, :] * base[:, None] + p3[None, :] * ((u ** 3) + b1)[:, None])
    X0 = (A1 * tmp).sum()
    X1 = (A2 * tmp).sum()
    det = C00 * C11 - C01 * C01
    seg = np.linalg.norm(p3 - p0)
    if abs(det) > 1e-12:
        a1 = (X0 * C11 - X1 * C01) / det
        a2 = (C00 * X1 - C01 * X0) / det
    else:
        a1 = a2 = seg / 3
    eps = 1e-6 * seg
    if a1 < eps or a2 < eps or a1 > seg * 2 or a2 > seg * 2:
        a1 = a2 = seg / 3
    return np.array([p0, p0 + t1 * a1, p3 + t2 * a2, p3])


def _max_err(pts, b, u):
    d = np.linalg.norm(_bez_eval(b, u) - pts, axis=1)
    i = int(np.argmax(d))
    return d[i], i


def _reparam(pts, b, u):
    q = _bez_eval(b, u)
    d1 = 3 * ((1 - u)[:, None] ** 2 * (b[1] - b[0]) + 2 * ((1 - u) * u)[:, None] * (b[2] - b[1])
              + (u * u)[:, None] * (b[3] - b[2]))
    d2 = 6 * ((1 - u)[:, None] * (b[2] - 2 * b[1] + b[0]) + u[:, None] * (b[3] - 2 * b[2] + b[1]))
    num = ((q - pts) * d1).sum(1)
    den = (d1 * d1).sum(1) + ((q - pts) * d2).sum(1)
    with np.errstate(divide='ignore', invalid='ignore'):
        nu = np.where(np.abs(den) > 1e-12, u - num / den, u)
    return np.clip(nu, 0, 1)


def _fit(pts, t1, t2, err, depth=0):
    n = len(pts)
    if n == 2 or depth > 12:
        d = np.linalg.norm(pts[-1] - pts[0]) / 3
        return [np.array([pts[0], pts[0] + t1 * d, pts[-1] + t2 * d, pts[-1]])]
    ch = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))])
    u = ch / ch[-1] if ch[-1] > 0 else np.linspace(0, 1, n)
    b = _generate(pts, u, t1, t2)
    e, split = _max_err(pts, b, u)
    if e < err:
        return [b]
    if e < err * 6:
        for _ in range(12):
            u = _reparam(pts, b, u)
            b = _generate(pts, u, t1, t2)
            e, split = _max_err(pts, b, u)
            if e < err:
                return [b]
    split = min(max(split, 1), n - 2)
    tc = _unit(pts[split - 1] - pts[split + 1])
    return _fit(pts[:split + 1], t1, tc, err, depth + 1) + _fit(pts[split:], -tc, t2, err, depth + 1)


def fit(pts, err=0.45, t1=None, t2=None):
    pts = A(pts)
    n = len(pts)
    k = min(3, n - 1)
    if t1 is None:
        t1 = _unit(pts[k] - pts[0])
    if t2 is None:
        t2 = _unit(pts[n - 1 - k] - pts[-1])
    return _fit(pts, t1, t2, err)


class Fmt:
    def __init__(self, prec):
        self.prec = prec

    def n(self, v):
        if self.prec == 0:
            r = int(round(v))
            return str(r)
        r = round(v, 1)
        if r == 0:
            return '0'
        s = f'{r:.1f}'
        if s.endswith('.0'):
            s = s[:-2]
        return s

    def pt(self, p):
        return f'{self.n(p[0])} {self.n(p[1])}'


def corners(p, thresh=32.0, closed=False):
    """Indices of sharp corners in a polyline (turning angle above thresh degrees)."""
    p = A(p)
    n = len(p)
    idx = []
    rng = range(n) if closed else range(1, n - 1)
    for i in rng:
        a = p[(i - 1) % n] - p[i]
        b = p[(i + 1) % n] - p[i]
        la, lb = np.linalg.norm(a), np.linalg.norm(b)
        if la < 1e-9 or lb < 1e-9:
            continue
        cosang = np.clip(np.dot(a, b) / (la * lb), -1, 1)
        turn = 180 - math.degrees(math.acos(cosang))
        if turn > thresh:
            idx.append(i)
    return idx


def piece_d(p, fm, err, closed_smooth=False):
    """Fit one polyline piece and return 'M ... C ...' (without the M if continuing)."""
    p = resample(p, 1.0)
    if len(p) < 2:
        return ''
    if len(p) == 2 or _straight(p):
        return f'L {fm.pt(p[-1])}', p[0]
    t1 = t2 = None
    if closed_smooth:
        t1 = _unit(p[1] - p[-2])
        t2 = -t1
    segs = fit(p, err, t1, t2)
    out = []
    for b in segs:
        if _straight(b):
            out.append(f'L {fm.pt(b[3])}')
        else:
            out.append(f'C {fm.pt(b[1])} {fm.pt(b[2])} {fm.pt(b[3])}')
    return ' '.join(out), p[0]


def _straight(b, tol=0.25):
    b = A(b)
    a, c = b[0], b[-1]
    v = c - a
    L = np.linalg.norm(v)
    if L < 1e-9:
        return False
    nrm = np.array([-v[1], v[0]]) / L
    return bool(np.all(np.abs((b - a) @ nrm) < tol)) and bool(np.all(((b - a) @ v) / L >= -tol)) and bool(
        np.all(((b - a) @ v) / L <= L + tol))


def poly_d(p, fm, closed=False, err=0.45, cthresh=32.0):
    """Polyline (dense, from a generator) -> smooth SVG path, splitting at sharp corners."""
    p = A(p)
    if closed and np.linalg.norm(p[0] - p[-1]) < 1e-6:
        p = p[:-1]
    if len(p) < 2:
        return ''
    cs = corners(p, cthresh, closed)
    if closed:
        if not cs:
            loop = np.vstack([p, p[:1]])
            body, start = piece_d(loop, fm, err, closed_smooth=True)
            return f'M {fm.pt(loop[0])} {body} Z'
        k = cs[0]
        p = np.vstack([p[k:], p[:k]])
        cs = [(c - k) % len(p) for c in cs]
        p = np.vstack([p, p[:1]])
        cs = sorted(set(cs + [len(p) - 1]))
    else:
        cs = cs + [len(p) - 1]
    out = [f'M {fm.pt(p[0])}']
    prev = 0
    for c in cs:
        if c <= prev:
            continue
        body, _ = piece_d(p[prev:c + 1], fm, err)
        out.append(body)
        prev = c
    s = ' '.join(out)
    return s + (' Z' if closed else '')


# =============================================================================================
# Figure with painter's-algorithm occlusion
# =============================================================================================


class Fig:
    def __init__(self, prec=0, dprec=0, margin=1.1):
        self.paths = []
        self.detail = []
        self.occ = []
        self.fm = Fmt(prec)
        self.dfm = Fmt(dprec)
        self.margin = margin
        self.grp = None

    def group(self):
        """Start merging emitted strings into one main path and one detail path (e.g. a cluster of buds)."""
        self.grp = ([], [])

    def end_group(self):
        g, self.grp = self.grp, None
        if g and g[0]:
            self.paths.append(' '.join(g[0]))
        if g and g[1]:
            self.detail.append(' '.join(g[1]))

    def _emit(self, detail, d):
        if not d:
            return
        if self.grp is not None:
            self.grp[1 if detail else 0].append(d)
        else:
            (self.detail if detail else self.paths).append(d)

    # --- occlusion ---
    def add_occ(self, poly):
        p = A(poly)
        if len(p) < 3:
            return
        self.occ.append((MPath(p), p.min(0) - 1, p.max(0) + 1, p))

    def hidden(self, pts):
        pts = A(pts)
        hid = np.zeros(len(pts), bool)
        for path, lo, hi, poly in self.occ:
            box = np.all((pts >= lo) & (pts <= hi), axis=1) & ~hid
            if not box.any():
                continue
            sub = pts[box]
            ins = path.contains_points(sub)
            if not ins.any():
                continue
            cand = sub[ins]
            # distance to boundary; points closer than margin count as visible (clean joins)
            a = poly
            b = np.roll(poly, -1, axis=0)
            ab = b - a
            L2 = np.maximum((ab * ab).sum(1), 1e-12)
            dmin = np.full(len(cand), np.inf)
            for s in range(0, len(cand), 512):
                c = cand[s:s + 512]
                t = np.clip(((c[:, None, :] - a[None]) * ab[None]).sum(2) / L2[None], 0, 1)
                proj = a[None] + t[..., None] * ab[None]
                dmin[s:s + 512] = np.sqrt(((c[:, None, :] - proj) ** 2).sum(2)).min(1)
            deep = dmin > self.margin
            idx = np.where(box)[0][ins]
            hid[idx[deep]] = True
        return hid

    def visible_runs(self, p, closed=False, minlen=4.5):
        p = A(p)
        if closed:
            p = np.vstack([p, p[:1]])
        d = resample(p, 0.9)
        # keep original corner vertices by resampling piecewise between them
        cs = corners(p, 32.0, False)
        if cs:
            parts, prev = [], 0
            for c in cs + [len(p) - 1]:
                seg = resample(p[prev:c + 1], 0.9)
                parts.append(seg if not parts else seg[1:])
                prev = c
            d = np.vstack(parts)
        if not self.occ:
            return [d], True
        hid = self.hidden(d)
        if not hid.any():
            return [d], True
        runs, cur = [], []
        for q, h in zip(d, hid):
            if h:
                if len(cur) > 1:
                    runs.append(A(cur))
                cur = []
            else:
                cur.append(q)
        if len(cur) > 1:
            runs.append(A(cur))
        if closed and len(runs) > 1 and not hid[0] and not hid[-1]:
            runs[0] = np.vstack([runs[-1], runs[0][1:]])
            runs.pop()
        return [r for r in runs if length(r) >= minlen], False

    # --- emit ---
    def _d(self, p, closed, fm, err):
        runs, whole = self.visible_runs(p, closed)
        if whole and closed:
            return poly_d(A(p), fm, True, err)
        return ' '.join(poly_d(r, fm, False, err) for r in runs if len(r) > 1)

    def line(self, p, closed=False, err=0.45, occlude=False, detail=False):
        fm = self.dfm if detail else self.fm
        d = self._d(p, closed, fm, err)
        if d:
            self._emit(detail, d)
        if occlude:
            self.add_occ(p)
        return d

    def shape(self, outline, details=(), closed=True, occlude=True, occ_poly=None, err=0.45,
              derr=0.5, detail_outline=False, segs=()):
        """Outline (+ inner details) clipped by everything already drawn, then becomes an occluder."""
        fm = self.dfm if detail_outline else self.fm
        d = self._d(outline, closed, fm, err)
        if d:
            self._emit(detail_outline, d)
        parts = []
        for q in details:
            q = A(q)
            if len(q) < 2:
                continue
            dd = self._d(q, False, self.dfm, derr)
            if dd:
                parts.append(dd)
        if parts:
            self._emit(True, ' '.join(parts))
        if len(segs):
            self.segs(segs)
        if occlude:
            self.add_occ(outline if occ_poly is None else occ_poly)

    def details(self, lines, err=0.5):
        parts = []
        for q in lines:
            q = A(q)
            if len(q) < 2:
                continue
            dd = self._d(q, False, self.dfm, err)
            if dd:
                parts.append(dd)
        if parts:
            self._emit(True, ' '.join(parts))

    def segs(self, segs):
        """Straight detail segments (hatching) clipped by occluders, emitted compactly."""
        out = []
        fm = self.dfm
        for a, b in segs:
            seg = resample([a, b], 0.9)
            if self.occ:
                hid = self.hidden(seg)
                runs, cur = [], []
                for q, h in zip(seg, hid):
                    if h:
                        if len(cur) > 1:
                            runs.append(cur)
                        cur = []
                    else:
                        cur.append(q)
                if len(cur) > 1:
                    runs.append(cur)
            else:
                runs = [list(seg)]
            for r in runs:
                if length(r) >= 2.0:
                    out.append(f'M {fm.pt(r[0])} L {fm.pt(r[-1])}')
        if out:
            self._emit(True, ' '.join(out))

    def occ_only(self, poly):
        self.add_occ(poly)


# =============================================================================================
# hatching
# =============================================================================================


def clip_lines(poly, ang, spacing, phase=0.0, keep=None, inset=1.5):
    """Parallel lines at angle ang (deg, 0 = vertical) clipped to closed polygon.
    keep(x, y) -> bool restricts hatching to part of the shape."""
    p = A(poly)
    a = math.radians(ang)
    d = np.array([math.sin(a), -math.cos(a)])  # line direction
    nrm = np.array([d[1], -d[0]])
    proj_n = p @ nrm
    proj_d = p @ d
    segs = []
    q = np.roll(p, -1, axis=0)
    c0 = math.floor((proj_n.min()) / spacing) * spacing + phase
    c = c0
    while c <= proj_n.max():
        # intersections of line {x: x.nrm = c}
        pa = proj_n - c
        pb = q @ nrm - c
        m = (pa * pb) < 0
        if m.any():
            t = pa[m] / (pa[m] - pb[m])
            pts = p[m] + (q[m] - p[m]) * t[:, None]
            s = np.sort(pts @ d)
            for i in range(0, len(s) - 1, 2):
                s0, s1 = s[i] + inset, s[i + 1] - inset
                if s1 - s0 < 2:
                    continue
                A0 = nrm * c + d * s0
                A1 = nrm * c + d * s1
                if keep is None:
                    segs.append((A0, A1))
                else:
                    # split by predicate
                    n = max(2, int((s1 - s0) / 1.0))
                    ts = np.linspace(0, 1, n)
                    ptsl = A0[None] + (A1 - A0)[None] * ts[:, None]
                    ok = np.array([keep(x, y) for x, y in ptsl])
                    start = None
                    for i2, o in enumerate(ok):
                        if o and start is None:
                            start = i2
                        if (not o or i2 == n - 1) and start is not None:
                            end = i2 if o else i2 - 1
                            if end - start >= 2:
                                segs.append((ptsl[start], ptsl[end]))
                            start = None
        c += spacing
    return segs


# =============================================================================================
# parametric plant parts (local coordinates: base at origin, pointing up = -y)
# =============================================================================================


def leaf_shape(L, W, a=0.8, b=1.0, bend=0.0, serr=0.0, nserr=0, n=60, tip=1.0, asym=0.0, back=False):
    """Leaf outline + midrib. Width profile t^a (1-t)^b normalised to W (half width).
    bend: lateral curvature (fraction of L). serr: serration depth (fraction of W)."""
    t = np.linspace(0, 1, n)
    prof = (t ** a) * ((1 - t * tip) ** b)
    prof = prof / prof.max() * W
    if serr > 0 and nserr > 0:
        saw = (nserr * t) % 1.0
        if back:
            saw = 1 - saw
        prof = prof * (1 - serr * (1 - saw) * np.clip(t * 6, 0, 1) * np.clip((1 - t) * 8, 0, 1))
    mx = bend * L * (t ** 2) * 1.0
    my = -L * t
    mid = np.stack([mx, my], 1)
    tg = np.gradient(mid, axis=0)
    tg /= np.maximum(np.linalg.norm(tg, axis=1, keepdims=True), 1e-9)
    nr = np.stack([-tg[:, 1], tg[:, 0]], 1)
    left = mid - nr * (prof * (1 + asym))[:, None]
    right = mid + nr * (prof * (1 - asym))[:, None]
    outline = np.vstack([left, right[::-1][1:]])
    return {'outline': outline, 'mid': mid, 'prof': prof, 'nr': nr, 't': t, 'left': left, 'right': right}


def leaf_veins(lf, k=6, reach=0.82, rise=0.13, t0=0.12, t1=0.82, both=True, curve=0.35):
    """Lateral veins from midrib to near the edge, curving toward the tip."""
    mid, prof, nr, t = lf['mid'], lf['prof'], lf['nr'], lf['t']
    n = len(t)
    out = []
    for i in range(k):
        tt = t0 + (t1 - t0) * (i / max(1, k - 1))
        for side in ([-1, 1] if both else [-1]):
            te = min(0.98, tt + rise)
            i0 = int(tt * (n - 1))
            i1 = int(te * (n - 1))
            p0 = mid[i0]
            p1 = mid[i1] + side * nr[i1] * prof[i1] * reach
            ctrl = mid[i0] + side * nr[i0] * prof[i0] * reach * curve + (mid[i1] - mid[i0]) * 0.2
            pts = bezpts(p0, ctrl, (ctrl + p1) / 2 + (mid[i1] - mid[i0]) * 0.15, p1, 16)
            out.append(pts)
    return out


def petal_shape(L, W, a=0.6, b=0.6, top=0.85, cap=0.18, notch=0.0, ruffle=0.0, nruf=3, tipPoint=0.0,
                n=50, seed=0):
    """Petal: sides follow t^a(1-t*top)^b up to length L, closed by a cap curve that can be round,
    pointed (tipPoint), notched or ruffled."""
    t = np.linspace(0, 1, n)
    prof = (t ** a) * ((1 - t * top) ** b)
    prof = prof / prof.max() * W
    wend = prof[-1]
    left = np.stack([-prof, -L * t], 1)
    right = np.stack([prof, -L * t], 1)
    u = np.linspace(-1, 1, 41)
    rng = random.Random(seed)
    ph = rng.random() * 6.28
    yy = -L - cap * L * (1 - u * u) - tipPoint * L * np.clip(1 - np.abs(u) * 3, 0, 1) ** 1.5
    yy += notch * L * np.exp(-(u / 0.16) ** 2)
    if ruffle:
        yy += ruffle * L * np.sin(u * math.pi * nruf + ph) * (1 - u * u)
    capc = np.stack([u * wend, yy], 1)
    outline = np.vstack([left, capc[1:-1], right[::-1]])
    return {'outline': outline, 'prof': prof, 'L': L, 'W': W}


def rng(seed):
    return random.Random(seed)


# =============================================================================================
# composite motifs
# =============================================================================================


def draw_leaf(fig, x, y, ang, L, W, veins=5, s=1.0, flip=False, mid=True, vein_kw=None, occlude=True,
              **kw):
    lf = leaf_shape(L, W, **kw)
    det = []
    if mid:
        det.append(place(lf['mid'][: int(len(lf['mid']) * 0.93)], x, y, ang, s, flip=flip))
    if veins:
        for v in leaf_veins(lf, veins, **(vein_kw or {})):
            det.append(place(v, x, y, ang, s, flip=flip))
    out = place(lf['outline'], x, y, ang, s, flip=flip)
    fig.shape(out, det, occlude=occlude)
    return out


def write_ts(templates):
    lines = [
        '// Template art: botanical & floral. Original line art authored in this repo (see docs/TEMPLATES.md).',
        '// generated by scripts/templategen/botanical.py — edit the generator, then run',
        '// `python3 scripts/templategen/botanical.py && node scripts/export-templates.ts`.',
        "import type { Template } from '../templates.ts';",
        '',
        'export const botanical: Template[] = [',
    ]

    def js(s):
        return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"

    for t in templates:
        lines.append('  {')
        lines.append(f"    id: {js(t['id'])},")
        lines.append(f"    name: {js(t['name'])},")
        lines.append("    category: 'flowers',")
        lines.append(f"    level: {js(t['level'])},")
        lines.append('    tags: [' + ', '.join(js(x) for x in t['tags']) + '],')
        lines.append("    viewBox: '0 0 400 400',")
        if 'strokeWidth' in t:
            lines.append(f"    strokeWidth: {t['strokeWidth']},")
        if 'detailWidth' in t:
            lines.append(f"    detailWidth: {t['detailWidth']},")
        lines.append('    paths: [')
        for d in t['paths']:
            lines.append(f'      {js(d)},')
        lines.append('    ],')
        if t.get('detail'):
            lines.append('    detail: [')
            for d in t['detail']:
                lines.append(f'      {js(d)},')
            lines.append('    ],')
        lines.append('  },')
    lines.append('];')
    lines.append('')
    OUT.write_text('\n'.join(lines))


def check_bounds(t):
    import re
    for d in t['paths'] + t.get('detail', []):
        nums = [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?', d)]
        assert all(-4 <= v <= 404 for v in nums), (t['id'], min(nums), max(nums))


TEMPLATES = []


def template(id, name, level, tags, **extra):
    def deco(fn):
        TEMPLATES.append((id, name, level, tags, extra, fn))
        return fn
    return deco


# =============================================================================================
# TEMPLATES
# =============================================================================================

# ---------------------------------------------------------------------------------------------
# beginner
# ---------------------------------------------------------------------------------------------


def tulip_bloom(fig, x, y, ang, s=1.0, crease=True):
    L = A([(0, 0), (-22, -12), (-33, -44), (-25, -76), (2, -100)])
    R = A([(2, -100), (25, -76), (33, -44), (22, -12), (0, 0)])
    front = np.vstack([catmull(L), catmull(R)[1:]])
    det = []
    if crease:
        det.append(catmull([(0, -10), (-3, -40), (-2, -70)]))
    fig.shape(place(front, x, y, ang, s), [place(d, x, y, ang, s) for d in det])
    left = np.vstack([catmull([(-2, -2), (-30, -16), (-42, -50), (-38, -80), (-30, -96)]),
                      catmull([(-30, -96), (-16, -80), (-6, -50), (-2, -2)])[1:]])
    right = place(left, flip=True)
    fig.shape(place(left, x, y, ang, s))
    fig.shape(place(right, x, y, ang, s))


@template('bot-tulip-pair', 'Tulip pair', 'beginner', ['botanical', 'stylized', 'tulip', 'spring', 'easter', 'love', 'card'])
def t_tulip_pair(fig):
    tulip_bloom(fig, 150, 168, -12, 1.12)
    tulip_bloom(fig, 262, 140, 10, 1.05)
    lf = leaf_shape(190, 26, a=0.6, b=1.1, bend=-0.22)
    fig.shape(place(lf['outline'], 200, 372, -32), [place(lf['mid'][5:52], 200, 372, -32)])
    lf2 = leaf_shape(170, 24, a=0.6, b=1.1, bend=0.25)
    fig.shape(place(lf2['outline'], 204, 372, 30), [place(lf2['mid'][5:52], 204, 372, 30)])
    fig.line(catmull([(198, 372), (190, 300), (168, 230), (152, 168)]))
    fig.line(catmull([(206, 372), (220, 290), (246, 210), (262, 140)]))
    fig.line([(120, 374), (280, 374)])


def stem_dir(stem, i):
    n = len(stem)
    tg = stem[min(n - 1, i + 3)] - stem[max(0, i - 3)]
    return math.degrees(math.atan2(tg[0], -tg[1]))


@template('bot-leaf-sprig', 'Bay leaf sprig', 'beginner', ['botanical', 'stylized', 'leaf', 'sprig', 'minimal', 'journal'])
def t_leaf_sprig(fig):
    stem = resample(catmull([(84, 366), (128, 300), (184, 222), (246, 140), (300, 74)], n=20), 1.0)
    n = len(stem)
    tip = stem[-1]
    lt = leaf_shape(84, 20, a=0.75, b=1.1, bend=0.05)
    a0 = stem_dir(stem, n - 1)
    fig.shape(place(lt['outline'], tip[0], tip[1], a0), [place(lt['mid'][4:54], tip[0], tip[1], a0)])
    spots = [0.9, 0.78, 0.64, 0.5, 0.36, 0.22]
    for k, u in enumerate(spots):
        i = int(u * (n - 1))
        p = stem[i]
        side = -1 if k % 2 == 0 else 1
        a = stem_dir(stem, i) + side * 46
        Ls = 92 - 2 * k
        lf = leaf_shape(Ls, 21, a=0.75, b=1.1, bend=-0.07 * side)
        q = pol(p[0], p[1], 9, a)
        fig.shape(place(lf['outline'], q[0], q[1], a), [place(lf['mid'][3:54], q[0], q[1], a)])
        fig.line([p, q])
    fig.line(stem)


@template('bot-sunflower', 'Sunflower', 'beginner', ['botanical', 'stylized', 'sunflower', 'summer', 'birthday', 'thanks', 'card'])
def t_sunflower(fig):
    cx, cy = 200, 142
    fig.shape(circ(cx, cy, 25), [])
    fig.shape(circ(cx, cy, 43), [])
    for i in range(16):
        ang = i * 22.5
        bx, by = pol(cx, cy, 39, ang)
        pt = petal_shape(70, 15, a=0.55, b=0.9, top=1.0, cap=0.0)
        fig.shape(place(pt['outline'], bx, by, ang))
    for i in range(16):
        ang = i * 22.5 + 11.25
        bx, by = pol(cx, cy, 39, ang)
        pt = petal_shape(62, 14, a=0.55, b=0.9, top=1.0, cap=0.0)
        fig.shape(place(pt['outline'], bx, by, ang))
    stem = resample(catmull([(200, 184), (204, 250), (198, 320), (201, 380)]), 1.0)
    for u, ang, flip in [(0.66, -128, False), (0.42, 126, True)]:
        i = int(u * (len(stem) - 1))
        p = stem[i]
        lf = leaf_shape(118, 36, a=0.38, b=1.25, bend=0.14)
        q = pol(p[0], p[1], 10, ang)
        fig.shape(place(lf['outline'], q[0], q[1], ang, flip=flip),
                  [place(lf['mid'][3:54], q[0], q[1], ang, flip=flip)])
        fig.line([p, q])
    fig.line(stem)


def box(pts):
    pts = A(pts)
    parts = [resample([pts[i], pts[(i + 1) % len(pts)]], 3) for i in range(len(pts))]
    return np.vstack([parts[0]] + [q[1:] for q in parts[1:]])


def rosette(fig, cx, cy, tiers, tilt=34, crease=False, leaf_kw=None):
    """Succulent rosette: leaves around a vertical axis, projected with the camera tilted down,
    drawn nearest first so the painter's pass hides what is behind."""
    t = math.radians(tilt)
    items = []
    for (n, e, L, W, off) in tiers:
        for i in range(n):
            ph = math.radians(off + 360 * i / n)
            el = math.radians(e)
            X, Y, Z = math.cos(el) * math.sin(ph), math.sin(el), math.cos(el) * math.cos(ph)
            dx, dy = X * L, -Y * L * math.cos(t) + Z * L * math.sin(t)
            depth = Z * math.cos(t) + Y * math.sin(t)
            items.append((depth * L, dx, dy, L, W))
    items.sort(key=lambda r: -r[0])
    kw = dict(a=0.6, b=0.85, top=1.0, cap=0.0)
    kw.update(leaf_kw or {})
    for depth, dx, dy, L, W in items:
        pl = max(math.hypot(dx, dy), 0.42 * L)
        ang = math.degrees(math.atan2(dx, -dy))
        pt = petal_shape(pl, W, **kw)
        det = [place(A([(0, -pl * 0.12), (0, -pl * 0.62)]), cx, cy, ang)] if crease else []
        fig.shape(place(pt['outline'], cx, cy, ang), det)


@template('bot-succulent', 'Potted succulent', 'beginner', ['botanical', 'stylized', 'succulent', 'plant', 'home', 'cute'])
def t_succulent(fig):
    rosette(fig, 200, 196, [(9, 6, 118, 26, 20), (7, 34, 96, 25, 0), (5, 60, 66, 20, 36), (3, 82, 38, 13, 0)])
    fig.shape(box([(110, 228), (290, 228), (290, 262), (110, 262)]))
    body = np.vstack([resample([(122, 262), (278, 262)], 3), catmull([(278, 262), (268, 316), (254, 370)])[1:],
                      resample([(254, 370), (146, 370)], 3)[1:], catmull([(146, 370), (132, 316), (122, 262)])[1:]])
    fig.shape(body)
# ---------------------------------------------------------------------------------------------
# shared motifs: rose, compound leaf, bud, ribbon bow
# ---------------------------------------------------------------------------------------------


def rot_about(p, deg, cx, cy):
    p = A(p)
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    q = p - [cx, cy]
    return np.stack([cx + q[:, 0] * c - q[:, 1] * s, cy + q[:, 0] * s + q[:, 1] * c], 1)


def rose_head(fig, cx, cy, R, seed=1, sy=0.8, rot=0.0, curls=0.5, rings=None, spiral_turns=2.2, ruffle=0.0,
              nruf=3, streaks=0, wmul=1.35, swirl=True, tipv=0.03):
    """Rose seen from above-front: a centre swirl and rings of cupped petals, inner petals in front."""
    r = rng(seed)

    def P(q):
        q = A(q).copy()
        q[:, 1] = cy + (q[:, 1] - cy) * sy
        return rot_about(q, rot, cx, cy) if rot else q

    if rings is None:
        k = int(np.clip(round(R / 12.5), 3, 5))
        rings = [(3 + j, 0.22 + 0.78 * (j / (k - 1)) ** 1.1, (j * 37) % 72) for j in range(k)]
        if R >= 90:
            rings = [(3, 0.22, 0), (4, 0.38, 40), (5, 0.58, 12), (6, 0.8, 48), (7, 1.0, 20)]
    # centre swirl (front-most)
    turns = min(spiral_turns, max(0.85, R / 42))
    th = np.linspace(0.6, turns * 2 * math.pi, 160)
    rr = R * (0.03 + 0.13 * th / th[-1]) if R >= 60 else R * (0.05 + 0.12 * th / th[-1])
    sw = np.stack([cx + rr * np.sin(th), cy - rr * np.cos(th)], 1)
    if swirl:
        fig.line(P(sw))
        fig.add_occ(P(circ(cx, cy, R * 0.15)))
    for k, (n, rf, off) in enumerate(rings):
        for i in range(n):
            ang = off + 360 * i / n + r.uniform(-9, 9)
            L = R * rf * r.uniform(0.93, 1.05)
            W = L * 0.8 * math.pi / n * wmul
            W = min(W, L * 0.95)
            ol = soft_petal(L, W, r, tip=tipv if k > 1 else 0.0)
            if ruffle and k > 0:
                fr = np.clip((-ol[:, 1] / L - 0.55) / 0.45, 0, 1)
                ph = r.uniform(0, 6.3)
                ol = ol.copy()
                ol[:, 1] -= ruffle * L * np.sin(ol[:, 0] / W * math.pi * nruf * 0.5 + ph) * fr
            det = []
            if streaks and k >= len(rings) - 2:
                for j in range(streaks):
                    xx = (j + 0.5) / streaks * 2 - 1
                    xx = xx * W * 0.55 + r.uniform(-2, 2)
                    y0, y1 = -L * r.uniform(0.5, 0.62), -L * r.uniform(0.74, 0.86)
                    det.append(P(place(A([(xx * 0.7, y0), (xx, y1)]), cx, cy, ang)))
            if k >= len(rings) - 3 and r.random() < curls:
                m = len(ol) // 2
                seg = ol[m - 22: m + r.randint(6, 16)]
                fac = np.linspace(1.0, 0.86, len(seg))[:, None]
                if r.random() < 0.5:
                    seg = ol[m - r.randint(6, 16): m + 22][::-1]
                    fac = np.linspace(1.0, 0.86, len(seg))[:, None]
                det.append(P(place(seg * fac, cx, cy, ang)))
            fig.shape(P(place(ol, cx, cy, ang)), det)


def soft_petal(L, W, r=None, tip=0.0, shoulder=0.86, n=10):
    """Smooth cupped petal (Catmull-Rom through jittered key points), base at origin, tip up."""
    j = (lambda: r.uniform(-0.04, 0.04)) if r else (lambda: 0.0)
    half = [(-0.45 * W, -0.12 * L), (-(0.95 + j()) * W, -0.5 * L), (-(0.8 + j()) * W, -(shoulder + j()) * L),
            (-0.42 * W, -(1.0 + j()) * L)]
    top = (0, -(1.03 + tip) * L)
    other = [(-x, y) for x, y in half[::-1]]
    if r:
        other = [(x * (1 + j()), y * (1 + j() * 0.5)) for x, y in other]
    pts = [(0, 0)] + half + [top] + other
    q = catmull(pts, closed=True, n=n)
    return q[:-1]


def rose_leaflet(L, W, serr=0.18, nserr=10, bend=0.04):
    return leaf_shape(L, W, a=0.6, b=1.0, bend=bend, serr=serr, nserr=nserr, n=120)


def compound_leaf(fig, x, y, ang, L=70, W=20, pairs=1, flip=False, veins=4, serr=0.18, rach=None, s=1.0,
                  hatch=None):
    """Rose-type compound leaf: terminal leaflet + opposite pairs on a rachis."""
    rach = rach or L * 0.55 * (pairs + 0.6)
    det_all = []
    tip = pol(0, 0, rach, 0)
    lf = rose_leaflet(L, W, serr)
    items = [(tip, 0.0, 1.0)]
    for k in range(pairs):
        q = pol(0, 0, rach * (0.78 - k * 0.42), 0)
        sc = 0.86 - 0.12 * k
        items += [(q, -58, sc), (q, 58, sc)]
    for (q, a, sc) in items:
        ol = place(lf['outline'], q[0], q[1], a, sc)
        det = [place(lf['mid'][4:110], q[0], q[1], a, sc)]
        for v in leaf_veins(lf, veins, reach=0.75, rise=0.14, t0=0.15, t1=0.75):
            det.append(place(v, q[0], q[1], a, sc))
        fig.shape(place(ol, x, y, ang, s, flip=flip), [place(d, x, y, ang, s, flip=flip) for d in det])
    fig.line(place(A([(0, 0), tip]), x, y, ang, s, flip=flip))


def bud(fig, x, y, ang, s=1.0, sepals=True):
    """Closed rose bud with sepals clasping it and a small hip below."""
    body = np.vstack([catmull([(0, 0), (-14, -10), (-15, -32), (-6, -52), (1, -60)]),
                      catmull([(1, -60), (9, -48), (15, -30), (13, -10), (0, 0)])[1:]])
    swirl = catmull([(-7, -46), (2, -39), (6, -22)])
    hip = catmull([(-8, 0), (-7, 9), (0, 13), (7, 9), (8, 0)])
    fig.shape(place(np.vstack([hip, catmull([(8, 0), (0, -3), (-8, 0)])[1:]]), x, y, ang, s))
    fig.shape(place(body, x, y, ang, s), [place(swirl, x, y, ang, s)])
    if sepals:
        for sx, L, aa in ((-1, 50, 14), (1, 48, 12)):
            lf = leaf_shape(L, 5.5, a=0.45, b=1.1, bend=0.3 * sx)
            fig.shape(place(lf['outline'], x, y, ang + sx * aa, s))


# ---------------------------------------------------------------------------------------------
# intermediate
# ---------------------------------------------------------------------------------------------


def thorn(stem, u, side, size=8):
    stem = A(stem)
    i = int(u * (len(stem) - 1))
    p = stem[i]
    t = _unit(stem[min(len(stem) - 1, i + 2)] - stem[max(0, i - 2)])
    nrm = np.array([-t[1], t[0]]) * side
    return A([p - t * size * 0.6, p + nrm * size + t * size * 0.5, p + t * size * 0.5])


@template('bot-rose', 'Garden rose', 'intermediate', ['botanical', 'realistic', 'rose', 'love', 'wedding', 'valentine', 'card'])
def t_rose(fig):
    rose_head(fig, 204, 128, 104, seed=3, sy=0.78, rot=-6)
    bud(fig, 98, 200, -34, 1.1)
    stem = resample(catmull([(204, 196), (208, 262), (198, 322), (204, 386)]), 1.0)
    side = resample(catmull([(98, 198), (118, 246), (156, 284), (204, 300)]), 1.0)
    compound_leaf(fig, 207, 242, 58, L=60, W=18, pairs=1)
    compound_leaf(fig, 201, 334, -100, L=50, W=16, pairs=1)
    fig.line(stem)
    fig.line(side)
    fig.details([thorn(stem, 0.5, 1), thorn(stem, 0.85, -1), thorn(side, 0.55, -1, 6)])


# ---- raster boolean helper: union/subtract polygons, then trace smooth outlines ---------------

from skimage.draw import polygon as _skpoly  # noqa: E402
from skimage.measure import find_contours  # noqa: E402


class Mask:
    def __init__(self, x0=0, y0=0, x1=400, y1=400, res=4):
        self.x0, self.y0, self.res = x0, y0, res
        self.m = np.zeros((int((y1 - y0) * res) + 2, int((x1 - x0) * res) + 2), bool)

    def add(self, poly, val=True):
        p = A(poly)
        rr, cc = _skpoly((p[:, 1] - self.y0) * self.res, (p[:, 0] - self.x0) * self.res, self.m.shape)
        self.m[rr, cc] = val
        return self

    def sub(self, poly):
        return self.add(poly, False)

    def contours(self, smooth=4, minlen=8, blur=0.0):
        out = []
        pad = np.pad(self.m, 1).astype(float)
        if blur:
            from scipy.ndimage import gaussian_filter
            pad = gaussian_filter(pad, blur * self.res)
        for c in find_contours(pad, 0.5):
            pts = np.stack([c[:, 1] - 1, c[:, 0] - 1], 1) / self.res + [self.x0, self.y0]
            pts = pts[:-1]
            if len(pts) < 8:
                continue
            if smooth:
                k = 2 * smooth + 1
                ext = np.vstack([pts[-smooth:], pts, pts[:smooth]])
                ker = np.ones(k) / k
                pts = np.stack([np.convolve(ext[:, 0], ker, 'valid'), np.convolve(ext[:, 1], ker, 'valid')], 1)
            pts = resample(np.vstack([pts, pts[:1]]), 1.0)[:-1]
            if length(pts) >= minlen:
                out.append(pts)
        out.sort(key=lambda q: -length(q))
        return out


def band(center, w0, w1=None, notch=0.0, step=1.2):
    """Closed band polygon around a centre line (stems, ribbon tails). notch > 0 cuts a V into the end."""
    w1 = w0 if w1 is None else w1
    c = resample(center, step)
    w = np.linspace(w0, w1, len(c)) / 2
    left = offset_curve(c, w)
    right = offset_curve(c, -w)
    end = []
    if notch:
        t = _unit(c[-1] - c[-2])
        end = [c[-1] - t * notch]
    return np.vstack([left, A(end).reshape(-1, 2), right[::-1]])


def bow(fig, x, y, s=1.0, ang=0.0, tails=((-24, 70), (20, 66)), loop=1.0, folds=True):
    """Ribbon bow: knot, two loops with inner folds, two tails with V-cut ends."""
    def P(q):
        return place(q, x, y, ang, s)
    knot = catmull([(-8, -8), (8, -9), (10, 0), (7, 9), (-7, 9), (-10, 0)], closed=True)
    fig.shape(P(knot), [P(A([(-3, -6), (-2, 6)])), P(A([(3, -6), (4, 6)]))])
    for sx in (-1, 1):
        lp = catmull([(sx * 9, -6), (sx * 30 * loop, -26 * loop), (sx * 56 * loop, -30 * loop),
                      (sx * 64 * loop, -10 * loop), (sx * 52 * loop, 12 * loop), (sx * 28 * loop, 12 * loop),
                      (sx * 9, 5)], closed=False, n=14)
        lp = np.vstack([lp, lp[:1]])
        det = [catmull([(sx * 12, -2), (sx * 30 * loop, -12 * loop), (sx * 46 * loop, -12 * loop)])] if folds else []
        fig.shape(P(lp), [P(d) for d in det])
    for (dx, L) in tails:
        sx = 1 if dx > 0 else -1
        c = catmull([(sx * 4, 7), (dx * 0.5, L * 0.4), (dx * 0.8 + sx * 6, L * 0.75), (dx + sx * 4, L)])
        fig.shape(P(band(c, 12, 15, notch=7)))


def twine_wrap(fig, cx, cy, w, h=16, turns=3):
    """Twine wrapped around a bundle: a few slightly slanted bands."""
    for i in range(turns):
        yy = cy - h / 2 + i * (h / max(1, turns - 1)) if turns > 1 else cy
        fig.line(catmull([(cx - w / 2, yy + 3), (cx, yy - 1), (cx + w / 2, yy - 3)]))


# ---- lavender ---------------------------------------------------------------------------------


def petal_raw(fig, bx, by, ang, L, W, round_=0.5, prec=0, occlude=True, detail=False):
    """Two-segment almond (cheap closed bud/grain), emitted directly; also registers as occluder."""
    fm = Fmt(prec)
    a = math.radians(ang)
    ux, uy = math.sin(a), -math.cos(a)
    px, py = -uy, ux

    def at(t, s_):
        return (bx + ux * L * t + px * s_, by + uy * L * t + py * s_)
    t1, t2 = 0.15 + 0.3 * round_, 0.55 + 0.35 * round_
    P0, P1, P2, P3 = at(0, 0), at(t1, W * 1.3), at(t2, W * 1.3), at(1, 0)
    Q1, Q2 = at(t2, -W * 1.3), at(t1, -W * 1.3)
    d = (f'M {fm.pt(P0)} C {fm.pt(P1)} {fm.pt(P2)} {fm.pt(P3)} C {fm.pt(Q1)} {fm.pt(Q2)} {fm.pt(P0)} Z')
    hid = fig.hidden(A([P0, P3, at(0.5, 0)])) if fig.occ else np.zeros(3, bool)
    if not hid.any():
        fig._emit(detail, d)
        if occlude:
            fig.add_occ(np.vstack([bezpts(P0, P1, P2, P3, 12), bezpts(P3, Q1, Q2, P0, 12)[1:]]))
    return d


@template('bot-lavender', 'Lavender bundle', 'intermediate',
          ['botanical', 'stylized', 'lavender', 'herb', 'summer', 'thanks', 'gift', 'journal'],
          strokeWidth=3.5, detailWidth=2)
def t_lavender(fig):
    r = rng(11)
    tie = (200, 296)
    tops = [(104, 62), (150, 40), (200, 28), (252, 42), (298, 66)]
    bow(fig, tie[0], tie[1] + 2, 0.85, tails=((-30, 62), (26, 58)))
    stems = []
    for k, (tx, ty) in enumerate(tops):
        bx = tie[0] + (k - 2) * 3
        bot = (tie[0] + (k - 2) * 11 + r.uniform(-2, 2), 384 - abs(k - 2) * 4)
        mid = ((tx + bx) / 2 + (tx - bx) * 0.12, (ty + tie[1]) / 2 + 8)
        stems.append(resample(catmull([bot, (bx, tie[1]), mid, (tx, ty)]), 1.0))
    for k, st in enumerate(stems):
        n = len(st)
        fig.group()
        top = n - 1
        petal_raw(fig, st[top][0], st[top][1], stem_dir(st, top), 11, 3.3, detail=True)
        gaps = [6, 6, 7, 7, 8, 8, 9, 11, 14, 17]
        pos = top - 3
        for j, g in enumerate(gaps):
            pos -= g
            q = st[pos]
            d = stem_dir(st, pos)
            sz = 1.0 if j < 8 else 0.85
            for side in (-1, 1):
                b = pol(q[0], q[1], 1.2, d + side * 90)
                petal_raw(fig, b[0], b[1], d + side * (34 + r.uniform(-5, 5)), 12 * sz, 3.4 * sz, detail=True)
            if j < 6 and r.random() < 0.5:
                petal_raw(fig, q[0], q[1], d + r.uniform(-6, 6), 8, 2.8, detail=True)
        fig.end_group()
    for st in stems:
        fig.line(st)


# ---- eucalyptus -------------------------------------------------------------------------------


def coin_leaf(fig, x, y, ang, L, W, r, veins=2):
    lf = leaf_shape(L, W, a=0.5, b=0.55, bend=r.uniform(-0.06, 0.06), n=50)
    det = [place(lf['mid'][2:46], x, y, ang)]
    for v in leaf_veins(lf, veins, reach=0.7, rise=0.18, t0=0.25, t1=0.6):
        det.append(place(v, x, y, ang))
    fig.shape(place(lf['outline'], x, y, ang), det)


def leafy_branch(fig, stem, r, spacing=28, L0=50, W0=24, shrink=0.55, stalk=6, start=0.06, veins=2, alt=48):
    n = len(stem)
    i = n - 1
    tip = stem[-1]
    coin_leaf(fig, *pol(tip[0], tip[1], 2, stem_dir(stem, n - 1)), stem_dir(stem, n - 1), L0 * shrink, W0 * shrink, r, 1)
    side = 1
    k = 0
    pos = n - 1 - int(spacing * 0.6)
    while pos > n * start:
        u = pos / (n - 1)
        sc = shrink + (1 - shrink) * (1 - u)
        q = stem[pos]
        a = stem_dir(stem, pos) + side * (alt + r.uniform(-8, 8))
        b = pol(q[0], q[1], stalk, a)
        coin_leaf(fig, b[0], b[1], a, L0 * sc * r.uniform(0.92, 1.05), W0 * sc, r, veins)
        fig.line([q, b])
        side = -side
        k += 1
        pos -= int(spacing * (0.7 + 0.5 * sc))


@template('bot-eucalyptus', 'Eucalyptus branch', 'intermediate',
          ['botanical', 'stylized', 'eucalyptus', 'leaf', 'branch', 'wedding', 'minimal', 'journal'])
def t_eucalyptus(fig):
    r = rng(5)
    main = resample(catmull([(118, 392), (150, 320), (196, 230), (236, 140), (268, 84), (300, 46)]), 1.0)
    side = resample(catmull([(170, 272), (126, 220), (98, 160), (90, 104)]), 1.0)
    leafy_branch(fig, side, r, spacing=30, L0=48, W0=23)
    leafy_branch(fig, main, r, spacing=31, L0=56, W0=27, start=0.12)
    fig.line(main)
    fig.line(side)


# ---- monstera ---------------------------------------------------------------------------------


@template('bot-monstera', 'Monstera leaf', 'intermediate',
          ['botanical', 'stylized', 'monstera', 'leaf', 'tropical', 'plant', 'home', 'journal'])
def t_monstera(fig):
    r = rng(21)
    L = 284
    half = [(0, 0), (12, 20), (48, 36), (92, 30), (122, 2), (136, -56), (132, -128), (110, -194), (70, -246),
            (30, -276), (0, -L)]
    right = resample(catmull(half, n=16), 1.0)
    left = right.copy()
    left[:, 0] = -left[:, 0] * 0.96
    left[:, 1] = left[:, 1] * 1.0
    # edge polyline from sinus to tip for each side
    blade = np.vstack([right, left[::-1][1:]])
    X, Y, ANG, SC = 164, 272, 32, 0.88

    def P(q):
        return place(q, X, Y, ANG, SC)

    m = Mask(0, -4, 400, 404)
    m.add(P(blade))
    veins, slits, holes = [], [], []
    for side, edge in ((1, right), (-1, left)):
        ne = len(edge)
        cum = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(edge, axis=0), axis=1))])
        tot = cum[-1]
        vs = []
        nv = 8
        for k in range(nv):
            f = 0.1 + k * 0.105
            ei = int(np.searchsorted(cum, f * tot))
            E = edge[min(ei, ne - 1)]
            ys = -14 - k * 30
            S = np.array([0.0, ys])
            C1 = np.array([E[0] * 0.25, ys - 20 - k * 2])
            C2 = np.array([E[0] * 0.7, (ys + E[1]) / 2 - 6])
            vs.append(bezpts(S, C1, C2, E * 1.0, 60))
        for k in range(nv):
            veins.append(vs[k][2:56])
        for k in range(nv - 1):
            a, b = vs[k], vs[k + 1]
            mid = (a + b) / 2
            sin_ = r.uniform(0.38, 0.55) if k < nv - 2 else 0.62
            i0 = int(sin_ * 59)
            cl = mid[i0:]
            ext = cl[-1] + _unit(cl[-1] - cl[-4]) * 14
            cl = np.vstack([cl, ext])
            w0 = 3.5 + 0.6 * k
            slits.append(band(cl, w0, w0 * 1.9))
            slits.append(circ(cl[0][0], cl[0][1], w0 / 2, n=20))
            if k < nv - 2 and sin_ > 0.4 and k > 0:
                h0, h1 = int(0.12 * 59), int((sin_ - 0.1) * 59)
                if h1 - h0 > 8:
                    hc = mid[h0:h1]
                    u = np.linspace(0, 1, len(hc))
                    hw = (2 + 3.5 * np.sin(np.pi * u) ** 0.8) * (0.8 + 0.06 * k)
                    holes.append(np.vstack([offset_curve(hc, hw), offset_curve(hc, -hw)[::-1]]))
    for q in slits + holes:
        m.sub(P(q))
    pet = catmull([(0, 6), (-4, 60), (-30, 116), (-74, 150)])
    fig.shape(P(band(pet, 8.5, 11.5)))
    cs = m.contours(smooth=3)
    for c in cs:
        fig.shape(c, occlude=False)
    # midrib as a slim tapered band, veins as single lines, all clipped by slits/holes
    for q in slits + holes:
        fig.add_occ(P(q))
    midrib = catmull([(0, 4), (0, -100), (2, -200), (0, -L + 12)])
    fig.details([P(v) for v in veins])
    fig.details([P(offset_curve(resample(midrib, 2), 2.6)[:-3]), P(offset_curve(resample(midrib, 2), -2.6)[:-3])])


# ---- dandelion clock --------------------------------------------------------------------------


def fib_sphere(n):
    pts = []
    ga = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        yv = 1 - 2 * (i + 0.5) / n
        rr = math.sqrt(1 - yv * yv)
        th = ga * i
        pts.append((math.cos(th) * rr, yv, math.sin(th) * rr))
    return pts


def pappus(cx, cy, dirdeg, L, spread=55, k=7, face=0.0):
    """Seed tuft: filaments fanning from (cx, cy) around direction dirdeg."""
    out = []
    if face > 0.75:
        for i in range(k + 2):
            a = dirdeg + 360 * i / (k + 2)
            out.append((A([(cx, cy)])[0], A([pol(cx, cy, L * 0.55, a)])[0]))
        return out
    for i in range(k):
        a = dirdeg - spread + 2 * spread * i / (k - 1)
        out.append((A([(cx, cy)])[0], A([pol(cx, cy, L * (0.85 + 0.15 * math.cos(math.radians(a - dirdeg))), a)])[0]))
    return out


@template('bot-dandelion', 'Dandelion clock', 'intermediate',
          ['botanical', 'whimsical', 'dandelion', 'wish', 'seeds', 'birthday', 'journal'], detailWidth=1.7)
def t_dandelion(fig):
    cx, cy, R = 186, 150, 92
    fig.shape(circ(cx, cy, 9))
    segs = []
    tufts = []
    for (X, Y, Z) in fib_sphere(64):
        if Z < -0.35:
            continue
        rho = math.hypot(X, Y)
        ang = math.degrees(math.atan2(X, Y))
        tipr = 11 + (R - 30) * rho
        tx, ty = pol(cx, cy, tipr, ang)
        b0 = pol(cx, cy, 10, ang)
        if rho > 0.12:
            segs.append((A([b0])[0], A([(tx, ty)])[0]))
        face = abs(Z) if Z > 0 else 0
        tufts += pappus(tx, ty, ang, 18 + 6 * rho, spread=46 + 30 * (1 - rho), k=5, face=face if rho < 0.3 else 0)
    fig.segs(segs + tufts)
    # drifting seeds
    for (x, y, a, s) in [(330, 66, 38, 1.0), (300, 160, 62, 0.85), (352, 214, 20, 0.75)]:
        base = A([pol(x, y, 30 * s, a + 180)])[0]
        achene = place(soft_petal(8, 2.4), base[0], base[1], a + 180, s)
        fig.shape(achene, detail_outline=True)
        fig.segs([(base, A([(x, y)])[0])] + pappus(x, y, a, 22 * s, spread=60, k=9))
    # stem and leaves
    stem = resample(catmull([(cx, cy + 9), (cx + 4, 230), (cx - 2, 310), (cx + 6, 388)]), 1.0)
    for (a, L, W, fl) in [(-62, 150, 21, False), (58, 138, 20, True), (-24, 104, 15, False)]:
        lf = leaf_shape(L, W * 1.1, a=0.9, b=0.7, serr=0.5, nserr=5, back=True, bend=0.1, n=200)
        fig.shape(place(lf['outline'], cx + 5, 386, a, flip=fl), [place(lf['mid'][8:180], cx + 5, 386, a, flip=fl)])
    fig.line(stem)
    fig.line(catmull([(cx - 2, cy + 8), (cx, cy + 16), (cx + 3, cy + 22)]))
# ---- sunflower seed head (phyllotaxis) --------------------------------------------------------

GOLDEN = 137.50776


@template('bot-sunflower-head', 'Sunflower seed head', 'intermediate',
          ['botanical', 'geometric', 'sunflower', 'fibonacci', 'summer', 'autumn', 'thanks', 'card'])
def t_sunflower_head(fig):
    r = rng(8)
    cx, cy, Rd = 200, 200, 80
    N = 560
    c = (Rd - 3) / math.sqrt(N)
    seeds = [pol(cx, cy, c * math.sqrt(i + 0.5), i * GOLDEN) for i in range(N)]
    rad = [c * math.sqrt(i + 0.5) for i in range(N)]
    lines = []
    for fam, rmin in ((21, 15), (34, 30)):
        for st in range(fam):
            idx = [i for i in range(st, N, fam) if rad[i] >= rmin]
            if len(idx) >= 3:
                lines.append(catmull([seeds[i] for i in idx], n=6))
    fig.shape(circ(cx, cy, Rd), lines + [circ(cx, cy, 11)])
    fig.add_occ(circ(cx, cy, Rd))
    for row, (n, L0, off) in enumerate(((21, 92, 0), (21, 100, 360 / 42))):
        for i in range(n):
            a = off + 360 * i / n + r.uniform(-3, 3)
            L = L0 * r.uniform(0.9, 1.04)
            lf = leaf_shape(L, 14 + r.uniform(-1, 1.5), a=0.55, b=0.95, bend=r.uniform(-0.12, 0.12), n=50)
            b = pol(cx, cy, Rd - 8, a)
            det = [place(lf['mid'][8:32], b[0], b[1], a)] if row == 0 else []
            fig.shape(place(lf['outline'], b[0], b[1], a), det)


# ---- cherry blossom ---------------------------------------------------------------------------


def notch_petal(L, W, r=None, notch=0.12):
    j = (lambda: r.uniform(-0.05, 0.05)) if r else (lambda: 0.0)
    left = [(0, 0), (-0.38 * W, -0.16 * L), (-(0.95 + j()) * W, -(0.55 + j()) * L), (-(0.82 + j()) * W, -0.88 * L),
            (-0.42 * W, -(1.0 + j()) * L), (0, -(1 - notch) * L)]
    right = [(0, -(1 - notch) * L), ((0.42 + j()) * W, -(1.0 + j()) * L), ((0.82 + j()) * W, -0.88 * L),
             ((0.95 + j()) * W, -0.55 * L), (0.38 * W, -0.16 * L), (0, 0)]
    return np.vstack([catmull(left, n=10), catmull(right, n=10)[1:]])


def blossom(fig, x, y, R, rot=0.0, sy=1.0, seed=1, stamens=11, veins=True):
    r = rng(seed)

    def P(q):
        q = A(q).copy()
        q[:, 1] = y + (q[:, 1] - y) * sy
        return rot_about(q, rot, x, y)
    det = []
    for k in range(stamens):
        a = 360 * k / stamens + r.uniform(-8, 8)
        L = R * r.uniform(0.38, 0.52)
        e = pol(x, y, L, a)
        det.append(P(catmull([pol(x, y, 4, a), pol(x, y, L * 0.6, a + r.uniform(-6, 6)), e], n=6)))
        det.append(P(circ(e[0], e[1], 1.7, n=10)))
    fig.shape(P(circ(x, y, 4.5)), det)
    for k in range(5):
        a = 72 * k + r.uniform(-5, 5)
        pt = notch_petal(R * r.uniform(0.92, 1.05), R * 0.36, r)
        pd = []
        if veins:
            for dv in (-0.18, 0, 0.18):
                pd.append(place(catmull([(0, -R * 0.12), (dv * R * 0.6, -R * 0.4), (dv * R, -R * 0.62)], n=6), x, y, a))
        fig.shape(P(place(pt, x, y, a)), [P(d) for d in pd])


def round_bud(fig, x, y, ang, s=1.0):
    body = catmull([(0, 0), (-9, -6), (-11, -18), (-5, -27), (0, -29), (5, -27), (11, -18), (9, -6)], closed=True)
    for sx in (-1, 1):
        lf = leaf_shape(16, 4, a=0.5, b=1.0, bend=0.2 * sx)
        fig.shape(place(lf['outline'], x, y, ang + sx * 30, s))
    fig.shape(place(body, x, y, ang, s), [place(catmull([(0, -4), (-2, -14), (0, -25)]), x, y, ang, s)])


def branch_outline(fig, bands, smooth=4):
    xs = np.vstack(bands)
    lo, hi = np.floor(xs.min(0)) - 4, np.ceil(xs.max(0)) + 4
    m = Mask(lo[0], lo[1], hi[0], hi[1])
    for b in bands:
        m.add(b)
    for c in m.contours(smooth=smooth):
        fig.shape(c)


@template('bot-cherry-blossom', 'Cherry blossom branch', 'intermediate',
          ['botanical', 'stylized', 'cherry', 'blossom', 'sakura', 'spring', 'wedding', 'love', 'card'])
def t_cherry(fig):
    r = rng(17)
    main = catmull([(22, 304), (100, 272), (180, 238), (262, 198), (326, 152), (366, 118)])
    tw1 = catmull([(172, 242), (190, 196), (194, 150), (186, 118)])
    tw2 = catmull([(262, 198), (282, 226), (310, 248), (334, 258)])
    tw3 = catmull([(96, 274), (90, 304), (100, 330)])
    flowers = [(186, 104, 48, 8, 1.0), (324, 150, 44, -16, 0.86), (122, 252, 42, 26, 1.0),
               (336, 262, 38, 0, 0.72), (102, 336, 34, -20, 0.9)]
    for k, (x, y, R, rot, sy) in enumerate(flowers):
        blossom(fig, x, y, R, rot, sy, seed=40 + k, stamens=9)
    for (x, y, a) in [(368, 116, 64), (240, 206, 20), (52, 290, -50)]:
        round_bud(fig, x, y, a, 1.0)
    for (x, y, a, L) in [(272, 186, 20, 40), (220, 222, 160, 34)]:
        lf = leaf_shape(L, 11, a=0.6, b=1.0, serr=0.15, nserr=8, n=80)
        fig.shape(place(lf['outline'], x, y, a), [place(lf['mid'][3:72], x, y, a)])
    bands = [band(main, 18, 5), band(tw1, 8, 4), band(tw2, 8, 4), band(tw3, 7, 4)]
    m2 = resample(main, 1.0)
    dashes = []
    for u in np.linspace(0.06, 0.72, 12):
        i = int(u * (len(m2) - 1))
        q = m2[i]
        t = _unit(m2[i + 2] - m2[i - 2])
        nrm = np.array([-t[1], t[0]])
        w = 18 - 13 * u
        o = r.uniform(-0.22, 0.22) * w
        dashes.append(A([q + nrm * o - t * w * 0.22, q + nrm * o + t * w * 0.22]))
    m = Mask(0, 0, 400, 400)
    for bd in bands:
        m.add(bd)
    for c in m.contours(smooth=3, blur=1.6):
        fig.shape(c)
    fig.details(dashes)


# ---- fern frond -------------------------------------------------------------------------------


def lobed_leaf(L, W, nl, depth=0.5, lean=0.35, bend=0.0, a=0.35, b=0.9, n=None, sharp=0.7):
    """Leaf/pinna whose edge is cut into nl rounded lobes per side (fern pinnules, oak-like)."""
    n = n or max(80, nl * 24)
    t = np.linspace(0, 1, n)
    env = (t ** a) * ((1 - t) ** b)
    env = env / env.max() * W
    ph = (t * nl + 0.25) % 1.0
    lobe = np.abs(np.sin(np.pi * ph)) ** sharp
    fade = np.clip((t - 0.8) / 0.2, 0, 1)
    lobe = lobe * (1 - fade) + fade
    prof = env * ((1 - depth) + depth * lobe)
    mid = np.stack([bend * L * t * t, -L * t], 1)
    tg = np.gradient(mid, axis=0)
    tg /= np.maximum(np.linalg.norm(tg, axis=1, keepdims=True), 1e-9)
    nr = np.stack([-tg[:, 1], tg[:, 0]], 1)
    fwd = (lean * prof * lobe)[:, None] * tg
    left = mid - nr * prof[:, None] + fwd
    right = mid + nr * prof[:, None] + fwd
    return {'outline': np.vstack([left, right[::-1][1:]]), 'mid': mid}


@template('bot-fern', 'Fern frond', 'intermediate',
          ['botanical', 'realistic', 'fern', 'leaf', 'woodland', 'journal'])
def t_fern(fig):
    r = rng(4)
    rach = resample(catmull([(176, 394), (184, 300), (204, 200), (214, 120), (210, 50)]), 1.0)
    n = len(rach)
    tip = rach[-1]
    lt = lobed_leaf(34, 7, 3, depth=0.45)
    fig.shape(place(lt['outline'], tip[0], tip[1], stem_dir(rach, n - 1)),
              [place(lt['mid'][2:70], tip[0], tip[1], stem_dir(rach, n - 1))])
    u = 0.955
    side = 1
    while u > 0.16:
        i = int(u * (n - 1))
        q = rach[i]
        env = math.sin(math.pi * min(1.0, (1 - u) * 1.08 + 0.05)) ** 0.7
        L = 30 + 106 * env
        W = 9 + 10 * env
        nl = max(3, int(L / 17))
        a = stem_dir(rach, i) + side * (54 + 20 * (1 - u))
        lf = lobed_leaf(L, W, nl, depth=0.6, lean=0.45, bend=-0.14 * side, sharp=0.6)
        fig.shape(place(lf['outline'], q[0], q[1], a), [place(lf['mid'][3:-12], q[0], q[1], a)])
        side = -side
        u -= 0.03 + 0.03 * env
    fig.line(rach)


# ---------------------------------------------------------------------------------------------
# advanced motifs
# ---------------------------------------------------------------------------------------------


def hatch_half(lf, x, y, ang, s=1.0, flip=False, spacing=3.6, hang=38, side='right'):
    """Hatch lines filling one half of a leaf (between midrib and edge), as shading."""
    half = np.vstack([lf[side], lf['mid'][::-1]])
    hw = place(half, x, y, ang, s, flip=flip)
    return clip_lines(hw, ang + (hang if side == 'right' else -hang) * (-1 if flip else 1), spacing, inset=2.2)


def leaf_adv(fig, x, y, ang, L, W, veins=6, hatch=True, flip=False, s=1.0, spacing=3.8, vein_kw=None,
             side='right', **kw):
    kw.setdefault('n', 100)
    lf = leaf_shape(L, W, **kw)
    det = [place(lf['mid'][2:int(len(lf['mid']) * 0.94)], x, y, ang, s, flip=flip)]
    for v in leaf_veins(lf, veins, **(vein_kw or {})):
        det.append(place(v, x, y, ang, s, flip=flip))
    segs = hatch_half(lf, x, y, ang, s, flip, spacing, side=side) if hatch else ()
    out = place(lf['outline'], x, y, ang, s, flip=flip)
    fig.shape(out, det, segs=segs)
    return out


def holly_leaf(L, W, spines=4, sag=0.28, bend=0.0):
    ts = np.linspace(0.12, 0.86, spines)
    prof = lambda t: W * (math.sin(math.pi * (0.15 + 0.85 * t)) ** 0.6)  # noqa: E731

    def side(sx):
        tips = [(sx * prof(t) * 1.12, -L * t) for t in ts]
        out = [catmull([(0, 0), (sx * W * 0.45, -L * 0.04), tips[0]], n=8)]
        seq = tips + [(0.0, -L)]
        for a, b in zip(seq[:-1], seq[1:]):
            a, b = np.array(a), np.array(b)
            v = b - a
            nrm = np.array([-v[1], v[0]]) / max(np.linalg.norm(v), 1e-9)
            if np.dot(nrm, [sx, 0]) > 0:
                nrm = -nrm
            ss = np.linspace(0, 1, 14)[:, None]
            out.append((a + v * ss + nrm * np.linalg.norm(v) * sag * np.sin(np.pi * ss))[1:])
        return np.vstack(out)
    left = side(-1)
    right = side(1)
    ol = np.vstack([left, right[::-1][1:]])
    if bend:
        ol = ol.copy()
        ol[:, 0] += bend * L * (ol[:, 1] / L) ** 2
    tips = [(sx * prof(t) * 1.12 + bend * L * t * t, -L * t) for t in ts for sx in (-1, 1)]
    mid = A([(bend * L * t * t, -L * t) for t in np.linspace(0, 0.95, 20)])
    return {'outline': ol, 'mid': mid, 'tips': tips, 'left': left, 'right': right}


def holly(fig, x, y, ang, L=54, W=17, hatch=True, s=1.0, flip=False, bend=0.06):
    h = holly_leaf(L, W, 4, bend=bend)
    det = [place(h['mid'], x, y, ang, s, flip=flip)]
    for (tx, ty) in h['tips']:
        my = ty * 0.75
        det.append(place(catmull([(bend * L * (my / L) ** 2, my + 4), ((tx) * 0.5, (ty + my) / 2), (tx * 0.82, ty * 0.98)], n=6),
                         x, y, ang, s, flip=flip))
    segs = ()
    if hatch:
        half = np.vstack([h['right'], h['mid'][::-1]])
        hw = place(half, x, y, ang, s, flip=flip)
        segs = clip_lines(hw, ang + 40, 3.8, inset=2.4)
    fig.shape(place(h['outline'], x, y, ang, s, flip=flip), det, segs=segs)


def berry(fig, x, y, r=7):
    hl = arc(x - r * 0.15, y - r * 0.15, r * 0.55, -80, -10, n=8)
    fig.shape(circ(x, y, r), [hl])


def pine_sprig(fig, x, y, ang, L=70, needle=17, step=4.2, s=1.0, r=None):
    r = r or rng(1)
    st = place(A([(0.06 * L * (t ** 2), -L * t) for t in np.linspace(0, 1, 30)]), x, y, ang, s)
    st = resample(st, 1.0)
    segs = []
    n = len(st)
    pos = 6
    while pos < n - 1:
        q = st[pos]
        d = stem_dir(st, pos)
        u = pos / (n - 1)
        ln = needle * s * (0.65 + 0.35 * math.sin(math.pi * min(1, u * 1.1 + 0.1)))
        for sd in (-1, 1):
            e = pol(q[0], q[1], ln, d + sd * (38 + r.uniform(-6, 6)))
            segs.append((q, A([e])[0]))
        pos += int(step * s)
    for sd in (-1, 0, 1):
        segs.append((st[-1], A([pol(st[-1][0], st[-1][1], needle * 0.6 * s, stem_dir(st, n - 1) + sd * 22)])[0]))
    fig.segs(segs)
    fig.line(st, detail=True)


def pinecone(fig, x, y, ang, w=22, h=36):
    body = catmull([(0, 0), (-w * 0.55, -h * 0.12), (-w, -h * 0.5), (-w * 0.75, -h * 0.85), (0, -h),
                    (w * 0.75, -h * 0.85), (w, -h * 0.5), (w * 0.55, -h * 0.12)], closed=True)
    det = []
    rows = 6
    for j in range(1, rows):
        yy = -h * j / rows
        half = w * math.sin(math.pi * (j / rows) ** 0.85) * 0.9
        k = max(2, int(2 * half / 9))
        sw = 2 * half / k
        off = (sw / 2) * (j % 2)
        for i in range(k):
            x0 = -half + i * sw + off * 0.5
            x1 = x0 + sw
            if x1 > half + 1:
                continue
            det.append(catmull([(x0, yy), ((x0 + x1) / 2, yy + sw * 0.55), (x1, yy)], n=6))
    fig.shape(place(body, x, y, ang), [place(d, x, y, ang) for d in det])


def peony_head(fig, cx, cy, R, seed=1, sy=0.78, rot=0.0):
    k = int(np.clip(round(R / 12), 3, 7))
    rings = [(4 + 2 * j, 0.18 + 0.82 * (j / (k - 1)), (j * 29) % 60) for j in range(k)]
    rose_head(fig, cx, cy, R, seed=seed, sy=sy, rot=rot, curls=0.25, swirl=False, wmul=1.7, ruffle=0.045, nruf=4,
              streaks=2, tipv=0.0, rings=rings)


def open_peony(fig, cx, cy, R, seed=1, sy=0.8, rot=0.0):
    """Semi-double peony: a boss of stamens around three carpels, two rings of ruffled petals."""
    r = rng(seed)

    def P(q):
        q = A(q).copy()
        q[:, 1] = cy + (q[:, 1] - cy) * sy
        return rot_about(q, rot, cx, cy)
    for k in range(3):
        petal_raw(fig, *P(A([pol(cx, cy, 2, 120 * k)]))[0], 120 * k + rot, R * 0.16, R * 0.06, prec=0)
    segs, dots = [], []
    for k in range(34):
        a = k * GOLDEN
        r0 = R * 0.1
        r1 = R * r.uniform(0.24, 0.33)
        p0 = A([pol(cx, cy, r0, a)])
        p1 = A([pol(cx, cy, r1, a + r.uniform(-12, 12))])
        q0, q1 = P(p0)[0], P(p1)[0]
        segs.append((q0, q1))
        dots.append(P(circ(*p1[0], 1.6, n=8)))
    fig.segs(segs)
    fig.details(dots)
    fig.add_occ(P(circ(cx, cy, R * 0.3)))
    rose_head(fig, cx, cy, R, seed=seed, sy=sy, rot=rot, curls=0.3, swirl=False, wmul=1.55, ruffle=0.05, nruf=4,
              streaks=4, tipv=0.0, rings=[(6, 0.72, 10), (8, 1.0, 30)])


def ranunculus_head(fig, cx, cy, R, seed=1, sy=0.85, rot=0.0):
    fig.shape(circ(cx, cy, R * 0.09))
    k = max(3, int(R / 9))
    rings = [(4 + j, 0.16 + 0.84 * (j + 1) / k, (j * 23) % 60) for j in range(k)]
    rose_head(fig, cx, cy, R, seed=seed, sy=sy, rot=rot, curls=0.0, swirl=False, wmul=1.65, tipv=0.0, rings=rings)


def gyp_spray(fig, x, y, ang, L=60, s=1.0, seed=3):
    """Baby's-breath spray: forked stem with tiny round flowers."""
    r = rng(seed)
    st = place(A([(0, 0), (0, -L)]), x, y, ang, s)
    fig.group()
    ends = []
    for k in range(5):
        u = 0.45 + 0.13 * k
        q = st[0] + (st[1] - st[0]) * min(u, 1.0)
        e = pol(q[0], q[1], L * 0.32 * s * r.uniform(0.7, 1.1), ang + r.uniform(-55, 55))
        ends.append((q, e))
    ends.append((st[1], st[1]))
    for q, e in ends:
        for j in range(r.randint(2, 3)):
            c = pol(e[0], e[1], r.uniform(0, 7) * s, r.uniform(0, 360))
            fig.shape(circ(c[0], c[1], 3.4 * s, n=14))
    fig.end_group()
    fig.line(st, detail=True)
    fig.details([A([q, e]) for q, e in ends[:-1]])


def wrap_sheet(top, tie_l, tie_r):
    """Paper sheet polygon: wavy top edge (list of points left->right) down to a tie."""
    return np.vstack([catmull(top, n=10), catmull([top[-1], tie_r], n=8)[1:], resample([tie_r, tie_l], 3)[1:],
                      catmull([tie_l, top[0]], n=8)[1:]])


@template('bot-rose-bouquet', 'Wrapped rose bouquet', 'advanced',
          ['botanical', 'romantic', 'realistic', 'rose', 'bouquet', 'wedding', 'love', 'valentine', 'gift', 'card'],
          strokeWidth=3, detailWidth=1.5)
def t_rose_bouquet(fig):
    r = rng(31)
    bow(fig, 200, 318, 1.15, tails=((-34, 66), (30, 62)))
    # lower cone below the tie
    low = np.vstack([resample([(180, 322), (220, 322)], 3), catmull([(220, 322), (214, 360), (208, 392)])[1:],
                     resample([(208, 392), (190, 392)], 3)[1:], catmull([(190, 392), (186, 360), (180, 322)])[1:]])
    fig.shape(low, [A([(200, 330), (199, 390)])])
    front = wrap_sheet([(66, 214), (110, 230), (150, 222), (196, 238), (240, 226), (290, 234), (334, 214)],
                       (182, 312), (218, 312))
    fold = [catmull([(150, 224), (166, 262), (186, 306)]), catmull([(240, 228), (228, 266), (214, 306)])]
    hs = clip_lines(front, 24, 4.2, keep=lambda X, Y: X > 246 + (Y - 230) * -0.5, inset=2)
    fig.shape(front, fold, segs=hs)
    heads = [(166, 196, 50, 1, 0.8, -8), (240, 192, 52, 2, 0.8, 10), (120, 148, 46, 3, 0.78, -14),
             (282, 140, 46, 4, 0.78, 16), (200, 116, 50, 5, 0.8, 0)]
    for (x, y, R, sd, sy, rot) in heads:
        rose_head(fig, x, y, R, seed=sd + 50, sy=sy, rot=rot, curls=0.6)
    for (x, y, a, fl, L) in [(126, 172, -84, False, 92), (276, 164, 86, True, 90), (140, 128, -42, False, 86),
                             (262, 120, 44, True, 84), (196, 104, -4, False, 74)]:
        leaf_adv(fig, x, y, a, L, 17, veins=5, flip=fl, serr=0.12, nserr=11, a=0.6, b=1.0, n=140,
                 vein_kw=dict(reach=0.75, rise=0.14, t0=0.45, t1=0.85))
    gyp_spray(fig, 168, 132, -30, 96, seed=2)
    gyp_spray(fig, 236, 128, 28, 96, seed=5)
    back = np.vstack([catmull([(150, 250), (60, 214), (40, 118)], n=12), catmull([(40, 118), (84, 100), (120, 120)], n=8)[1:],
                      catmull([(120, 120), (150, 250)], n=8)[1:]])
    back2 = np.vstack([catmull([(250, 250), (340, 212), (360, 112)], n=12),
                       catmull([(360, 112), (316, 92), (280, 112)], n=8)[1:], catmull([(280, 112), (250, 250)], n=8)[1:]])
    fig.shape(back, [catmull([(62, 132), (88, 190), (130, 240)])],
              segs=clip_lines(back, -20, 4.2, keep=lambda X, Y: X < 70 + (Y - 120) * 0.25, inset=2))
    fig.shape(back2, [catmull([(338, 126), (312, 186), (270, 240)])])


@template('bot-holly-wreath', 'Holly & pine wreath', 'advanced',
          ['botanical', 'ornamental', 'realistic', 'wreath', 'holly', 'christmas', 'winter', 'card'],
          strokeWidth=3, detailWidth=1.5)
def t_holly_wreath(fig):
    r = rng(12)
    cx, cy, Rr = 200, 186, 120
    bow(fig, cx, cy + Rr + 6, 1.05, tails=((-34, 54), (30, 50)), loop=1.0)
    for a in [34, 100, 152, 214, 268, 326]:
        c = pol(cx, cy, Rr + r.uniform(-4, 4), a)
        for j in range(3):
            q = pol(c[0], c[1], 9.5, a + 120 * j + 30)
            berry(fig, q[0], q[1], 8)
    for a in [66, 240, 300]:
        c = pol(cx, cy, Rr + 26, a)
        pinecone(fig, c[0], c[1], a + 180, 14, 42)
    k = 0
    for a in np.arange(4, 360, 30.0):
        if 160 < a < 200:
            continue
        for sd in (-1, 1):
            c = pol(cx, cy, Rr + sd * 10, a + sd * 8)
            la = a + 90 + sd * 40 + r.uniform(-8, 8)
            holly(fig, c[0], c[1], la, L=64, W=19, hatch=(k % 2 == 0), flip=(sd > 0), bend=0.05)
            k += 1
    for a in np.arange(18, 360, 24.0):
        if 158 < a < 202:
            continue
        for sd in (-1, 1):
            c = pol(cx, cy, Rr + sd * 6, a)
            pine_sprig(fig, c[0], c[1], a + 90 * (1 if sd < 0 else -1) * 0 + (0 if sd > 0 else 180) + 60 * sd,
                       L=50, needle=14, step=5, r=r)


@template('bot-wedding-wreath', 'Rose & olive wreath', 'advanced',
          ['botanical', 'romantic', 'ornamental', 'wreath', 'rose', 'wedding', 'love', 'anniversary', 'invitation'],
          strokeWidth=3, detailWidth=1.5)
def t_wedding_wreath(fig):
    r = rng(23)
    cx, cy, Rr = 200, 200, 136
    rose_head(fig, *pol(cx, cy, Rr, 222), 48, seed=81, sy=0.82, rot=10, curls=0.6)
    rose_head(fig, *pol(cx, cy, Rr + 6, 250), 36, seed=82, sy=0.82, rot=-20, curls=0.5)
    rose_head(fig, *pol(cx, cy, Rr - 4, 195), 34, seed=83, sy=0.82, rot=30, curls=0.5)
    rose_head(fig, *pol(cx, cy, Rr, 42), 38, seed=84, sy=0.82, rot=-30, curls=0.5)
    for (a, rr, ang) in [(272, Rr + 2, -100), (176, Rr - 4, 160), (20, Rr + 2, -30), (64, Rr - 2, 150)]:
        q = pol(cx, cy, rr, a)
        bud(fig, q[0], q[1], ang, 0.62)
    for a in np.arange(0, 360, 12.0):
        if 180 < a < 266 or 28 < a < 58:
            continue
        grow = 1 if 58 <= a <= 180 else -1
        for sd in (-1, 1):
            c = pol(cx, cy, Rr + sd * 2, a + sd * 3)
            la = a + 90 * grow + sd * 40 * grow + r.uniform(-6, 6)
            if int(a / 12) % 3 == 0:
                coin_leaf(fig, c[0], c[1], la, 30, 14, r, veins=1)
            else:
                leaf_adv(fig, c[0], c[1], la, 50 + r.uniform(-5, 5), 9, veins=0, hatch=(sd < 0),
                         flip=(sd > 0), spacing=3.6, a=0.7, b=1.0, n=60)
    fig.line(circ(cx, cy, Rr, n=360))


def footed_bowl(fig, cx, top, w, h, foot_w, foot_y):
    rim_f = catmull([(cx - w / 2, top), (cx, top + 10), (cx + w / 2, top)], n=16)
    body = np.vstack([catmull([(cx - w / 2, top), (cx - w * 0.44, top + h * 0.55), (cx - w * 0.2, top + h * 0.92),
                               (cx - 12, top + h)], n=14),
                      catmull([(cx - 12, top + h), (cx - 9, (top + h + foot_y) / 2), (cx - foot_w / 2, foot_y - 8),
                               (cx - foot_w / 2, foot_y)], n=10)[1:],
                      resample([(cx - foot_w / 2, foot_y), (cx + foot_w / 2, foot_y)], 3)[1:],
                      catmull([(cx + foot_w / 2, foot_y), (cx + foot_w / 2, foot_y - 8), (cx + 9, (top + h + foot_y) / 2),
                               (cx + 12, top + h)], n=10)[1:],
                      catmull([(cx + 12, top + h), (cx + w * 0.2, top + h * 0.92), (cx + w * 0.44, top + h * 0.55),
                               (cx + w / 2, top)], n=14)[1:]])
    hs = clip_lines(body, 0, 4.2, keep=lambda X, Y: X > cx + w * 0.16, inset=2)
    band1 = catmull([(cx - w * 0.47, top + 14), (cx, top + 24), (cx + w * 0.47, top + 14)], n=16)
    band2 = catmull([(cx - w * 0.45, top + 22), (cx, top + 32), (cx + w * 0.45, top + 22)], n=16)
    scal = []
    for i in range(11):
        u0, u1 = i / 11, (i + 1) / 11
        a0 = band2[int(u0 * (len(band2) - 1))]
        a1 = band2[int(u1 * (len(band2) - 1))]
        scal.append(catmull([a0, (a0 + a1) / 2 + [0, 7], a1], n=6))
    fig.shape(body, [rim_f, band1, band2] + scal + [catmull([(cx - 12, top + h), (cx, top + h + 4), (cx + 12, top + h)])],
              segs=hs)


@template('bot-peony-arrangement', 'Peony & ranunculus bowl', 'advanced',
          ['botanical', 'romantic', 'realistic', 'peony', 'ranunculus', 'bouquet', 'wedding', 'birthday', 'thanks', 'card'],
          strokeWidth=3, detailWidth=1.5)
def t_peony(fig):
    open_peony(fig, 160, 196, 80, seed=7, sy=0.76, rot=-6)
    ranunculus_head(fig, 290, 244, 40, seed=9, sy=0.84, rot=14)
    ranunculus_head(fig, 86, 270, 36, seed=10, sy=0.84, rot=-16)
    peony_head(fig, 276, 148, 60, seed=11, sy=0.78, rot=12)
    # peony bud with clasping sepals
    for sx, aa in ((-1, 34), (1, 30)):
        lf = leaf_shape(36, 8, a=0.5, b=1.0, bend=0.3 * sx)
        fig.shape(place(lf['outline'], 230, 94, sx * aa))
    bb = circ(230, 72, 22, ry=21)
    fig.shape(bb, [catmull([(214, 64), (228, 56), (244, 62)]), catmull([(216, 78), (231, 72), (246, 78)])])
    fig.line(catmull([(230, 94), (236, 120), (240, 140)]))
    for (x, y, a) in [(118, 176, -50), (296, 120, 30)]:
        st = resample(catmull([pol(x, y, 0, 0), pol(x, y, 36, a), pol(x, y, 72, a + 14)]), 1.0)
        leafy_branch(fig, st, rng(3), spacing=20, L0=26, W0=12, shrink=0.7, stalk=3)
        fig.line(st)
    for (x, y, a, L, fl) in [(116, 206, -82, 100, False), (300, 214, 84, 92, True), (130, 158, -36, 96, False),
                             (302, 120, 44, 82, True), (92, 280, -124, 76, False), (296, 270, 120, 80, True)]:
        leaf_adv(fig, x, y, a, L, 17, veins=6, flip=fl, a=0.55, b=1.05, bend=0.1, vein_kw=dict(reach=0.8, rise=0.16))
    footed_bowl(fig, 200, 280, 196, 58, 92, 388)
def wild_rose(fig, x, y, R, rot=0.0, sy=1.0, seed=1, stamens=28, veins=5):
    """Five-petal single (dog) rose, face on: stamen boss, broad notched petals with fan veins."""
    r = rng(seed)

    def P(q):
        q = A(q).copy()
        q[:, 1] = y + (q[:, 1] - y) * sy
        return rot_about(q, rot, x, y)
    segs, dots = [], []
    for k in range(stamens):
        a = k * GOLDEN
        e = pol(x, y, R * r.uniform(0.3, 0.42), a + r.uniform(-6, 6))
        segs.append((P(A([pol(x, y, R * 0.13, a)]))[0], P(A([e]))[0]))
        dots.append(P(circ(e[0], e[1], 1.7, n=8)))
    fig.shape(P(circ(x, y, R * 0.13)), [P(circ(x, y, R * 0.06, n=12))])
    fig.segs(segs)
    fig.details(dots)
    fig.add_occ(P(circ(x, y, R * 0.2)))
    for k in range(5):
        a = 72 * k + r.uniform(-4, 4)
        pt = notch_petal(R * r.uniform(0.95, 1.04), R * 0.6, r, notch=0.07)
        pd = []
        for j in range(veins):
            dv = (j - (veins - 1) / 2) / max(1, veins - 1)
            pd.append(place(catmull([(dv * R * 0.1, -R * 0.24), (dv * R * 0.38, -R * 0.52), (dv * R * 0.62, -R * 0.78)], n=6),
                            x, y, a))
        fig.shape(P(place(pt, x, y, a)), [P(d) for d in pd])


def leaflet_leaf(fig, x, y, ang, L, W, pairs=2, s=1.0, flip=False, hatch=True, seed=1):
    """Compound leaf (terminal + opposite leaflets) with serrated, veined, half-hatched leaflets."""
    rach = L * 0.55 * (pairs + 0.6)
    tip = pol(0, 0, rach, 0)
    items = [(tip, 0.0, 1.0)]
    for k in range(pairs):
        q = pol(0, 0, rach * (0.74 - k * 0.4), 0)
        sc = 0.88 - 0.12 * k
        items += [(q, -56, sc), (q, 56, sc)]
    for (q, a, sc) in items:
        Q = place(A([q]), x, y, ang, s, flip=flip)[0]
        aa = ang + (-a if flip else a)
        leaf_adv(fig, Q[0], Q[1], aa, L * sc * s, W * sc * s, veins=5, hatch=hatch, serr=0.16, nserr=10, a=0.6, b=1.0,
                 n=130, spacing=3.4, vein_kw=dict(reach=0.78, rise=0.13, t0=0.14, t1=0.78))
    fig.line(place(A([(0, 0), tip]), x, y, ang, s, flip=flip))


def rose_hip(fig, x, y, ang, s=1.0):
    body = catmull([(0, 0), (-12, -6), (-16, -22), (-12, -38), (0, -44), (12, -38), (16, -22), (12, -6)], closed=True)
    for k, aa in enumerate((-40, -16, 12, 38)):
        lf = leaf_shape(22, 3.5, a=0.5, b=1.0, bend=0.3 * (1 if aa > 0 else -1))
        fig.shape(place(lf['outline'], *place(A([(0, -42)]), x, y, ang, s)[0], ang + aa, s))
    hs = clip_lines(place(body, x, y, ang, s), ang + 30, 3.6, keep=None, inset=2)
    keep = [(a_, b_) for a_, b_ in hs if (a_[0] - x) * math.cos(math.radians(ang)) > -2]
    fig.shape(place(body, x, y, ang, s), [place(arc(-5, -26, 6, -60, 10, n=8), x, y, ang, s)], segs=keep)


def hip_section(fig, cx, cy, R):
    """Cut rose hip: wall (double outline), hairy seeds, hatched flesh, inside a thin circle."""
    r = rng(77)
    outer = circ(cx, cy, R * 0.72, ry=R * 0.86)
    inner = circ(cx, cy, R * 0.5, ry=R * 0.64)
    seeds = []
    for k in range(9):
        a = k * 40 + r.uniform(-8, 8)
        b = pol(cx, cy, R * 0.12, a)
        seeds.append(place(soft_petal(R * 0.32, R * 0.08), b[0], b[1], a))
    for sd in seeds:
        fig.shape(sd, detail_outline=True)
    hs = clip_lines(outer, 35, 3.4, keep=lambda X, Y: ((X - cx) / (R * 0.5)) ** 2 + ((Y - cy) / (R * 0.64)) ** 2 > 1.08,
                    inset=1.5)
    fig.shape(inner, [], segs=[])
    fig.shape(outer, [], segs=hs, occlude=False)
    fig.line(circ(cx, cy, R), detail=True)


@template('bot-rose-study', 'Wild rose botanical study', 'advanced',
          ['botanical', 'vintage', 'realistic', 'rose', 'study', 'scientific', 'journal', 'love'],
          strokeWidth=3, detailWidth=1.4)
def t_rose_study(fig):
    hip_section(fig, 332, 334, 44)
    wild_rose(fig, 214, 126, 74, rot=8, sy=0.92, seed=3)
    bud(fig, 84, 112, -24, 0.9)
    rose_hip(fig, 336, 216, 20, 1.1)
    main = resample(catmull([(118, 394), (150, 330), (186, 260), (206, 200), (214, 150)]), 1.0)
    br1 = resample(catmull([(170, 292), (120, 230), (94, 170), (86, 118)]), 1.0)
    br2 = resample(catmull([(196, 230), (250, 228), (300, 236), (326, 216)]), 1.0)
    leaflet_leaf(fig, 160, 312, -64, 40, 13, pairs=2, flip=False)
    leaflet_leaf(fig, 260, 230, 30, 34, 11, pairs=2, flip=True)
    leaflet_leaf(fig, 112, 216, -74, 30, 10, pairs=1)
    # a single petal and a sepal laid out beside the plant, as in a study plate
    pt = notch_petal(46, 26, rng(5), notch=0.08)
    fig.shape(place(pt, 54, 330, -20), [place(catmull([(dv, -10), (dv * 2.4, -26), (dv * 3.6, -40)], n=6), 54, 330, -20)
                                         for dv in (-6, -3, 0, 3, 6)])
    for st, us in ((main, (0.18, 0.36, 0.55, 0.74)), (br1, (0.3, 0.6)), (br2, (0.4, 0.7))):
        fig.line(st)
        fig.details([thorn(st, u, 1 if i % 2 else -1, 7) for i, u in enumerate(us)])
    # leader ticks pointing to the inset section
    fig.details([catmull([(336, 240), (334, 266), (332, 288)])])


# ---- herbarium specimen -----------------------------------------------------------------------


def roots(fig, x, y, L, ang, depth, r, segs):
    """Recursive root system: tapering branching lines (L-system like)."""
    if depth == 0 or L < 7:
        return
    e = pol(x, y, L, ang)
    m = pol(x, y, L * 0.5, ang + r.uniform(-14, 14))
    segs.append(catmull([(x, y), m, e], n=6))
    for k in range(r.randint(2, 3)):
        roots(fig, e[0], e[1], L * r.uniform(0.55, 0.72), ang + r.uniform(-48, 48), depth - 1, r, segs)


def cup_flower(fig, x, y, ang, s=1.0):
    """Side view of a five-petalled cup flower (buttercup-like) with sepals."""
    fr = [(0, 0), (-10, -4), (-22, -16), (-24, -30), (-14, -36), (-6, -30), (0, -38), (6, -30), (14, -36), (24, -30),
          (22, -16), (10, -4)]
    body = catmull(fr, closed=True)
    det = [catmull([(-6, -30), (-4, -14), (0, -3)]), catmull([(6, -30), (4, -14), (0, -3)])]
    fig.shape(place(body, x, y, ang, s), [place(d, x, y, ang, s) for d in det])
    for sx in (-1, 1):
        lf = leaf_shape(16, 4, a=0.5, b=1.0, bend=-0.3 * sx)
        fig.shape(place(lf['outline'], x, y, ang + 180 + sx * 50, s))


@template('bot-herbarium', 'Herbarium specimen', 'advanced',
          ['botanical', 'vintage', 'realistic', 'herbarium', 'pressed', 'study', 'journal', 'scrapbook'],
          strokeWidth=3, detailWidth=1.4)
def t_herbarium(fig):
    r = rng(9)
    # tape strips over the stems
    for (x, y, a) in [(176, 186, -18), (238, 132, 24), (176, 270, 8)]:
        tp = place(box([(-20, -7), (20, -7), (20, 7), (-20, 7)]), x, y, a)
        fig.shape(tp, [place(A([(-14, -3), (14, -3)]), x, y, a)])
    # label
    fig.shape(box([(236, 318), (346, 318), (346, 372), (236, 372)]),
              [box([(241, 323), (341, 323), (341, 367), (241, 367)])[:-1]] +
              [A([(250, yy), (332, yy)]) for yy in (338, 350, 361)])
    fig.add_occ(box([(236, 318), (346, 318), (346, 372), (236, 372)]))
    # flowers
    wild_rose(fig, 236, 76, 36, rot=20, sy=0.94, seed=12, stamens=16, veins=3)
    bellflower(fig, 130, 96, -18, 1.3)
    bud_pts = catmull([(0, 0), (-8, -8), (-8, -20), (0, -27), (8, -20), (8, -8)], closed=True)
    fig.shape(place(bud_pts, 300, 130, 34))
    seedhead = circ(92, 160, 13)
    fig.shape(seedhead, [], segs=clip_lines(seedhead, 45, 3.6) + clip_lines(seedhead, -45, 3.6))
    stem = resample(catmull([(168, 300), (184, 250), (198, 190), (214, 130), (232, 92)]), 1.0)
    br = [resample(catmull([(194, 226), (166, 168), (140, 112), (130, 98)]), 1.0),
          resample(catmull([(208, 150), (250, 146), (284, 140), (298, 130)]), 1.0),
          resample(catmull([(184, 250), (140, 214), (108, 178), (94, 172)]), 1.0)]
    # stem leaves
    for (st, u, a, L) in [(stem, 0.52, -60, 48), (stem, 0.4, 62, 52), (br[0], 0.45, -40, 34), (br[1], 0.5, 40, 30)]:
        i = int(u * (len(st) - 1))
        q = st[i]
        aa = stem_dir(st, i) + a
        lf = lobed_leaf(L, 9, 3, depth=0.5, lean=0.4, sharp=0.6)
        fig.shape(place(lf['outline'], q[0], q[1], aa), [place(lf['mid'][3:-10], q[0], q[1], aa)])
    # basal rosette of lobed, veined, hatched leaves
    for (a, L, W, nl) in [(-66, 96, 20, 5), (64, 92, 20, 5), (-28, 80, 17, 4), (30, 76, 17, 4), (-98, 70, 15, 4),
                          (96, 64, 15, 4)]:
        lf = lobed_leaf(L, W, nl, depth=0.55, lean=0.35, bend=0.08 * (1 if a > 0 else -1), sharp=0.55)
        half = np.vstack([lf['outline'][len(lf['outline']) // 2:], lf['mid'][::-1]])
        hw = place(half, 168, 300, a)
        hs = clip_lines(hw, a + 40, 3.6, inset=2.5)
        mid = lf['mid']
        veins = []
        for j in range(nl):
            tt = (j + 0.45) / nl
            i = int(tt * (len(mid) - 1))
            for sd in (-1, 1):
                e = mid[i] + np.array([sd * W * 0.7 * math.sin(math.pi * min(0.95, tt + 0.05)) ** 0.4, -L * 0.07])
                veins.append(place(catmull([mid[i], (mid[i] + e) / 2 + [0, -2], e], n=6), 168, 300, a))
        fig.shape(place(lf['outline'], 168, 300, a), [place(mid[3:-8], 168, 300, a)] + veins, segs=hs)
    for st in [stem] + br:
        fig.line(st)
    # roots
    segs = []
    rr = rng(4)
    for a in (-30, 0, 26):
        roots(fig, 168, 328, 26, 180 + a, 4, rr, segs)
    fig.details(segs)
    fig.line(catmull([(168, 300), (167, 316), (169, 330)]))
    # sheet
    fig.line(box([(36, 12), (364, 12), (364, 388), (36, 388)]), closed=True)


# ---- floral corner frame ----------------------------------------------------------------------


def corner_cluster(fig, flip):
    """Top-left floral corner (or its 180-degree copy when flip)."""
    r = rng(61 if not flip else 62)

    def T(x, y):
        return (400 - x, 400 - y) if flip else (x, y)

    def TA(a):
        return a + 180 if flip else a

    def TP(pts):
        p = A(pts)
        return 400 - p if flip else p
    rose_head(fig, *T(66, 70), 46, seed=91 if not flip else 92, sy=0.84, rot=TA(-20), curls=0.6)
    wild_rose(fig, *T(146, 50), 26, rot=TA(10), sy=0.9, seed=5, stamens=14, veins=3)
    wild_rose(fig, *T(48, 152), 24, rot=TA(-30), sy=0.9, seed=6, stamens=12, veins=3)
    for (x, y, a) in [(104, 112, 135), (176, 34, 70)]:
        X, Y = T(x, y)
        bud(fig, X, Y, TA(a), 0.55)
    for (x, y, a, L) in [(100, 64, 84, 46), (60, 112, 176, 44), (118, 92, 130, 38)]:
        X, Y = T(x, y)
        leaf_adv(fig, X, Y, TA(a), L, 12, veins=4, serr=0.14, nserr=8, a=0.6, b=1.0, n=110, spacing=3.4,
                 vein_kw=dict(reach=0.75, rise=0.14))
    v1 = resample(TP(catmull([(150, 52), (196, 44), (246, 38), (290, 40)])), 1.0)
    v2 = resample(TP(catmull([(48, 150), (42, 196), (38, 246), (40, 290)])), 1.0)
    for v in (v1, v2):
        leafy_branch(fig, v, r, spacing=22, L0=26, W0=8, shrink=0.6, stalk=2, start=0.22, alt=50, veins=0)
        fig.line(v)
    for (x, y) in [(214, 58), (58, 214), (262, 48), (48, 262)]:
        X, Y = T(x, y)
        berry(fig, X, Y, 4.5)
        fig.line(A([(X, Y), T(x - 6 if x > y else x + 6, y + 6 if x > y else y - 6)]), detail=True)


@template('bot-floral-frame', 'Botanical corner frame', 'advanced',
          ['botanical', 'ornamental', 'romantic', 'frame', 'border', 'wedding', 'invitation', 'birthday', 'thanks', 'card'],
          strokeWidth=3, detailWidth=1.4)
def t_floral_frame(fig):
    corner_cluster(fig, False)
    corner_cluster(fig, True)
    fig.line(box([(22, 22), (378, 22), (378, 378), (22, 378)]), closed=True)
    fig.line(box([(30, 30), (370, 30), (370, 370), (30, 370)]), closed=True, detail=True)


# ---- wildflower posy (intermediate) ------------------------------------------------------------


def daisy(fig, x, y, R, sy=1.0, rot=0.0, n=16, seed=1):
    r = rng(seed)

    def P(q):
        q = A(q).copy()
        q[:, 1] = y + (q[:, 1] - y) * sy
        return rot_about(q, rot, x, y)
    disk = circ(x, y, R * 0.24)
    hs = clip_lines(P(disk), 40, 3.6) + clip_lines(P(disk), -40, 3.6)
    fig.shape(P(disk), [], segs=hs)
    for k in range(n):
        a = 360 * k / n + r.uniform(-4, 4)
        b = pol(x, y, R * 0.2, a)
        pt = soft_petal(R * 0.8 * r.uniform(0.9, 1.05), R * 0.1)
        fig.shape(P(place(pt, b[0], b[1], a)))


def bellflower(fig, x, y, ang, s=1.0):
    pts = [(0, 0), (-6, 4), (-12, 18), (-16, 30), (-22, 36), (-12, 35), (-6, 39), (0, 35), (6, 39), (12, 35), (22, 36),
           (16, 30), (12, 18), (6, 4)]
    body = catmull(pts, closed=True)
    det = [catmull([(-14, 33), (0, 30), (14, 33)]), A([(0, 30), (1, 42)]), catmull([(-4, 6), (-6, 20), (-6, 31)])]
    fig.shape(place(body, x, y, ang, s), [place(d, x, y, ang, s) for d in det])
    for sx in (-1, 1):
        lf = leaf_shape(10, 2.5, a=0.5, b=1.0)
        fig.shape(place(lf['outline'], x, y, ang + 180 + sx * 30, s))


def cornflower(fig, x, y, R, seed=1):
    r = rng(seed)
    fig.shape(circ(x, y, R * 0.18), [circ(x, y, R * 0.07, n=10)])
    for k in range(9):
        a = 40 * k + r.uniform(-6, 6)
        L, w = R * r.uniform(0.85, 1.0), R * 0.17
        pts = [(0, 0), (-w * 0.35, -L * 0.5), (-w, -L * 0.86), (-w * 0.55, -L), (-w * 0.15, -L * 0.9), (w * 0.2, -L * 1.02),
               (w * 0.55, -L * 0.9), (w, -L * 0.94), (w * 0.35, -L * 0.5)]
        ol = np.vstack([catmull(pts[:3], n=8), A(pts[3:8]), catmull(pts[7:] + [(0, 0)], n=8)])
        fig.shape(place(ol, x, y, a), [place(A([(0, -L * 0.25), (0, -L * 0.7)]), x, y, a)])


def grass_head(fig, st, r, n=9):
    k = len(st)
    petal_raw(fig, st[-1][0], st[-1][1], stem_dir(st, k - 1), 10, 3)
    for j in range(n):
        i = k - 4 - j * 6
        if i < 2:
            break
        q = st[i]
        sd = 1 if j % 2 else -1
        petal_raw(fig, q[0], q[1], stem_dir(st, i) + sd * 26, 10, 3)


@template('bot-wildflower-posy', 'Wildflower posy', 'intermediate',
          ['botanical', 'whimsical', 'wildflower', 'daisy', 'bouquet', 'birthday', 'thanks', 'gift', 'card'],
          strokeWidth=3.5)
def t_posy(fig):
    r = rng(14)
    tie = (200, 290)
    bow(fig, tie[0], tie[1], 0.95, tails=((-30, 60), (26, 56)))
    daisy(fig, 158, 150, 50, sy=0.92, rot=-8, seed=1)
    daisy(fig, 262, 182, 40, sy=0.8, rot=16, seed=2)
    cornflower(fig, 222, 92, 34, seed=3)
    bellflower(fig, 92, 118, 12, 1.15)
    bellflower(fig, 70, 172, -8, 1.0)
    bellflower(fig, 116, 70, 30, 0.9)
    tops = {
        'd1': (158, 150), 'd2': (262, 182), 'cf': (222, 92), 'b1': (92, 118), 'b2': (70, 172), 'b3': (116, 70)}
    g1 = resample(catmull([(204, 290), (250, 190), (296, 96), (316, 46)]), 1.0)
    g2 = resample(catmull([(198, 290), (172, 200), (166, 120), (174, 40)]), 1.0)
    grass_head(fig, g1, r)
    grass_head(fig, g2, r, 7)
    bell_stem = resample(catmull([(196, 290), (150, 200), (110, 120), (116, 70)]), 1.0)
    fig.line(catmull([(129, 158), (106, 150), (92, 118)]))
    fig.line(catmull([(140, 186), (96, 196), (70, 172)]))
    for (x, y, a, L) in [(150, 222, -70, 56), (240, 230, 64, 54), (178, 252, -24, 44), (226, 256, 20, 40)]:
        lf = leaf_shape(L, 9, a=0.6, b=1.0, bend=0.12 * (1 if a > 0 else -1))
        fig.shape(place(lf['outline'], x, y, a), [place(lf['mid'][3:52], x, y, a)])
    stems = [catmull([tie, (180, 220), tops['d1']]), catmull([tie, (240, 230), tops['d2']]),
             catmull([tie, (214, 180), tops['cf']])]
    for st in stems + [g1, g2, bell_stem]:
        fig.line(st)
    for k in range(6):
        dx = (k - 2.5) * 6
        fig.line(catmull([(tie[0] + dx * 0.4, tie[1]), (tie[0] + dx * 0.8, tie[1] + 40), (tie[0] + dx * 1.3, 384)]))
    del r
#@@ADVANCED@@


# =============================================================================================
# main
# =============================================================================================


def build():
    out = []
    for (tid, name, level, tags, extra, fn) in TEMPLATES:
        fig = Fig(**{k: v for k, v in extra.items() if k in ('prec', 'dprec', 'margin')})
        fn(fig)
        t = {'id': tid, 'name': name, 'level': level, 'tags': tags, 'paths': [p for p in fig.paths if p],
             'detail': [d for d in fig.detail if d]}
        for k in ('strokeWidth', 'detailWidth'):
            if k in extra:
                t[k] = extra[k]
        check_bounds(t)
        chars = sum(len(p) for p in t['paths'] + t['detail'])
        npath = len(t['paths']) + len(t['detail'])
        print(f'{tid:28s} {level:12s} paths={npath:3d} chars={chars:6d}')
        assert chars <= 30000 and npath <= 300, tid
        out.append(t)
    total = sum(sum(len(p) for p in t['paths'] + t['detail']) for t in out)
    print(f'total {len(out)} templates, {total} chars')
    write_ts(out)


if __name__ == '__main__':
    build()
