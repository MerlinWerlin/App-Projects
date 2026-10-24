#!/usr/bin/env python3
"""T132: Glaze's three original starter art packs, drawn procedurally (no network, no photos).

    python3 scripts/brand/make-starter-packs.py [out-folder]
    node scripts/import-theme-packs.mjs <out-folder>

Writes one folder per pack in the art-pack format (docs/THEME_PACKS.md, "Art packs (themes-1024)"):
wallpaper.png (1290 x 2796, quantised to 256 colours), widget-small/medium/large.png (transparent
hero art at the reference sizes 510x510, 1092x510, 1092x1146), palette.json and meta.json.
With no out-folder it writes to a fresh temporary folder and prints its path.

Everything is Glaze's own art: gradients, value noise, analytic discs and spheres. Needs Python 3,
Pillow, numpy and scipy (scipy.ndimage for blurs). Seeds are fixed, so the output is repeatable.
"""

import json
import math
import os
import sys
import tempfile

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

W, H = 1290, 2796
HERO = {"small": (510, 510), "medium": (1092, 510), "large": (1092, 1146)}
ADDED_AT = "2026-10-24"


# --------------------------------------------------------------------------- helpers


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4)], dtype=np.float32)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def vgrad(h, w, stops):
    """Vertical gradient through (position 0..1, hex) stops, float HxWx3."""
    ys = np.linspace(0, 1, h, dtype=np.float32)
    pos = np.array([p for p, _ in stops], dtype=np.float32)
    cols = np.stack([hexrgb(c) for _, c in stops])
    out = np.stack([np.interp(ys, pos, cols[:, k]) for k in range(3)], axis=-1)
    return np.repeat(out[:, None, :], w, axis=1).astype(np.float32)


def value_noise(h, w, cell, rng):
    """Smooth value noise in 0..1 with roughly `cell`-pixel features."""
    gh, gw = h // cell + 3, w // cell + 3
    g = rng.random((gh, gw)).astype(np.float32)
    img = Image.fromarray(g, mode="F").resize((int(gw * cell), int(gh * cell)), Image.BICUBIC)
    a = np.asarray(img, dtype=np.float32)
    return np.clip(a[cell : cell + h, cell : cell + w], 0, 1)


def fbm(h, w, cell, octaves, rng, gain=0.5):
    total = np.zeros((h, w), np.float32)
    amp, norm = 1.0, 0.0
    for _ in range(octaves):
        total += amp * value_noise(h, w, max(2, int(cell)), rng)
        norm += amp
        amp *= gain
        cell /= 2
    return total / norm


def blur(a, s):
    if a.ndim == 3:
        return np.stack([gaussian_filter(a[..., k], s) for k in range(a.shape[2])], axis=-1)
    return gaussian_filter(a, s)


def over(dst_rgb, src_rgb, alpha):
    """Composite src over an opaque dst with alpha (HxW)."""
    a = alpha[..., None]
    return dst_rgb * (1 - a) + src_rgb * a


def premul_over(dst, src):
    """Straight-alpha RGBA over straight-alpha RGBA (float HxWx4)."""
    sa = src[..., 3:4]
    da = dst[..., 3:4]
    oa = sa + da * (1 - sa)
    rgb = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    return np.concatenate([rgb, oa], axis=-1)


def rgba_layer(rgb, alpha):
    if rgb.ndim == 1:
        rgb = np.broadcast_to(rgb, alpha.shape + (3,))
    return np.concatenate([rgb, alpha[..., None]], axis=-1).astype(np.float32)


def grid(h, w, cx, cy):
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    return xs - cx, ys - cy


def stars(h, w, rng, count, size_pow, max_bright, density=None, tint_warm=0.25, spikes=0):
    """Additive star layer HxWx3: varied sizes and brightness, a few soft glows and spikes."""
    layer = np.zeros((h, w, 3), np.float32)
    glow = np.zeros((h, w, 3), np.float32)
    xs = rng.integers(0, w, count * 3)
    ys = rng.integers(0, h, count * 3)
    if density is not None:
        keep = rng.random(count * 3) < density[ys, xs]
        xs, ys = xs[keep], ys[keep]
    xs, ys = xs[:count], ys[:count]
    n = len(xs)
    b = (rng.random(n) ** size_pow) * max_bright
    warm = rng.random(n) < tint_warm
    tints = np.where(warm[:, None], np.array([1.0, 0.88, 0.72]), np.array([0.82, 0.9, 1.0]))
    tints = tints * (0.6 + 0.4 * rng.random((n, 1)))
    tints = np.clip(tints + 0.25, 0, 1)
    np.add.at(layer, (ys, xs), tints * b[:, None])
    big = b > max_bright * 0.55
    np.add.at(glow, (ys[big], xs[big]), tints[big] * b[big, None] * 6)
    out = blur(layer, 0.55) * 2.2 + blur(glow, 3.0) * 0.9 + blur(glow, 9.0) * 0.6
    # Diffraction-style sparkle on the brightest few.
    order = np.argsort(-b)[:spikes]
    for i in order:
        x, y = int(xs[i]), int(ys[i])
        L = int(18 + 30 * rng.random())
        t = np.arange(-L, L + 1)
        f = np.exp(-np.abs(t) / (L / 3.2)) * 0.55
        xx = np.clip(x + t, 0, w - 1)
        yy = np.clip(y + t, 0, h - 1)
        out[y, xx] += tints[i] * f[:, None]
        out[yy, x] += tints[i] * f[:, None]
    return out


