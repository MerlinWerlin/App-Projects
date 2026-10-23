// Image size math (fit within a max edge) and clockwise quarter-turn rotation maps for RGBA buffers.

export type Size = { width: number; height: number };

function assertDims(w: number, h: number): void {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    throw new RangeError(`invalid image size ${w}×${h}`);
  }
}

/** Scale so the longer edge is ≤ max, preserving aspect; never upscales; integer dims ≥ 1. */
export function fitWithin(w: number, h: number, max = 1024): Size {
  assertDims(w, h);
  if (!Number.isFinite(max) || max < 1) throw new RangeError(`invalid max ${max}`);
  const k = Math.min(1, max / Math.max(w, h));
  return {
    width: Math.min(Math.floor(max), Math.max(1, Math.round(w * k))),
    height: Math.min(Math.floor(max), Math.max(1, Math.round(h * k))),
  };
}

/** Normalise any integer number of clockwise quarter turns into 0..3. */
export function normTurns(turns: number): 0 | 1 | 2 | 3 {
  if (!Number.isFinite(turns)) return 0;
  return ((((Math.round(turns) % 4) + 4) % 4) as 0 | 1 | 2 | 3);
}

export function rotate90Dims(w: number, h: number, turns: number): Size {
  return normTurns(turns) % 2 === 0 ? { width: w, height: h } : { width: h, height: w };
}

/** Destination coordinates of source pixel (x, y) in a w×h image after `turns` clockwise quarter turns. */
export function rotate90Index(x: number, y: number, w: number, h: number, turns: number): { x: number; y: number } {
  switch (normTurns(turns)) {
    case 1:
      return { x: h - 1 - y, y: x };
    case 2:
      return { x: w - 1 - x, y: h - 1 - y };
    case 3:
      return { x: y, y: w - 1 - x };
    default:
      return { x, y };
  }
}

/** Rotate a w×h RGBA buffer by clockwise quarter turns. Returns a new buffer of the same array type. */
export function rotateRGBA90<T extends Uint8ClampedArray | Uint8Array>(
  data: T,
  w: number,
  h: number,
  turns: number,
): { data: T; width: number; height: number } {
  assertDims(w, h);
  if (!Number.isInteger(w) || !Number.isInteger(h)) throw new RangeError('image size must be integers');
  if (data.length < w * h * 4) throw new RangeError(`buffer too small for ${w}×${h} RGBA`);
  const { width, height } = rotate90Dims(w, h, turns);
  const out = (data instanceof Uint8ClampedArray ? new Uint8ClampedArray(w * h * 4) : new Uint8Array(w * h * 4)) as T;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = rotate90Index(x, y, w, h, turns);
      const si = (y * w + x) * 4;
      const di = (d.y * width + d.x) * 4;
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      out[di + 3] = data[si + 3];
    }
  }
  return { data: out, width, height };
}
