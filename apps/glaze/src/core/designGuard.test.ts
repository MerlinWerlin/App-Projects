// Design-system guard (T163, owner-1030 B): one token set (src/theme/tokensV2.ts) and a RATCHET on
// raw design values in screens and UI components. It scans app/**/*.tsx and src/ui/**/*.tsx for
//   colour   raw hex (#RGB, #RGBA, #RRGGBB, #RRGGBBAA) and rgb()/rgba() literals
//   fontSize numeric fontSize literals (use typeV2 / textV2 steps)
//   radius   numeric border*Radius literals (use chromeRadiusV2 card / control / pill, or the shape
//            helpers iconTileRadius(size) / circleRadius(size))
// BASELINE holds today's counts per file. The test fails when a file's count goes UP or a file not
// in BASELINE adds any. When you remove literals, lower the file's numbers here (never raise them).
// Theme ART (palettes, mocks that draw a theme's own colours, generated artwork) is data, not
// chrome: those files are listed in ART_ALLOWLIST with a reason and are not counted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { chromeRadiusV2, circleRadius, radiusV2, spaceV2, typeV2 } from './designV2.ts';

const root = process.cwd();

type Counts = { colour?: number; fontSize?: number; radius?: number };
type Kind = keyof Counts;
const KINDS: Kind[] = ['colour', 'fontSize', 'radius'];

/** Files that draw artwork or a theme's own colours (data, not chrome), with the reason. */
const ART_ALLOWLIST: Record<string, string> = {
  'src/ui/CatalogueWidgetPreview.tsx': 'draws a catalogue widget in the theme\'s own colours and shapes',
  'src/ui/HomeMock.tsx': 'phone mock: status bar and dock drawn over the theme wallpaper',
  'src/ui/IntroGlaze.tsx': 'generated intro artwork (gloss gradients, sparkle)',
  'src/ui/IslandPetArt.tsx': 'pixel-art pet palette',
  'src/ui/LockMock.tsx': 'phone mock: lock-screen clock and controls over the wallpaper',
  'src/ui/PhoneFrame.tsx': 'device frame artwork (black glass, rim, island, glare)',
  'src/ui/SeamlessWidgetPreview.tsx': 'phone mock for seamless widgets (device black, dock glass)',
  'src/ui/Swatches.tsx': 'picks readable ink against a theme swatch colour (data-driven)',
  'src/ui/WidgetOptionArt.tsx': 'miniature widget artwork in option pickers',
  'src/ui/WidgetPreview.tsx': 'draws a widget in the theme\'s own colours',
};

/** Raw-value counts recorded on 30 Oct 2026 after the T163 cleanup. Only ever lower these. */
const BASELINE: Record<string, Counts> = {
  'app/(tabs)/_layout.tsx': { fontSize: 1 },
  'app/(tabs)/live.tsx': { colour: 2 },
  'app/(tabs)/themes.tsx': { radius: 2 },
  'app/(tabs)/widgets.tsx': { radius: 1 },
  'app/collage.tsx': { radius: 2 },
  'app/live/[id].tsx': { radius: 1 },
  'app/pets.tsx': { colour: 2, radius: 2 },
  'app/theme/[id].tsx': { radius: 5 },
  'app/wallpaper.tsx': { radius: 1 },
  'src/ui/HeartButton.tsx': { colour: 1 },
  'src/ui/LiveHeroCard.tsx': { colour: 1 },
  'src/ui/LivePhotoGuide.tsx': { colour: 6, fontSize: 1 },
  'src/ui/PhotoCropEditor.tsx': { colour: 1 },
  'src/ui/ShapePicker.tsx': { radius: 1 },
  'src/ui/SheenButton.tsx': { colour: 1 },
  'src/ui/Sheet.tsx': { radius: 1 },
  'src/ui/WallpaperTile.tsx': { colour: 3 },
};

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Drops block and line comments (a `//` after `:` or a quote, as in a URL, is kept). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\w])\/\/.*$/gm, '$1');
}

