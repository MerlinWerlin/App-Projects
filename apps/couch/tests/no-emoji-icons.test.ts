/**
 * Button artwork guard (owner feedback fb-1017b H2: "real button artwork instead of emoji").
 * Every icon in the app is drawn from Couch's own vector set (src/ui/icons). No emoji, pictograph
 * or symbol character may stand in for an icon in app/ or src/ui — neither literally nor as a
 * \u escape. Comments and tests are ignored. Pure TS + Node built-ins.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { KEY_LABEL } from '../src/core/keys';
import { ICON_NAMES, isIconName } from '../src/ui/icons/names';
import { ICON_PATHS } from '../src/ui/icons/paths';
import { allKeyControls, MID, NUMPAD_GRID, NUMPAD_OK, VOICE_BUTTON } from '../src/ui/remote/controls';
import { SIMPLE_CONTROLS } from '../src/ui/remote/simple';

const ROOT = join(__dirname, '..');

/**
 * Files still allowed to draw symbol glyphs. Keep this list empty except for work in flight.
 * (No allowlist: AppTile.tsx was rewritten in T63 and is scanned like every other file.)
 */
const ALLOW = new Set<string>([]);

/** Arrows, technical, geometric, dingbats, misc symbols; emoji planes; variation selectors. */
const SYMBOL = /[\u2190-\u2BFF\uFE0E\uFE0F]|[\u{1F000}-\u{1FAFF}]/u;
/** The same ranges written as escapes in source ('\u23FB', '\u{1F399}', '\uFE0F'). */
const SYMBOL_ESCAPE = /\\u(?:2[1-9AB][0-9A-F]{2}|FE0[EF]|\{(?:1F[0-9A-F]{3}|2[1-9AB][0-9A-F]{2}|FE0[EF])\})/i;

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !p.includes('__tests__')) out.push(p);
  }
  return out;
}

/** Drop block comments, JSX comments and line comments (keeping "://" in URLs). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => l.replace(/(^|[^:\\])\/\/.*$/, '$1'))
    .join('\n');
}

function symbolHits(src: string): string[] {
  return stripComments(src)
    .split('\n')
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => SYMBOL.test(l) || SYMBOL_ESCAPE.test(l))
    .map(({ l, i }) => `${i + 1}: ${l.trim()}`);
}

describe('no emoji / symbol glyphs as icons', () => {
  it('the scanner catches literal and escaped glyphs and ignores comments', () => {
    expect(symbolHits("const a = '\u23FB';")).toHaveLength(1);
    expect(symbolHits("const a = '\u{1F507}';")).toHaveLength(1);
    expect(symbolHits("const a = '\\u{1F399}\\u{FE0E}';")).toHaveLength(1);
    expect(symbolHits("const a = '\\u2328';")).toHaveLength(1);
    expect(symbolHits("<Text>\u2715</Text>")).toHaveLength(1);
    expect(symbolHits("const a = 'ok'; // \u25B2 up")).toEqual([]);
    expect(symbolHits('/* Settings \u2192 Remote theme */')).toEqual([]);
    expect(symbolHits("const u = 'http://x/\u2190';")).toHaveLength(1);
    expect(symbolHits("const digits = '123'; const dash = '\u2014';")).toEqual([]);
  });

  it('app/ and src/ui draw no emoji, pictographs or symbol characters', () => {
    const files = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'src', 'ui'))];
    expect(files.length).toBeGreaterThan(20);
    const offenders: string[] = [];
    for (const f of files) {
      const rel = relative(ROOT, f).split('\\').join('/');
      if (ALLOW.has(rel)) continue;
      for (const hit of symbolHits(readFileSync(f, 'utf8'))) offenders.push(`${rel}:${hit}`);
    }
    expect(offenders).toEqual([]);
  });

  it('allowlist only names files that exist', () => {
    for (const rel of ALLOW) expect(existsSync(join(ROOT, rel))).toBe(true);
  });
});

describe('icon set coverage', () => {
  it('every IconName has path data', () => {
    for (const id of ICON_NAMES) {
      const parts = ICON_PATHS[id];
      expect({ id, n: (parts?.length ?? 0) > 0 }).toEqual({ id, n: true });
      for (const p of parts) expect(p.d).toMatch(/^M[0-9.\-\s,MmLlHhVvAaCcSsQqZz]+$/);
    }
    expect(Object.keys(ICON_PATHS).sort()).toEqual([...ICON_NAMES].sort());
  });

  it('every remote key, action, voice and simple control has a valid icon or text', () => {
    for (const c of [...allKeyControls(), ...NUMPAD_GRID, NUMPAD_OK]) {
      if (c.icon !== null) expect(isIconName(c.icon)).toBe(true);
      else expect({ key: c.key, ok: /^(|OK|[0-9])$/.test(c.glyph) }).toEqual({ key: c.key, ok: true });
    }
    for (const c of MID) expect(isIconName(c.icon)).toBe(true);
    expect(isIconName(VOICE_BUTTON.icon)).toBe(true);
    for (const c of SIMPLE_CONTROLS) {
      expect(isIconName(c.icon)).toBe(true);
      expect(c.label).toBe(KEY_LABEL[c.key]);
    }
  });
});
