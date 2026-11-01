// T14 "Save to Satchel" (owner-1101s-4, folds in T46): the pure side of Open in / Copy to Satchel. iOS hands the app a
// file:// URL (Android a content:// one) when the traveller taps Share > Satchel on a PDF, image, text file, email
// or .satchel trip file. This module decides what that file is (by extension, UTI or MIME type, else by its first
// bytes), reads the text out of an .eml message, and picks the screen it goes to:
//   text / eml -> Paste a booking, filled in (the T77 parser)
//   pdf / image -> Add to a trip (pick a trip, then a new booking with the file attached)
//   trip -> the T15 import flow
//   backup (.satchelbackup, T154) -> Settings > Backup's restore preview (Merge or Replace), never a trip import
//   unknown -> an honest "Satchel can't read this kind of file" screen with a way back
// Nothing here touches the file system; src/native/openin.ts copies the file into the app first. No RN imports.
import { BACKUP_FILE_MIME, BACKUP_UTI } from './backup.ts';
import { extensionOf } from './tickets.ts';

export type OpenInKind = 'trip' | 'backup' | 'pdf' | 'image' | 'text' | 'eml' | 'unknown';
export type OpenInRoute = 'import' | 'restore' | 'addToTrip' | 'paste' | 'unsupported';

/** Largest file Satchel takes in through Open in (bytes). Bigger ones get the "too large" message. */
export const MAX_INCOMING_BYTES = 40 * 1024 * 1024;
/** A backup carries every attachment and photo, so it may be larger: the restore screen's own limit applies. */
export const MAX_INCOMING_BACKUP_BYTES = 400 * 1024 * 1024;
/** The size limit for an incoming file of this kind. */
export const maxIncomingBytes = (kind: OpenInKind): number => (kind === 'backup' ? MAX_INCOMING_BACKUP_BYTES : MAX_INCOMING_BYTES);
/** Text handed to Paste a booking is cut to this many characters (a confirmation is never longer). */
export const MAX_PASTE_CHARS = 20000;
/** How many leading bytes the native side reads for sniffing a file with no telling name. */
export const SNIFF_BYTES = 512;
/** The folder under the app's documents where incoming files are copied first (not iOS's own Documents/Inbox). */
export const INCOMING_FOLDER = 'incoming';
/** The exported UTI for .satchel files (app.json UTExportedTypeDeclarations). */
export const TRIP_UTI = 'app.satchel.trip';

/** True for a URL that carries a file (iOS Open in / Copy to, Android VIEW): file:// or content://. */
export function isIncomingFileUrl(url: unknown): url is string {
  return typeof url === 'string' && /^(file|content):\/\//i.test(url.trim());
}

