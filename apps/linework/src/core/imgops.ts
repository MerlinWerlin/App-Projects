// Small, allocation-aware image operations on single-channel Float32 planes (row-major, w x h).
// Pure TypeScript for the outline pipeline; every filter is O(pixels) regardless of radius.

export type Plane = Float32Array;

/** Horizontal + vertical running-sum box blur of radius r (window 2r + 1), clamp-to-edge. */
export function boxBlur(src: Plane, w: number, h: number, r: number, out?: Plane, tmp?: Plane): Plane {
  const n = w * h;
  const t = tmp && tmp.length >= n && tmp !== src ? tmp : new Float32Array(n);
  const o = out && out.length >= n ? out : new Float32Array(n);
  r = Math.max(0, Math.floor(r));
  if (r === 0) {
    if (o !== src) o.set(src.subarray(0, n));
    return o;
  }
  const inv = 1 / (2 * r + 1);
  // Horizontal pass: src -> t. Edges clamp; the interior runs without bounds checks.
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const last = row + w - 1;
    let acc = src[row] * (r + 1);
    for (let k = 1; k <= r; k++) acc += src[row + (k < w ? k : w - 1)];
    const xa = Math.min(w, r), xb = Math.max(xa, w - r - 1);
    let x = 0;
    for (; x < xa; x++) {
      t[row + x] = acc * inv;
      const add = row + x + r + 1;
      acc += src[add <= last ? add : last] - src[row];
    }
    for (; x < xb; x++) {
      t[row + x] = acc * inv;
      acc += src[row + x + r + 1] - src[row + x - r];
    }
    for (; x < w; x++) {
      t[row + x] = acc * inv;
      const sub = row + x - r;
      acc += src[last] - src[sub >= row ? sub : row];
    }
  }
  // Vertical pass, row-major so memory is read in order: running column sums in `col`.
  const col = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let acc = t[x] * (r + 1);
    for (let k = 1; k <= r; k++) acc += t[(k < h ? k : h - 1) * w + x];
    col[x] = acc;
  }
  const lastRow = (h - 1) * w;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let addRow = (y + r + 1) * w;
    if (addRow > lastRow) addRow = lastRow;
    let subRow = (y - r) * w;
    if (subRow < 0) subRow = 0;
    for (let x = 0; x < w; x++) {
      o[row + x] = col[x] * inv;
      col[x] += t[addRow + x] - t[subRow + x];
    }
  }
  return o;
}

/** Box radii whose three passes approximate a Gaussian of standard deviation sigma. */
export function boxesForGauss(sigma: number): [number, number, number] {
  const n = 3;
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  const sizes = [0, 1, 2].map((i) => (i < m ? wl : wu));
  return [(sizes[0] - 1) / 2, (sizes[1] - 1) / 2, (sizes[2] - 1) / 2].map((v) => Math.max(0, v)) as [number, number, number];
}

/**
 * Gaussian blur. Sigmas below 1 use an exact separable kernel (radius 2.5 sigma; box
 * approximations are too coarse there); larger ones use three box passes (O(1) per pixel).
 */
export function gaussBlur(src: Plane, w: number, h: number, sigma: number, out?: Plane, tmp?: Plane): Plane {
  const n = w * h;
  const o = out && out.length >= n ? out : new Float32Array(n);
  const t = tmp && tmp.length >= n && tmp !== src && tmp !== o ? tmp : new Float32Array(n);
  if (!(sigma > 0.05)) {
    if (o !== src) o.set(src.subarray(0, n));
    return o;
  }
  if (sigma < 1) {
    const rad = Math.max(1, Math.ceil(sigma * 2.5));
    const K = 2 * rad + 1;
    const k = new Float32Array(K);
    let s = 0;
    for (let i = -rad; i <= rad; i++) s += k[i + rad] = Math.exp((-i * i) / (2 * sigma * sigma));
    for (let i = 0; i < K; i++) k[i] /= s;
    // Horizontal: src -> t
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let acc = 0;
        if (x >= rad && x < w - rad) {
          const base = row + x - rad;
          for (let i = 0; i < K; i++) acc += src[base + i] * k[i];
        } else {
          for (let i = -rad; i <= rad; i++) {
            let xx = x + i;
            xx = xx < 0 ? 0 : xx >= w ? w - 1 : xx;
            acc += src[row + xx] * k[i + rad];
          }
        }
        t[row + x] = acc;
      }
    }
    // Vertical: t -> o, row-major accumulation.
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) o[row + x] = 0;
      for (let i = -rad; i <= rad; i++) {
        let yy = y + i;
        yy = yy < 0 ? 0 : yy >= h ? h - 1 : yy;
        const kr = k[i + rad];
        const srow = yy * w;
        for (let x = 0; x < w; x++) o[row + x] += t[srow + x] * kr;
      }
    }
    return o;
  }
  const [a, b, c] = boxesForGauss(sigma);
  // Ping-pong between o and t (boxBlur keeps its own scratch when tmp aliases its input).
  boxBlur(src, w, h, a, o);
  boxBlur(o, w, h, b, t);
  boxBlur(t, w, h, c, o);
  return o;
}

