import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRST_RUN_TIP_IDS,
  PLACEMENT_LABELS,
  TIPS,
  TIPS_KEY,
  TIP_IDS,
  dismiss,
  dismissMany,
  getTip,
  hiddenCount,
  isDismissed,
  nextTip,
  parseTips,
  restoreAll,
  restoreOne,
  serializeTips,
  tipGroups,
  visibleTips,
  type TipId,
} from './tips.ts';
import * as tipsNs from '../i18n/ns/tips/index.ts';

test('storage key is unchanged from T09', () => {
  assert.equal(TIPS_KEY, 'glaze.tips.v1');
});

test('the three T09 first-run tips keep their ids, order and meaning', () => {
  assert.deepEqual([...FIRST_RUN_TIP_IDS], ['icons-added', 'bulk-install', 'live-lock']);
  assert.deepEqual(
    visibleTips('first-run', []).map((t) => t.id),
    ['icons-added', 'bulk-install', 'live-lock'],
  );
  assert.match(getTip('icons-added').title, /added, not replaced/);
  assert.match(getTip('bulk-install').body, /one profile/);
  assert.match(getTip('live-lock').body, /Live Photo/);
  assert.equal(getTip('bulk-install').title, 'Install all at once');
  assert.doesNotMatch(getTip('bulk-install').title + getTip('bulk-install').body, /beta/i);
  assert.match(getTip('bulk-install').body, /Shortcuts method/);
});

test('catalogue has the contextual tips, unique ids, short bodies', () => {
  const ids = TIPS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of [
    'theme-pick',
    'photo-background',
    'wallpaper-save',
    'icon-shapes',
    'icon-override',
    'missing-app',
    'install-not-verified',
    'live-loop',
  ] as TipId[]) {
    assert.ok(ids.includes(id), id);
  }
  for (const t of TIPS) {
    assert.ok(t.title.length > 0 && t.title.length <= 40, `${t.id} title`);
    const sentences = t.body.split(/[.!?](?:\s|$)/).filter((s) => s.trim().length > 0);
    assert.ok(sentences.length <= 2, `${t.id} has ${sentences.length} sentences`);
    assert.ok(t.body.length <= 160, `${t.id} body is ${t.body.length} chars`);
    assert.ok(t.icon.length > 0);
  }
});

test('copy is honest about iOS limits', () => {
  assert.match(getTip('photo-background').body, /can’t set wallpapers/);
  assert.match(getTip('photo-background').body, /Settings › Wallpaper/);
  assert.match(getTip('icon-shapes').body, /rounded square/);
  assert.match(getTip('missing-app').body, /can’t see which apps are installed/);
  assert.match(getTip('install-not-verified').body, /Not Verified/);
  assert.match(getTip('live-loop').body, /isn’t a constant loop/);
  assert.doesNotMatch(TIPS.map((t) => t.body).join(' '), /Live Lock|Loop your own/);
  // T147 (fb-1025 C): honest about app-made Live Photos as wallpapers, no "moves when you wake".
  assert.match(getTip('live-loop').body, /Motion not available/);
  assert.match(getTip('live-lock').body, /still/);
  assert.doesNotMatch(`${getTip('live-lock').body} ${getTip('live-loop').body}`, /when you wake|Use as Wallpaper/);
  assert.match(getTip('icon-override').body, /keeps your image/);
  const all = TIPS.map((t) => `${t.title} ${t.body}`).join(' ');
  for (const name of ['Themify', 'Icon Themer', 'MyScreen', 'ScreenKit', 'Widgetsmith', 'intoLive', 'Loopy', 'Lockio']) {
    assert.ok(!all.includes(name), name);
  }
});

test('visibleTips filters by placement and dismissed, sorted by order; null = loading', () => {
  assert.deepEqual(
    visibleTips('wallpaper', []).map((t) => t.id),
    ['photo-background', 'wallpaper-save'],
  );
  assert.deepEqual(
    visibleTips('wallpaper', ['photo-background']).map((t) => t.id),
    ['wallpaper-save'],
  );
  assert.deepEqual(visibleTips('wallpaper', null), []);
  assert.deepEqual(visibleTips('install', ['install-not-verified']), []);
});

test('nextTip shows one contextual tip at a time', () => {
  const ids: TipId[] = ['photo-background', 'wallpaper-save'];
  assert.equal(nextTip(ids, [])?.id, 'photo-background');
  assert.equal(nextTip(ids, ['photo-background'])?.id, 'wallpaper-save');
  assert.equal(nextTip(ids, ['photo-background', 'wallpaper-save']), null);
  assert.equal(nextTip(ids, null), null);
  assert.equal(nextTip(['nope' as TipId], []), null);
});

