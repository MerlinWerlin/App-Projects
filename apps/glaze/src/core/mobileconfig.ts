// .mobileconfig builder: a Configuration profile wrapping one com.apple.webClip.managed
// payload per icon. Pure TS (no React Native / Expo), unsigned profiles.

import { utf8Encode } from './bytes.ts';

export type WebClipIcon = {
  label: string;
  /** Target app URL scheme or universal link, e.g. `music:` */
  url: string;
  /** PNG bytes as base64 (whitespace is ignored). */
  pngBase64: string;
  /**
   * T202: which app this icon opens (catalogue app id or bundle id). With an install id the web
   * clip's PayloadIdentifier / PayloadUUID derive from (installId, key) only, so the same app keeps
   * the same payload ids across themes. Omitted: the URL stands in for it.
   */
  key?: string;
};

export type BuildProfileOptions = {
  themeName: string;
  icons: WebClipIcon[];
  uuid?: () => string;
  identifierPrefix?: string;
  /** Shown as " (1 of 2)" after the display name when a set is split. */
  part?: { index: number; total: number };
  /**
   * T194 / T202: one random id per Glaze install (src/store/installId.ts, `makeInstallId`). When
   * set, the profile's PayloadIdentifier AND PayloadUUID are the same for every theme and every
   * build (`<prefix>.<installId>`, plus `.part<k>` for the 2nd+ file of a split set), and each web
   * clip's PayloadIdentifier / PayloadUUID derive only from (installId, app key): never the theme,
   * the position or the time. Installing a new theme's profile therefore REPLACES the previous
   * Glaze profile in iOS and updates its web clips in place instead of adding new ones. Without it
   * the old behaviour stays (random identifiers per build).
   */
  installId?: string;
};

export type ProfileFile = { filename: string; xml: string };

export const DEFAULT_IDENTIFIER_PREFIX = 'com.jared797.glaze.icons';
export const DEFAULT_MAX_PROFILE_BYTES = 2.5 * 1024 * 1024;

// ---- UUIDs ----

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(out);
  } else {
    for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

/** RFC 4122 version 4 UUID, upper case (as Apple's tools write them). */
export function uuidV4(bytes: (n: number) => Uint8Array = randomBytes): string {
  const b = bytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`.toUpperCase();
}

// ---- stable ids (T194) ----

/** Install id format: 6-32 lower-case letters / digits. */
export function isValidInstallId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9]{6,32}$/.test(id);
}

/** A fresh random install id (16 lower-case hex characters). Created once and stored by src/store. */
export function makeInstallId(bytes: (n: number) => Uint8Array = randomBytes): string {
  return Array.from(bytes(8), (x) => x.toString(16).padStart(2, '0')).join('');
}

/** SHA-1 digest (pure TS; only used to derive name-based UUIDs, not for security). */
export function sha1(data: Uint8Array): Uint8Array {
  const ml = data.length;
  const total = (((ml + 8) >> 6) + 1) << 6;
  const m = new Uint8Array(total);
  m.set(data);
  m[ml] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(total - 8, Math.floor(ml / 0x20000000));
  dv.setUint32(total - 4, (ml * 8) >>> 0);
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = t;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => ov.setUint32(i * 4, h));
  return out;
}

function uuidBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) throw new Error(`not a UUID: ${uuid}`);
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** RFC 4122 DNS namespace (used for the known-answer test and to derive the Glaze namespace). */
export const UUID_NAMESPACE_DNS = '6BA7B810-9DAD-11D1-80B4-00C04FD430C8';

/** RFC 4122 version 5 (name-based, SHA-1) UUID, upper case. Same inputs give the same UUID forever. */
export function uuidV5(name: string, namespace: string): string {
  const ns = uuidBytes(namespace);
  const nm = utf8Encode(name);
  const buf = new Uint8Array(ns.length + nm.length);
  buf.set(ns);
  buf.set(nm, ns.length);
  const b = sha1(buf).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`.toUpperCase();
}

/** Namespace of every Glaze profile UUID: v5 of the profile prefix in the DNS namespace. */
export const GLAZE_UUID_NAMESPACE = uuidV5(DEFAULT_IDENTIFIER_PREFIX, UUID_NAMESPACE_DNS);

/** A deterministic upper-case UUID (v5, SHA-1) derived only from `seed`. */
export function stableUuid(seed: string): string {
  return uuidV5(seed, GLAZE_UUID_NAMESPACE);
}

/**
 * T202: the per-app part of a web clip identifier: lower-case [a-z0-9.-], at most 60 characters
 * ("app" when nothing is left). Built from the catalogue app id / bundle id, never the theme.
 */
export function appPayloadKey(key: string): string {
  const k = key
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 60)
    .replace(/[.-]+$/g, '');
  return k || 'app';
}