/** The decoded last path segment of a file URL ('' when there is none). */
export function fileNameFromUrl(url: string): string {
  const path = url.trim().replace(/^[a-z]+:\/\/[^/]*/i, '').split(/[?#]/)[0] ?? '';
  const last = path.split('/').filter(Boolean).pop() ?? '';
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

const EXT_KIND: Record<string, OpenInKind> = {
  satchel: 'trip',
  satchelbackup: 'backup',
  pdf: 'pdf',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  heic: 'image',
  heif: 'image',
  gif: 'image',
  webp: 'image',
  txt: 'text',
  text: 'text',
  eml: 'eml',
};

const UTI_KIND: Record<string, OpenInKind> = {
  [TRIP_UTI]: 'trip',
  [BACKUP_UTI]: 'backup',
  'com.adobe.pdf': 'pdf',
  'public.image': 'image',
  'public.jpeg': 'image',
  'public.png': 'image',
  'public.heic': 'image',
  'public.heif': 'image',
  'com.compuserve.gif': 'image',
  'org.webmproject.webp': 'image',
  'public.plain-text': 'text',
  'public.utf8-plain-text': 'text',
  'public.text': 'text',
  'com.apple.mail.email': 'eml',
  'public.email-message': 'eml',
};

function kindForMime(mime: string): OpenInKind {
  const m = mime.trim().toLowerCase().split(';')[0] ?? '';
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('image/')) return 'image';
  if (m === 'message/rfc822') return 'eml';
  if (m === 'text/plain') return 'text';
  if (m === 'application/vnd.satchel.trip+json') return 'trip';
  if (m === BACKUP_FILE_MIME) return 'backup';
  return 'unknown';
}

/**
 * What the file is, from its name, UTI and MIME type (in that order of trust). 'unknown' means "look at the bytes"
 * (sniffKind): a .json file or a nameless content:// file is only a trip file if its contents say so.
 */
export function classifyFile(p: { name?: string | null; mime?: string | null; uti?: string | null }): OpenInKind {
  const ext = extensionOf(p.name ?? '');
  const byExt = EXT_KIND[ext];
  if (byExt) return byExt;
  const byUti = p.uti ? UTI_KIND[p.uti.trim().toLowerCase()] ?? UTI_KIND[p.uti.trim()] : undefined;
  if (byUti) return byUti;
  return p.mime ? kindForMime(p.mime) : 'unknown';
}

const startsWith = (b: Uint8Array, sig: readonly number[], at = 0) => sig.every((x, i) => b[at + i] === x);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
const EML_HEAD = /^(received|return-path|delivered-to|from|to|subject|date|message-id|mime-version|reply-to|x-[\w-]+|arc-[\w-]+|dkim-signature|authentication-results|content-type):/i;

/** What the first bytes of a file say it is, or null when they say nothing useful (binary of some other kind). */
export function sniffKind(bytes: Uint8Array): OpenInKind | null {
  if (bytes.length === 0) return null;
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'image'; // PNG
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image'; // JPEG
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image'; // GIF8
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && ascii(bytes, 8, 12) === 'WEBP') return 'image';
  if (ascii(bytes, 4, 8) === 'ftyp' && /^(heic|heix|hevc|heif|mif1|msf1)$/.test(ascii(bytes, 8, 12))) return 'image';
  // Text: no control bytes other than tab / newline / return (UTF-8 multibyte bytes are >= 0x80, so they pass).
  const start = startsWith(bytes, [0xef, 0xbb, 0xbf]) ? 3 : 0;
  for (let i = start; i < bytes.length; i++) {
    const c = bytes[i];
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) return null;
  }
  const text = decodeBytes(bytes.subarray(start), 'utf-8');
  const lead = text.trimStart();
  if (lead.startsWith('{') && /"format"\s*:\s*"satchel-trip"/.test(text)) return 'trip';
  if (lead.startsWith('{') && /"format"\s*:\s*"satchel-backup"/.test(text)) return 'backup';
  if (lead.startsWith('{') || lead.startsWith('[')) return 'unknown'; // some other JSON: not ours
  if (EML_HEAD.test(lead)) return 'eml';
  return 'text';
}

/** The kind to act on: the name / UTI / MIME answer, else what the bytes say, else unknown. */
export function decideKind(p: { name?: string | null; mime?: string | null; uti?: string | null }, head?: Uint8Array | null): OpenInKind {
  const ext = extensionOf(p.name ?? '');
  const named = classifyFile(p);
  // A file named .json or .txt could still be a trip file renamed by a mail app; the bytes decide those.
  if (named !== 'unknown' && ext !== 'txt' && ext !== 'text') return named;
  const sniffed = head ? sniffKind(head) : null;
  if (named === 'text') return sniffed === 'trip' || sniffed === 'backup' || sniffed === 'eml' ? sniffed : 'text';
  return sniffed ?? 'unknown';
}

/** Which screen a kind goes to. */
export function routeFor(kind: OpenInKind): OpenInRoute {
  switch (kind) {
    case 'trip':
      return 'import';
    case 'backup':
      return 'restore';
    case 'pdf':
    case 'image':
      return 'addToTrip';
    case 'text':
    case 'eml':
      return 'paste';
    default:
      return 'unsupported';
  }
}

/**
 * Where expo-router sends an incoming system URL (app/+native-intent.tsx). A file URL goes to the Open in screen
 * with the URL as a parameter, so it never reaches the router as a path it can't match; anything else is left as it
 * came. Never throws.
 */
export function incomingRedirect(path: unknown): string | null {
  try {
    if (!isIncomingFileUrl(path)) return null;
    return `/openin?uri=${encodeURIComponent(path.trim())}`;
  } catch {
    return null;
  }
}

/** A safe file name for the inbox copy: `<id>-<name>`, path characters replaced, never empty, at most 80 chars. */
export function incomingName(id: string, name: string, kind: OpenInKind = 'unknown'): string {
  const fallback = kind === 'pdf' ? 'file.pdf' : kind === 'image' ? 'image.jpg' : kind === 'eml' ? 'message.eml' : kind === 'trip' ? 'trip.satchel' : kind === 'backup' ? 'backup.satchelbackup' : 'file';
  const clean = name.replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '').slice(-80) || fallback;
  return `${id}-${clean}`;
}

/** The MIME type to store on an attachment made from an incoming PDF or image. */
export function mimeForKind(kind: OpenInKind, name: string, mime?: string | null): string {
  const m = (mime ?? '').trim().toLowerCase();
  if (kind === 'pdf') return 'application/pdf';
  if (kind === 'image') {
    if (m.startsWith('image/')) return m;
    const ext = extensionOf(name);
    if (ext === 'png') return 'image/png';
    if (ext === 'heic' || ext === 'heif') return `image/${ext}`;
    if (ext === 'gif') return 'image/gif';
    if (ext === 'webp') return 'image/webp';
    return 'image/jpeg';
  }
  return m || 'application/octet-stream';
}