const PATTERNS: Record<Kind, RegExp[]> = {
  colour: [/(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?!\w)/g, /\brgba?\(/g],
  fontSize: [/\bfontSize\s*[:=]\s*[{'"]?\s*\d/g],
  radius: [/\bborder(?:Top|Bottom)?(?:Left|Right|Start|End)?Radius\s*[:=]\s*\{?\s*\d/g],
};

export function countRaw(src: string): Required<Counts> {
  const s = stripComments(src);
  const n = (k: Kind) => PATTERNS[k].reduce((sum, re) => sum + (s.match(re) ?? []).length, 0);
  return { colour: n('colour'), fontSize: n('fontSize'), radius: n('radius') };
}

function scanned(): string[] {
  return [...walk(join(root, 'app')), ...walk(join(root, 'src', 'ui'))].map((f) => relative(root, f).replace(/\\/g, '/'));
}

test('the counter sees hex, rgba, fontSize and radius literals but not tokens or comments', () => {
  const c = countRaw(
    [
      "const a = { color: '#FFF', backgroundColor: '#12345678', borderColor: 'rgba(0,0,0,0.4)' };",
      "const b = { fontSize: 13, borderRadius: 12, borderTopLeftRadius: 4 };",
      'const ok = { color: c.ink, fontSize: typeV2.footnote.fontSize, borderRadius: radiusV2.card };',
      '// #FF0000 fontSize: 99 in a comment',
      "const url = 'https://example.com/#top';",
      '<Svg fill="#000000" />',
    ].join('\n'),
  );
  assert.deepEqual(c, { colour: 4, fontSize: 1, radius: 2 });
});

test('art allowlist entries exist and give a reason', () => {
  for (const [file, reason] of Object.entries(ART_ALLOWLIST)) {
    assert.ok(existsSync(join(root, file)), `${file} is allowlisted but missing; remove it from ART_ALLOWLIST`);
    assert.ok(reason.trim().length > 10, `${file} needs a reason`);
  }
});

test('raw colours / font sizes / radii in app and src/ui never go up (ratchet)', () => {
  const files = scanned();
  assert.ok(files.length > 20, 'expected app and src/ui screens');
  const problems: string[] = [];
  for (const file of files) {
    if (ART_ALLOWLIST[file]) continue;
    const now = countRaw(readFileSync(join(root, file), 'utf8'));
    const base = BASELINE[file] ?? {};
    for (const k of KINDS) {
      const allowed = base[k] ?? 0;
      if (now[k] > allowed) problems.push(`${file}: ${now[k]} raw ${k} (ratchet ${allowed})`);
    }
  }
  assert.deepEqual(
    problems,
    [],
    'Use src/theme/tokensV2 (palette via useColorsV2, typeV2/textV2, chromeRadiusV2, circleRadius, onArtV2) instead of raw values; theme artwork goes in ART_ALLOWLIST with a reason.',
  );
});

test('tokensV2 has one type scale, a 4-pt spacing grid and exactly three chrome radii', () => {
  assert.deepEqual(Object.keys(chromeRadiusV2).sort(), ['card', 'control', 'pill']);
  assert.equal(chromeRadiusV2.card, radiusV2.card);
  assert.equal(chromeRadiusV2.control, radiusV2.control);
  assert.equal(chromeRadiusV2.pill, radiusV2.pill);
  for (const [k, v] of Object.entries(spaceV2)) {
    if (k === 'xxs') continue; // the one half step (2 pt) for hairline gaps
    assert.equal(v % 4, 0, `spaceV2.${k} = ${v} is off the 4-pt grid`);
  }
  const sizes = Object.values(typeV2).map((s) => s.fontSize);
  assert.ok(sizes.every((n) => Number.isInteger(n) && n >= 11 && n <= 34), 'type scale sizes');
  assert.equal(circleRadius(24), 12);
  assert.equal(circleRadius(-1), 0);
});

test('only tokensV2 is a theme token module', () => {
  const themeDir = join(root, 'src', 'theme');
  assert.ok(existsSync(join(themeDir, 'tokensV2.ts')));
  assert.ok(!existsSync(join(themeDir, 'tokens.ts')), 'src/theme/tokens.ts is retired (T163)');
});
