// .mobileconfig builder: a Configuration profile wrapping one com.apple.webClip.managed
// payload per icon. Pure TS (no React Native / Expo), unsigned profiles.

export type WebClipIcon = {
  label: string;
  /** Target app URL scheme or universal link, e.g. `music:` */
  url: string;
  /** PNG bytes as base64 (whitespace is ignored). */
  pngBase64: string;
};

export type BuildProfileOptions = {
  themeName: string;
  icons: WebClipIcon[];
  uuid?: () => string;
  identifierPrefix?: string;
  /** Shown as " (1 of 2)" after the display name when a set is split. */
  part?: { index: number; total: number };
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

function webClipPayload(icon: WebClipIcon, profileIdentifier: string, uuid: string): string {
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
    str(i, 'PayloadIdentifier', `${profileIdentifier}.webclip.${uuid}`) +
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
  const profileUuid = uuid();
  const identifier = `${prefix}.${slugify(opts.themeName)}.${profileUuid}`;
  const payloads = opts.icons.map((icon) => webClipPayload(icon, identifier, uuid())).join('');
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
  const id = `${identifierPrefix ?? DEFAULT_IDENTIFIER_PREFIX}.${'x'.repeat(40)}.${SAMPLE_UUID}`;
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
