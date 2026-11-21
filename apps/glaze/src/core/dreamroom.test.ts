// Dreamroom (apps/glaze/DESIGN.md): the stage row, the stage's full-size starter art, the display
// face and the theme page's exhibit band.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { displayFamilyV2, displayV2 } from './designV2.ts';
import { starterWallpaper, type StarterPackData } from './starterPacks.ts';
import { browseHomeRows } from './themeBrowse.ts';

const root = join(import.meta.dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

function starter(assets: { path: string; role: string; width: number }[], files: Record<string, number>): StarterPackData {
  return {
    entry: { id: 'demo', packVersion: 3 },
    manifest: { assets },
    files,
  } as unknown as StarterPackData;
}

test('starterWallpaper picks the widest bundled wallpaper, and nothing for another version or pack', () => {
  const s = starter(
    [
      { path: 'wallpaper-1334.webp', role: 'wallpaper', width: 750 },
      { path: 'wallpaper-2796.webp', role: 'wallpaper', width: 1290 },
      { path: 'wallpaper-2556.webp', role: 'wallpaper', width: 1179 },
      { path: 'thumb.webp', role: 'thumb', width: 240 },
    ],
    { 'wallpaper-1334.webp': 11, 'wallpaper-2796.webp': 12, 'thumb.webp': 14 },
  );
  // 2556 is listed but not bundled: the widest BUNDLED one wins.
  assert.equal(starterWallpaper([s], 'demo', 3), 12);
  assert.equal(starterWallpaper([s], 'demo', 2), null);
  assert.equal(starterWallpaper([s], 'other', 3), null);
  assert.equal(starterWallpaper([starter([{ path: 'thumb.webp', role: 'thumb', width: 240 }], { 'thumb.webp': 1 })], 'demo', 3), null);
});

test('the stage opens the overview only when it has themes', () => {
  const themes = [
    { id: 'a', name: 'A', category: 'Nature' },
    { id: 'b', name: 'B', category: 'Nature' },
  ];
  const withStage = browseHomeRows({ themes, columns: 3, stage: [themes[0]] });
  assert.equal(withStage[0].kind, 'stage');
  assert.equal(withStage.filter((r) => r.kind === 'stage').length, 1);
  const without = browseHomeRows({ themes, columns: 3 });
  assert.ok(without.every((r) => r.kind !== 'stage'));
  assert.ok(browseHomeRows({ themes, columns: 3, stage: [] }).every((r) => r.kind !== 'stage'));
});

test('display type: Unbounded faces the app loads, sizes stepping down from masthead to section', () => {
  const layout = read('app', '_layout.tsx');
  for (const f of Object.values(displayFamilyV2)) assert.ok(layout.includes(f), `${f} is loaded at startup`);
  const sizes = [displayV2.masthead, displayV2.title, displayV2.stage, displayV2.section].map((r) => r.fontSize);
  assert.deepEqual([...sizes].sort((a, b) => b - a), sizes);
  for (const [k, r] of Object.entries(displayV2)) {
    assert.ok(r.lineHeight >= r.fontSize * 1.15, `${k} line height`);
    assert.ok(r.letterSpacing < 0, `${k} is tracked tight`);
  }
  const helper = read('src', 'ui', 'displayType.ts');
  assert.match(helper, /if \(!brandFontSupports\(script\)\) return NONE;/, 'other scripts keep the system face');
  assert.match(helper, /fontWeight: 'normal'/, 'no numeric weight on the custom face');
});

test('the stage follows the finger, respects Reduce Motion and uses full-size starter art', () => {
  const stage = read('src', 'ui', 'ThemeStage.tsx');
  assert.match(stage, /const reduced = useMotionReduced\(\);/);
  assert.match(stage, /if \(reduced\) return \{ opacity: 1, transform: \[\{ scale: 1 \}\] \};/);
  assert.match(stage, /snapToInterval=\{step\}/);
  const tab = read('app', '(tabs)', 'themes.tsx');
  assert.match(tab, /starterWallpaper\(STARTER_DATA, theme\.remoteArt\.packId, theme\.remoteArt\.packVersion\)/);
  assert.match(tab, /if \(item\.kind === 'stage'\) return <ThemeStage\b/);
});

test('the theme page exhibit band keeps WCAG AA or falls back to the app wall', () => {
  const d = read('app', 'theme', '[id].tsx');
  assert.match(d, /if \(contrastRatio\(ink, bg\) < 4\.5\) return null;/);
  assert.match(d, /if \(contrastRatio\(c\.ink, deep\) < 4\.5 \|\| contrastRatio\(c\.inkSecondary, deep\) < 4\.5\) return null;/);
  assert.match(d, /styles\.headWrap, room \? \{ backgroundColor: room\.bg \} : null/);
  assert.match(d, /fill=\{room\?\.bg\}/);
});