/** The stable PayloadIdentifier + PayloadUUID of one app's web clip for an install (T202). */
export function stableWebClipIds(
  installId: string,
  appKey: string,
  identifierPrefix?: string,
): { identifier: string; uuid: string } {
  const key = appPayloadKey(appKey);
  return {
    identifier: `${stableProfileIdentifier(installId, 1, identifierPrefix)}.webclip.${key}`,
    uuid: stableUuid(`webclip:${installId}:${key}`),
  };
}

/** The stable top-level PayloadUUID of an install's profile (part 1, or part k of a split set). */
export function stableProfileUuid(installId: string, partIndex = 1): string {
  return stableUuid(partIndex > 1 ? `profile:${installId}:part${partIndex}` : `profile:${installId}`);
}

/** The top-level PayloadIdentifier for an install id ("com.jared797.glaze.icons.<id>", ".part2" …). */
export function stableProfileIdentifier(installId: string, partIndex = 1, identifierPrefix?: string): string {
  const prefix = (identifierPrefix ?? DEFAULT_IDENTIFIER_PREFIX).replace(/\.+$/, '');
  return partIndex > 1 ? `${prefix}.${installId}.part${partIndex}` : `${prefix}.${installId}`;
}

// ---- XML helpers ----

/** Escape text for XML; drops characters XML 1.0 forbids (control chars, lone surrogates). */
export function escapeXml(s: string): string {
  const cleaned = s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Lower-case ascii slug for identifiers and filenames ("theme" when nothing is left). */
export function slugify(s: string): string {
  const slug = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug || 'theme';
}

/** UTF-8 byte length without relying on TextEncoder. */
export function utf8Length(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        n += 4;
        i++;
      } else n += 3;
    } else n += 3;
  }
  return n;
}

function wrapBase64(b64: string, indent: string, width = 68): string {
  const clean = b64.replace(/\s+/g, '');
  const lines: string[] = [];
  for (let i = 0; i < clean.length; i += width) lines.push(indent + clean.slice(i, i + width));
  return lines.join('\n');
}

const str = (indent: string, key: string, value: string) =>
  `${indent}<key>${escapeXml(key)}</key>\n${indent}<string>${escapeXml(value)}</string>\n`;
const int = (indent: string, key: string, value: number) =>
  `${indent}<key>${escapeXml(key)}</key>\n${indent}<integer>${Math.trunc(value)}</integer>\n`;
const bool = (indent: string, key: string, value: boolean) =>
  `${indent}<key>${escapeXml(key)}</key>\n${indent}<${value ? 'true' : 'false'}/>\n`;

