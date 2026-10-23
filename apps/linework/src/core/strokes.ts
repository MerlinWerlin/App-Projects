// Vector strokes from a 1-px line mask: trace the skeleton into chains, prune hairy spurs,
// smooth the staircase pixels into flowing curves, then render anti-aliased round strokes.
// This is what turns "edge pixels" into line art that looks drawn rather than computed.

export type Stroke = {
  xs: Float32Array;
  ys: Float32Array;
  /** Mean line strength 0..1 (drives taper). */
  strength: number;
  /** Optional per-point radius cap (e.g. small facial features). */
  cap?: Float32Array;
};

const NX = [1, 1, 0, -1, -1, -1, 0, 1];
const NY = [0, 1, 1, 1, 0, -1, -1, -1];

function degreeMap(mask: Uint8Array, w: number, h: number): Uint8Array {
  const deg = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      deg[i] = mask[i - w - 1] + mask[i - w] + mask[i - w + 1] + mask[i - 1] + mask[i + 1] + mask[i + w - 1] + mask[i + w] + mask[i + w + 1];
    }
  }
  return deg;
}

/** Splits the skeleton into pixel chains between end/junction pixels (and closed loops). */
export function traceChains(mask: Uint8Array, w: number, h: number): number[][] {
  const deg = degreeMap(mask, w, h);
  const used = new Uint8Array(w * h); // interior (degree-2) pixels already in a chain
  const chains: number[][] = [];
  const isNode = (i: number) => mask[i] === 1 && deg[i] !== 2;
  const walk = (start: number, first: number): number[] => {
    const chain = [start, first];
    let prev = start, cur = first;
    while (!isNode(cur)) {
      used[cur] = 1;
      const cx = cur % w, cy = (cur / w) | 0;
      let nxt = -1;
      // Prefer 4-neighbours so diagonal shortcuts don't skip pixels.
      for (const k of [0, 2, 4, 6, 1, 3, 5, 7]) {
        const q = (cy + NY[k]) * w + cx + NX[k];
        if (q === prev || !mask[q]) continue;
        if (used[q] && !isNode(q)) continue;
        if (chain.length > 2 && q === chain[chain.length - 2]) continue;
        nxt = q;
        break;
      }
      if (nxt < 0) break;
      prev = cur;
      cur = nxt;
      chain.push(cur);
      if (cur === start) break;
    }
    if (!isNode(cur)) used[cur] = 1;
    return chain;
  };
  for (let i = 0; i < mask.length; i++) {
    if (!isNode(i)) continue;
    const x = i % w, y = (i / w) | 0;
    for (let k = 0; k < 8; k++) {
      const q = (y + NY[k]) * w + x + NX[k];
      if (!mask[q]) continue;
      if (isNode(q)) {
        // Node-to-node step: emit once (lower index first) as a 2-pixel chain.
        if (i < q) chains.push([i, q]);
        continue;
      }
      if (used[q]) continue;
      chains.push(walk(i, q));
    }
    if (deg[i] === 0) chains.push([i]);
  }
  // Closed loops have no nodes.
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || used[i] || isNode(i)) continue;
    used[i] = 1;
    const x = i % w, y = (i / w) | 0;
    let first = -1;
    for (let k = 0; k < 8; k++) {
      const q = (y + NY[k]) * w + x + NX[k];
      if (mask[q] && !used[q]) { first = q; break; }
    }
    if (first < 0) { chains.push([i]); continue; }
    const c = walk(i, first);
    c.push(i);
    chains.push(c);
  }
  return chains;
}

/** Removes short spurs: chains with a free end that hang off a junction. */
export function pruneSpurs(chains: number[][], mask: Uint8Array, w: number, h: number, maxLen: number): number[][] {
  const deg = degreeMap(mask, w, h);
  return chains.filter((c) => {
    if (c.length >= maxLen || c.length < 2) return true;
    const a = deg[c[0]], b = deg[c[c.length - 1]];
    const freeA = a <= 1, freeB = b <= 1;
    // Exactly one free end and one junction end = a spur.
    return !((freeA && b >= 3) || (freeB && a >= 3));
  });
}

/** Moving-average smoothing of chain points (ends fixed), `passes` x [1 2 1]/4. */
export function smoothChain(c: readonly number[], w: number, passes: number): { xs: Float32Array; ys: Float32Array } {
  const n = c.length;
  let xs = new Float32Array(n), ys = new Float32Array(n);
  for (let k = 0; k < n; k++) { xs[k] = c[k] % w; ys[k] = (c[k] / w) | 0; }
  const closed = n > 3 && c[0] === c[n - 1];
  let tx = new Float32Array(n), ty = new Float32Array(n);
  for (let p = 0; p < passes; p++) {
    for (let k = 0; k < n; k++) {
      if (!closed && (k === 0 || k === n - 1)) { tx[k] = xs[k]; ty[k] = ys[k]; continue; }
      const a = closed ? (k === 0 ? n - 2 : k - 1) : k - 1;
      const b = closed ? (k === n - 1 ? 1 : k + 1) : k + 1;
      tx[k] = (xs[a] + 2 * xs[k] + xs[b]) * 0.25;
      ty[k] = (ys[a] + 2 * ys[k] + ys[b]) * 0.25;
    }
    [xs, tx] = [tx, xs];
    [ys, ty] = [ty, ys];
  }
  return { xs, ys };
}

/**
 * Renders strokes as anti-aliased round-capped lines into a coverage plane (0..255, max-combined).
 * Radius per stroke = base * (1 - taper + taper * strength), easing to 65 % at free ends.
 */
export function renderStrokes(
  strokes: readonly Stroke[], cov: Uint8Array, w: number, h: number, base: number, taper: number, minR = 0.35,
): void {
  for (const s of strokes) {
    const n = s.xs.length;
    const r0 = Math.max(minR, base * (1 - taper + taper * s.strength));
    const endEase = Math.min(n / 2, Math.max(2, n * 0.18));
    const rad = (k: number) => {
      let r = r0;
      if (taper > 0 && n > 6) {
        const e = Math.min(k, n - 1 - k);
        if (e < endEase) r *= 0.65 + 0.35 * (e / endEase);
      }
      if (s.cap) r = Math.min(r, s.cap[k]);
      return Math.max(minR, r);
    };
    if (n === 1) {
      stampSegment(cov, w, h, s.xs[0], s.ys[0], s.xs[0], s.ys[0], rad(0), rad(0));
      continue;
    }
    for (let k = 0; k + 1 < n; k++) {
      stampSegment(cov, w, h, s.xs[k], s.ys[k], s.xs[k + 1], s.ys[k + 1], rad(k), rad(k + 1));
    }
  }
}

function stampSegment(
  cov: Uint8Array, w: number, h: number,
  ax: number, ay: number, bx: number, by: number, ra: number, rb: number,
): void {
  const rm = Math.max(ra, rb) + 1;
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - rm)), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + rm));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by) - rm)), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + rm));
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let t = len2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = ax + t * dx - x, py = ay + t * dy - y;
      const d = Math.sqrt(px * px + py * py);
      const r = ra + (rb - ra) * t;
      let a = r + 0.5 - d;
      if (a <= 0) continue;
      if (a > 1) a = 1;
      const v = (a * 255 + 0.5) | 0;
      const i = y * w + x;
      if (v > cov[i]) cov[i] = v;
    }
  }
}
