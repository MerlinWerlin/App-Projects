// T147 (owner feedback fb-1025 C, 25 Oct 2026): on the TestFlight build the Live Photo saved fine
// but did not move as the Lock Screen wallpaper. Apple DTS: app-made Live Photos have undocumented
// requirements to work as Live Wallpapers (developer.apple.com/forums/thread/798044). Decision:
// keep the maker, stop promising a moving iPhone wallpaper, say "Motion not available" plainly and
// point to the still wallpaper packs. Source guards keep the copy honest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../i18n/locales/en.ts';
import { CATALOGUES, TRANSLATIONS } from '../i18n/locales/index.ts';
import { isPluralMessage, translate, type Locale } from './i18n.ts';
import { GUIDE_STEPS, GUIDE_TEXT, heroSubline, livePhotoGuide, saveOptions } from './liveSteps.ts';
import { TIPS } from './tips.ts';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

function leaves(tree: unknown, prefix = ''): [string, string][] {
  if (typeof tree === 'string') return [[prefix, tree]];
  if (isPluralMessage(tree)) return Object.values(tree).filter((x): x is string => typeof x === 'string').map((x) => [prefix, x]);
  if (!tree || typeof tree !== 'object') return [];
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(tree)) out.push(...leaves(v, prefix ? `${prefix}.${k}` : k));
  return out;
}

/** The old promises: a Live Photo that moves on the Lock Screen / when the iPhone wakes. */
const PROMISES: RegExp[] = [
  /moves? (?:on|across) (?:your|the) Lock Screen/i,
  /when you wake/i,
  /wake (?:your|the) iPhone/i,
  /when the iPhone wakes/i,
  /moving Lock Screen/i,
  /Live Photo wallpaper that moves/i,
  /moves on iOS \d+/i,
  /plays briefly when/i,
  /Set it as your wallpaper/i,
];

const enLeaves = leaves(en);
const lpLeaves = enLeaves.filter(([, v]) => /Live Photo/.test(v));
const en1 = (key: string) => translate(CATALOGUES, 'en', key);

test('fb-1025 C: no English Live Photo string promises it moves on the Lock Screen', () => {
  assert.ok(lpLeaves.length > 20, `only ${lpLeaves.length} Live Photo strings found`);
  for (const [k, v] of lpLeaves) {
    for (const re of PROMISES) assert.doesNotMatch(v, re, `${k}: "${v}"`);
  }
  // The keys the owner sees around the maker, whether or not they name "Live Photo".
  for (const k of [
    'live.tab.subtitle',
    'liveUi.hero.title',
    'liveUi.hero.subLive',
    'liveUi.hero.subLivePhoto',
    'liveUi.guide.title',
    'liveUi.guide.moves',
    'liveUi.livePhoto.msgSaved',
    'liveUi.livePhoto.setTitle',
    'liveUi.options.livePhotoDetail',
    'liveUi.save.introExpoGo',
    'liveUi.save.clipNote',
    'tips.items.liveLock.body',
    'tips.items.liveLoop.body',
    'themeUi.tips.live-lock.body',
    'themeUi.tips.live-loop.body',
    'tabs.wallpapersTab.subtitle',
  ]) {
    const v = en1(k);
    assert.notEqual(v, k, `${k} exists`);
    for (const re of PROMISES) assert.doesNotMatch(v, re, `${k}: "${v}"`);
  }
  assert.doesNotMatch(en1('live.tab.subtitle'), /wallpaper/i);
  assert.doesNotMatch(en1('liveUi.hero.title'), /wallpaper/i);
  assert.doesNotMatch(en1('tabs.wallpapersTab.subtitle'), /live wallpapers/i);
});

test('fb-1025 C: the English catalogue explains "Motion not available" honestly', () => {
  const needs = en1('liveUi.guide.needs');
  assert.match(needs, /Motion not available/);
  assert.match(needs, /made by apps/);
  assert.match(needs, /Apple limit, not your phone/);
  assert.match(needs, /still one in Wallpapers/, 'points to the still wallpaper packs');
  assert.match(en1('liveUi.guide.lockBody'), /Motion not available/);
  assert.match(en1('liveUi.guide.honest'), /moves when you press it/);
  assert.match(en1('liveUi.guide.honest'), /try it as a wallpaper/);
  assert.match(en1('liveUi.guide.honest'), /often keeps Live Photos made by apps still/);
  assert.match(en1('liveUi.guide.shareBody'), /To try it as a wallpaper/);
  assert.match(en1('liveUi.livePhoto.msgSaved'), /Touch and hold it there to see it move/);
  assert.match(en1('tips.items.liveLoop.body'), /Motion not available/);
  // The core English source agrees with the catalogue.
  assert.equal(GUIDE_TEXT.needs, needs);
  assert.equal(GUIDE_STEPS[2].body, en1('liveUi.guide.lockBody'));
  for (const t of TIPS) for (const re of PROMISES) assert.doesNotMatch(`${t.title} ${t.body}`, re, t.id);
  assert.equal(TIPS.find((t) => t.id === 'live-lock')?.body, en1('tips.items.liveLock.body'));
  assert.equal(TIPS.find((t) => t.id === 'live-loop')?.body, en1('tips.items.liveLoop.body'));
  for (const ios of [0, 15, 16, 17, 18, 26]) {
    for (const re of PROMISES) assert.doesNotMatch(heroSubline('full', ios), re, `heroSubline ${ios}`);
  }
  for (const o of saveOptions('full', 'video')) for (const re of PROMISES) assert.doesNotMatch(o.detail, re, o.id);
});

