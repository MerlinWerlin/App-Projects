// T176 premium UI, Live slice (docs/PREMIUM_UI.md §3.10): source guards for the Live tab
// (app/live/index.tsx since T186; was app/(tabs)/live.tsx) and the loop editor (app/live/[id].tsx). Editorial section headers, the
// 16-pt rhythm, lifted loop cards without hairlines, skeletons in the result's shape instead of
// spinners, Dynamic Type caps on every Text / TextInput, tokens only, strings in every locale. The
// Live Photo export flow and the honest copy stay as they were: no "always looping" promise on
// iPhone, the Android live wallpaper only where it already exists.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as liveNs from '../i18n/ns/live/index.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// Same patterns as designGuard.test.ts (raw hex / rgba, numeric fontSize, numeric radius).
const RAW = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?!\w)|\brgba?\(|\bfontSize\s*[:=]\s*[{'"]?\s*\d|\bborder(?:Top|Bottom)?(?:Left|Right|Start|End)?Radius\s*[:=]\s*\{?\s*\d/;

const TAB = ['app', 'live', 'index.tsx'];
const EDITOR = ['app', 'live', '[id].tsx'];

type Msgs = { tab?: Record<string, unknown>; editor?: Record<string, unknown> };
const get = (o: unknown, path: string): unknown => path.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), o);

const NEW_KEYS = [
  'tab.sections.make.eyebrow',
  'tab.sections.make.title',
  'tab.sections.make.body',
  'tab.sections.loops.eyebrow',
  'editor.sections.frame.eyebrow',
  'editor.sections.frame.title',
  'editor.sections.clip.eyebrow',
  'editor.sections.finish.eyebrow',
  'editor.sections.finish.title',
  'editor.sections.finish.body',
];

test('every locale has the Live section headers', () => {
  const locales = Object.entries(liveNs) as [string, Msgs][];
  assert.equal(locales.length, 11);
  for (const [loc, msgs] of locales) {
    for (const k of NEW_KEYS) {
      const v = get(msgs, k);
      assert.ok(typeof v === 'string' && v.trim().length > 0, `${loc}: live.${k}`);
    }
  }
});

test('the new Live copy is honest: no constant-loop promise, 3 seconds, saved to Photos', () => {
  const en = liveNs.en as unknown as Msgs;
  assert.match(String(get(en, 'tab.sections.make.body')), /first 3 seconds to Photos as a Live Photo/);
  assert.equal(get(en, 'tab.sections.make.eyebrow'), 'Make a Live Photo');
  for (const [loc, msgs] of Object.entries(liveNs) as [string, Msgs][]) {
    const text = NEW_KEYS.map((k) => String(get(msgs, k))).join(' ');
    assert.doesNotMatch(text, /always|constant|forever|endless|every time it wakes/i, `${loc}: no looping promise`);
  }
});

test('Live tab: editorial headers, 16-pt rhythm, lifted loop cards, skeleton loop card, no hairlines', () => {
  const tab = strip(read(...TAB));
  assert.equal((tab.match(/<SectionHeader\b/g) ?? []).length, 2, 'two editorial sections');
  assert.match(tab, /t\('live\.tab\.sections\.make\.eyebrow'\)/);
  assert.match(tab, /eyebrow=\{t\('live\.tab\.sections\.loops\.eyebrow'\)\}\s*title=\{t\('live\.tab\.yourLoops'\)\}/);
  assert.match(tab, /section: \{ marginHorizontal: spaceV2\.lg, gap: editorialV2\.cardGap \}/);
  assert.match(tab, /cards: \{ gap: editorialV2\.cardGap \}/);
  assert.match(tab, /const cardTone = scheme === 'dark' \? 'raised' : 'surface';/);
  assert.ok((tab.match(/<SquircleCard tone=\{(?:cardTone|tone)\} outline=\{false\}/g) ?? []).length >= 3, 'loop, empty and skeleton cards lift by surface');
  assert.doesNotMatch(tab, /hairlineWidth|borderTopWidth|borderWidth/, 'surfaces, not hairlines');
  assert.match(tab, /<LoopCardSkeleton tone=\{cardTone\} \/>/);
  assert.match(tab, /<Skeleton width=\{THUMB\} height=\{THUMB\} radius=\{iconTileRadius\(THUMB\)\} \/>/);
});

test('loop editor: skeleton in the editor shape, preview on a raised surface, editorial sections', () => {
  const ed = strip(read(...EDITOR));
  assert.doesNotMatch(ed, /ActivityIndicator/);
  assert.match(ed, /if \(project === undefined\) return <EditorSkeleton \/>;/);
  const skel = /function EditorSkeleton\(\) \{([\s\S]*?)\n\}/.exec(ed)?.[1] ?? '';
  assert.match(skel, /<Skeleton width="100%" height=\{sizeV2\.rowMin\}/, 'name field');
  assert.match(skel, /<Skeleton width=\{phoneW\} height=\{outerH\}/, 'phone-shaped preview');
  assert.match(skel, /accessibilityLabel=\{t\('live\.editor\.loading'\)\}/);
  assert.match(ed, /<SquircleCard size="large" elevation="raised" tone="raised" outline=\{false\}/);
  assert.match(ed, /const \{ aspect, phoneW, screenSize \} = useEditorPhone\(\);/, 'skeleton and editor share one phone size');
  for (const k of ['frame.eyebrow', 'frame.title', 'clip.eyebrow', 'finish.eyebrow', 'finish.title', 'finish.body']) {
    assert.ok(ed.includes(`t('live.editor.sections.${k}')`), k);
  }
  assert.match(ed, /<SectionHeader level="group" flushTop title=\{t\('live\.editor\.speed'\)\}/);
  assert.doesNotMatch(ed, /<Text accessibilityRole="header"/, 'headings are SectionHeaders');
  assert.match(ed, /content: \{ padding: spaceV2\.lg, gap: editorialV2\.cardGap/);
  assert.doesNotMatch(ed, /borderWidth/, 'the size warning is a surface, not an outline');
});

test('loop editor: the Live Photo export flow and the Android live wallpaper stay as they were', () => {
  const ed = strip(read(...EDITOR));
  assert.match(ed, /<SaveAsLivePhotoButton\b[\s\S]*?getProject=\{\(\) => latest\.current\}/);
  assert.match(ed, /<LivePhotoGuide kind=\{project\.kind\} \/>/);
  assert.match(ed, /<LiveSaveToPhotos getProject=\{\(\) => latest\.current\} getPlayer=\{\(\) => playerRef\.current\} \/>/);
  assert.match(ed, /androidNative\.isAndroid \?/);
  assert.match(ed, /setVideoWallpaperWithFeedback\(latest\.current\)/);
  // The order is the save path: frame, trim, speed, then the save section.
  const order = ['live.editor.sections.frame.title', 'live.editor.trim', 'live.editor.speed', 'live.editor.sections.finish.title', '<SaveAsLivePhotoButton'];
  const at = order.map((s) => ed.indexOf(s));
  assert.ok(at.every((i) => i >= 0) && at.every((i, n) => n === 0 || i > at[n - 1]), `order ${at.join(',')}`);
  assert.match(strip(read(...TAB)), /<LivePhotoGuide \/>/);
});

test('Live tab and editor: tokens only, timed fades, no spring', () => {
  for (const f of [TAB, EDITOR]) {
    const src = strip(read(...f)).replace(/layout=\{layout\}/g, '');
    assert.doesNotMatch(src, RAW, `${f.join('/')}: raw colour, font size or radius`);
    assert.doesNotMatch(src, /\bwithSpring\b|\.springify\(|\bBounceIn\b|Easing\.bounce|Easing\.elastic|damping:/, f.join('/'));
  }
  assert.doesNotMatch(read('src', 'core', 'designGuard.test.ts'), /'app\/\(tabs\)\/live\.tsx'|'app\/live\/\[id\]\.tsx'/, 'design guard entries removed');
});

test('every Text and TextInput on the Live tab and in the loop editor carries a Dynamic Type cap', () => {
  for (const f of [TAB, EDITOR]) {
    const src = strip(read(...f));
    const tags = [...src.matchAll(/<(Text|TextInput)\b[\s\S]*?(?=\/?>)/g)].map((m) => m[0]);
    assert.ok(tags.length >= 4, f.join('/'));
    const uncapped = tags.filter((t) => !/maxFontSizeMultiplier=\{fontScaleCap\('/.test(t));
    assert.deepEqual(uncapped, [], `${f.join('/')}: Text without maxFontSizeMultiplier`);
  }
});