def save_wallpaper(rgb, path, colours=256):
    img = Image.fromarray((np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB")
    q = img.quantize(colors=colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    q.save(path, optimize=True)
    return os.path.getsize(path)


BAYER8 = (
    np.array(
        [
            [0, 32, 8, 40, 2, 34, 10, 42],
            [48, 16, 56, 24, 50, 18, 58, 26],
            [12, 44, 4, 36, 14, 46, 6, 38],
            [60, 28, 52, 20, 62, 30, 54, 22],
            [3, 35, 11, 43, 1, 33, 9, 41],
            [51, 19, 59, 27, 49, 17, 57, 25],
            [15, 47, 7, 39, 13, 45, 5, 37],
            [63, 31, 55, 23, 61, 29, 53, 21],
        ],
        np.float32,
    )
    / 64.0
    - 0.5
)


def save_hero(rgba, path, budget=140_000, dither=0.6):
    """Palette PNG under `budget` bytes: 256 colours, fewer only when the file is too big."""
    for colours in (256, 224, 192, 160, 128, 96):
        n = save_hero_colours(rgba, path, colours, dither)
        if n <= budget:
            break
    return n


def save_hero_colours(rgba, path, colours=256, dither=0.6):
    """RGBA -> 8-bit palette PNG with a tRNS chunk: k-means in premultiplied space, ordered dither."""
    from scipy.cluster.vq import kmeans2, vq

    a = np.clip(rgba, 0, 1).astype(np.float32)
    h, w = a.shape[:2]
    alpha = a[..., 3]
    alpha = np.where(alpha < 0.02, 0, alpha)
    pm = np.concatenate([a[..., :3] * alpha[..., None], alpha[..., None]], axis=-1) * 255
    clear = alpha == 0
    vis = pm[~clear]
    rng = np.random.default_rng(7)
    sample = vis[rng.choice(len(vis), min(len(vis), 60000), replace=False)].astype(np.float64)
    cents, _ = kmeans2(sample, colours - 1, iter=12, minit="++", seed=rng)
    cents = np.clip(cents, 0, 255)
    th = np.tile(BAYER8, (h // 8 + 1, w // 8 + 1))[:h, :w]
    jit = pm + (th * dither)[..., None] * np.array([1, 1, 1, 0.6], np.float32)
    idx, _ = vq(jit[~clear].astype(np.float64), cents)
    out = np.zeros((h, w), np.uint8)
    out[~clear] = idx.astype(np.uint8) + 1
    pal_a = np.concatenate([[0.0], cents[:, 3]])
    pal_rgb = np.concatenate([[[0, 0, 0]], cents[:, :3] / np.maximum(cents[:, 3:4], 1e-3) * 255])
    pal_rgb = np.clip(np.where(pal_a[:, None] > 0, pal_rgb, 0), 0, 255)
    img = Image.fromarray(out, "P")
    img.putpalette([int(round(v)) for v in pal_rgb.flatten()])
    img.save(path, optimize=True, transparency=bytes(int(round(v)) for v in pal_a))
    return os.path.getsize(path)


def sphere(h, w, cx, cy, r):
    """Normals of a sphere seen from the front: x, y, z (z=0 outside) and AA coverage."""
    dx, dy = grid(h, w, cx, cy)
    d = np.sqrt(dx * dx + dy * dy)
    cov = np.clip(r - d + 0.5, 0, 1)
    nx, ny = dx / r, dy / r
    nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
    return nx, ny, nz, cov, d


def craters(h, w, cx, cy, r, rng, n, rmin, rmax, light=(-0.64, -0.77)):
    """Height-ish shading term for round craters on a sphere (foreshortened toward the limb)."""
    shade = np.zeros((h, w), np.float32)
    floor = np.zeros((h, w), np.float32)
    dx, dy = grid(h, w, cx, cy)
    for _ in range(n):
        ang = rng.random() * 2 * math.pi
        rad = math.sqrt(rng.random()) * 0.93
        px, py = math.cos(ang) * rad, math.sin(ang) * rad
        cr = (rmin + (rmax - rmin) * rng.random() ** 2.2) * r
        z = math.sqrt(max(0.0, 1 - px * px - py * py))
        # Local frame: radial direction squashed by z (foreshortening).
        rl = math.hypot(px, py) or 1.0
        ux, uy = px / rl, py / rl
        x0, y0 = cx + px * r, cy + py * r
        ext = int(cr * 1.6) + 2
        xa, xb = max(0, int(x0 - ext)), min(w, int(x0 + ext))
        ya, yb = max(0, int(y0 - ext)), min(h, int(y0 + ext))
        if xa >= xb or ya >= yb:
            continue
        lx = dx[ya:yb, xa:xb] - px * r
        ly = dy[ya:yb, xa:xb] - py * r
        a = (lx * ux + ly * uy) / max(z, 0.18)
        b = -lx * uy + ly * ux
        q = np.sqrt(a * a + b * b) / cr
        # Bowl: inner wall facing the light is bright, the wall nearest the light is shadowed;
        # the outer rim catches a little light on the lit side; the floor is slightly darker.
        dist = np.sqrt(lx * lx + ly * ly) + 1e-3
        dirn = (lx * light[0] + ly * light[1]) / dist
        wall = smoothstep(0.45, 0.98, q) * (q < 1.0)
        rim_out = np.exp(-((q - 1.06) ** 2) / 0.006)
        bowl = smoothstep(1.0, 0.8, q)
        shade[ya:yb, xa:xb] += -wall * dirn * 0.2 + rim_out * dirn * 0.08
        floor[ya:yb, xa:xb] = np.maximum(floor[ya:yb, xa:xb], bowl * (0.3 + 0.5 * rng.random()))
    return shade, floor


# --------------------------------------------------------------------------- starry night


def starry_wallpaper(rng):
    sky = vgrad(H, W, [(0, "#02040B"), (0.35, "#070C1F"), (0.7, "#0D1838"), (0.9, "#1A2A55"), (1, "#22336A")])
    dx, dy = grid(H, W, 0, 0)
    # Milky band: a soft ribbon of haze and dense stars rising from lower left to upper right.
    ang = math.radians(-62)
    ux, uy = math.cos(ang), math.sin(ang)
    px, py = dx - W * 0.5, dy - H * 0.4
    along = (px * ux + py * uy) / W
    across = (-px * uy + py * ux) / W
    band_d = np.abs(across - 0.08 * np.sin(along * 2.4 + 0.5))
    n1 = fbm(H, W, 260, 5, rng)
    n2 = fbm(H, W, 90, 4, rng)
    band = np.exp(-(band_d / 0.2) ** 2) * (0.35 + 1.0 * n1) * smoothstep(1.05, 0.55, dy / H)
    dust = smoothstep(0.5, 0.8, n2) * np.exp(-(band_d / 0.06) ** 2)
    haze = band * (1 - 0.45 * dust)
    sky = sky + haze[..., None] * np.array([0.10, 0.11, 0.2]) + (haze**2)[..., None] * np.array([0.10, 0.07, 0.11])
    # Faint violet / teal nebular tints in the band.
    tint = fbm(H, W, 400, 3, rng)
    sky += (band * tint)[..., None] * np.array([0.06, 0.0, 0.08]) + (band * (1 - tint))[..., None] * np.array([0.0, 0.04, 0.05])
    # Stars: a sparse field everywhere, dense in the band, fewer near the horizon glow.
    density = np.clip(0.25 + 1.4 * np.exp(-(band_d / 0.16) ** 2) * (0.4 + n2), 0, 1)
    density *= smoothstep(1.0, 0.72, dy / H)
    sky += stars(H, W, rng, 9000, 4.0, 0.9, density=density, spikes=0)
    sky += stars(H, W, rng, 260, 2.5, 1.2, density=np.clip(density + 0.3, 0, 1), spikes=9)
    # Horizon glow and two layers of hills.
    glow = np.exp(-(((H * 0.93) - dy) / (H * 0.12)) ** 2)
    sky += glow[..., None] * np.array([0.06, 0.09, 0.16])
    xs = np.arange(W, dtype=np.float32) / W
    far = H * (0.86 + 0.03 * np.sin(xs * 4.2 + 1.0) + 0.018 * np.sin(xs * 11 + 2.0)) + 18 * value_noise(1, W, 40, rng)[0]
    near = H * (0.915 + 0.035 * np.sin(xs * 3.1 + 4.0) + 0.012 * np.sin(xs * 9.0)) + 10 * value_noise(1, W, 25, rng)[0]
    farm = np.clip(dy - far[None, :] + 0.5, 0, 1)
    nearm = np.clip(dy - near[None, :] + 0.5, 0, 1)
    sky = over(sky, hexrgb("#0B1430") + 0.03 * glow[..., None], farm)
    sky = over(sky, hexrgb("#050913"), nearm)
    return sky


def full_moon(rng):
    w, h = HERO["large"]
    cx, cy, r = w / 2, h / 2, 400
    nx, ny, nz, cov, d = sphere(h, w, cx, cy, r)
    maria = fbm(h, w, 220, 4, rng)
    mar = smoothstep(0.45, 0.63, maria) * (0.75 + 0.35 * fbm(h, w, 90, 2, rng))
    fine = fbm(h, w, 24, 2, rng)
    sh, fl = craters(h, w, cx, cy, r, rng, 90, 0.01, 0.075)
    sh *= 0.55
    alb = 0.87 - 0.23 * mar - 0.05 * fl + 0.07 * (fine - 0.5)
    # A bright ray crater in the lower left.
    rx, ry = cx - 0.32 * r, cy + 0.45 * r
    ddx, ddy = grid(h, w, rx, ry)
    rd = np.sqrt(ddx**2 + ddy**2)
    ang = np.arctan2(ddy, ddx)
    rn = value_noise(h, w, 40, rng)
    rays = np.abs(np.sin(ang * 6 + 0.4 + rn * 2.0)) ** 3 * np.exp(-rd / (0.42 * r)) * smoothstep(10, 50, rd)
    alb += 0.07 * rays + 0.12 * np.exp(-(rd / 18) ** 2)
    light = 0.8 + 0.2 * nz**0.6 + sh
    lum = np.clip(alb * light, 0, 1.1)
    warm = np.array([1.0, 0.97, 0.9])
    cool = np.array([0.82, 0.86, 0.92])
    col = lum[..., None] * (warm * (1 - mar[..., None] * 0.5) + cool * mar[..., None] * 0.5)
    moon = rgba_layer(col, cov)
    # Soft halo fading to clear.
    halo_a = np.where(d > r, 0.3 * np.exp(-(d - r) / 30) + 0.1 * np.exp(-(d - r) / 100), 0) * (1 - cov)
    halo = rgba_layer(np.array([0.85, 0.9, 1.0], np.float32), halo_a.astype(np.float32))
    return premul_over(halo, moon)


def gas_giant(rng):
    w, h = HERO["medium"]
    cx, cy, r = w / 2, h / 2 + 4, 168
    tilt, rot = 0.3, math.radians(-14)
    dx, dy = grid(h, w, cx, cy)
    nx, ny, nz, cov, d = sphere(h, w, cx, cy, r)
    # Bands along latitude (rotated with the ring), warped by noise.
    lat = (-nx * math.sin(rot) + ny * math.cos(rot))
    warp = fbm(h, w, 70, 4, rng) - 0.5
    turb = fbm(h, w, 18, 3, rng) - 0.5
    t = lat * 7.5 + warp * 1.6 + turb * 0.35
    bands = 0.5 + 0.5 * np.sin(t * 2.2) * np.cos(t * 0.7 + 1)
    c1, c2, c3, c4 = hexrgb("#F3DDB0"), hexrgb("#D9A96C"), hexrgb("#B7744A"), hexrgb("#EFE6D2")
    col = c1 * (1 - bands[..., None]) + c2 * bands[..., None]
    belt = smoothstep(0.55, 0.9, np.abs(np.sin(t * 0.9 + 0.4)))
    col = col * (1 - 0.45 * belt[..., None]) + c3 * 0.45 * belt[..., None]
    pale = smoothstep(0.75, 0.95, np.abs(lat))
    col = col * (1 - pale[..., None] * 0.5) + c4 * pale[..., None] * 0.5
    # Storm spot.
    sx, sy = cx + 0.35 * r, cy + 0.32 * r
    sd = np.sqrt(((dx - (sx - cx)) / 30) ** 2 + ((dy - (sy - cy)) / 17) ** 2)
    col = col * (1 - 0.6 * smoothstep(1.0, 0.4, sd)[..., None]) + hexrgb("#C2603A") * 0.6 * smoothstep(1.0, 0.4, sd)[..., None]
    L = np.array([-0.62, -0.38, 0.68])
    L = L / np.linalg.norm(L)
    lam = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    shade = 0.12 + 0.95 * lam**0.85
    planet_rgb = col * shade[..., None]
    # Ring shadow across the planet (thin dark band just south of the ring line).
    ux = dx * math.cos(rot) + dy * math.sin(rot)
    uy = -dx * math.sin(rot) + dy * math.cos(rot)
    planet_rgb *= (1 - 0.45 * np.exp(-((uy - 0.2 * r) / 6) ** 2) * (np.abs(ux) < r))[..., None]
    planet = rgba_layer(planet_rgb, cov)
    # Ring in its own plane.
    rv = uy / tilt
    rr = np.sqrt(ux * ux + rv * rv) / r
    prof = (
        smoothstep(1.3, 1.36, rr) * smoothstep(2.35, 2.28, rr)
        * (0.55 + 0.45 * np.sin(rr * 46) ** 2)
        * (1 - 0.9 * np.exp(-((rr - 1.92) / 0.035) ** 2))
        * (0.7 + 0.3 * smoothstep(1.4, 1.75, rr))
    )
    ring_col = hexrgb("#E9D3AA") * (0.75 + 0.25 * np.sin(rr * 13)[..., None]) * (0.65 + 0.35 * (ux / (2.4 * r) * -1 + 0.5))[..., None]
    # Planet's shadow on the far ring (behind the planet, on the side away from the light).
    shadow = (ux > 0) & (np.abs(rv) < r * 0.98) & (rv < 0)
    ring_a = np.clip(prof * 0.95, 0, 1)
    ring_a_aa = blur(ring_a, 0.6)
    back = rgba_layer(ring_col * np.where(shadow, 0.35, 1.0)[..., None], np.where(rv < 0, ring_a_aa, 0).astype(np.float32))
    front = rgba_layer(ring_col, np.where(rv >= 0, ring_a_aa, 0).astype(np.float32))
    img = premul_over(back, planet)
    img = premul_over(img, front)
    halo_a = np.where(d > r, 0.25 * np.exp(-(d - r) / 18), 0) * (1 - img[..., 3])
    halo = rgba_layer(hexrgb("#FFE2B8"), halo_a.astype(np.float32))
    return premul_over(halo, img)


def blood_moon(rng):
    w, h = HERO["small"]
    cx, cy, r = w / 2, h / 2, 190
    nx, ny, nz, cov, d = sphere(h, w, cx, cy, r)
    maria = smoothstep(0.5, 0.64, fbm(h, w, 110, 4, rng))
    fine = fbm(h, w, 8, 3, rng)
    sh, fl = craters(h, w, cx, cy, r, rng, 60, 0.015, 0.1)
    alb = 0.9 - 0.32 * maria - 0.08 * fl + 0.08 * (fine - 0.5) + sh * 0.8
    # Eclipse light: brighter copper limb at lower left, deep red elsewhere.
    edge = np.clip(-nx * 0.6 + ny * 0.55, -1, 1) * 0.5 + 0.5
    deep, copper, gold = hexrgb("#5A140C"), hexrgb("#B9411D"), hexrgb("#F08A3C")
    col = deep * (1 - edge[..., None]) + copper * edge[..., None]
    col = col + gold * (smoothstep(0.7, 1.0, edge) * 0.35)[..., None]
    col = col * (alb * (0.72 + 0.28 * nz**0.5))[..., None]
    moon = rgba_layer(col, cov)
    halo_a = np.where(d > r, 0.38 * np.exp(-(d - r) / 16) + 0.12 * np.exp(-(d - r) / 55), 0) * (1 - cov)
    halo = rgba_layer(hexrgb("#FF6A3A"), halo_a.astype(np.float32))
    return premul_over(halo, moon)


# --------------------------------------------------------------------------- sunset dunes


def streaks(h, w, rng, cell=40, squash=8):
    """Horizontal wispy streak noise in 0..1 (noise stretched sideways)."""
    small = fbm(h, max(8, w // squash), cell, 4, rng)
    return np.asarray(Image.fromarray(small, mode="F").resize((w, h), Image.BICUBIC), np.float32)


def dunes_wallpaper(rng):
    sky = vgrad(
        H,
        W,
        [(0, "#1E0F3A"), (0.2, "#3C1650"), (0.38, "#7A2A62"), (0.5, "#C8495E"), (0.6, "#F07F55"), (0.66, "#FFB565"), (0.7, "#FFD99A")],
    )
    dx, dy = grid(H, W, 0, 0)
    yy = dy / H
    # Low sun glow just under the dune line.
    gx, gy = W * 0.64, H * 0.68
    gd = np.sqrt(((dx - gx) / W) ** 2 + ((dy - gy) / W) ** 2 * 1.6)
    sky += (np.exp(-(gd / 0.22) ** 2) * 0.35)[..., None] * np.array([1.0, 0.75, 0.4])
    sky += (np.exp(-(gd / 0.6) ** 2) * 0.12)[..., None] * np.array([1.0, 0.5, 0.4])
    # Long wispy clouds, lit pink-gold from below.
    st = streaks(H, W, rng)
    n = fbm(H, W, 200, 4, rng)
    cl = smoothstep(0.55, 0.78, st * 0.8 + n * 0.2) * smoothstep(0.12, 0.3, yy) * smoothstep(0.62, 0.42, yy)
    lit = np.clip(1 - (0.6 - yy) * 2.4, 0, 1)[..., None]
    cloud_col = hexrgb("#5A2358") * (1 - lit) + hexrgb("#FFB08A") * lit
    sky = over(sky, cloud_col, cl * 0.6)
    # Twilight stars at the top.
    top = smoothstep(0.32, 0.05, yy)
    sky += stars(H, W, rng, 900, 4.0, 0.7, density=top) * top[..., None]
    # Dune layers, far (hazy) to near (deep plum), lit from the right (the sun).
    xs = np.arange(W, dtype=np.float32)
    layers = [
        (0.66, 0.022, 0.7, "#F09A74", "#C76A6C", 3),
        (0.71, 0.04, 1.1, "#D2645E", "#8E3A5A", 5),
        (0.785, 0.055, 0.8, "#A2414F", "#5A2148", 7),
        (0.875, 0.07, 1.25, "#6A2644", "#2C1131", 9),
    ]
    for i, (base, amp, freq, lit_c, shade_c, seed) in enumerate(layers):
        r2 = np.random.default_rng(seed)
        ph = r2.random(4) * 6.28
        x = xs / W
        smooth = amp * (0.62 * np.sin(x * 2 * math.pi * freq + ph[0]) + 0.3 * np.sin(x * 2 * math.pi * freq * 2.3 + ph[1]))
        top_y = H * (base - smooth - amp * 0.05 * np.sin(x * 31 + ph[2]))
        slope = np.gradient(H * (base - smooth))
        # Lit face: where the ground rises toward the sun (right). A soft terminator between faces.
        facing = smoothstep(-0.25, 0.25, -slope)
        below = np.clip((dy - top_y[None, :]) / (H * 0.1), 0, 1)
        # Faces lit or shadowed near the crest, settling into one body colour lower down.
        near = np.exp(-np.clip(dy - top_y[None, :], 0, None) / (H * 0.035))
        lit_amt = 0.4 * (1 - near) + near * (0.15 + 0.85 * facing[None, :])
        lit_amt = lit_amt * (1 - 0.3 * below)
        col = hexrgb(shade_c) * (1 - lit_amt[..., None]) + hexrgb(lit_c) * lit_amt[..., None]
        # Haze at the foot of far dunes.
        col = over(col, hexrgb("#FFB98A"), (0.18 * smoothstep(0.0, 1.0, below) * (1 - i / 3)).astype(np.float32))
        # Bright crest line.
        crest = np.exp(-((dy - top_y[None, :]) / 2.4) ** 2) * (0.25 + 0.75 * facing[None, :])
        col = col + crest[..., None] * hexrgb("#FFD2A0") * 0.55
        if i == len(layers) - 1:
            ripple = 0.5 + 0.5 * np.sin(dy * 0.08 + np.sin(dx * 0.004) * 18 + fbm(H, W, 80, 2, rng) * 6)
            col = col * (0.94 + 0.06 * ripple[..., None])
        m = np.clip(dy - top_y[None, :] + 0.5, 0, 1)
        sky = over(sky, col, m)
    return sky


def setting_sun(rng):
    w, h = HERO["large"]
    cx, cy, r = w / 2, h * 0.48, 300
    dx, dy = grid(h, w, cx, cy)
    d = np.sqrt(dx**2 + dy**2)
    cov = np.clip(r - d + 0.5, 0, 1)
    t = np.clip((dy + r) / (2 * r), 0, 1)
    col = hexrgb("#FFF4C4") * (1 - t[..., None]) + hexrgb("#FF8C4E") * t[..., None]
    col = col * (1 - 0.1 * (d / r)[..., None] ** 4)
    sun = rgba_layer(col, cov)
    glow_a = np.where(d > r, 0.5 * np.exp(-(d - r) / 28) + 0.2 * np.exp(-(d - r) / 110), 0) * (1 - cov)
    glow = rgba_layer(hexrgb("#FFB070"), glow_a.astype(np.float32))
    img = premul_over(glow, sun)
    # Two soft wisps of cloud drifting across the lower half, with a gold lit edge.
    st = streaks(h, w, rng, cell=30, squash=10)
    band = np.exp(-((dy - r * 0.38) / 34) ** 2) + 0.8 * np.exp(-((dy - r * 0.72) / 26) ** 2)
    dens = smoothstep(0.42, 0.7, st) * band * smoothstep(w * 0.5, w * 0.2, np.abs(dx))
    dens = blur(dens, 2)
    edge = np.clip(dens - np.roll(dens, 5, axis=0), 0, 1)
    ccol = hexrgb("#9C3F6E") + (hexrgb("#FFC890") - hexrgb("#9C3F6E")) * np.clip(edge * 4, 0, 1)[..., None]
    return premul_over(img, rgba_layer(ccol, np.clip(dens * 0.9, 0, 0.9).astype(np.float32)))


def cloud_bank(rng):
    w, h = HERO["medium"]
    dx, dy = grid(h, w, 0, 0)
    base_y = h * 0.66
    dens = np.zeros((h, w), np.float32)
    # A cumulus built from soft puffs along a flat base, tallest in the middle.
    for k in range(26):
        u = rng.random()
        x = w * (0.12 + 0.76 * u)
        tall = math.sin(u * math.pi)
        r = 40 + 95 * tall * (0.6 + 0.4 * rng.random())
        y = base_y - r * (0.35 + 0.5 * rng.random()) * (0.5 + tall)
        dd = np.sqrt((dx - x) ** 2 + (dy - y) ** 2)
        dens = np.maximum(dens, smoothstep(r, r * 0.55, dd))
    dens *= smoothstep(base_y + 14, base_y - 18, dy)
    n = fbm(h, w, 40, 3, rng)
    dens = np.clip(dens * (0.9 + 0.2 * (n - 0.5)) * 1.1, 0, 1)
    soft = blur(dens, 10)
    gy, gx = np.gradient(soft)
    # Light from the low sun (below right).
    light = np.clip((gx * -0.6 + gy * -0.8) * 40, -1, 1)
    under = smoothstep(base_y - 120, base_y, dy)
    body = hexrgb("#7E3A78") * (1 - under[..., None]) + hexrgb("#D9667A") * under[..., None]
    body = body + hexrgb("#FFB98A") * (np.clip(light, 0, 1) * 0.75)[..., None]
    body = body * (1 - 0.25 * np.clip(-light, 0, 1))[..., None]
    rim = np.clip(dens - blur(dens, 4), 0, 1) * 2.5
    body = body + hexrgb("#FFD9A6") * (rim * under * 0.6)[..., None]
    a = smoothstep(0.05, 0.5, blur(dens, 1.2)) * 0.97
    return rgba_layer(np.clip(body, 0, 1), a.astype(np.float32))


def crescent_star(rng):
    w, h = HERO["small"]
    cx, cy, r = w * 0.47, h * 0.52, 165
    dx, dy = grid(h, w, cx, cy)
    d = np.sqrt(dx**2 + dy**2)
    d2 = np.sqrt((dx - 72) ** 2 + (dy + 40) ** 2)
    disc = np.clip(r - d + 0.5, 0, 1)
    bite = np.clip(r * 0.92 - d2 + 0.5, 0, 1)
    cres = disc * (1 - bite)
    shade = 0.85 + 0.15 * np.clip(-dx / r, -1, 1)
    col = hexrgb("#FFE2B0") * shade[..., None]
    moon = rgba_layer(col, cres)
    halo_a = 0.35 * np.exp(-blur(1 - cres, 0) * 0 - np.clip(d - r, 0, None) / 22) * (d > r * 0.9) * (1 - cres)
    halo_a = blur(cres, 14) * 0.6 * (1 - cres)
    halo = rgba_layer(hexrgb("#FFC07A"), halo_a.astype(np.float32))
    img = premul_over(halo, moon)
    # Evening star: four-point sparkle.
    sx, sy = w * 0.78, h * 0.27
    ex, ey = grid(h, w, sx, sy)
    ed = np.sqrt(ex**2 + ey**2)
    spark = np.exp(-ed / 5) + 0.7 * (np.exp(-np.abs(ex) / 2.2) * np.exp(-np.abs(ey) / 26) + np.exp(-np.abs(ey) / 2.2) * np.exp(-np.abs(ex) / 26))
    spark += 0.3 * np.exp(-ed / 18)
    star = rgba_layer(hexrgb("#FFF6E0"), np.clip(spark, 0, 1).astype(np.float32))
    return premul_over(img, star)


# --------------------------------------------------------------------------- deep sea


def sea_wallpaper(rng):
    sea = vgrad(H, W, [(0, "#2C9AB0"), (0.12, "#167A97"), (0.35, "#0B4F75"), (0.65, "#062B4E"), (1, "#020A1C")])
    dx, dy = grid(H, W, 0, 0)
    yy = dy / H
    # Caustic shimmer near the surface.
    n1 = fbm(H, W, 80, 3, rng)
    caus = blur((1 - np.abs(n1 * 2 - 1)) ** 6, 1.5) * smoothstep(0.2, 0.0, yy)
    sea += caus[..., None] * np.array([0.07, 0.11, 0.11])
    # God rays: slanted beams from the top, broken up by noise and fading with depth.
    ang = math.radians(12)
    u = (dx - W * 0.35) * math.cos(ang) + dy * math.sin(ang)
    beams = Image.fromarray(value_noise(1, W * 2, 26, rng)[0][None, :].repeat(2, axis=0), mode="F").resize((W * 2, 1), Image.BICUBIC)
    bv = np.asarray(beams, np.float32)[0]
    ui = np.clip((u + W * 0.5).astype(np.int32), 0, W * 2 - 1)
    rays = smoothstep(0.55, 0.85, bv[ui]) * smoothstep(0.75, 0.0, yy) * 0.28
    sea += rays[..., None] * np.array([0.55, 0.85, 0.9])
    # Marine snow and distant glow particles.
    snow = stars(H, W, rng, 2600, 5.0, 0.45, density=np.clip(0.3 + yy, 0, 1), tint_warm=0.0)
    sea += snow * np.array([0.6, 0.9, 1.0])
    # A few drifting bubbles on the right.
    bub = np.zeros((H, W), np.float32)
    hi = np.zeros((H, W), np.float32)
    for k in range(34):
        bx = W * (0.78 + 0.06 * math.sin(k * 1.3)) + rng.normal(0, 18)
        by = H * (0.18 + 0.62 * rng.random())
        br = 6 + 22 * rng.random() ** 2
        ddx, ddy = dx - bx, dy - by
        dd = np.sqrt(ddx**2 + ddy**2)
        m = dd < br + 3
        if not m.any():
            continue
        ring = np.exp(-((dd - br) / 1.4) ** 2)
        bub = np.maximum(bub, ring * 0.55 + np.clip(br - dd, 0, 1) * 0.06)
        hi = np.maximum(hi, np.exp(-(((ddx + br * 0.35) ** 2 + (ddy + br * 0.4) ** 2) / (br * 0.22 + 0.8) ** 2)))
    sea += (bub * 0.5 + hi * 0.6)[..., None] * np.array([0.7, 0.95, 1.0])
    # Seabed and kelp silhouettes.
    xs = np.arange(W, dtype=np.float32) / W
    bed = H * (0.93 + 0.02 * np.sin(xs * 5 + 1) + 0.012 * np.sin(xs * 17)) + 12 * value_noise(1, W, 30, rng)[0]
    kelp = np.zeros((H, W), np.float32)
    for k, (kx, kh, kw) in enumerate([(0.07, 0.36, 44), (0.16, 0.26, 34), (0.89, 0.3, 40), (0.97, 0.42, 48), (0.55, 0.14, 26)]):
        y0 = H * 0.96
        ys = np.linspace(y0, y0 - H * kh, 220)
        xcs = W * kx + 40 * np.sin(np.linspace(0, 3.2, 220) + k) * np.linspace(0, 1, 220)
        for j, (x, y) in enumerate(zip(xcs, ys)):
            wdt = kw * (1 - j / 260)
            ya, yb = int(max(0, y - 8)), int(min(H, y + 8))
            xa, xb = int(max(0, x - wdt - 30)), int(min(W, x + wdt + 30))
            sx = dx[ya:yb, xa:xb] - x
            sy = dy[ya:yb, xa:xb] - y
            blade = np.clip(wdt * 0.42 * (1 + 0.45 * math.sin(j * 0.21 + k)) - np.abs(sx) + 0.5, 0, 1)
            if j % 12 == 6:
                side = 1 if j % 24 == 6 else -1
                lx_ = sx - side * wdt * 1.1
                leaf = np.clip(1 - (lx_ / (wdt * 1.15)) ** 2 - ((sy + side * lx_ * 0.35) / 11) ** 2, 0, 1)
                blade = np.maximum(blade, smoothstep(0, 0.2, leaf))
            kelp[ya:yb, xa:xb] = np.maximum(kelp[ya:yb, xa:xb], blade)
    sea = over(sea, hexrgb("#03182C"), blur(kelp, 0.8) * 0.92)
    bedm = np.clip(dy - bed[None, :] + 0.5, 0, 1)
    sea = over(sea, hexrgb("#020814"), bedm)
    return sea


def jellyfish(w, h, cx, top, bell_w, bell_h, hue_a, hue_b, rng, tentacles=14, length=1.0):
    """A translucent jellyfish (straight alpha RGBA), bell at (cx, top)."""
    dx, dy = grid(h, w, cx, top + bell_h)
    # Bell: upper half-ellipse with a scalloped rim.
    ex = dx / bell_w
    ey = dy / bell_h
    rim_wave = 0.03 * np.abs(np.cos(ex * math.pi * 7)) - 0.24 * np.clip(1 - ex**2, 0, 1)
    e = np.sqrt(ex**2 + np.minimum(ey, 0) ** 2)
    edge_cov = np.clip((1 - e) * bell_w * 0.9, 0, 1) * np.clip((rim_wave - ey) * bell_h, 0, 1)
    edge_cov = np.where(ey < 1, edge_cov, 0)
    fres = smoothstep(0.55, 1.0, e)
    a_bell = edge_cov * (0.32 + 0.55 * fres)
    canals = blur(np.abs(np.sin(np.arctan2(ex, -ey + 0.15) * 8)) ** 16 * smoothstep(0.95, 0.5, e) * smoothstep(0.1, 0.4, e), 2) * 0.22
    core = np.exp(-((ex / 0.42) ** 2 + ((ey + 0.45) / 0.35) ** 2)) * 0.55
    ca, cb = hexrgb(hue_a), hexrgb(hue_b)
    bell_rgb = ca * (1 - fres[..., None]) + cb * fres[..., None] + np.array([1, 1, 1]) * (canals + core * 0.7)[..., None] * 0.6
    a_bell = np.clip(a_bell + canals * edge_cov + core * edge_cov * 0.5, 0, 1)
    img = rgba_layer(np.clip(bell_rgb, 0, 1), a_bell.astype(np.float32))
    # Tentacles and frilly oral arms (drawn as soft polylines).
    lines = np.zeros((h, w), np.float32)
    lines_col = np.zeros((h, w), np.float32)
    ys_all = np.arange(h, dtype=np.float32)
    for k in range(tentacles):
        fx = -0.92 + 1.84 * (k + 0.5) / tentacles
        x0 = cx + fx * bell_w
        y0 = top + bell_h + 0.03 * bell_h
        L = (h - y0 - 8) * length * (0.6 + 0.4 * rng.random())
        ph = rng.random() * 6.28
        amp = 10 + 18 * rng.random()
        rows = (ys_all >= y0) & (ys_all < y0 + L)
        yy = ys_all[rows]
        t = (yy - y0) / L
        xx = x0 + fx * 30 * t + amp * np.sin(t * 7 + ph) * t
        width = 1.3 * (1 - t) + 0.5
        fade = (1 - t) ** 1.3
        for yi, xc, wd, fd in zip(yy.astype(int), xx, width, fade):
            xa, xb = int(max(0, xc - 4)), int(min(w, xc + 5))
            px = np.arange(xa, xb, dtype=np.float32)
            v = np.clip(wd - np.abs(px - xc) + 0.5, 0, 1) * fd
            lines[yi, xa:xb] = np.maximum(lines[yi, xa:xb], v * 0.85)
    for k in range(4):
        fx = (-0.3 + 0.2 * k) * bell_w
        x0 = cx + fx
        y0 = top + bell_h * 0.78
        L = bell_h * (2.2 + 0.6 * rng.random()) * length
        ph = rng.random() * 6.28
        rows = (ys_all >= y0) & (ys_all < min(h - 4, y0 + L))
        yy = ys_all[rows]
        t = (yy - y0) / L
        xx = x0 + 22 * np.sin(t * 5 + ph) * t
        width = 7 * (1 - t) ** 0.7 + 2 + 3 * np.sin(t * 40 + ph) ** 2 * (1 - t)
        for yi, xc, wd, tt in zip(yy.astype(int), xx, width, t):
            xa, xb = int(max(0, xc - wd - 2)), int(min(w, xc + wd + 3))
            px = np.arange(xa, xb, dtype=np.float32)
            v = np.clip(wd - np.abs(px - xc) + 0.5, 0, 1) * (1 - tt) ** 1.1
            lines_col[yi, xa:xb] = np.maximum(lines_col[yi, xa:xb], v * 0.7)
    ten = rgba_layer(cb * 0.9 + 0.1, lines)
    arms = rgba_layer(ca * 0.7 + cb * 0.3 + 0.08, lines_col)
    body = premul_over(premul_over(ten, arms), img)
    # Bioluminescent glow.
    glow_src = blur(np.maximum(a_bell, lines_col * 0.6), 18)
    glow = rgba_layer(cb, (np.clip(glow_src * 0.9, 0, 0.5) * (1 - body[..., 3])).astype(np.float32))
    return premul_over(glow, body)


def big_jelly(rng):
    w, h = HERO["large"]
    return jellyfish(w, h, w / 2, 70, 300, 250, "#F7B6E8", "#B67CFF", rng, tentacles=18)


def jelly_pair(rng):
    w, h = HERO["medium"]
    a = jellyfish(w, h, w * 0.33, 30, 120, 100, "#9FF3FF", "#3FC8E8", rng, tentacles=10, length=0.95)
    b = jellyfish(w, h, w * 0.7, 120, 80, 66, "#FFD0F2", "#E07AD8", rng, tentacles=8, length=0.9)
    return premul_over(a, b)


def bubbles(rng):
    w, h = HERO["small"]
    out = np.zeros((h, w, 4), np.float32)
    dx, dy = grid(h, w, 0, 0)
    spots = []
    for k in range(16):
        r = 10 + 70 * rng.random() ** 2.4
        if k == 0:
            r = 92
        x = w * 0.5 + rng.normal(0, w * 0.17)
        y = h * (0.15 + 0.7 * rng.random())
        if k == 0:
            x, y = w * 0.46, h * 0.55
        spots.append((x, y, r))
    for x, y, r in sorted(spots, key=lambda s: s[2]):
        ddx, ddy = dx - x, dy - y
        d = np.sqrt(ddx**2 + ddy**2)
        cov = np.clip(r - d + 0.5, 0, 1)
        q = np.clip(d / r, 0, 1)
        fres = q**3.2
        alpha = cov * (0.08 + 0.75 * fres)
        col = hexrgb("#7EE8F2") * (1 - fres[..., None]) + hexrgb("#E9FDFF") * fres[..., None]
        hl = np.exp(-(((ddx + r * 0.38) ** 2 + (ddy + r * 0.42) ** 2) / (r * 0.18) ** 2))
        hl2 = np.exp(-(((ddx - r * 0.35) ** 2 + (ddy - r * 0.45) ** 2) / (r * 0.1) ** 2)) * 0.5
        col = col + (hl + hl2)[..., None]
        alpha = np.clip(alpha + (hl + hl2) * cov, 0, 1)
        out = premul_over(out, rgba_layer(np.clip(col, 0, 1), alpha.astype(np.float32)))
    glow = rgba_layer(hexrgb("#5EE1D9"), (blur(out[..., 3], 12) * 0.35 * (1 - out[..., 3])).astype(np.float32))
    return premul_over(glow, out)


# --------------------------------------------------------------------------- packs

PACKS = [
    {
        "id": "starry-night",
        "palette": {"bg": "#0A0F24", "tile": "#161C2E", "glyph": "#FFFFFF", "accent": "#F4D58D", "text": "#EEF1FF"},
        "meta": {
            "name": "Starry Night",
            "mood": "A quiet sky full of stars, with moons and a ringed planet floating in it.",
            "tags": ["dark", "space", "stars", "night", "moon", "planet", "sky", "calm"],
            "credits": "Glaze (original procedural art)",
            "licence": "original",
            "generator": "procedural",
            "prompt": "",
            "addedAt": ADDED_AT,
        },
        "wallpaper": starry_wallpaper,
        "heroes": {"large": full_moon, "medium": gas_giant, "small": blood_moon},
        "seed": 1024,
    },
    {
        "id": "sunset-dunes",
        "palette": {"bg": "#2A1233", "tile": "#3B1A3A", "glyph": "#FFE8D2", "accent": "#FF9A5A", "text": "#FFF3E8"},
        "meta": {
            "name": "Sunset Dunes",
            "mood": "Warm desert dusk: glowing dunes, a low sun and the first evening star.",
            "tags": ["nature", "desert", "sunset", "dunes", "warm", "orange", "pink", "summer"],
            "credits": "Glaze (original procedural art)",
            "licence": "original",
            "generator": "procedural",
            "prompt": "",
            "addedAt": ADDED_AT,
        },
        "wallpaper": dunes_wallpaper,
        "heroes": {"large": setting_sun, "medium": cloud_bank, "small": crescent_star},
        "seed": 2048,
    },
    {
        "id": "deep-sea",
        "palette": {"bg": "#04182E", "tile": "#0C2A40", "glyph": "#E6FBFF", "accent": "#5EE1D9", "text": "#E9FAFF"},
        "meta": {
            "name": "Deep Sea",
            "mood": "Sunbeams fading into blue, glowing jellyfish and drifting bubbles.",
            "tags": ["dark", "nature", "ocean", "sea", "jellyfish", "underwater", "blue", "calm"],
            "credits": "Glaze (original procedural art)",
            "licence": "original",
            "generator": "procedural",
            "prompt": "",
            "addedAt": ADDED_AT,
        },
        "wallpaper": sea_wallpaper,
        "heroes": {"large": big_jelly, "medium": jelly_pair, "small": bubbles},
        "seed": 4096,
    },
]

HERO_FILES = {"small": "widget-small.png", "medium": "widget-medium.png", "large": "widget-large.png"}


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(prefix="glaze-starter-packs-")
    only = set(sys.argv[2:])
    os.makedirs(out, exist_ok=True)
    total = 0
    for p in PACKS:
        if only and p["id"] not in only:
            continue
        d = os.path.join(out, p["id"])
        os.makedirs(d, exist_ok=True)
        rng = np.random.default_rng(p["seed"])
        n = save_wallpaper(p["wallpaper"](rng), os.path.join(d, "wallpaper.png"))
        sizes = {"wallpaper.png": n}
        for slot, fn in p["heroes"].items():
            rng_h = np.random.default_rng(p["seed"] + len(slot))
            sizes[HERO_FILES[slot]] = save_hero(fn(rng_h), os.path.join(d, HERO_FILES[slot]))
        with open(os.path.join(d, "palette.json"), "w") as f:
            json.dump(p["palette"], f, indent=2)
            f.write("\n")
        with open(os.path.join(d, "meta.json"), "w") as f:
            json.dump(p["meta"], f, indent=2)
            f.write("\n")
        pack_total = sum(sizes.values())
        total += pack_total
        print(p["id"], ", ".join(f"{k} {v / 1000:.0f} kB" for k, v in sizes.items()), f"(pack {pack_total / 1000:.0f} kB)")
    print(f"total {total / 1000:.0f} kB -> {out}")


if __name__ == "__main__":
    main()