test('fb-1025 C: the Motion not available note shows on every iOS version and after saving', () => {
  for (const ios of [0, 15, 16, 17, 18, 26]) {
    for (const build of ['expo-go', 'full'] as const) {
      assert.ok(livePhotoGuide({ iosMajor: ios, build, kind: 'video' }).notes.includes('needs'), `${build} iOS ${ios}`);
    }
  }
  const sheet = read('src/ui/LivePhotoSheet.tsx');
  const saved = sheet.slice(sheet.indexOf("s.kind === 'saved' ? ("));
  assert.match(saved.slice(0, saved.indexOf(') : null}')), /t\('liveUi\.guide\.needs'\)/, 'saved sheet shows the honest note');
});

test('fb-1025 C: every language carries the new copy (not English, not the old promise)', () => {
  const changed = [
    'live.tab.subtitle',
    'liveUi.hero.title',
    'liveUi.hero.subLive',
    'liveUi.guide.title',
    'liveUi.guide.honest',
    'liveUi.guide.photosBody',
    'liveUi.guide.shareBody',
    'liveUi.guide.lockBody',
    'liveUi.guide.moves',
    'liveUi.guide.needs',
    'liveUi.guide.oldIos',
    'liveUi.livePhoto.msgSaved',
    'liveUi.livePhoto.setTitle',
    'liveUi.save.clipNote',
    'tips.items.liveLock.body',
    'tips.items.liveLoop.body',
    'themeUi.tips.live-lock.body',
    'themeUi.tips.live-loop.body',
    'tabs.wallpapersTab.subtitle',
  ];
  const locales = Object.keys(TRANSLATIONS).filter((l) => l !== 'en') as Locale[];
  assert.equal(locales.length, 10);
  for (const l of locales) {
    for (const k of changed) {
      const v = translate(CATALOGUES, l, k);
      assert.notEqual(v, k, `${l} ${k} missing`);
      assert.notEqual(v, en1(k), `${l} ${k} is English`);
    }
    // Tips: the themeUi copy and the tips-screen copy say the same thing.
    assert.equal(translate(CATALOGUES, l, 'tips.items.liveLock.body'), translate(CATALOGUES, l, 'themeUi.tips.live-lock.body'), l);
    assert.equal(translate(CATALOGUES, l, 'tips.items.liveLoop.body'), translate(CATALOGUES, l, 'themeUi.tips.live-loop.body'), l);
  }
});

test('fb-1025 C: Android keeps its real looping live wallpaper', () => {
  assert.equal(en1('live.editor.setAndroid'), 'Set as live wallpaper');
  assert.match(read('app/live/[id].tsx'), /t\('live\.editor\.setAndroid'\)/);
  assert.match(read('app/live/[id].tsx'), /setVideoWallpaperWithFeedback/);
  // The iPhone guide (and its wallpaper wording) stays hidden on Android.
  assert.match(read('src/ui/LivePhotoGuide.tsx'), /if \(!ctx\.isIos\) return null;/);
});

test('fb-1025 C: docs record the 25 Oct decision and the DTS evidence', () => {
  const dts = 'https://developer.apple.com/forums/thread/798044';
  const motion = 'https://developer.apple.com/forums/thread/768984';
  const review = read('docs/REVIEW_NOTES.md');
  assert.match(review, /25 Oct 2026/);
  assert.ok(review.includes(dts) && review.includes(motion), 'REVIEW_NOTES links both threads');
  for (const re of PROMISES) assert.doesNotMatch(review, re, 'REVIEW_NOTES');
  const lp = read('docs/LIVEPHOTO.md');
  assert.match(lp, /Decision 25 Oct 2026/);
  assert.ok(lp.includes(dts) && lp.includes(motion), 'LIVEPHOTO links both threads');
  const store = read('docs/STORE.md');
  assert.match(store, /no wallpaper-motion promise/);
  assert.doesNotMatch(store, /\| [^|]*moves when you wake your iPhone[^|]*\|/, 'no shot caption promises motion');
  const shots = read('assets/store/src/shots.js');
  for (const re of PROMISES) assert.doesNotMatch(shots, re, 'shots.js');
  assert.doesNotMatch(shots, /Wallpapers that move/);
  const future = read('docs/future/live-wallpaper/README.md');
  assert.match(future, /## Live Photo as wallpaper \(25 Oct 2026\)/);
  assert.match(future, /undocumented requirements/);
  assert.match(future, /public API for creating wallpaper-eligible Live Photos/);
  assert.match(future, /Feedback\s+Assistant/);
  assert.match(future, /What to do when it lands/);
});

test('fb-1025 C: the Live Photo screens use no springs or bounce', () => {
  for (const f of ['src/ui/LivePhotoGuide.tsx', 'src/ui/LivePhotoSheet.tsx', 'src/ui/LiveSaveToPhotos.tsx', 'app/live/index.tsx', 'app/live/[id].tsx']) {
    assert.doesNotMatch(read(f), /withSpring|Animated\.spring|\bspring\(|Easing\.bounce|Easing\.elastic|damping:/, f);
  }
});
