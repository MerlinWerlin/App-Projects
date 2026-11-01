// T28: in-app QR / barcode crop for a ticket image (from Files or Photos) without a new native module.
// The crop is stored on the attachment as a normalised rectangle (fractions of the image, 0..1) and the ticket view
// draws only that region, scaled up, with an overflow-hidden frame and an offset Image. The original file is never
// rewritten, so the crop is plain data: it travels in .satchel files and backups with the rest of the attachment.
// Pure TypeScript (no React Native): the crop screen and the ticket view call these.
import type { Attachment, CropRect, Item } from './model.ts';

export type { CropRect };
export type Corner = 'tl' | 'tr' | 'bl' | 'br';

/** Smallest side of a crop, as a fraction of the image side (a code still needs some pixels). */
export const MIN_CROP = 0.05;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const fin = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
/** Rounded so stored crops stay short and compare equal after a JSON round trip. */
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** The rectangle pulled inside the image, at least `min` on each side. */
export function clampCrop(r: CropRect, min = MIN_CROP): CropRect {
  const w = Math.min(1, Math.max(min, r.w));
  const h = Math.min(1, Math.max(min, r.h));
  const x = Math.min(1 - w, clamp01(r.x));
  const y = Math.min(1 - h, clamp01(r.y));
  return { x: r4(x), y: r4(y), w: r4(w), h: r4(h) };
}

/** A stored crop made safe to draw, or null when it is missing or nonsense (a hand-edited file, an old version). */
export function cleanCrop(raw: unknown): CropRect | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!fin(o.x) || !fin(o.y) || !fin(o.w) || !fin(o.h) || o.w <= 0 || o.h <= 0) return null;
  const c = clampCrop({ x: o.x, y: o.y, w: o.w, h: o.h });
  // The whole image is no crop at all.
  return isWhole(c) ? null : c;
}

export const isWhole = (r: CropRect) => r.x <= 0 && r.y <= 0 && r.w >= 1 && r.h >= 1;

/** Starting frame: a centred square (in pixels, so it looks square on screen) covering most of the short side. */
export function initialCrop(imgW: number, imgH: number, share = 0.7): CropRect {
  if (!(imgW > 0 && imgH > 0)) return clampCrop({ x: 0.15, y: 0.15, w: 0.7, h: 0.7 });
  const side = Math.min(imgW, imgH) * share;
  const w = side / imgW;
  const h = side / imgH;
  return clampCrop({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
}

/** One corner dragged by (dx, dy) image fractions; the opposite corner stays put and the frame never inverts. */
export function dragCorner(r: CropRect, corner: Corner, dx: number, dy: number, min = MIN_CROP): CropRect {
  let left = r.x;
  let top = r.y;
  let right = r.x + r.w;
  let bottom = r.y + r.h;
  if (corner === 'tl' || corner === 'bl') left = Math.min(right - min, clamp01(left + dx));
  else right = Math.max(left + min, clamp01(right + dx));
  if (corner === 'tl' || corner === 'tr') top = Math.min(bottom - min, clamp01(top + dy));
  else bottom = Math.max(top + min, clamp01(bottom + dy));
  return clampCrop({ x: left, y: top, w: right - left, h: bottom - top }, min);
}

/** The whole frame moved by (dx, dy), stopping at the image edges (its size never changes). */
export function moveCrop(r: CropRect, dx: number, dy: number): CropRect {
  return clampCrop({ x: Math.min(1 - r.w, Math.max(0, r.x + dx)), y: Math.min(1 - r.h, Math.max(0, r.y + dy)), w: r.w, h: r.h });
}

/** The frame grown (factor > 1) or shrunk (< 1) about its centre, kept inside the image. For the buttons. */
export function scaleCrop(r: CropRect, factor: number, min = MIN_CROP): CropRect {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const w = Math.min(1, Math.max(min, r.w * factor));
  const h = Math.min(1, Math.max(min, r.h * factor));
  return clampCrop({ x: Math.min(1 - w, Math.max(0, cx - w / 2)), y: Math.min(1 - h, Math.max(0, cy - h / 2)), w, h }, min);
}

export type CropLayout = {
  /** Size of the visible frame (overflow hidden). */
  frameW: number;
  frameH: number;
  /** Size and offset of the full image inside the frame. */
  imageW: number;
  imageH: number;
  left: number;
  top: number;
};

/**
 * How to draw `crop` of an imgW x imgH image as large as fits a boxW x boxH box, keeping the cropped region's
 * pixel aspect (a QR code stays square, a long barcode stays long). Null when a size is unknown.
 */
export function cropLayout(crop: CropRect, imgW: number, imgH: number, boxW: number, boxH: number): CropLayout | null {
  if (!(imgW > 0 && imgH > 0 && boxW > 0 && boxH > 0)) return null;
  const c = clampCrop(crop);
  const regionW = c.w * imgW;
  const regionH = c.h * imgH;
  const scale = Math.min(boxW / regionW, boxH / regionH);
  const imageW = imgW * scale;
  const imageH = imgH * scale;
  return { frameW: regionW * scale, frameH: regionH * scale, imageW, imageH, left: -c.x * imageW, top: -c.y * imageH };
}

/** Converts a drag on screen (points) into image fractions for an image shown at dispW x dispH points. */
export const toFraction = (dxPt: number, dyPt: number, dispW: number, dispH: number) => ({
  dx: dispW > 0 ? dxPt / dispW : 0,
  dy: dispH > 0 ? dyPt / dispH : 0,
});

/**
 * Sets (or with null clears) the in-app crop on one attachment. Setting one drops a separate QR crop image
 * (qrCropUri pointing at another file): the caller deletes `dropped` after the save. A crop that is the
 * attachment itself (qrCropUri === uri) stays, as it marks the file as the ticket.
 * T155: works on anything with attachments (a booking or a vault document).
 */
export function setCropRect<T extends Pick<Item, 'attachments'>>(item: T, attachmentId: string, crop: CropRect | null): { item: T; dropped: string | null } {
  let dropped: string | null = null;
  const attachments = item.attachments.map((a): Attachment => {
    if (a.id !== attachmentId) return a;
    const { qrCrop: _old, qrCropUri, ...rest } = a;
    const keepUri = qrCropUri && qrCropUri === a.uri ? { qrCropUri } : {};
    const c = crop ? cleanCrop(crop) : null;
    if (c && qrCropUri && qrCropUri !== a.uri) dropped = qrCropUri;
    if (c) return { ...rest, ...keepUri, qrCrop: c };
    // Cleared: a separate crop image (if any) stays as it was.
    return { ...rest, ...(qrCropUri ? { qrCropUri } : {}) };
  });
  return { item: { ...item, attachments }, dropped };
}

/** True when an image attachment carries a usable in-app crop. */
export const hasCropRect = (a: Pick<Attachment, 'qrCrop'>): boolean => cleanCrop(a.qrCrop) !== null;
