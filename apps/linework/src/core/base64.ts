// Standard base64 (RFC 4648, '+' '/' alphabet, '=' padding) for Uint8Array, with no globals.
// Used by the outline pipeline to move JPEG / PNG bytes through expo-image-manipulator and
// expo-file-system, which speak base64 strings. Decoding ignores whitespace and tolerates
// missing padding; any other character is an error.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const ENC: number[] = [];
const DEC = new Int16Array(256).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) {
  ENC[i] = ALPHABET.charCodeAt(i);
  DEC[ALPHABET.charCodeAt(i)] = i;
}
const PAD = 61; // '='
/** Characters per String.fromCharCode call (keeps argument lists well below engine limits). */
const CHUNK = 8192;

export function encodeBase64(bytes: Uint8Array | Uint8ClampedArray): string {
  const n = bytes.length;
  const outLen = Math.ceil(n / 3) * 4;
  const codes = new Uint16Array(outLen);
  let o = 0;
  let i = 0;
  for (const end = n - (n % 3); i < end; i += 3) {
    const v = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    codes[o++] = ENC[(v >> 18) & 63];
    codes[o++] = ENC[(v >> 12) & 63];
    codes[o++] = ENC[(v >> 6) & 63];
    codes[o++] = ENC[v & 63];
  }
  const rest = n - i;
  if (rest === 1) {
    const v = bytes[i] << 16;
    codes[o++] = ENC[(v >> 18) & 63];
    codes[o++] = ENC[(v >> 12) & 63];
    codes[o++] = PAD;
    codes[o++] = PAD;
  } else if (rest === 2) {
    const v = (bytes[i] << 16) | (bytes[i + 1] << 8);
    codes[o++] = ENC[(v >> 18) & 63];
    codes[o++] = ENC[(v >> 12) & 63];
    codes[o++] = ENC[(v >> 6) & 63];
    codes[o++] = PAD;
  }
  let s = '';
  for (let k = 0; k < outLen; k += CHUNK) {
    s += String.fromCharCode.apply(null, codes.subarray(k, Math.min(outLen, k + CHUNK)) as unknown as number[]);
  }
  return s;
}

function isSpace(c: number): boolean {
  return c === 32 || c === 9 || c === 10 || c === 13 || c === 12;
}

export function decodeBase64(text: string): Uint8Array {
  // First pass: count significant characters and validate.
  let sig = 0;
  let pads = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (isSpace(c)) continue;
    if (c === PAD) {
      pads++;
      continue;
    }
    if (pads > 0) throw new SyntaxError('base64: data after padding');
    if (c > 255 || DEC[c] < 0) throw new SyntaxError(`base64: invalid character at ${i}`);
    sig++;
  }
  if (pads > 2) throw new SyntaxError('base64: too much padding');
  const tail = sig % 4;
  if (tail === 1) throw new SyntaxError('base64: truncated input');
  if (pads > 0 && (sig + pads) % 4 !== 0) throw new SyntaxError('base64: bad padding');
  const outLen = Math.floor(sig / 4) * 3 + (tail === 0 ? 0 : tail - 1);
  const out = new Uint8Array(outLen);

  let acc = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < text.length && o < outLen; i++) {
    const c = text.charCodeAt(i);
    if (c === PAD || isSpace(c)) continue;
    acc = ((acc << 6) | DEC[c]) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}
