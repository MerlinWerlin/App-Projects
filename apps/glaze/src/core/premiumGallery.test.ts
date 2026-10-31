// T177 (owner brief 31 Oct, docs/OWNER_1031.md): the Themes tab gallery is the New collection (the
// remote catalogue, data-driven) then exactly three bundled starters. Logic tests on
// src/core/gallery.ts with the real glaze-packs-v1 catalogue fixture, plus source guards on the
// screen (the cloud can't mount React Native).
//
// Guards retired or rewritten with this change (the owner removed these from the gallery):
//  - categoryPaging "the gallery uses the paging logic" (bubbles / showcase paging on the tab) -> the
//    bubble row and grid keep their own paging guards;
//  - categorySwitch "store-driven selection, deferred grid swap ..." -> only the memoised panels;
//  - calmMotion fb-1022c NO_POPS / deferred category swap -> no pop, stagger or transition at all;
//  - discovery "picks note / discoveryThemes on Themes" -> All / Liked via galleryRows;
//  - fb1022 G3 (bubbles first) -> controls first; G4 picks-note body; G5a Space in the gallery ->
//    Space resolves by id only;
//  - fb1023 Themes fadeKey (chips / sub-tabs / collections) -> grid fade only;
//  - freeMarks Free pill / story chips on Themes -> showcase grid only, no chips on the tab;
//  - paywallGuard per-card Plus badge -> the gallery card badge for catalogue packs marked Plus;
//  - perf1024 PackHead / PackCardRow / packRows / gridShared / showcaseEmpty / tabOptions -> the
//    gallery rows; perfBudget pack rows + bounces={false} -> gallery rows + top-only bounce
//    (t151NoBounce allows `atTop` on this one list, for pull to refresh);
//  - premiumOnboarding "title, bubbles, section" -> title, quiet controls, New collection;
//  - premiumThemesBrowse seasonal banner + showcase feature flag on the tab -> retired;
//  - premiumUi eyebrows starters / art / space / plus -> collection / starters.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ART_PACK_THEMES } from './artPackThemes.ts';
import {
  GALLERY_FILTERS,
  GALLERY_SECTIONS,
  GALLERY_SKELETON_CARDS,
  GALLERY_STARTER_IDS,
  galleryCardWidth,
  galleryColumns,
  galleryMatchCount,
  galleryRows,
  galleryStarters,
  galleryThemeIds,
  galleryWaiting,
} from './gallery.ts';
import { lookup, type CatalogueTree } from './i18n.ts';
import { getAnyTheme, PLUS_PACKS } from './plusThemes.ts';
import { decideCatalog, parseCatalogText, remoteArtThemes, type RemoteArtTheme } from './remoteCatalog.ts';
import { SPACE_THEMES } from './spacePack.ts';
import { THEMES, type Theme } from './themes.ts';
import { CATALOGUES } from '../i18n/locales/index.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const FIXTURE = read('src', 'core', 'fixtures', 'catalog-glaze-packs-v1.json');
const BASE = 'https://github.com/example/glaze/releases/download/glaze-packs-v1/';
const catalog = parseCatalogText(FIXTURE);
const REMOTE: RemoteArtTheme[] = remoteArtThemes(catalog, BASE, []);
const SCREEN = strip(read('app', '(tabs)', 'themes.tsx'));
const CARD = strip(read('src', 'ui', 'GalleryArtCard.tsx'));
const ids = (rows: ReturnType<typeof galleryRows>) => galleryThemeIds(rows);

test('the real catalogue fixture gives 10 free remote themes with thumb URLs and thumbhashes', () => {
  assert.ok(catalog);
  assert.equal(REMOTE.length, 10);
  for (const t of REMOTE) {
    assert.equal(t.plus, false, t.id);
    assert.ok(t.remoteArt.thumbUrl?.startsWith(BASE), t.id);
    assert.ok(t.remoteArt.thumbhash.length > 0, t.id);
    assert.ok(t.name.length > 0 && t.tagline.length > 0, `${t.id} has a name and a mood line`);
  }
  assert.ok(REMOTE.some((t) => t.id === 'firefly-grove'), "the owner's favourite is listed");
});

