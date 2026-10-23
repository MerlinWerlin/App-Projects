/**
 * T69 (market-1018 M5): store shots follow the docs/MARKET.md "Store screenshot playbook". Chromium cannot run
 * under offline bun, so these are source checks on store/render.mjs and the prototype; the script itself enforces
 * the headline size and line count on every render (assertHeadline).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { uiEn } from '../src/i18n/catalog/en/ui';
import { CATALOGUES } from '../src/i18n/catalog';

const root = join(__dirname, '..');
const render = readFileSync(join(root, 'store/render.mjs'), 'utf8');
const proto = readFileSync(join(root, 'prototype/index.html'), 'utf8');
const readme = readFileSync(join(root, 'store/README.md'), 'utf8');

const shotsSrc = render.slice(render.indexOf('export const SHOTS = ['), render.indexOf('];', render.indexOf('export const SHOTS = [')));
const shots = [...shotsSrc.matchAll(/\{ n: '(\d\d)', name: '([\w-]+)', key: '([\w.]+)'([^\n]*)\}/g)].map((m) => ({
  n: m[1], name: m[2], key: m[3] as keyof typeof uiEn, rest: m[4],
  view: /view: '(\w+)'/.exec(m[4])?.[1], seal: /seal: '([\w.]+)'/.exec(m[4])?.[1] as keyof typeof uiEn | undefined,
}));

describe('store shots (T69, playbook order)', () => {
  it('outcome, price promise, then one feature per shot', () => {
    expect(shots.map((s) => `${s.n}-${s.name}`)).toEqual([
      '01-every-tv', '02-free', '03-find-tv', '04-search', '05-apps', '06-themes', '07-multi-tv',
    ]);
    expect(shots.map((s) => s.view ?? null)).toEqual([null, null, 'add', 'keyboard', 'apps', null, 'switch']);
    expect(shots[5]!.rest).toContain('fan: [');
  });

  it('every headline (and the seal word) comes from the English catalogue and every other catalogue', () => {
    const keys = [...shots.map((s) => s.key), ...shots.flatMap((s) => (s.seal ? [s.seal] : []))];
    expect(keys.every((k) => k.startsWith('ui.store.headline.'))).toBe(true);
    for (const k of keys) {
      expect({ k, en: typeof uiEn[k] }).toEqual({ k, en: 'string' });
      for (const [code, cat] of Object.entries(CATALOGUES)) expect({ k, code, ok: typeof (cat as Record<string, unknown>)[k] }).toEqual({ k, code, ok: 'string' });
    }
  });

  it('shot 01 is a 4-6 word outcome; shot 02 is exactly the price promise with a Free seal', () => {
    expect(shots[0]!.key).toBe('ui.store.headline.everyTv');
    const words = uiEn['ui.store.headline.everyTv'].split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(4);
    expect(words).toBeLessThanOrEqual(6);
    expect(shots[1]!.key).toBe('ui.store.headline.priceFree');
    expect(uiEn['ui.store.headline.priceFree']).toBe('Every button free. No ads. No subscription.');
    expect(shots[1]!.seal).toBe('ui.store.headline.sealFree');
    expect(uiEn['ui.store.headline.sealFree']).toBe('Free');
  });

  it('headline rules: at least 7% of the shot height, at most 2 lines, asserted on every render', () => {
    expect(render).toContain('export const HEADLINE_MIN_FRACTION = 0.07;');
    expect(render).toContain('export const HEADLINE_MAX_LINES = 2;');
    expect(render).toMatch(/const head = await fitHeadline\(page\);\s+assertHeadline\(head, size, shot\);/);
    expect(render).toContain('m.lines > HEADLINE_MAX_LINES');
    expect(render).toContain('m.box < HEADLINE_MIN_FRACTION * m.H');
  });

  it('one accent per shot from that shot\'s theme; no rating, review or small-print markup', () => {
    expect(shots.every((s) => /accent: '(accent|glow)'/.test(s.rest))).toBe(true);
    expect(render).not.toMatch(/★|\bstars?\b|\bratings?\b|\breviews?\b|eyebrow/i);
  });

  it('the prototype has the screenshot states the shots use', () => {
    expect(proto).toContain("if(view==='apps')S.tab='apps'");
    expect(proto).toContain("if(view==='keyboard'){keyboardSheet()");
    expect(proto).toContain("if(view==='switch')switchSheet()");
    expect(proto).toContain("view=add|numpad|voice|tvs|apps|keyboard|switch");
  });

  it('publishes every 1320x2868 shot as JPEG q85 with a contact sheet', () => {
    expect(render).toContain("const PUBLISH = { dir: '1320x2868', quality: 85, maxBytes: 2 * 1048576 }");
    expect(render).toContain("writeFileSync(join(publishDir, 'index.html'), sheet)");
    for (const s of shots) expect(readme).toContain(`| ${s.n} | \`${s.key}\``);
  });

  it('T83: the apps shot has no small print or duplicate tile names, and retired headline keys are gone', () => {
    expect(proto).toContain('html[data-shot] .appsnote,html[data-shot] .app .cap{display:none!important}');
    expect(proto.match(/class="note appsnote"/g)?.length).toBe(2);
    for (const k of ['noAds', 'voice', 'numpad']) {
      expect(render).not.toContain(`ui.store.headline.${k}'`);
      for (const cat of [uiEn, ...Object.values(CATALOGUES)]) expect(k in (cat as Record<string, unknown>) || `ui.store.headline.${k}` in (cat as Record<string, unknown>)).toBe(false);
    }
  });
});
