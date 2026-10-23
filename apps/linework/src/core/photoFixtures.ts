// Real-photo-like synthetic fixtures (T78, OWNER_1018 M5): the hard cases a phone photo brings
// that the clean T49 fixtures (fixtures.ts) do not — fine hair, fur texture, low light with
// sensor noise, a backlit subject and JPEG block artefacts. Generated in code (deterministic, no
// photos, nothing copyrighted), small (160-192 px) so the golden test stays fast.
//
// Ground truth follows fixtures.ts: edges come from region ids, never from pixel values. Texture
// that a tracer should NOT draw (fur strokes, rim light, sensor noise, JPEG blocks) is painted
// inside one region, so drawing it costs precision; real boundaries (strands, silhouette, eyes)
// are separate regions, so missing them costs recall.

import { build, rng, type Fixture } from './fixtures.ts';

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** Deterministic hash noise in [-1, 1] for integer coordinates. */
function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

/** Approximately Gaussian sample (sum of 3 uniforms), unit variance. */
function gauss(r: () => number): number {
  return (r() + r() + r() - 1.5) * 2;
}

/**
 * Fine hair: 14 wavy dark strands (~1.6 px wide, varying contrast) falling over a skin-to-light
 * vertical gradient, plus a solid hair mass along the top. Each strand is its own region.
 */
export function hairFixture(w = 176, h = 176, seed = 41): Fixture {
  const r = rng(seed);
  const strands: { x0: number; amp: number; f: number; ph: number; tone: number; y0: number }[] = [];
  for (let k = 0; k < 14; k++) {
    strands.push({
      x0: 0.08 * w + (k + 0.5) * (0.84 * w / 14),
      amp: 3 + r() * 5,
      f: 0.025 + r() * 0.03,
      ph: r() * 6.28,
      tone: 55 + r() * 45, // how much darker than the background
      y0: 0.16 * h + r() * 0.08 * h,
    });
  }
  return build('hair', w, h, 3, seed, (x, y) => {
    const bg = 205 - 60 * (y / h) + 8 * (x / w);
    if (y < 0.14 * h + 4 * Math.sin(x * 0.07)) return { id: 1, rgb: [70, 52, 40] };
    for (let k = 0; k < strands.length; k++) {
      const s = strands[k];
      if (y < s.y0) continue;
      const cx = s.x0 + s.amp * Math.sin(y * s.f + s.ph) + 0.12 * (y - s.y0);
      if (Math.abs(x - cx) < 0.8) {
        const v = bg - s.tone;
        return { id: 10 + k, rgb: [v + 8, v, v - 8] };
      }
    }
    return { id: 0, rgb: [bg + 10, bg, bg - 14] };
  });
}

/**
 * Fur: a cat-like silhouette (body + head + ears) with a jagged, furry boundary, filled with
 * ~700 short noisy strokes of +-30 levels (texture, same region), on a plain light background.
 */
export function furFixture(w = 176, h = 176, seed = 43): Fixture {
  const r = rng(seed);
  const tex = new Float32Array(w * h);
  for (let k = 0; k < 700; k++) {
    const cx = r() * w, cy = r() * h;
    const a = r() * Math.PI * 0.6 + Math.PI * 0.2; // mostly downward-ish strokes
    const len = 3 + r() * 4;
    const amp = (r() < 0.5 ? -1 : 1) * (15 + r() * 15);
    for (let t = 0; t <= len; t += 0.5) {
      const px = Math.round(cx + Math.cos(a) * t), py = Math.round(cy + Math.sin(a) * t);
      if (px >= 0 && py >= 0 && px < w && py < h) tex[py * w + px] = amp;
    }
  }
  const bx = 0.52 * w, by = 0.66 * h, brx = 0.3 * w, bry = 0.22 * h;
  const hx = 0.4 * w, hy = 0.36 * h, hr = 0.17 * w;
  return build('fur', w, h, 3, seed, (x, y) => {
    // Furry boundary: radius jittered per angle bucket.
    const jb = 1 + 0.06 * hash2(Math.round(Math.atan2(y - by, x - bx) * 40), 0, seed);
    const jh = 1 + 0.07 * hash2(Math.round(Math.atan2(y - hy, x - hx) * 30), 1, seed);
    const body = ((x - bx) / (brx * jb)) ** 2 + ((y - by) / (bry * jb)) ** 2 <= 1;
    const head = ((x - hx) / (hr * jh)) ** 2 + ((y - hy) / (hr * jh)) ** 2 <= 1;
    // Ears: two triangles above the head.
    let ear = false;
    for (const ex of [hx - 0.6 * hr, hx + 0.6 * hr]) {
      const t = (y - (hy - 1.45 * hr)) / (0.7 * hr);
      if (t >= 0 && t <= 1 && Math.abs(x - ex) <= t * 0.38 * hr) ear = true;
    }
    if (inEllipse(x, y, hx - 0.4 * hr, hy - 0.1 * hr, 0.12 * hr, 0.09 * hr)) return { id: 3, rgb: [40, 44, 30] };
    if (inEllipse(x, y, hx + 0.4 * hr, hy - 0.1 * hr, 0.12 * hr, 0.09 * hr)) return { id: 4, rgb: [40, 44, 30] };
    if (body || head || ear) {
      const v = 128 + tex[y * w + x];
      return { id: 2, rgb: [v + 18, v, v - 16] };
    }
    return { id: 0, rgb: [214, 212, 206] };
  });
}

/**
 * Low light: a portrait-like scene (face, hair, eyes, mouth, shoulders) all within luma 18..70,
 * contrast 10-25 levels, with Gaussian-ish sensor noise (sigma ~5 levels, slight colour noise).
 */
