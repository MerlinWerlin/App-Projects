// T48: friendly image load / processing errors. Pure TS (no React Native imports).
//
// - precheckImage(meta): cheap check on what the picker reports, before anything is decoded. Only rejects what we
//   know will fail (not an image, a RAW file, or a huge photo). Ordinary JPEG / PNG / WebP / HEIC photos pass;
//   HEIC is converted to JPEG on import (src/native/photoPick.ts) and by the outline pipeline's resize step.
// - classifyImageError(err, meta): maps whatever the picker / manipulator / decoder threw to a kind the UI can
//   explain in plain words (src/ui/ImageErrorBoundary.tsx).

export type ImageErrorKind = 'unsupported' | 'tooLarge' | 'heic' | 'memory' | 'unknown';

export const IMAGE_ERROR_KINDS: readonly ImageErrorKind[] = ['unsupported', 'tooLarge', 'heic', 'memory', 'unknown'];

/** What the picker (or route params) tells us about an image. Every field is optional. */
export type ImageMeta = {
  uri?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  /** Bytes. */
  fileSize?: number | null;
};

/** Photos above this many megapixels are refused before decoding (a 48 MP phone photo still passes). */
export const MAX_MEGAPIXELS = 60;
/** Files above this many bytes are refused before decoding. */
export const MAX_FILE_BYTES = 150 * 1024 * 1024;

/** An error that already knows its kind (thrown by the pre-check or the HEIC conversion). */
export class ImageCheckError extends Error {
  readonly kind: ImageErrorKind;
  constructor(kind: ImageErrorKind, message?: string) {
    super(message ?? `Image check failed: ${kind}`);
    this.name = 'ImageCheckError';
    this.kind = kind;
  }
}

const KINDS = new Set<string>(IMAGE_ERROR_KINDS);

function isKind(v: unknown): v is ImageErrorKind {
  return typeof v === 'string' && KINDS.has(v);
}

/** Lower-case file extension of a uri or file name (query and fragment ignored), or '' if none. */
export function extensionOf(path: string | null | undefined): string {
  if (!path) return '';
  const clean = path.split('?')[0].split('#')[0];
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(clean);
  return m ? m[1].toLowerCase() : '';
}

const HEIC_EXT = new Set(['heic', 'heif', 'heics', 'hif']);
const HEIC_MIME = /^image\/(heic|heif)(-sequence)?$/i;
// Camera RAW and other image formats the decoders in Expo Go can't read reliably.
const UNSUPPORTED_EXT = new Set(['dng', 'cr2', 'cr3', 'nef', 'arw', 'orf', 'rw2', 'raf', 'srw', 'pef', 'psd', 'ai', 'eps', 'pdf']);
const UNSUPPORTED_MIME = /^image\/(x-adobe-dng|dng|x-canon-cr2|x-canon-cr3|x-nikon-nef|x-sony-arw|x-olympus-orf|x-panasonic-rw2|x-fuji-raf|x-samsung-srw|x-pentax-pef|x-raw|raw|vnd\.adobe\.photoshop|x-photoshop|x-eps)$/i;
// Non-image files that a document picker / share sheet could hand us.
const NON_IMAGE_EXT = new Set(['mov', 'mp4', 'm4v', 'avi', 'mkv', 'webm', '3gp', 'txt', 'zip', 'doc', 'docx']);

function names(meta: ImageMeta): string[] {
  return [meta.fileName, meta.uri].filter((s): s is string => typeof s === 'string' && s.length > 0);
}

/** True when the picker says this is a HEIC / HEIF image (mime type or extension). */
export function isHeic(meta: ImageMeta): boolean {
  if (meta.mimeType && HEIC_MIME.test(meta.mimeType.trim())) return true;
  return names(meta).some((n) => HEIC_EXT.has(extensionOf(n)));
}

