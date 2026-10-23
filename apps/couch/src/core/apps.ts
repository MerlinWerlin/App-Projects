import type { TvDriver } from './driver';
import { describeError } from './session';
import type { TvApp } from './types';

/**
 * Apps grid logic. Pure TS: sorting, pin toggling and loading the app list from a driver.
 * Pins are plain id lists so the store (T07) can persist them per TV.
 */

/** Pinned apps first in pin order, then the rest alphabetically. `pinned` reflects pinnedIds. */
export function sortApps(apps: readonly TvApp[], pinnedIds: readonly string[]): TvApp[] {
  const byId = new Map(apps.map((a) => [a.id, a]));
  const pinned: TvApp[] = [];
  const seen = new Set<string>();
  for (const id of pinnedIds) {
    const a = byId.get(id);
    if (a && !seen.has(id)) {
      pinned.push({ ...a, pinned: true });
      seen.add(id);
    }
  }
  const rest = apps
    .filter((a) => !seen.has(a.id))
    .map((a) => ({ ...a, pinned: false }))
    .sort((x, y) => x.name.localeCompare(y.name, undefined, { sensitivity: 'base' }) || x.id.localeCompare(y.id));
  return [...pinned, ...rest];
}

/** Pin (appended to the end) or unpin an app id. Returns a new list. */
export function togglePin(pinnedIds: readonly string[], id: string): string[] {
  return pinnedIds.includes(id) ? pinnedIds.filter((p) => p !== id) : [...pinnedIds, id];
}

/** Starting pins when the user has none saved: whatever the TV/driver marks as pinned, in list order. */
export function defaultPins(apps: readonly TvApp[]): string[] {
  return apps.filter((a) => a.pinned).map((a) => a.id);
}

/** Tile letter (prototype shows the first character of the name). */
export function appInitial(name: string): string {
  const c = Array.from(name.trim())[0];
  return c ? c.toUpperCase() : '?';
}

export type AppsLoad =
  | { kind: 'ok'; apps: TvApp[] }
  | { kind: 'unsupported' }
  | { kind: 'none' }
  | { kind: 'error'; message: string };

/** Load the app list from the active driver without throwing. */
export async function loadApps(driver: TvDriver | null): Promise<AppsLoad> {
  if (!driver) return { kind: 'none' };
  if (!driver.listApps) return { kind: 'unsupported' };
  try {
    return { kind: 'ok', apps: await driver.listApps() };
  } catch (e) {
    return { kind: 'error', message: describeError(e) };
  }
}

// ---------- app tiles ----------
//
// Icons are only ever what the TV supplies at runtime (TvDriver.appIcon, cached by
// src/core/appIconCache.ts). We never bundle, draw or restyle a service's logo or brand colours.
// Without a TV icon the tile uses the house style below: the app's NAME set in Couch's own type on
// a Couch palette gradient. The colour is picked by a stable hash of the app id only, never from
// the name (tests/no-logos.test.ts guards this), and tiles carry no symbol or emoji glyphs.

/** Couch house palette for fallback tiles (prototype v2 --h1/--h2 pairs plus two in the same key). */
export const TILE_PALETTE: readonly { readonly h1: string; readonly h2: string }[] = [
  { h1: '#6E8CF0', h2: '#2F4FB8' },
  { h1: '#5FC2C9', h2: '#227A86' },
  { h1: '#9A86F2', h2: '#4B3BA8' },
  { h1: '#F0A86A', h2: '#B4612A' },
  { h1: '#7FC79C', h2: '#2F7A55' },
  { h1: '#E58BA8', h2: '#9E3B62' },
];

export interface FallbackTile {
  h1: string;
  h2: string;
}

/** FNV-1a 32-bit over UTF-16 code units: stable across runs and platforms. */
export function stableHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** House-style tile colours for an app the TV gave no icon for. Depends on the app id only. */
export function fallbackTile(appId: string): FallbackTile {
  const pal = TILE_PALETTE[stableHash(appId) % TILE_PALETTE.length]!;
  return { h1: pal.h1, h2: pal.h2 };
}

/**
 * Symbol and emoji characters removed from tile labels: arrows, maths/technical symbols, geometric
 * shapes, dingbats and misc symbols (U+2190-2BFF), private use (U+E000-F8FF, e.g. vendor logos),
 * variation selectors, ZWJ, (c) (r) TM and the astral emoji / pictograph blocks. Plain code-point
 * ranges (no Unicode property escapes) so every JS engine agrees.
 */
