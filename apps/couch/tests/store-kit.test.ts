/**
 * owner-1017 T4 (backlog T59): store screenshot kit. Chromium cannot run under offline bun, so these
 * are source checks on store/render.mjs (the script itself was run to produce store/screenshots/).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { uiEn } from '../src/i18n/catalog/en/ui';

const root = join(__dirname, '..');
const render = readFileSync(join(root, 'store/render.mjs'), 'utf8');
const guard = readFileSync(join(root, 'store/brand-guard.mjs'), 'utf8');
const readme = readFileSync(join(root, 'store/README.md'), 'utf8');
const gitignore = readFileSync(join(root, '.gitignore'), 'utf8');

const BRANDS = /\b(Roku|Samsung|LG|Sony|Netflix|YouTube|Disney|Prime|Hulu|Apple TV|Google TV|Fire TV|Vizio|Philips)\b/i;

describe('store screenshot kit (T59)', () => {
  it('renders the three store sizes', () => {
    for (const [w, h] of [[1320, 2868], [1242, 2688], [1080, 1920]]) {
      expect(render).toContain(`dir: '${w}x${h}', w: ${w}, h: ${h}`);
    }
  });

  it('uses only headline keys that exist in the English catalogue', () => {
    const keys = [...render.matchAll(/key: '(ui\.store\.headline\.\w+)'/g)].map((m) => m[1] as keyof typeof uiEn);
    // the order itself is pinned in tests/store-shots.test.ts (T69)
    expect(keys.length).toBeGreaterThanOrEqual(7);
    for (const k of keys) expect(typeof uiEn[k]).toBe('string');
    expect(uiEn['ui.store.headline.themes']).toContain('{count}');
    // the count follows the real theme list (12 since Walnut & Brass and Charcoal & Gold), never a hard-coded number
    expect(render).toContain('vars: { count: Object.keys(REMOTE_THEMES).length }');
  });

  it('one theme per shot, from the shared theme ids', () => {
    const themes = [...render.matchAll(/name: '[\w-]+', key: '[\w.]+',(?: vars: \{[^}]*\},)? theme: '(\w+)'/g)].map((m) => m[1]);
    expect(themes).toEqual(['charcoal', 'daylight', 'retro', 'aurora', 'cinema', 'neon', 'forest']);
  });

  it('names no TV maker, platform or streaming service in its output strings or contact sheet', () => {
    expect(render).not.toMatch(BRANDS);
    expect(readme).not.toMatch(BRANDS);
    // every screen and composed page is checked at render time
    expect(render).toContain("import { assertNoBrands } from './brand-guard.mjs'");
    expect(render.match(/assertNoBrands\(/g)?.length).toBeGreaterThanOrEqual(2);
    for (const w of ['Roku', 'Samsung', 'Netflix', 'YouTube', 'Disney', 'Fire TV', 'Philips']) expect(guard).toContain(`'${w}'`);
  });

  it('renders the prototype in shot mode at a phone viewport @3x', () => {
    expect(render).toContain('?shot=1&theme=');
    expect(render).toMatch(/PHONE = \{ w: 430, h: 932, scale: 3 \}/);
  });

  it('never installs a browser or packages and does not wait on the network', () => {
    expect(render).not.toMatch(/playwright install|npx playwright|npm (i|install)\b/);
    expect(render).not.toContain('networkidle');
  });

  it('--locale picks the catalogue; RTL only flips the headline', () => {
    expect(render).toContain("arg('locale', 'en')");
    expect(render).toContain('src/i18n/catalog/${code}.ts');
    expect(render).toContain(`<h1\${rtl ? ' dir="rtl"' : ''}>`);
  });

  it('writes NN-name.png per size, JPEG previews and a contact sheet with relative links', () => {
    expect(render).toContain('`${shot.n}-${shot.name}.png`');
    expect(render).toContain("join(outRoot, 'previews'");
    expect(render).toContain('.jpeg(');
    expect(render).toContain('const png = `${size.dir}/${m.shot.n}-${m.shot.name}.png`');
    expect(render).toContain("join(outRoot, 'index.html')");
  });

  it('generated output stays out of git', () => {
    expect(gitignore).toMatch(/^store\/screenshots\/$/m);
    expect(readme).toContain('node store/render.mjs');
  });
});