// ---------------------------------------------------------------------------------------------------------------
// Bytes and text

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX: Record<string, number> = Object.fromEntries([...B64].map((c, i) => [c, i]));

/** Base64 (standard or URL-safe, whitespace and padding ignored) to bytes. Invalid characters are skipped. */
export function base64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let n = 0;
  for (let i = 0; i + 1 < clean.length; i += 4) {
    const a = B64_INDEX[clean[i]];
    const b = B64_INDEX[clean[i + 1]];
    const c = i + 2 < clean.length ? B64_INDEX[clean[i + 2]] : -1;
    const d = i + 3 < clean.length ? B64_INDEX[clean[i + 3]] : -1;
    out[n++] = (a << 2) | (b >> 4);
    if (c >= 0) out[n++] = ((b & 15) << 4) | (c >> 2);
    if (c >= 0 && d >= 0) out[n++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, n);
}

/** UTF-8 bytes to text; a broken sequence becomes U+FFFD rather than an error. */
function utf8(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const c = bytes[i];
    let cp = 0xfffd;
    let len = 1;
    if (c < 0x80) cp = c;
    else if (c >= 0xc2 && c < 0xe0 && (bytes[i + 1] & 0xc0) === 0x80) {
      cp = ((c & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      len = 2;
    } else if (c >= 0xe0 && c < 0xf0 && (bytes[i + 1] & 0xc0) === 0x80 && (bytes[i + 2] & 0xc0) === 0x80) {
      cp = ((c & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f);
      len = 3;
    } else if (c >= 0xf0 && c < 0xf5 && (bytes[i + 1] & 0xc0) === 0x80 && (bytes[i + 2] & 0xc0) === 0x80 && (bytes[i + 3] & 0xc0) === 0x80) {
      cp = ((c & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      len = 4;
    }
    out += String.fromCodePoint(cp);
    i += len;
  }
  return out;
}

/** Bytes to text in the named charset: UTF-8 (default), US-ASCII, or Latin-1 / Windows-1252 (byte = code point). */
export function decodeBytes(bytes: Uint8Array, charset = 'utf-8'): string {
  const cs = charset.trim().toLowerCase().replace(/^"|"$/g, '');
  if (cs === 'iso-8859-1' || cs === 'latin1' || cs === 'latin-1' || cs === 'windows-1252' || cs === 'cp1252' || cs === 'iso-8859-15') {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return s;
  }
  return utf8(bytes);
}

/** Quoted-printable to bytes (soft line breaks removed, =XX decoded). Characters above 255 are kept as UTF-8. */
export function decodeQuotedPrintable(s: string): Uint8Array {
  const text = s.replace(/=\r?\n/g, '');
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(text.slice(i + 1, i + 3))) {
      out.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
      continue;
    }
    const code = text.charCodeAt(i);
    if (code < 0x80) out.push(code);
    else for (const b of new TextEncoderLite(ch).bytes) out.push(b);
  }
  return Uint8Array.from(out);
}

/** Minimal UTF-8 encoder for one character (no TextEncoder in some runtimes' typings). */
class TextEncoderLite {
  bytes: number[];
  constructor(ch: string) {
    const cp = ch.codePointAt(0) ?? 0xfffd;
    if (cp < 0x80) this.bytes = [cp];
    else if (cp < 0x800) this.bytes = [0xc0 | (cp >> 6), 0x80 | (cp & 63)];
    else if (cp < 0x10000) this.bytes = [0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)];
    else this.bytes = [0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)];
  }
}

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', euro: '€', pound: '£', yen: '¥', copy: '©', reg: '®', middot: '·', bull: '•', rarr: '→' };