const SYMBOLS = /[\u2190-\u2BFF\uE000-\uF8FF\uFE00-\uFE0F\u200D\u00A9\u00AE\u2122\u{1F000}-\u{1FAFF}\u{E0000}-\u{E007F}]/gu;

/** The app name with symbol/emoji characters removed and whitespace collapsed. */
export function cleanTileName(name: string): string {
  return name.replace(SYMBOLS, ' ').replace(/\s+/g, ' ').trim();
}

export interface TileLabel {
  /** Text for the tile; lines are joined with '\n'. Empty only when the name had nothing usable. */
  text: string;
  /** 'name' = the (short) name itself, 'initials' = up to two initials. */
  kind: 'name' | 'initials';
  lines: 1 | 2;
  /** Longest line in code points (drives the font size). */
  longest: number;
}

const ONE_LINE_MAX = 10;

/**
 * Typographic label for the house-style tile. Short names are shown whole (one line up to 10
 * characters, or two lines of up to 10 for two- or three-word names); anything longer becomes
 * initials ("Long Name Here" -> "LN", "Somethinglong" -> "So"). Deterministic for a name.
 */
export function tileLabel(name: string): TileLabel {
  const clean = cleanTileName(name);
  const len = (s: string) => Array.from(s).length;
  if (clean === '') return { text: '', kind: 'initials', lines: 1, longest: 0 };
  if (len(clean) <= ONE_LINE_MAX) return { text: clean, kind: 'name', lines: 1, longest: len(clean) };
  const words = clean.split(' ');
  if (words.length >= 2 && words.length <= 3) {
    // Best split into two lines, each at most ONE_LINE_MAX.
    const longer = (a: string, b: string) => (len(a) > len(b) ? len(a) : len(b));
    let best: [string, string] | null = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      if (len(a) <= ONE_LINE_MAX && len(b) <= ONE_LINE_MAX) {
        if (!best || longer(a, b) < longer(best[0], best[1])) best = [a, b];
      }
    }
    if (best) return { text: best.join('\n'), kind: 'name', lines: 2, longest: longer(best[0], best[1]) };
  }
  const initials =
    words.length >= 2
      ? words
          .slice(0, 2)
          .map((w) => Array.from(w)[0]!.toUpperCase())
          .join('')
      : (() => {
          const cps = Array.from(clean);
          return cps[0]!.toUpperCase() + (cps[1] ?? '');
        })();
  return { text: initials, kind: 'initials', lines: 1, longest: len(initials) };
}

/** Label font size as a fraction of the tile's width, by the longest line's length. */
export function tileLabelScale(longest: number): number {
  if (longest <= 2) return 0.34;
  if (longest <= 4) return 0.25;
  if (longest <= 6) return 0.19;
  if (longest <= 8) return 0.155;
  return 0.13;
}

// ---------- TV icon framing ----------

/**
 * Tile artwork frame aspect (width / height). 4:3 matches the Roku HD channel icon (290x218), the
 * most common wide TV icon, so those fill the frame edge to edge.
 */
export const ICON_FRAME_ASPECT = 4 / 3;

export interface IconFit {
  /** cover = full-bleed with a slight centre crop; contain = whole icon on the tile backdrop. */
  mode: 'cover' | 'contain';
  /** Displayed size in points (cover: the frame). */
  width: number;
  height: number;
}

/**
 * How a TV-supplied icon sits in the tile frame. Icons whose aspect is within ~15% of the frame
 * are shown full-bleed (cover, centre crop of at most ~13% per axis, so wordmarks are not cut).
 * Others (square webOS/Samsung icons, very wide banners) are shown whole (contain) inside a small
 * inset on the tile backdrop, and never blown up past 1.5x their pixel size (so they stay crisp
 * at @3x instead of turning soft). Unknown sizes are contained in the inset.
 */
export function iconFit(imgW: number, imgH: number, frameW: number, frameH: number, pixelRatio = 3): IconFit {
  if (!(frameW > 0 && frameH > 0)) return { mode: 'contain', width: 0, height: 0 };
  const insetW = frameW * 0.84;
  const insetH = frameH * 0.84;
  if (!(imgW > 0 && imgH > 0 && Number.isFinite(imgW) && Number.isFinite(imgH))) {
    return { mode: 'contain', width: insetW, height: insetH };
  }
  const r = imgW / imgH / (frameW / frameH);
  if (r >= 0.87 && r <= 1.15) return { mode: 'cover', width: frameW, height: frameH };
  const pr = pixelRatio > 0 ? pixelRatio : 1;
  const scale = Math.min(insetW / imgW, insetH / imgH, 1.5 / pr);
  return { mode: 'contain', width: imgW * scale, height: imgH * scale };
}