test('dismiss / restoreOne / restoreAll are pure and idempotent', () => {
  const start: TipId[] = ['icons-added'];
  const d = dismiss(start, 'live-loop');
  assert.deepEqual(d, ['icons-added', 'live-loop']);
  assert.deepEqual(start, ['icons-added'], 'input not mutated');
  assert.deepEqual(dismiss(d, 'live-loop'), d);
  assert.deepEqual(restoreOne(d, 'icons-added'), ['live-loop']);
  assert.deepEqual(restoreOne(d, 'theme-pick'), d);
  assert.deepEqual(restoreAll(d), []);
  assert.ok(isDismissed(d, 'live-loop'));
  assert.ok(!isDismissed(null, 'live-loop'));
});

test('dismissing all first-run cards keeps contextual dismissals', () => {
  const d = dismissMany(['live-loop', 'icons-added'], FIRST_RUN_TIP_IDS);
  assert.deepEqual(d, ['live-loop', 'icons-added', 'bulk-install', 'live-lock']);
  assert.deepEqual(visibleTips('first-run', d), []);
  assert.deepEqual(visibleTips('install', d).map((t) => t.id), ['install-not-verified']);
});

test('parse: stored v1 data from T09 is preserved', () => {
  assert.deepEqual(parseTips('{"dismissed":["icons-added","live-lock"]}'), ['icons-added', 'live-lock']);
  assert.deepEqual(parseTips('{"dismissed":["icons-added","bulk-install","live-lock"]}'), [...FIRST_RUN_TIP_IDS]);
  assert.deepEqual(parseTips('{"dismissed":[]}'), []);
});

test('parse: unknown ids ignored, duplicates removed, junk tolerated', () => {
  assert.deepEqual(parseTips('{"dismissed":["icons-added","old-tip",3,null,"icons-added","live-loop"]}'), [
    'icons-added',
    'live-loop',
  ]);
  assert.deepEqual(parseTips(null), []);
  assert.deepEqual(parseTips(undefined), []);
  assert.deepEqual(parseTips(''), []);
  assert.deepEqual(parseTips('{broken'), []);
  assert.deepEqual(parseTips('[]'), []);
  assert.deepEqual(parseTips('{"dismissed":"icons-added"}'), []);
  assert.deepEqual(parseTips('null'), []);
});

test('serialize writes the v1 shape and round-trips', () => {
  const d: TipId[] = ['bulk-install', 'missing-app'];
  const s = serializeTips(d);
  assert.deepEqual(JSON.parse(s), { dismissed: ['bulk-install', 'missing-app'] });
  assert.deepEqual(parseTips(s), d);
  assert.equal(serializeTips(['bulk-install', 'bulk-install', 'x' as TipId]), '{"dismissed":["bulk-install"]}');
});

test('a T09 build can still read what this version writes', () => {
  // T09 parse: {dismissed: string[]} filtered to its own three ids.
  const t09 = (raw: string) =>
    (JSON.parse(raw) as { dismissed: string[] }).dismissed.filter((x) =>
      ['icons-added', 'bulk-install', 'live-lock'].includes(x),
    );
  assert.deepEqual(t09(serializeTips(['live-loop', 'live-lock'])), ['live-lock']);
});

test('library groups list every tip exactly once', () => {
  const groups = tipGroups();
  const ids = groups.flatMap((g) => g.tips.map((t) => t.id));
  assert.equal(ids.length, TIP_IDS.length);
  assert.deepEqual([...ids].sort(), [...TIP_IDS].sort());
  assert.equal(groups[0].title, 'Getting started');
  for (const g of groups) assert.ok(g.tips.length > 0);
  // T193: there is no Live tab (the Live Photo maker is /live, opened from Wallpapers).
  assert.equal(PLACEMENT_LABELS.live, 'Live Photo maker');
  for (const [loc, msgs] of Object.entries(tipsNs) as [string, { places: Record<string, string> }][]) {
    assert.ok(msgs.places.live.length > 0, loc);
    assert.doesNotMatch(msgs.places.live, /tab|Tab|Pestaña|Onglet|Scheda|Aba|タブ|탭|标签页|टैब|تبويب/, `${loc}: tips.places.live names a Live tab`);
  }
});

test('hiddenCount', () => {
  assert.equal(hiddenCount(null), 0);
  assert.equal(hiddenCount([]), 0);
  assert.equal(hiddenCount(['icons-added', 'live-loop']), 2);
});

// T217: Install all at once is the main way (T202); no "beta" bulk wording left in any locale.
import { readFileSync, readdirSync } from 'node:fs';
test('T217: no locale calls Install all at once a beta (tips, themeUi, plus)', () => {
  const base = new URL('../i18n/ns/', import.meta.url);
  for (const ns of ['tips', 'themeUi', 'plus']) {
    for (const f of readdirSync(new URL(ns + '/', base))) {
      if (f === 'index.ts') continue;
      const src = readFileSync(new URL(ns + '/' + f, base), 'utf8');
      const lines = src.split('\n').filter((l) => !/unavailable:/.test(l));
      assert.doesNotMatch(lines.join('\n'), /beta|Beta|ベータ|베타|测试版|बीटा|تجريبي/, ns + '/' + f);
    }
  }
});