test('New collection comes first and lists every catalogue theme, in catalogue order', () => {
  assert.deepEqual([...GALLERY_SECTIONS], ['collection', 'starters']);
  const rows = galleryRows<Theme, Theme>({ remote: REMOTE, columns: 2 });
  assert.deepEqual(rows[0], { kind: 'head', key: 'head:collection', section: 'collection' });
  const listed = ids(rows);
  assert.deepEqual(listed.slice(0, REMOTE.length), REMOTE.map((t) => t.id));
  assert.deepEqual(listed.slice(REMOTE.length), [...GALLERY_STARTER_IDS]);
  assert.equal(galleryMatchCount(rows), 13);
  // Rows of `columns` cards; keys are unique and stable.
  for (const r of rows) if (r.kind === 'cards') assert.ok(r.themes.length >= 1 && r.themes.length <= 2);
  assert.equal(new Set(rows.map((r) => r.key)).size, rows.length);
  assert.ok(!galleryWaiting(rows));
});

test('data-driven: a later batch shows up with no app change, a pack with a starter id is listed once', () => {
  const extra = { ...REMOTE[0], id: 'later-batch-pack', name: 'Later Batch' } as RemoteArtTheme;
  const dup = { ...REMOTE[1], id: 'deep-sea' } as RemoteArtTheme;
  const rows = galleryRows<Theme, Theme>({ remote: [...REMOTE, extra, dup, REMOTE[2]], columns: 2 });
  const listed = ids(rows);
  assert.ok(listed.includes('later-batch-pack'));
  assert.equal(listed.filter((x) => x === 'deep-sea').length, 1, 'bundled wins');
  assert.equal(listed.filter((x) => x === REMOTE[2].id).length, 1, 'no duplicate cards');
});

test('only the three bundled starters are in the gallery, in the owner’s order', () => {
  assert.deepEqual([...GALLERY_STARTER_IDS], ['deep-sea', 'starry-night', 'sunset-dunes']);
  const starters = galleryStarters();
  assert.deepEqual(starters.map((t) => t.id), [...GALLERY_STARTER_IDS]);
  for (const id of GALLERY_STARTER_IDS) assert.ok(ART_PACK_THEMES.some((t) => t.id === id), `${id} is a bundled art pack`);
  const rows = galleryRows<Theme, Theme>({ remote: REMOTE, columns: 2 });
  const bundledInGallery = ids(rows).filter((id) => !REMOTE.some((r) => r.id === id));
  assert.deepEqual(bundledInGallery, [...GALLERY_STARTER_IDS]);
  const old = new Set([...THEMES, ...PLUS_PACKS.flatMap((p) => p.themes), ...SPACE_THEMES].map((t) => t.id));
  for (const id of ids(rows)) assert.ok(!old.has(id), `${id} is not one of the old themes`);
});

test('while the catalogue is empty (first launch, offline, 404) the New collection shows skeletons, not an error', () => {
  // A 404 / offline keeps no catalogue: decideCatalog never throws and yields nothing to list.
  const d = decideCatalog(null, { ok: false, error: 'HTTP 404' }, Date.now());
  assert.equal(d.catalog, null);
  const empty = remoteArtThemes(d.catalog, BASE, []);
  assert.equal(empty.length, 0);
  for (const columns of [1, 2, 3]) {
    const rows = galleryRows<Theme, Theme>({ remote: empty, columns });
    assert.equal(rows[0].kind, 'head');
    assert.ok(galleryWaiting(rows));
    const skeletons = rows.filter((r) => r.kind === 'skeleton');
    assert.equal(skeletons.reduce((n, r) => n + (r.kind === 'skeleton' ? r.count : 0), 0), GALLERY_SKELETON_CARDS);
    assert.ok(!rows.some((r) => r.kind === 'empty'), 'no empty / error row');
    assert.deepEqual(ids(rows), [...GALLERY_STARTER_IDS], 'starters still listed');
  }
});

test('search and Liked narrow both sections; an empty filter offers the way back, never skeletons', () => {
  const name = REMOTE[3].name;
  const found = galleryRows<Theme, Theme>({ remote: REMOTE, columns: 2, query: name });
  assert.ok(ids(found).includes(REMOTE[3].id));
  assert.ok(!galleryWaiting(found));
  const starry = galleryRows<Theme, Theme>({ remote: REMOTE, columns: 2, query: 'Starry Night' });
  assert.ok(ids(starry).includes('starry-night'));
  const none = galleryRows<Theme, Theme>({ remote: REMOTE, columns: 2, query: 'zzqqxx' });
  assert.deepEqual(none.map((r) => r.kind), ['empty']);
  assert.equal(none[0].kind === 'empty' && none[0].reason, 'noMatches');
  const offlineSearch = galleryRows<Theme, Theme>({ remote: [], columns: 2, query: 'zzqqxx' });
  assert.ok(!galleryWaiting(offlineSearch));
  assert.deepEqual([...GALLERY_FILTERS], ['all', 'liked']);
  const liked = galleryRows<Theme, Theme>({ remote: REMOTE, columns: 2, filter: 'liked', liked: ['firefly-grove', 'sunset-dunes'] });
  assert.deepEqual(ids(liked), ['firefly-grove', 'sunset-dunes']);
  const noLiked = galleryRows<Theme, Theme>({ remote: REMOTE, columns: 2, filter: 'liked', liked: [] });
  assert.equal(noLiked.length, 1);
  assert.equal(noLiked[0].kind === 'empty' && noLiked[0].reason, 'noLiked');
});