function webClipPayload(icon: WebClipIcon, identifier: string, uuid: string): string {
  const i = '\t\t\t';
  const label = icon.label.trim() || 'App';
  return (
    '\t\t<dict>\n' +
    bool(i, 'FullScreen', false) +
    `${i}<key>Icon</key>\n${i}<data>\n${wrapBase64(icon.pngBase64, i)}\n${i}</data>\n` +
    bool(i, 'IsRemovable', true) +
    str(i, 'Label', label) +
    str(i, 'PayloadDescription', `Opens ${label}`) +
    str(i, 'PayloadDisplayName', label) +
    str(i, 'PayloadIdentifier', identifier) +
    str(i, 'PayloadType', 'com.apple.webClip.managed') +
    str(i, 'PayloadUUID', uuid) +
    int(i, 'PayloadVersion', 1) +
    bool(i, 'Precomposed', true) +
    str(i, 'URL', icon.url) +
    '\t\t</dict>\n'
  );
}

export function profileDisplayName(themeName: string, part?: { index: number; total: number }): string {
  const base = `Glaze icons – ${themeName.trim() || 'Custom'}`;
  return part && part.total > 1 ? `${base} (${part.index} of ${part.total})` : base;
}

/** Build one unsigned .mobileconfig (plist XML). */
export function buildProfile(opts: BuildProfileOptions): string {
  const uuid = opts.uuid ?? (() => uuidV4());
  const prefix = (opts.identifierPrefix ?? DEFAULT_IDENTIFIER_PREFIX).replace(/\.+$/, '');
  const installId = isValidInstallId(opts.installId) ? opts.installId : null;
  const partIndex = opts.part ? Math.max(1, Math.trunc(opts.part.index)) : 1;
  // T202: with an install id the top-level PayloadUUID is stable too. iOS replaces an installed
  // profile that has the same PayloadIdentifier; keeping the UUID stable as well makes the new
  // theme's file the same profile in every respect, only with new contents.
  const profileUuid = installId ? stableProfileUuid(installId, partIndex) : uuid();
  const identifier = installId
    ? stableProfileIdentifier(installId, partIndex, prefix)
    : `${prefix}.${slugify(opts.themeName)}.${profileUuid}`;
  // Two icons for the same app in one set (rare) get ".dup2", ".dup3" so payload ids stay unique.
  const seen = new Map<string, number>();
  const payloads = opts.icons
    .map((icon) => {
      if (!installId) {
        const u = uuid();
        return webClipPayload(icon, `${identifier}.webclip.${u}`, u);
      }
      const base = appPayloadKey(icon.key ?? icon.url);
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      const ids = stableWebClipIds(installId, n > 1 ? `${base}.dup${n}` : base, prefix);
      return webClipPayload(icon, ids.identifier, ids.uuid);
    })
    .join('');
  const i = '\t';
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
    '<plist version="1.0">\n' +
    '<dict>\n' +
    `${i}<key>PayloadContent</key>\n` +
    (payloads ? `${i}<array>\n${payloads}${i}</array>\n` : `${i}<array/>\n`) +
    str(
      i,
      'PayloadDescription',
      'Adds Home Screen shortcuts that open your apps with your Glaze icons. Your original apps stay in the App Library. Remove this profile any time to remove the icons.',
    ) +
    str(i, 'PayloadDisplayName', profileDisplayName(opts.themeName, opts.part)) +
    str(i, 'PayloadIdentifier', identifier) +
    str(i, 'PayloadOrganization', 'Glaze') +
    bool(i, 'PayloadRemovalDisallowed', false) +
    str(i, 'PayloadType', 'Configuration') +
    str(i, 'PayloadUUID', profileUuid) +
    int(i, 'PayloadVersion', 1) +
    '</dict>\n' +
    '</plist>\n'
  );
}

// ---- size estimate and splitting ----

const SAMPLE_UUID = '00000000-0000-4000-8000-000000000000';

/** Bytes one icon adds to a profile. */
export function estimateIconBytes(icon: WebClipIcon, identifierPrefix?: string): number {
  // Longer than any real identifier: a 40-char slug + UUID + ".webclip." + UUID (a real app key is ≤ 60).
  const id = `${identifierPrefix ?? DEFAULT_IDENTIFIER_PREFIX}.${'x'.repeat(40)}.${SAMPLE_UUID}.webclip.${SAMPLE_UUID}`;
  return utf8Length(webClipPayload(icon, id, SAMPLE_UUID));
}

