/**
 * fb-1017b H1-H3 in the prototype (T62). prototype/index.html is the UI reference that also renders the
 * store screenshots, so it must not drift from the app:
 * - its icon table (#icon-paths JSON) is an exact copy of ICON_PATHS (src/ui/icons/paths.ts);
 * - its demo apps (#demo-apps JSON) are the app's invented demo apps with the same abstract art, plus
 *   house tiles computed by the same core helpers;
 * - no emoji or symbol character stands in for an icon, and no TV maker, platform or service is named;
 * - the OK key follows DPAD_KEY_RATIO.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fallbackTile, tileLabel, tileLabelScale } from '../src/core/apps';
import { DEMO_APP_ART, SCREENSHOT_DEMO_APPS } from '../src/core/demo';
import { DPAD_KEY_RATIO, dpadGeometry } from '../src/core/dpadGeometry';
import { uiEn } from '../src/i18n/catalog/en/ui';
import { ICON_NAMES } from '../src/ui/icons/names';
import { ICON_PATHS, ICON_STROKE, ICON_VIEWBOX } from '../src/ui/icons/paths';
// @ts-expect-error plain .mjs module without types
import { BRAND_RE } from '../store/brand-guard.mjs';

const root = join(__dirname, '..');
const proto = readFileSync(join(root, 'prototype/index.html'), 'utf8');

function jsonBlock(id: string): unknown {
  const m = new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`).exec(proto);
  if (!m || !m[1]) throw new Error(`no #${id} JSON in prototype/index.html`);
  return JSON.parse(m[1]);
}

/** Prototype source with HTML, CSS and JS comments blanked (URLs keep their "//"). */
function withoutComments(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/(^|[^:\\'"])\/\/.*$/, '$1'))
    .join('\n');
}

const SYMBOL = /[←-⯿︎️]|[\u{1F000}-\u{1FAFF}]/u;
const SYMBOL_ESCAPE = /\\u(?:2[1-9AB][0-9A-F]{2}|FE0[EF]|\{(?:1F[0-9A-F]{3}|2[1-9AB][0-9A-F]{2}|FE0[EF])\})/i;
/** HTML character references in the same ranges (&#x2715; &#9654; &#127897;). */
function entityHits(src: string): string[] {
  return [...src.matchAll(/&#(x[0-9a-f]+|\d+);/gi)]
    .map((m) => m[1]!)
    .filter((v) => {
      const c = v[0] === 'x' || v[0] === 'X' ? parseInt(v.slice(1), 16) : parseInt(v, 10);
      return (c >= 0x2190 && c <= 0x2bff) || c === 0xfe0e || c === 0xfe0f || (c >= 0x1f000 && c <= 0x1faff);
    });
}

describe('prototype icons mirror the app (fb-1017b H2)', () => {
  const table = jsonBlock('icon-paths') as Record<string, unknown>;

  it('#icon-paths is exactly ICON_PATHS, in ICON_NAMES order', () => {
    expect(Object.keys(table)).toEqual([...ICON_NAMES]);
    expect(table).toStrictEqual(JSON.parse(JSON.stringify(ICON_PATHS)));
  });

  it('draws icons on the app grid: 24 viewBox, stroke 1.9, round caps/joins, filled parts solid, currentColor', () => {
    expect(ICON_VIEWBOX).toBe(24);
    expect(ICON_STROKE).toBe(1.9);
    expect(proto).toContain(`viewBox="0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}"`);
    expect(proto).toMatch(new RegExp(`svg\\.ic\\{[^}]*stroke:currentColor;fill:none;stroke-width:${ICON_STROKE};stroke-linecap:round;stroke-linejoin:round`));
    expect(proto).toMatch(/svg\.ic \.f\{fill:currentColor;stroke:none\}/);
    expect(proto).toContain("JSON.parse(document.getElementById('icon-paths').textContent)");
  });

  it('no other hand-drawn icon table or stroke weight is left', () => {
    const code = withoutComments(proto);
    expect(code).not.toMatch(/stroke-width:2(\.2)?[;}]/);
    for (const old of ['kb', 'gear', 'grid', 'input', 'rew', 'ff', 'play', 'ir', 'film', 'note', 'star', 'news']) {
      expect({ old, found: new RegExp(`ICON\\.${old}\\b`).test(code) }).toEqual({ old, found: false });
    }
    expect(code).not.toContain("'123'");
  });

  it('every remote control, sheet close and the TV switcher use an app icon', () => {
    for (const n of [
      'power', 'source', 'settings', 'home', 'back', 'menu', 'mute', 'volUp', 'volDown', 'chUp', 'chDown',
      'playPause', 'rewind', 'fastForward', 'mic', 'keyboard', 'numpad', 'apps', 'up', 'down', 'left', 'right', 'close',
    ]) {
      expect({ n, used: proto.includes(`ICON.${n}`) }).toEqual({ n, used: true });
    }
    expect(proto).toContain("icon('down','chev')");
  });

  it('keys have the physical face from keyFaceColors (gradient, top highlight, inner shade)', () => {
    expect(proto).toMatch(/\.key,\.rocker,\.x\{background:linear-gradient\(180deg,var\(--kf-gloss\) 0,transparent 18%\),linear-gradient\(180deg,transparent 78%,var\(--kf-shade\) 100%\),linear-gradient\(180deg,var\(--kf-top\),var\(--kf-bot\)\)\}/);
    expect(proto).toContain("mixHex(t.key,'#FFFFFF',.07)");
    expect(proto).toContain('mixHex(t.key,t.keyEdge,.05)');
    expect(proto).toContain('dark?.14:.6');
    expect(proto).toContain('dark?35:18');
  });
});

describe('prototype has no emoji or symbol icon characters', () => {
  it('no literal, escaped or entity glyphs in U+2190-2BFF, FE0E/FE0F or U+1F000-1FAFF outside comments', () => {
    const lines = withoutComments(proto).split('\n');
    const hits = lines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => SYMBOL.test(l) || SYMBOL_ESCAPE.test(l) || entityHits(l).length > 0)
      .map(({ l, i }) => `${i + 1}: ${l.trim().slice(0, 120)}`);
    expect(hits).toEqual([]);
  });

  it('the scanner itself catches each form', () => {
    expect(SYMBOL.test('✕')).toBe(true);
    expect(SYMBOL.test('\u{1F399}')).toBe(true);
    expect(SYMBOL_ESCAPE.test("'\\u23FB'")).toBe(true);
    expect(entityHits('&#x2715; &#9654;')).toHaveLength(2);
    expect(entityHits('&amp; &#183;')).toEqual([]);
  });
});

describe('prototype names no TV maker, platform or streaming service', () => {
  it('no brand word anywhere in the file (comments included)', () => {
    // the system font keyword "-apple-system" in the CSS font stack is not a brand mention
    const m = BRAND_RE.exec(proto.replace(/-apple-system/g, ''));
    expect(m ? m[0] : null).toBeNull();
  });
});

describe('prototype app tiles mirror the app (fb-1017b H3)', () => {
  type ProtoApp = {
    id: string;
    name: string;
    pinned: boolean;
    art?: unknown;
    house?: { h1: string; h2: string; text: string; scale: number };
  };
  const apps = jsonBlock('demo-apps') as ProtoApp[];

  it('demo apps are the app demo set, in order, with English names and identical art', () => {
    const demo = apps.filter((a) => a.art);
    expect(demo.map((a) => a.id)).toEqual(SCREENSHOT_DEMO_APPS.map((a) => a.id));
    expect(demo.map((a) => a.name)).toEqual(['Cinema', 'Sports', 'Music', 'News', 'Kids', 'Photos']);
    for (const a of demo) {
      const app = SCREENSHOT_DEMO_APPS.find((d) => d.id === a.id)!;
      expect(a.name).toBe(uiEn[`ui.apps.demo.${a.id.split('.')[1]}` as keyof typeof uiEn]);
      expect(a.pinned).toBe(app.pinned === true);
      expect(a.art).toStrictEqual(JSON.parse(JSON.stringify(DEMO_APP_ART[a.id])));
    }
  });

  it('house tiles use the core palette, label and size helpers', () => {
    const house = apps.filter((a) => !a.art);
    expect(house.length).toBeGreaterThan(0);
    for (const a of house) {
      const l = tileLabel(a.name);
      expect(a.house).toEqual({ ...fallbackTile(a.id), text: l.text, scale: tileLabelScale(l.longest) });
    }
  });

  it('tiles are 4:3 artwork over the name, with no icon glyph', () => {
    expect(proto).toMatch(/\.app \.art\{[^}]*aspect-ratio:4\/3/);
    expect(proto).toContain('preserveAspectRatio="xMidYMid slice"');
    expect(proto).toContain('<span class="cap"><span class="nm">');
    expect(proto).not.toMatch(/\.app i\{/);
  });
});

describe('prototype OK key follows dpadGeometry (fb-1017b H1)', () => {
  it('width, label and border are the geometry ratios of the 260 pad', () => {
    const g = dpadGeometry(260);
    const ratio = (n: number) => String(Math.round((n / g.diameter) * 1000) / 1000).replace(/^0/, '');
    expect(DPAD_KEY_RATIO).toBe(0.52);
    // 52% of the ring; the app rounds the key to an even 134 pt in the 260 pt pad
    expect(Math.abs(DPAD_KEY_RATIO * g.diameter - g.key.size)).toBeLessThanOrEqual(2);
    expect(proto).toMatch(/\.pad \.okb\{[^}]*width:calc\(var\(--pad\)\*\.52\);height:calc\(var\(--pad\)\*\.52\)/);
    expect(proto).toMatch(new RegExp(`\\.pad \\.okb\\{[^}]*font-size:calc\\(var\\(--pad\\)\\*${ratio(g.label.fontSize).replace('.', '\\.')}\\)`));
    expect(proto).toMatch(new RegExp(`\\.pad \\.okb\\{[^}]*inset 0 0 0 calc\\(var\\(--pad\\)\\*${ratio(g.key.border).replace('.', '\\.')}\\)`));
  });

  it('arrow areas take the band between key and ring, from the same variable', () => {
    expect(proto).toContain('.pad .u,.pad .d{left:calc(var(--pad)*.24);width:calc(var(--pad)*.52);height:calc(var(--pad)*.24)}');
    expect(proto).toContain('.pad .l,.pad .r{top:calc(var(--pad)*.24);height:calc(var(--pad)*.52);width:calc(var(--pad)*.24)}');
  });

  it('raised bevel: light top band to 36%, keyEdge shade from 64%, soft keyEdge drop shadow', () => {
    const g = dpadGeometry(260);
    expect(g.bevel).toEqual({ highlightEnd: 0.36, shadeStart: 0.64 });
    expect(proto).toMatch(/\.pad \.okb\{[^}]*rgba\(255,255,255,\.3\) 0,rgba\(255,255,255,0\) 36%,transparent 64%,color-mix\(in srgb,var\(--key-edge\) 35%,transparent\) 100%/);
    expect(proto).toMatch(/\.pad \.okb\{[^}]*0 3px 6px color-mix\(in srgb,var\(--key-edge\) 45%,transparent\)/);
  });
});

describe('prototype script', () => {
  it('the inline app script parses (a stray quote would blank every store screenshot)', () => {
    const scripts = [...proto.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
    expect(scripts.length).toBeGreaterThan(0);
    for (const src of scripts) expect(() => new Function(src)).not.toThrow();
  });
});
