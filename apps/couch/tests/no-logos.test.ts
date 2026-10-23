/**
 * Trademark guard (PLAN 6b, owner feedback 12 Oct 2026): app icons are only ever the images the TV
 * supplies at runtime. The repo must not bundle streaming services' logos, and the house-style
 * fallback tile must never pick its look from an app's name. Pure TS + Node built-ins.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { cleanTileName, tileLabel } from '../src/core/apps';
import { createDemoSession, DEMO_APP_ART, DEMO_TV_APPS, SCREENSHOT_DEMO_APPS } from '../src/core/demo';
import { serviceFor } from '../src/core/storeIcons';

const ROOT = join(__dirname, '..');
const SERVICES = ['netflix', 'youtube', 'prime', 'disney', 'stan', 'iview', 'spotify', 'plex', 'hulu', 'max', 'paramount'];
/** Wider list for demo data: any well-known service, store or platform name. */
const BRANDS = [
  ...SERVICES,
  'amazon', 'apple', 'google', 'twitch', 'crunchyroll', 'peacock', 'tubi', 'pluto', 'vimeo', 'deezer', 'tidal',
  'sbs', 'abc', 'bbc', 'itv', 'espn', 'dazn', 'hbo', 'roku', 'samsung', 'sony', 'vizio', 'philips', 'kayo', 'binge',
  'foxtel', 'pandora', 'soundcloud', 'facebook', 'instagram', 'tiktok', 'fubo', 'sling', 'starz', 'showtime',
];
/** Symbol code points the old tiles drew as glyphs, plus emoji blocks: none may appear in tiles. */
const SYMBOL_CHAR = /[\u2190-\u2BFF\uE000-\uF8FF\u{1F000}-\u{1FAFF}]/u;
const SYMBOL_ESCAPE = /\\u(2[1-9a-bA-B][0-9a-fA-F]{2}|\{1[fF][0-9a-fA-F]{3}\})/;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|ico|heic|avif|tiff?)$/i;

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe('no streaming-service logos', () => {
  it('has no image assets under src/ or assets/ named after a streaming service', () => {
    const images = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'assets'))].filter((f) => IMAGE_EXT.test(f));
    const offenders = images
      .map((f) => relative(ROOT, f))
      .filter((rel) => {
        const lower = rel.toLowerCase();
        return SERVICES.some((s) => lower.includes(s));
      });
    expect(offenders).toEqual([]);
  });

  it('src/core/apps.ts mentions no service names', () => {
    const src = readFileSync(join(ROOT, 'src', 'core', 'apps.ts'), 'utf8').toLowerCase();
    for (const s of SERVICES) {
      // whole word, so identifiers like "maxWidth" or "primeCache" do not trip it
      expect({ s, found: new RegExp(`\\b${s}\\b`).test(src) }).toEqual({ s, found: false });
    }
  });

  it('fallbackTile takes only the app id and never reads a name', () => {
    const src = readFileSync(join(ROOT, 'src', 'core', 'apps.ts'), 'utf8');
    const start = src.indexOf('export function fallbackTile(');
    expect(start).toBeGreaterThanOrEqual(0);
    const end = src.indexOf('\n}\n', start);
    const body = src.slice(start, end);
    expect(body).toMatch(/^export function fallbackTile\(appId: string\)/);
    expect(body).not.toMatch(/\bname\b/i);
    expect(body).not.toMatch(/\b(if|switch|case)\b|\?[^.]/);
    // The hash helper it relies on must not look at names either.
    const h = src.indexOf('export function stableHash(');
    expect(src.slice(h, src.indexOf('\n}\n', h))).not.toMatch(/\bname\b/i);
  });

  it('the app tile picks its fallback from the app id', () => {
    const tile = readFileSync(join(ROOT, 'src', 'ui', 'apps', 'AppTile.tsx'), 'utf8');
    expect(tile).toMatch(/fallbackTile\(app\.id\)/);
    expect(tile).not.toMatch(/fallbackTile\(app\.name\)/);
  });

  it('the app tiles draw no symbol or emoji glyphs', () => {
    const dir = join(ROOT, 'src', 'ui', 'apps');
    for (const f of readdirSync(dir).filter((n) => /\.tsx?$/.test(n) && !/\.test\./.test(n))) {
      const src = readFileSync(join(dir, f), 'utf8');
      expect({ f, char: SYMBOL_CHAR.test(src) }).toEqual({ f, char: false });
      expect({ f, escape: SYMBOL_ESCAPE.test(src) }).toEqual({ f, escape: false });
    }
    expect(readFileSync(join(dir, 'AppTile.tsx'), 'utf8')).not.toMatch(/GLYPH_TEXT|TileGlyph|TILE_GLYPHS/);
    // Names from the TV are cleaned of symbols before they are set in the house tile.
    expect(tileLabel('\u2605 Star\u266A').text).toBe('Star');
    expect(cleanTileName('\u25B6\uFE0E Go')).toBe('Go');
  });
});

describe('real service icons (owner decision 22 Oct 2026)', () => {
  it('demo apps are real services whose icons come only from the App Store at runtime', async () => {
    const demo = await createDemoSession({ sleep: async () => {} });
    const apps = await demo.drivers.get('demo-1')!.listApps();
    expect(apps.map((a) => a.id)).toEqual(DEMO_TV_APPS.map((a) => a.id));
    for (const a of apps) expect(serviceFor(a)).not.toBeNull();
    const src = readFileSync(join(ROOT, 'src', 'core', 'storeIcons.ts'), 'utf8');
    expect(src).toMatch(/https:\/\/itunes\.apple\.com\/search/);
    expect(src).not.toMatch(/require\(|data:image/);
  });

  it('screenshot demo apps keep invented names and original art', () => {
    const lower = (s: string) => s.toLowerCase();
    for (const a of SCREENSHOT_DEMO_APPS) {
      for (const b of BRANDS) expect({ id: a.id, b, hit: new RegExp(`(^|[^a-z])${b}([^a-z]|$)`).test(lower(a.name)) }).toEqual({ id: a.id, b, hit: false });
      expect(DEMO_APP_ART[a.id]).toBeDefined();
    }
  });
});
