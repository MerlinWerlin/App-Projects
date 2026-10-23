import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  IDEAL_UPLOAD_SIZE,
  MIN_UPLOAD_SIZE,
  SAFE_AREA_PERCENT,
  buildIconPrompt,
  humanize,
  themeColours,
  themeMotifs,
} from './iconPrompt.ts';
import { PHOTO_ICON_SIZE, PROFILE_ICON_SIZE } from './install.ts';
import { THEMES, getTheme } from './themes.ts';
import { PLUS_THEMES } from './plusThemes.ts';

const strawberry = getTheme('strawberry-dessert')!;

test('sizes come from the install constants, not invented numbers', () => {
  assert.equal(MIN_UPLOAD_SIZE, PHOTO_ICON_SIZE);
  assert.equal(PHOTO_ICON_SIZE, 360);
  assert.equal(PROFILE_ICON_SIZE, 180);
  assert.equal(SAFE_AREA_PERCENT, 70); // square inside the circle mask: 1/√2
  const p = buildIconPrompt({ appName: 'Roblox', theme: strawberry });
  assert.ok(p.includes(`at least ${PHOTO_ICON_SIZE} × ${PHOTO_ICON_SIZE} px`), p);
  assert.ok(p.includes(`${PROFILE_ICON_SIZE} × ${PROFILE_ICON_SIZE} px`));
  assert.ok(p.includes(`${IDEAL_UPLOAD_SIZE} × ${IDEAL_UPLOAD_SIZE} px is ideal`));
  assert.ok(p.includes(`central ${SAFE_AREA_PERCENT}%`));
  // Every pixel size in the text is one of the known numbers.
  const sizes = [...p.matchAll(/(\d+) × (\d+) px/g)].map((m) => Number(m[1]));
  for (const n of sizes) assert.ok([PROFILE_ICON_SIZE, PHOTO_ICON_SIZE, IDEAL_UPLOAD_SIZE].includes(n), String(n));
});

test('the source imports the constants rather than hard-coding 180 / 360', () => {
  const src = readFileSync(join(process.cwd(), 'src', 'core', 'iconPrompt.ts'), 'utf8');
  assert.match(src, /import \{[^}]*PHOTO_ICON_SIZE[^}]*PROFILE_ICON_SIZE[^}]*\} from '\.\/install\.ts'/);
  const code = src.replace(/\/\/.*$/gm, '');
  assert.ok(!/\b(180|360)\b/.test(code), 'hard-coded icon size in iconPrompt.ts');
});

test('prompt names the app and theme, the attachments, and the honest rules', () => {
  const p = buildIconPrompt({ appName: '  Clash  Royale ', theme: strawberry });
  assert.ok(p.includes('"Clash Royale"'));
  assert.ok(p.includes('"Strawberry Dessert"'));
  assert.match(p, /screenshot of the original Clash Royale icon/);
  assert.match(p, /sample of the "Strawberry Dessert" theme/);
  assert.match(p, /clearly represents Clash Royale/);
  assert.match(p, /Do not copy the original logo exactly/);
  assert.match(p, /app icon/);
  assert.match(p, /Not a wallpaper/);
  assert.match(p, /Square canvas/);
  assert.match(p, /PNG or JPEG/);
  assert.match(p, /No text or letters, unless/);
  assert.equal(buildIconPrompt({ appName: '', theme: strawberry }).includes('"the app"'), true);
});

test('theme hex values and motifs appear in the prompt', () => {
  for (const theme of [...THEMES, ...PLUS_THEMES]) {
    const p = buildIconPrompt({ appName: 'Notes', theme });
    const colours = themeColours(theme);
    assert.ok(colours.length >= 3, theme.id);
    for (const hex of [theme.palette.bg, theme.palette.accent, theme.palette.ink]) {
      assert.ok(p.includes(hex.toUpperCase()), `${theme.id}: ${hex}`);
    }
    for (const m of themeMotifs(theme)) assert.ok(p.includes(m), `${theme.id}: ${m}`);
    assert.ok(p.includes(theme.name), theme.id);
  }
  const motifs = themeMotifs(strawberry);
  assert.ok(motifs.length >= 2);
  for (const m of motifs) assert.equal(m, m.toLowerCase());
  assert.ok(themeColours(strawberry).some((c) => c.hex === '#E0475B'));
  assert.equal(new Set(themeColours(strawberry).map((c) => c.hex)).size, themeColours(strawberry).length);
});

test('humanize', () => {
  assert.equal(humanize('leaf-sprig'), 'leaf sprig');
  assert.equal(humanize('Ice_Cream'), 'ice cream');
});

test('no network or AI service references in the prompt module', () => {
  const src = readFileSync(join(process.cwd(), 'src', 'core', 'iconPrompt.ts'), 'utf8');
  assert.ok(!/fetch\(|https?:\/\/|XMLHttpRequest/.test(src));
});