function overheadBytes(themeName: string, identifierPrefix?: string): number {
  return utf8Length(
    buildProfile({ themeName: `${themeName} (99 of 99)`, icons: [], uuid: () => SAMPLE_UUID, identifierPrefix }),
  );
}

/** Estimated size in bytes of a single profile holding all `icons`. */
export function estimateSize(icons: WebClipIcon[], themeName = 'Custom', identifierPrefix?: string): number {
  let n = overheadBytes(themeName, identifierPrefix);
  for (const icon of icons) n += estimateIconBytes(icon, identifierPrefix);
  return n;
}

/**
 * Greedily group icons (order kept) so each profile stays under `maxBytes`.
 * An icon that alone exceeds the limit gets a profile of its own.
 */
export function splitIcons(
  icons: WebClipIcon[],
  maxBytes: number = DEFAULT_MAX_PROFILE_BYTES,
  themeName = 'Custom',
  identifierPrefix?: string,
): WebClipIcon[][] {
  const overhead = overheadBytes(themeName, identifierPrefix);
  const groups: WebClipIcon[][] = [];
  let current: WebClipIcon[] = [];
  let size = overhead;
  for (const icon of icons) {
    const b = estimateIconBytes(icon, identifierPrefix);
    if (current.length > 0 && size + b > maxBytes) {
      groups.push(current);
      current = [];
      size = overhead;
    }
    current.push(icon);
    size += b;
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/** Build one or more profiles; filenames are `Glaze-<slug>.mobileconfig` or `Glaze-<slug>-1-of-2.mobileconfig`. */
export function buildProfiles(opts: BuildProfileOptions & { maxBytes?: number }): ProfileFile[] {
  const groups = splitIcons(opts.icons, opts.maxBytes ?? DEFAULT_MAX_PROFILE_BYTES, opts.themeName, opts.identifierPrefix);
  const slug = slugify(opts.themeName);
  const total = groups.length;
  return groups.map((icons, k) => ({
    filename: total > 1 ? `Glaze-${slug}-${k + 1}-of-${total}.mobileconfig` : `Glaze-${slug}.mobileconfig`,
    xml: buildProfile({
      themeName: opts.themeName,
      icons,
      uuid: opts.uuid,
      identifierPrefix: opts.identifierPrefix,
      part: { index: k + 1, total },
      installId: opts.installId,
    }),
  }));
}

// ---- user guides ----

export function installGuide(profileCount = 1): string[] {
  const steps = [
    'Open the profile in Safari (Glaze opens it for you in builds that can), tap Allow, then Close. Mail or AirDrop to yourself also works. A copy saved to Files often does not install. iOS shows "Profile Downloaded".',
    'Open Settings. Tap "Profile Downloaded" near the top (or go to General > VPN & Device Management) and pick the Glaze icons profile.',
    'Tap Install and enter your passcode. iOS marks the profile "Not Verified" because it is not signed by a company certificate. That is expected: it only adds Home Screen shortcuts that open your apps, and it can be removed any time.',
    'Tap Install again, then Done. Your new icons appear on the Home Screen.',
    'Move the original app icons to the App Library (long-press > Remove App > Remove from Home Screen). The apps themselves stay installed.',
  ];
  if (profileCount > 1) {
    steps.push(`Your icons are split into ${profileCount} profiles to keep each one small. Repeat these steps for each profile.`);
  }
  return steps;
}

export function removeGuide(): string[] {
  return [
    'Open Settings > General > VPN & Device Management.',
    'Tap the "Glaze icons" profile you want to remove.',
    'Tap Remove Profile and enter your passcode.',
    'The icons from that profile disappear from the Home Screen. Your apps and their data are not affected.',
  ];
}
