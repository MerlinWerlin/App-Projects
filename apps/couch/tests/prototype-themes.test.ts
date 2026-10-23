/**
 * owner-1017 T3 (backlog T58): prototype/index.html mirrors the 10 remote themes. The prototype embeds
 * a JSON copy of the colour tokens (#remote-themes); it must stay identical to src/theme/remoteThemes.ts.
 * The d-pad OK geometry from fb-1017-ok (tests/dpad-ok.test.ts) must survive the theming.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REMOTE_THEME_IDS, REMOTE_THEMES } from '../src/theme/remoteThemes';

const root = join(__dirname, '..');
const proto = readFileSync(join(root, 'prototype/index.html'), 'utf8');

const FIELDS = [
  'bg', 'stage', 'body', 'key', 'keyEdge', 'ink', 'muted', 'accent', 'accentSoft', 'accentInk',
  'power', 'ring', 'ringLit', 'glow', 'radius', 'texture',
] as const;

function embedded(): Record<string, Record<string, unknown>> {
  const m = /<script type="application\/json" id="remote-themes">([\s\S]*?)<\/script>/.exec(proto);
  if (!m || !m[1]) throw new Error('no #remote-themes JSON in prototype/index.html');
  return JSON.parse(m[1]);
}

describe('prototype remote themes (T58)', () => {
  const json = embedded();

  it('embeds every theme, in app order', () => {
    expect(Object.keys(json)).toEqual([...REMOTE_THEME_IDS]);
  });

  it.each([...REMOTE_THEME_IDS])('%s tokens match src/theme/remoteThemes.ts exactly', (id) => {
    const t = REMOTE_THEMES[id];
    const want: Record<string, unknown> = {};
    for (const f of FIELDS) want[f] = JSON.parse(JSON.stringify(t[f]));
    expect(json[id]).toStrictEqual(want);
  });

  it('has a theme switcher, ?theme= and ?shot= support', () => {
    expect(proto).toContain('id="themesel"');
    expect(proto).toContain("Q.get('theme')");
    expect(proto).toContain("Q.get('shot')==='1'");
    expect(proto).toContain('data-rt=');
  });

  it('generates a texture for every texture kind and the cinema glow uses theme.glow', () => {
    const kinds = new Set(REMOTE_THEME_IDS.map((id) => REMOTE_THEMES[id].texture.kind).filter((k) => k !== 'none'));
    for (const k of kinds) expect(proto).toContain(`html[data-tex="${k}"] .remote::before`);
    expect(proto).toContain("'--glow':t.glow||'transparent'");
    expect(proto).toMatch(/html\[data-rtheme\] \.remote\{[^}]*var\(--glow\)/);
  });

  it('aurora drifts slowly and stops under prefers-reduced-motion', () => {
    expect(proto).toMatch(/html\[data-tex="aurora"\] \.remote::before\{[^}]*animation:aurora \d+s/);
    expect(proto).toMatch(/@media \(prefers-reduced-motion:reduce\)\{html\[data-tex="aurora"\] \.remote::before\{animation:none\}\}/);
  });

  it('textures are generated, never image files', () => {
    expect(proto).not.toMatch(/url\(["']?(?!data:)[^)]*\.(png|jpe?g|webp|gif)/i);
  });

  it('keeps the fb-1017-ok d-pad geometry (dpad-ok.test.ts expectations)', () => {
    expect(proto).toContain('--pad:');
    // fb-1017b H1: OK key is 52% of the ring (DPAD_KEY_RATIO)
    expect(proto).toMatch(/\.pad \.okb\{[^}]*width:calc\(var\(--pad\)\*\.52\)/);
    expect(proto).toMatch(/\.pad \.okb\{[^}]*height:calc\(var\(--pad\)\*\.52\)/);
    expect(proto).toMatch(/\.pad \.okb\{[^}]*line-height:1/);
    expect(proto).toMatch(/\.pad \.okb\{[^}]*translate\(-50%,-50%\)/);
    expect(proto).toContain('.pad{--pad:min(260px,72vw);position:relative;width:var(--pad);height:var(--pad);margin:0 auto;border-radius:50%;');
    // themed colours only: the OK key reads accent / accent-ink variables
    expect(proto).toMatch(/\.pad \.okb\{[^}]*background:var\(--accent\);color:var\(--accent-ink,#fff\)/);
  });
});