function positive(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/** True when width × height (both known) is above MAX_MEGAPIXELS, or the file size (known) is above MAX_FILE_BYTES. */
export function isTooLarge(meta: ImageMeta): boolean {
  if (positive(meta.width) && positive(meta.height) && meta.width * meta.height > MAX_MEGAPIXELS * 1e6) return true;
  return positive(meta.fileSize) && meta.fileSize > MAX_FILE_BYTES;
}

/** True when the mime type or extension says this is something we can't open. Unknown/missing info is allowed. */
export function isUnsupportedType(meta: ImageMeta): boolean {
  const mime = (meta.mimeType ?? '').trim().toLowerCase();
  if (mime) {
    if (UNSUPPORTED_MIME.test(mime)) return true;
    // A known non-image type (video/mp4, application/pdf, …). Generic binary types say nothing, so they pass.
    if (!mime.startsWith('image/') && mime !== 'application/octet-stream' && mime !== 'binary/octet-stream') return true;
  }
  return names(meta).some((n) => {
    const ext = extensionOf(n);
    return UNSUPPORTED_EXT.has(ext) || NON_IMAGE_EXT.has(ext);
  });
}

/**
 * Before decoding: the kind of problem we can already see from the metadata, or null when the image should take
 * the normal path. HEIC is not rejected here (it is converted to JPEG), so this never returns 'heic'.
 */
export function precheckImage(meta: ImageMeta): Exclude<ImageErrorKind, 'heic'> | null {
  if (isUnsupportedType(meta)) return 'unsupported';
  if (isTooLarge(meta)) return 'tooLarge';
  return null;
}

/** Text of an error-ish value (Error message + name + code), for pattern matching. */
function textOf(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const o = err as { message?: unknown; name?: unknown; code?: unknown };
    return [o.name, o.code, o.message].filter((v) => typeof v === 'string' && v).join(' ');
  }
  return String(err);
}

const MEMORY = /out ?of ?memory|outofmemory|\bOOM\b|memory (pressure|warning|limit)|not enough memory|allocation (failed|size)|failed to allocate|array buffer allocation|invalid (typed )?array length|maxMemoryUsageInMB|memory usage/i;
const TOO_LARGE = /too (large|big)|larger than the|exceeds? (the )?(max|maximum|limit)|maxResolutionInMP|resolution (is )?too high|image is \d+\s*[×x]\s*\d+/i;
const HEIC = /\bhei[cf]\b|hevc/i;
const UNSUPPORTED = /unsupported|not supported|unknown (image )?format|unrecognized (image )?format|cannot decode|can[’']?t decode|could ?n[’']?o?t (be )?(decoded?|read|open(ed)?|load(ed)?)|could not (be )?(decoded?|read|open(ed)?|load(ed)?)|failed to (decode|load|read|open)|decod(e|ing) (failed|error)|SOI not found|marker|invalid (jpeg|png|image|file)|not a (valid )?(jpeg|png|image)|corrupt|truncated|bad (png|jpeg|huffman)|no image|ERR_IMAGE|image ?format/i;

/**
 * What went wrong, in a form the UI can explain. `meta` (optional) adds what we know about the photo: a HEIC
 * photo that failed is reported as 'heic', a huge one as 'tooLarge'. Abort errors should be filtered out first.
 */
export function classifyImageError(err: unknown, meta?: ImageMeta): ImageErrorKind {
  if (err && typeof err === 'object' && isKind((err as { kind?: unknown }).kind) && (err as { name?: unknown }).name === 'ImageCheckError') {
    return (err as { kind: ImageErrorKind }).kind;
  }
  const text = textOf(err);
  if (err instanceof RangeError && /array|buffer|length|allocation/i.test(text)) return 'memory';
  if (MEMORY.test(text)) return 'memory';
  if (TOO_LARGE.test(text)) return 'tooLarge';
  if (HEIC.test(text)) return 'heic';
  if (meta && isTooLarge(meta)) return 'tooLarge';
  if (meta && isUnsupportedType(meta)) return 'unsupported';
  if (meta && isHeic(meta)) return 'heic';
  if (UNSUPPORTED.test(text)) return 'unsupported';
  return 'unknown';
}

/** Whether "Try again" can help for this kind (the same photo might work a second time). */
export function canRetry(kind: ImageErrorKind): boolean {
  return kind === 'memory' || kind === 'unknown';
}