export function lowLightFixture(w = 160, h = 192, seed = 47): Fixture {
  const r = rng(seed);
  const cx = 0.5 * w, cy = 0.46 * h, rx = 0.25 * w, ry = 0.29 * h;
  return build('low light', w, h, 0, seed, (x, y) => {
    const n = 5 * gauss(r);
    const cn = 2 * gauss(r);
    let id: number, v: number;
    if (inEllipse(x, y, cx - 0.1 * w, 0.42 * h, 0.045 * w, 0.02 * h)) { id = 10; v = 24; }
    else if (inEllipse(x, y, cx + 0.1 * w, 0.42 * h, 0.045 * w, 0.02 * h)) { id = 11; v = 24; }
    else if (inEllipse(x, y, cx, 0.6 * h, 0.08 * w, 0.022 * h)) { id = 12; v = 36; }
    else if (inEllipse(x, y, cx, cy, rx, ry)) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      id = 2; v = 62 - 12 * d + 6 * ((x - cx) / rx);
    } else if (inEllipse(x, y, cx, 0.4 * h, 0.31 * w, 0.33 * h) && y < 0.58 * h) { id = 3; v = 20; }
    else if (y > 0.8 * h && Math.abs(x - cx) < 0.42 * w) { id = 4; v = 44; }
    else { id = 0; v = 32 + 6 * (x / w); }
    return { id, rgb: [v + 3 + n + cn, v + n, v - 3 + n - cn] };
  });
}

/**
 * Backlit: a dark head-and-shoulders silhouette against a bright sky, a bright rim light just
 * inside the silhouette (texture), haze/bloom around the boundary, and low-contrast features
 * (eyes, mouth) inside the dark face.
 */
export function backlitFixture(w = 160, h = 192, seed = 53): Fixture {
  const cx = 0.5 * w, cy = 0.4 * h, rx = 0.22 * w, ry = 0.26 * h;
  const sh = 0.78 * h;
  const insideHead = (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
  return build('backlit', w, h, 3, seed, (x, y) => {
    const dh = insideHead(x, y);
    const shoulders = y > sh - 0.04 * h * Math.cos(((x - cx) / w) * 3) && Math.abs(x - cx) < 0.44 * w;
    const neck = Math.abs(x - cx) < 0.11 * w && y > cy && y <= sh;
    if (dh <= 1 || shoulders || neck) {
      if (inEllipse(x, y, cx - 0.09 * w, 0.38 * h, 0.04 * w, 0.017 * h)) return { id: 10, rgb: [24, 22, 22] };
      if (inEllipse(x, y, cx + 0.09 * w, 0.38 * h, 0.04 * w, 0.017 * h)) return { id: 11, rgb: [24, 22, 22] };
      if (inEllipse(x, y, cx, 0.53 * h, 0.07 * w, 0.017 * h)) return { id: 12, rgb: [30, 22, 22] };
      // Rim light: brightens the outer ~3 px of the head, fading inward.
      const rim = dh <= 1 ? Math.max(0, (dh - 0.86) / 0.14) : 0;
      const v = 46 + 150 * rim * rim;
      return { id: 2, rgb: [v + 6, v, v - 4] };
    }
    // Sky with bloom: brighter near the subject.
    const bloom = Math.max(0, 1.6 - Math.sqrt(dh)) * 18;
    const v = Math.min(252, 222 + bloom - 20 * (y / h));
    return { id: 0, rgb: [v - 6, v, Math.min(255, v + 8)] };
  });
}

/**
 * JPEG-ish: shapes (dark rectangle, light disc, mid triangle) on a gradient, then 8x8 block
 * coding artefacts: each block's detail is quantised to 14-level steps around its mean and the
 * block mean is offset by +-5, which makes faint grid seams and ringing next to edges.
 */
export function jpegFixture(w = 192, h = 160, seed = 59): Fixture {
  const f = build('jpeg blocks', w, h, 2, seed, (x, y) => {
    const bg = 140 + 50 * (x / w);
    if (x >= 0.1 * w && x < 0.4 * w && y >= 0.14 * h && y < 0.52 * h) return { id: 1, rgb: [60, 52, 48] };
    if (inEllipse(x, y, 0.7 * w, 0.36 * h, 0.15 * w, 0.15 * w)) return { id: 2, rgb: [232, 228, 210] };
    const ty = (y - 0.6 * h) / (0.32 * h);
    if (ty >= 0 && ty <= 1 && Math.abs(x - 0.5 * w) <= ty * 0.2 * w) return { id: 3, rgb: [100, 112, 120] };
    return { id: 0, rgb: [bg - 8, bg, bg + 6] };
  });
  const d = f.img.data;
  const q = 14;
  for (let by = 0; by < h; by += 8) {
    for (let bx = 0; bx < w; bx += 8) {
      const off = Math.round(5 * hash2(bx, by, seed));
      for (let c = 0; c < 3; c++) {
        let sum = 0, cnt = 0;
        for (let y = by; y < Math.min(h, by + 8); y++) for (let x = bx; x < Math.min(w, bx + 8); x++) { sum += d[(y * w + x) * 4 + c]; cnt++; }
        const m = sum / cnt;
        for (let y = by; y < Math.min(h, by + 8); y++) {
          for (let x = bx; x < Math.min(w, bx + 8); x++) {
            const p = (y * w + x) * 4 + c;
            d[p] = m + off + Math.round((d[p] - m) / q) * q;
          }
        }
      }
    }
  }
  return f;
}

/** All T78 photo-like fixtures. */
export function photoFixtures(): Fixture[] {
  return [hairFixture(), furFixture(), lowLightFixture(), backlitFixture(), jpegFixture()];
}