/**
 * Self-guided filter (He et al.): edge-preserving smoothing. Flattens texture whose variance is
 * below eps (skin pores, paper grain, fur noise) while keeping edges whose variance is above it.
 * Values are expected in 0..1. `epsMap` (optional, same size) scales eps per pixel.
 */
/** Working size the guided filter uses internally for (w, h, r): pass an eps map at this size. */
export function guidedSize(w: number, h: number, r: number): [number, number] {
  const sub = r >= 3 && w >= 64 && h >= 64 ? 2 : 1;
  return [Math.max(1, Math.round(w / sub)), Math.max(1, Math.round(h / sub))];
}

export function guidedFilter(
  I: Plane, w: number, h: number, r: number, eps: number,
  epsMap?: { data: Plane; width: number; height: number },
): Plane {
  // Fast guided filter (He & Sun 2015): coefficients on a half-size copy, applied at full size.
  const sub = r >= 3 && w >= 64 && h >= 64 ? 2 : 1;
  const sw = Math.max(1, Math.round(w / sub)), sh = Math.max(1, Math.round(h / sub));
  const Is = sub === 1 ? I : resizePlane(I, w, h, sw, sh);
  const em = epsMap
    ? (epsMap.width === sw && epsMap.height === sh ? epsMap.data : resizePlane(epsMap.data, epsMap.width, epsMap.height, sw, sh))
    : undefined;
  const rs = Math.max(1, Math.round(r / sub));
  const n = sw * sh;
  const tmp = new Float32Array(n);
  const mean = boxBlur(Is, sw, sh, rs, undefined, tmp);
  const sq = new Float32Array(n);
  for (let i = 0; i < n; i++) sq[i] = Is[i] * Is[i];
  const meanSq = boxBlur(sq, sw, sh, rs, undefined, tmp);
  const a = sq; // reuse
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = meanSq[i] - mean[i] * mean[i];
    const e = em ? eps * em[i] : eps;
    const ai = v / (v + e);
    a[i] = ai;
    b[i] = mean[i] * (1 - ai);
  }
  let ma = boxBlur(a, sw, sh, rs, meanSq, tmp);
  let mb = boxBlur(b, sw, sh, rs, mean, tmp);
  if (sub !== 1) {
    ma = resizePlane(ma, sw, sh, w, h);
    mb = resizePlane(mb, sw, sh, w, h);
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = ma[i] * I[i] + mb[i];
  return out;
}

/**
 * Resize a plane to (dw, dh): bilinear with precomputed column taps, after a 2x2 box reduction
 * for each halving so big downscales still average every pixel.
 */
export function resizePlane(src: Plane, w: number, h: number, dw: number, dh: number): Plane {
  let cur = src, cw = w, ch = h;
  while (cw >= dw * 2 && ch >= dh * 2) {
    const nw = cw >> 1, nh = ch >> 1;
    const half = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) {
      const r0 = 2 * y * cw, r1 = r0 + cw, o = y * nw;
      for (let x = 0; x < nw; x++) {
        const i = r0 + 2 * x, j = r1 + 2 * x;
        half[o + x] = (cur[i] + cur[i + 1] + cur[j] + cur[j + 1]) * 0.25;
      }
    }
    cur = half; cw = nw; ch = nh;
  }
  if (cw === dw && ch === dh) return cur === src ? Float32Array.from(src) : cur;
  const out = new Float32Array(dw * dh);
  const sx = cw / dw, sy = ch / dh;
  const x0s = new Int32Array(dw), x1s = new Int32Array(dw), fxs = new Float32Array(dw);
  for (let x = 0; x < dw; x++) {
    let fx = (x + 0.5) * sx - 0.5;
    if (fx < 0) fx = 0;
    const x0 = Math.min(cw - 1, Math.floor(fx));
    x0s[x] = x0;
    x1s[x] = Math.min(cw - 1, x0 + 1);
    fxs[x] = fx - x0;
  }
  for (let y = 0; y < dh; y++) {
    let fy = (y + 0.5) * sy - 0.5;
    if (fy < 0) fy = 0;
    const y0 = Math.min(ch - 1, Math.floor(fy));
    const r0 = y0 * cw, r1 = Math.min(ch - 1, y0 + 1) * cw;
    const ty = fy - y0;
    const o = y * dw;
    for (let x = 0; x < dw; x++) {
      const a = x0s[x], b = x1s[x], t = fxs[x];
      const top = cur[r0 + a] + (cur[r0 + b] - cur[r0 + a]) * t;
      const bot = cur[r1 + a] + (cur[r1 + b] - cur[r1 + a]) * t;
      out[o + x] = top + (bot - top) * ty;
    }
  }
  return out;
}

/** Otsu threshold of values in 0..1. */
export function otsu(v: Plane, bins = 64): number {
  const hist = new Float64Array(bins);
  for (let i = 0; i < v.length; i++) {
    let b = (v[i] * bins) | 0;
    if (b < 0) b = 0;
    if (b >= bins) b = bins - 1;
    hist[b]++;
  }
  const total = v.length;
  let sum = 0;
  for (let i = 0; i < bins; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 0.5;
  for (let i = 0; i < bins; i++) {
    wB += hist[i];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      thr = (i + 1) / bins;
    }
  }
  return thr;
}
