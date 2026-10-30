// T159: ThumbHash encoder (and the tiny average-colour decoder used by the tests).
// Algorithm and reference code: ThumbHash by Evan Wallace, https://github.com/evanw/thumbhash,
// MIT licence, Copyright (c) 2023 Evan Wallace (recorded in docs/LICENSES.md). Ported to an ES
// module with no changes to the maths, so hashes match the reference implementation.

/**
 * Encode an image (w, h <= 100, RGBA bytes) into a ThumbHash (Uint8Array, usually 15-25 bytes).
 */
export function rgbaToThumbHash(w, h, rgba) {
  if (w > 100 || h > 100) throw new Error(`${w}x${h} doesn't fit in 100x100`);
  const { PI, round, max, cos, abs } = Math;

  // Average colour.
  let avg_r = 0, avg_g = 0, avg_b = 0, avg_a = 0;
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const alpha = rgba[j + 3] / 255;
    avg_r += (alpha / 255) * rgba[j];
    avg_g += (alpha / 255) * rgba[j + 1];
    avg_b += (alpha / 255) * rgba[j + 2];
    avg_a += alpha;
  }
  if (avg_a) {
    avg_r /= avg_a;
    avg_g /= avg_a;
    avg_b /= avg_a;
  }

  const hasAlpha = avg_a < w * h;
  const l_limit = hasAlpha ? 5 : 7; // fewer luminance bits when there is alpha
  const lx = max(1, round((l_limit * w) / max(w, h)));
  const ly = max(1, round((l_limit * h) / max(w, h)));
  const l = []; // luminance
  const p = []; // yellow - blue
  const q = []; // red - green
  const a = []; // alpha

  // RGBA -> LPQA, composited over the average colour.
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const alpha = rgba[j + 3] / 255;
    const r = avg_r * (1 - alpha) + (alpha / 255) * rgba[j];
    const g = avg_g * (1 - alpha) + (alpha / 255) * rgba[j + 1];
    const b = avg_b * (1 - alpha) + (alpha / 255) * rgba[j + 2];
    l[i] = (r + g + b) / 3;
    p[i] = (r + g) / 2 - b;
    q[i] = r - g;
    a[i] = alpha;
  }

  // DCT into DC (constant) and normalised AC (varying) terms.
  const encodeChannel = (channel, nx, ny) => {
    let dc = 0;
    let scale = 0;
    const ac = [];
    const fx = [];
    for (let cy = 0; cy < ny; cy++) {
      for (let cx = 0; cx * ny < nx * (ny - cy); cx++) {
        let f = 0;
        for (let x = 0; x < w; x++) fx[x] = cos((PI / w) * cx * (x + 0.5));
        for (let y = 0; y < h; y++) {
          const fy = cos((PI / h) * cy * (y + 0.5));
          for (let x = 0; x < w; x++) f += channel[x + y * w] * fx[x] * fy;
        }
        f /= w * h;
        if (cx || cy) {
          ac.push(f);
          scale = max(scale, abs(f));
        } else {
          dc = f;
        }
      }
    }
    if (scale) for (let i = 0; i < ac.length; i++) ac[i] = 0.5 + (0.5 / scale) * ac[i];
    return [dc, ac, scale];
  };
  const [l_dc, l_ac, l_scale] = encodeChannel(l, max(3, lx), max(3, ly));
  const [p_dc, p_ac, p_scale] = encodeChannel(p, 3, 3);
  const [q_dc, q_ac, q_scale] = encodeChannel(q, 3, 3);
  const [a_dc, a_ac, a_scale] = hasAlpha ? encodeChannel(a, 5, 5) : [];

  // Constants.
  const isLandscape = w > h;
  const header24 =
    round(63 * l_dc) | (round(31.5 + 31.5 * p_dc) << 6) | (round(31.5 + 31.5 * q_dc) << 12) | (round(31 * l_scale) << 18) | ((hasAlpha ? 1 : 0) << 23);
  const header16 = (isLandscape ? ly : lx) | (round(63 * p_scale) << 3) | (round(63 * q_scale) << 9) | ((isLandscape ? 1 : 0) << 15);
  const hash = [header24 & 255, (header24 >> 8) & 255, header24 >> 16, header16 & 255, header16 >> 8];
  const ac_start = hasAlpha ? 6 : 5;
  let ac_index = 0;
  if (hasAlpha) hash.push(round(15 * a_dc) | (round(15 * a_scale) << 4));

  // Varying factors, two 4-bit values per byte.
  for (const ac of hasAlpha ? [l_ac, p_ac, q_ac, a_ac] : [l_ac, p_ac, q_ac]) {
    for (const f of ac) {
      hash[ac_start + (ac_index >> 1)] |= round(15 * f) << ((ac_index++ & 1) << 2);
    }
  }
  return new Uint8Array(hash);
}

/** Average colour (0..1 per channel) stored in a ThumbHash. */
export function thumbHashToAverageRGBA(hash) {
  const { min, max } = Math;
  const header = hash[0] | (hash[1] << 8) | (hash[2] << 16);
  const l = (header & 63) / 63;
  const p = ((header >> 6) & 63) / 31.5 - 1;
  const q = ((header >> 12) & 63) / 31.5 - 1;
  const hasAlpha = header >> 23;
  const a = hasAlpha ? (hash[5] & 15) / 15 : 1;
  const b = l - (2 / 3) * p;
  const r = (3 * l - b + q) / 2;
  const g = r - q;
  return { r: max(0, min(1, r)), g: max(0, min(1, g)), b: max(0, min(1, b)), a };
}

/** Approximate aspect ratio (width / height) stored in a ThumbHash. */
export function thumbHashToApproximateAspectRatio(hash) {
  const header = hash[3];
  const hasAlpha = hash[2] & 0x80;
  const isLandscape = hash[4] & 0x80;
  const lx = isLandscape ? (hasAlpha ? 5 : 7) : header & 7;
  const ly = isLandscape ? header & 7 : hasAlpha ? 5 : 7;
  return lx / ly;
}