/** HTML (an email's text/html part) to plain readable text: blocks become lines, tags go, entities decode. */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(head|style|script|title)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|table|section|header|footer|blockquote)\s*>/gi, '\n')
    .replace(/<(p|div|tr|li|h[1-6]|table)\b[^>]*>/gi, '\n')
    .replace(/<\/t[dh]\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

const safeChar = (cp: number) => (Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '');

// ---------------------------------------------------------------------------------------------------------------
// .eml messages

type Headers = Record<string, string>;
type Part = { headers: Headers; body: string };

/** Splits a message or MIME part into its headers (lower-case names, folded lines joined) and raw body. */
function splitPart(raw: string): Part {
  const text = raw.replace(/\r\n?/g, '\n');
  const cut = text.search(/\n\n/);
  const head = cut >= 0 ? text.slice(0, cut) : text;
  const body = cut >= 0 ? text.slice(cut + 2) : '';
  const headers: Headers = {};
  // The first copy of a repeated header wins; folded continuation lines join the header they follow.
  let last: string | null = null;
  for (const line of head.split('\n')) {
    if (/^[ \t]/.test(line)) {
      if (last) headers[last] += ` ${line.trim()}`;
      continue;
    }
    const m = /^([!-9;-~]+):\s*(.*)$/.exec(line);
    if (!m) {
      last = null;
      continue;
    }
    const name = m[1].toLowerCase();
    if (name in headers) {
      last = null;
      continue;
    }
    headers[name] = m[2].trim();
    last = name;
  }
  return { headers, body };
}

/** A header parameter such as charset or boundary ('' when missing). */
function param(value: string | undefined, name: string): string {
  if (!value) return '';
  const m = new RegExp(`;\\s*${name}\\s*=\\s*("([^"]*)"|[^;\\s]+)`, 'i').exec(value);
  return m ? (m[2] ?? m[1]).replace(/^"|"$/g, '') : '';
}

/** RFC 2047 encoded words (=?UTF-8?B?...?= and =?UTF-8?Q?...?=) in a header to plain text. */
export function decodeHeader(value: string): string {
  return value
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs: string, enc: string, data: string) => {
      const bytes = enc.toUpperCase() === 'B' ? base64ToBytes(data) : decodeQuotedPrintable(data.replace(/_/g, ' '));
      return decodeBytes(bytes, cs.split('*')[0]);
    })
    .trim();
}

/** A part's body decoded per its Content-Transfer-Encoding and charset. */
function partText(p: Part): string {
  const enc = (p.headers['content-transfer-encoding'] ?? '').trim().toLowerCase();
  const charset = param(p.headers['content-type'], 'charset') || 'utf-8';
  if (enc === 'base64') return decodeBytes(base64ToBytes(p.body), charset);
  if (enc === 'quoted-printable') return decodeBytes(decodeQuotedPrintable(p.body), charset);
  // 7bit / 8bit / binary: the body is already text. A Latin-1 charset read as text keeps its characters.
  return p.body;
}

const mediaType = (p: Part) => (p.headers['content-type'] ?? 'text/plain').split(';')[0].trim().toLowerCase();
const isAttachment = (p: Part) => /^\s*attachment/i.test(p.headers['content-disposition'] ?? '');

/** Every leaf part of a (possibly nested) multipart message, in order. */
function leaves(p: Part, depth = 0): Part[] {
  const type = mediaType(p);
  const boundary = param(p.headers['content-type'], 'boundary');
  if (!type.startsWith('multipart/') || !boundary || depth > 6) return [p];
  const out: Part[] = [];
  const marker = `--${boundary}`;
  const chunks = p.body.split(marker).slice(1);
  for (const chunk of chunks) {
    if (chunk.startsWith('--')) break; // closing boundary
    out.push(...leaves(splitPart(chunk.replace(/^[ \t]*\r?\n/, '')), depth + 1));
  }
  return out;
}

export type EmlText = { subject: string; from: string; date: string; body: string };

/** Reads an .eml message: Subject, From, Date and the readable body (text/plain, else text/html as text). */
export function parseEml(raw: string): EmlText {
  const top = splitPart(raw);
  const parts = leaves(top).filter((p) => !isAttachment(p));
  const plain = parts.find((p) => mediaType(p) === 'text/plain');
  const html = parts.find((p) => mediaType(p) === 'text/html');
  let body = '';
  if (plain) body = partText(plain);
  else if (html) body = htmlToText(partText(html));
  return {
    subject: decodeHeader(top.headers.subject ?? ''),
    from: decodeHeader(top.headers.from ?? ''),
    date: (top.headers.date ?? '').trim(),
    body: body.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim(),
  };
}

/** The text Paste a booking gets for an incoming message: header lines the parser can use, then the body. */
export function emlToPasteText(raw: string): string {
  const m = parseEml(raw);
  const head = [m.subject && `Subject: ${m.subject}`, m.from && `From: ${m.from}`, m.date && `Date: ${m.date}`].filter(Boolean).join('\n');
  return clampPaste(head && m.body ? `${head}\n\n${m.body}` : head || m.body);
}

/** Text for Paste a booking from an incoming file of this kind (byte order mark gone, line ends tidy, capped). */
export function pasteTextFor(kind: 'text' | 'eml', raw: string): string {
  const text = raw.replace(/^﻿/, '');
  return kind === 'eml' ? emlToPasteText(text) : clampPaste(text.replace(/\r\n?/g, '\n').trim());
}

const clampPaste = (s: string) => (s.length > MAX_PASTE_CHARS ? s.slice(0, MAX_PASTE_CHARS) : s);