test('card sizes: two art-led columns on phones (240 px thumbs), three on wide screens, gutters respected', () => {
  assert.equal(galleryColumns(320), 1);
  assert.equal(galleryColumns(393), 2);
  assert.equal(galleryColumns(440), 2);
  assert.equal(galleryColumns(820), 3);
  assert.equal(galleryColumns(Number.NaN), 1);
  for (const w of [320, 375, 393, 430, 820]) {
    const cols = galleryColumns(w);
    const card = galleryCardWidth(w, cols, 16, 16);
    assert.ok(card * cols + 16 * (cols - 1) <= w - 32, `${w}: row fits`);
    assert.ok(card >= 150, `${w}: large card (${card} pt)`);
  }
});

test('old ids still resolve via getAnyTheme (applied themes, widgets and saved state keep working)', () => {
  const old = [...THEMES, ...PLUS_PACKS.flatMap((p) => p.themes), ...SPACE_THEMES, ...ART_PACK_THEMES];
  assert.ok(old.length >= 60);
  for (const t of old) assert.equal(getAnyTheme(t.id)?.id, t.id, t.id);
});

// ------------------------------------------------------------------ screen source guards

test('the Themes tab is built from galleryRows over useRemoteArtThemes, and imports no old lists', () => {
  assert.match(SCREEN, /const remote = useRemoteArtThemes\(\);/);
  assert.match(SCREEN, /galleryRows<GalleryTheme, GalleryTheme>\(\{ remote, starters: STARTERS, columns, query, filter, liked \}\)/);
  assert.match(SCREEN, /const STARTERS = galleryStarters\(\);/);
  assert.match(SCREEN, /data=\{rows\}/);
  for (const mod of ['themesNew', 'themesStoryPlay', 'spacePack', 'plusThemes', 'seasons', 'freeMarks', 'discovery', 'categoryPaging', 'categorySwitch', 'artPackThemes']) {
    assert.doesNotMatch(SCREEN, new RegExp(`from '[./]*src/core/${mod}'`), `themes.tsx imports ${mod}`);
  }
  assert.doesNotMatch(SCREEN, /\b(THEMES|ALL_THEMES|PLUS_PACKS|SPACE_THEMES|ART_PACK_THEMES|NEW_THEMES|STORYPLAY_\w+)\b/);
  for (const ui of ['ShowcaseGrid', 'CategoryBubbleRow', 'StoryChips', 'SeasonalBanner', 'ThemeCard ', 'FreePill']) {
    assert.ok(!SCREEN.includes(`<${ui}`), `no <${ui.trim()}> on the tab`);
  }
});

