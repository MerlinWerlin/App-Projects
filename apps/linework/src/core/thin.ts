// Binary-mask helpers for the outline pipeline: Zhang–Suen thinning to 1-px centre lines and
// removal of short stray strokes (specks, noise) by connected-component length.

/**
 * Zhang–Suen thinning in place (mask values 0/1). Works from a candidate list so cost scales
 * with the number of line pixels, not the image size. Border pixels are cleared first.
 */
export function thin(mask: Uint8Array, w: number, h: number, maxIter = 40): void {
  for (let x = 0; x < w; x++) { mask[x] = 0; mask[(h - 1) * w + x] = 0; }
  for (let y = 0; y < h; y++) { mask[y * w] = 0; mask[y * w + w - 1] = 0; }
  let cand: number[] = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) cand.push(i);
  const del: number[] = [];
  for (let it = 0; it < maxIter; it++) {
    let changed = false;
    for (let sub = 0; sub < 2; sub++) {
      del.length = 0;
      for (let k = 0; k < cand.length; k++) {
        const i = cand[k];
        if (!mask[i]) continue;
        const p2 = mask[i - w], p3 = mask[i - w + 1], p4 = mask[i + 1], p5 = mask[i + w + 1];
        const p6 = mask[i + w], p7 = mask[i + w - 1], p8 = mask[i - 1], p9 = mask[i - w - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;
        const A =
          (+(!p2 && p3)) + (+(!p3 && p4)) + (+(!p4 && p5)) + (+(!p5 && p6)) +
          (+(!p6 && p7)) + (+(!p7 && p8)) + (+(!p8 && p9)) + (+(!p9 && p2));
        if (A !== 1) continue;
        if (sub === 0) {
          if (p2 && p4 && p6) continue;
          if (p4 && p6 && p8) continue;
        } else {
          if (p2 && p4 && p8) continue;
          if (p2 && p6 && p8) continue;
        }
        del.push(i);
      }
      for (let k = 0; k < del.length; k++) mask[del[k]] = 0;
      if (del.length) changed = true;
    }
    if (!changed) break;
    const next: number[] = [];
    for (let k = 0; k < cand.length; k++) if (mask[cand[k]]) next.push(cand[k]);
    cand = next;
  }
}

/**
 * Removes 8-connected components with fewer than `minLen` pixels. `keepIf` (optional) can rescue a
 * short component (e.g. inside a face, where small strokes are eyes and nostrils).
 * Returns the number of pixels left.
 */
export function dropShort(
  mask: Uint8Array, w: number, h: number, minLen: number,
  keepIf?: (pixels: number[]) => boolean,
): number {
  const n = w * h;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  let kept = 0;
  const comp: number[] = [];
  for (let s = 0; s < n; s++) {
    if (!mask[s] || seen[s]) continue;
    comp.length = 0;
    let sp = 0;
    stack[sp++] = s;
    seen[s] = 1;
    while (sp) {
      const p = stack[--sp];
      comp.push(p);
      const x = p % w, y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const q = yy * w + xx;
          if (mask[q] && !seen[q]) { seen[q] = 1; stack[sp++] = q; }
        }
      }
    }
    if (comp.length < minLen && !(keepIf && keepIf(comp))) {
      for (const p of comp) mask[p] = 0;
    } else kept += comp.length;
  }
  return kept;
}

/**
 * Closes small gaps in 1-px lines: from every line end, looks up to `gap` px ahead (within a
 * cone around the stroke's own direction) for another stroke and joins them with a straight
 * segment. Returns the number of joins.
 */
export function linkGaps(mask: Uint8Array, w: number, h: number, gap: number): number {
  const n = w * h;
  // Component labels so an end never links back onto its own stroke.
  const label = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  let next = 0;
  for (let s = 0; s < n; s++) {
    if (!mask[s] || label[s] >= 0) continue;
    let sp = 0;
    stack[sp++] = s;
    label[s] = next;
    while (sp) {
      const p = stack[--sp];
      const x = p % w, y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const q = yy * w + xx;
          if (mask[q] && label[q] < 0) { label[q] = next; stack[sp++] = q; }
        }
      }
    }
    next++;
  }
  // Union-find over component ids, so joined strokes count as one.
  const parent = new Int32Array(next);
  for (let i = 0; i < next; i++) parent[i] = i;
  const find = (a: number): number => {
    while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
    return a;
  };
  const g = Math.max(1, Math.round(gap));
  const ends: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const c = mask[i - w - 1] + mask[i - w] + mask[i - w + 1] + mask[i - 1] + mask[i + 1] + mask[i + w - 1] + mask[i + w] + mask[i + w + 1];
      if (c === 1) ends.push(i);
    }
  }
  let joins = 0;
  for (const e of ends) {
    const ex = e % w, ey = (e / w) | 0;
    // Direction of the stroke: from a pixel a few steps back towards the end.
    let px = ex, py = ey, prev = -1, cur = e;
    for (let k = 0; k < 5; k++) {
      let moved = false;
      for (let dy = -1; dy <= 1 && !moved; dy++) {
        for (let dx = -1; dx <= 1 && !moved; dx++) {
          if (!dx && !dy) continue;
          const xx = (cur % w) + dx, yy = ((cur / w) | 0) + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const q = yy * w + xx;
          if (q !== prev && mask[q] && label[q] >= 0 && find(label[q]) === find(label[e])) {
            prev = cur; cur = q; px = xx; py = yy; moved = true;
          }
        }
      }
      if (!moved) break;
    }
    let vx = ex - px, vy = ey - py;
    const vl = Math.hypot(vx, vy);
    if (vl < 1) continue;
    vx /= vl; vy /= vl;
    let best = -1, bestD = Infinity;
    for (let dy = -g; dy <= g; dy++) {
      const yy = ey + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -g; dx <= g; dx++) {
        const xx = ex + dx;
        if (xx < 0 || xx >= w) continue;
        const q = yy * w + xx;
        if (!mask[q] || label[q] < 0 || find(label[q]) === find(label[e])) continue;
        const d = Math.hypot(dx, dy);
        if (d > g) continue;
        // Within ~50 degrees of the stroke direction.
        if ((dx * vx + dy * vy) < 0.64 * d) continue;
        if (d < bestD) { bestD = d; best = q; }
      }
    }
    if (best < 0) continue;
    const bx = best % w, by = (best / w) | 0;
    const steps = Math.max(Math.abs(bx - ex), Math.abs(by - ey));
    for (let k = 1; k < steps; k++) {
      const xx = Math.round(ex + ((bx - ex) * k) / steps), yy = Math.round(ey + ((by - ey) * k) / steps);
      mask[yy * w + xx] = 1;
    }
    // Merge labels so the other end of this gap doesn't link again.
    parent[find(label[best])] = find(label[e]);
    joins++;
  }
  return joins;
}