test('New collection header first, then Starters; skeleton rows while empty; no error copy', () => {
  const head = SCREEN.slice(SCREEN.indexOf('const GalleryHead = memo('));
  const collection = head.indexOf("t('themes.collection.title')");
  const starters = head.indexOf("t('themes.starters')");
  assert.ok(collection >= 0 && starters > collection);
  assert.match(head, /eyebrow=\{t\('themes\.eyebrow\.collection'\)\}/);
  assert.match(SCREEN, /if \(item\.kind === 'skeleton'\) return <SkeletonCardRow count=\{item\.count\} cardWidth=\{cardWidth\} \/>/);
  assert.match(SCREEN, /accessibilityLabel=\{t\('themes\.collection\.loadingA11y'\)\}/);
  assert.match(CARD, /export const GalleryCardSkeleton = memo\(/);
  assert.match(CARD, /<Skeleton width=\{width\} height=\{artH\}/);
  // A 404 / offline never shows copy on the tab: no pack error state is read, no error strings.
  assert.doesNotMatch(SCREEN, /getPackState|\.error\b|packs\.error|catalogue\.error|ActivityIndicator|Alert\./);
  assert.doesNotMatch(SCREEN, /t\('[^']*(error|offline|failed|retry)[^']*'/i);
});

test('pull to refresh calls refreshRemoteCatalog; the list stays virtualised and bounces only at the top', () => {
  assert.match(SCREEN, /import \{ refreshRemoteCatalog, useRemoteArtThemes \} from '\.\.\/\.\.\/src\/native\/useRemoteCatalog';/);
  assert.match(SCREEN, /void refreshRemoteCatalog\(\)\.then\(done, done\);/);
  const list = SCREEN.slice(SCREEN.indexOf('<Animated.FlatList'));
  assert.match(list, /refreshing=\{refreshing\}/);
  assert.match(list, /onRefresh=\{onRefresh\}/);
  assert.match(list, /\{\.\.\.LIST_WINDOW\}/);
  assert.match(list, /bounces=\{atTop\}/);
  assert.match(list, /overScrollMode="never"/);
  assert.match(SCREEN, /runOnJS\(setAtTop\)\(top === 1\)/);
  assert.match(SCREEN, /if \(top !== topFlag\.value\)/, 'atTop only flips when the list crosses the top');
});

test('gallery cards are art-led: remote thumb via expo-image with ThumbHash, name, mood, heart, ≥ 48 pt', () => {
  assert.match(CARD, /isRemoteArtTheme\(theme\) \? \(\s*<RemoteArtImage theme=\{theme\} width=\{width\} height=\{artH\} \/>/);
  const img = read('src', 'ui', 'RemoteArtImage.tsx');
  assert.match(img, /from 'expo-image'/);
  assert.match(img, /placeholder=\{theme\.remoteArt\.thumbhash \? \{ thumbhash: theme\.remoteArt\.thumbhash \}/);
  assert.match(CARD, /\{theme\.name\}/);
  assert.match(CARD, /\{theme\.tagline\}/);
  assert.match(CARD, /<HeartButton\b/);
  assert.match(CARD, /card: \{ minHeight: sizeV2\.touch/);
  assert.match(CARD, /accessibilityHint=\{t\('themeUi\.card\.hint'\)\}/);
  assert.match(CARD, /scheme === 'dark' \? c\.surfaceRaised : c\.surface/);
  assert.doesNotMatch(CARD, /borderWidth|hairlineWidth/, 'surfaces, not hairlines');
  assert.match(SCREEN, /router\.push\(`\/theme\/\$\{id\}`\)/);
  assert.match(SCREEN, /<GalleryArtCard\b/);
});

test('every Text / TextInput on the tab and in the card has a Dynamic Type cap; no raw design values', () => {
  const raw = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?!\w)|\brgba?\(|\bfontSize\s*[:=]\s*[{'"]?\s*\d|\bborder(?:Top|Bottom)?(?:Left|Right|Start|End)?Radius\s*[:=]\s*\{?\s*\d/;
  for (const [name, src] of [['themes.tsx', SCREEN], ['GalleryArtCard.tsx', CARD]]) {
    const tags = [...src.matchAll(/<(Text|TextInput)\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(tags.length > 0, name);
    assert.deepEqual(tags.filter((x) => !/maxFontSizeMultiplier=/.test(x)), [], `${name}: Text without a cap`);
    assert.doesNotMatch(src, raw, name);
    assert.doesNotMatch(src, /\bwithSpring\b|\.springify\(|\bBounceIn\b|\bZoomIn\b|withSequence/, name);
  }
});

test('the new strings are in all 11 locales', () => {
  const keys = ['themes.eyebrow.collection', 'themes.collection.title', 'themes.collection.body', 'themes.collection.loadingA11y', 'themes.collection.downloadA11y', 'themes.startersBody'];
  const locales = Object.keys(CATALOGUES);
  assert.equal(locales.length, 11);
  for (const l of locales) {
    for (const k of keys) {
      const v = lookup(CATALOGUES[l as keyof typeof CATALOGUES] as unknown as CatalogueTree, k);
      assert.ok(typeof v === 'string' && v.trim().length > 0, `${l}: ${k}`);
    }
  }
});

test('PREMIUM_UI.md records the owner-1031 gallery', () => {
  const doc = read('docs', 'PREMIUM_UI.md');
  assert.match(doc, /\| Themes gallery \(owner-1031\) \|[^\n]*\| 189 \|/);
  assert.match(doc, /premiumGallery\.test\.ts/);
});
