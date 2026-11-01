// T206 + T209 (run 208 widget snapshot review): practical pieces whose picture has numbers painted in
// ('29 THU OCT', '14 DAYS', '25:00', '3/5', '78% BATTERY', fixed clock hands) are not presented as
// live practical widgets: they sit with the art, carry no "Live" badge, and the theme page offers
// the live catalogue widget as a separate one ("Live widget instead") with a note. A pack can mark
// a number-free piece (`numberFree: true`) to keep it practical. Menu names are the same in every
// size (the sheets showed "Art 1, Art 3, Art 2" and one piece numbered differently per size).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  VALUE_KINDS,
  WIDGET_OPTION_KINDS,
  fixedValues,
  heroNameKey,
  optionName,
  parseWidgetOptions,
  shelfKind,
  shelfOptions,
  showsLiveBadge,
  widgetOptionsFromV1,
  widgetShelf,
  type OptionAsset,
  type WidgetOption,
} from './widgetOptions.ts';
import * as tabsNs from '../i18n/ns/tabs/index.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const IMG = 'widget-a.11111111.webp';
const ASSETS: OptionAsset[] = [{ path: IMG, role: 'widget-art', width: 1024, height: 1024 }];
const ALL = ['small', 'medium', 'large'];

/** The practical pieces of the live production packs as of run 208 (labels and kinds from the manifests). */
const PRODUCTION_LIKE = [
  { id: 'rehearsal-countdown', kind: 'countdown', label: 'Rehearsal countdown' }, // '14 DAYS'
  { id: 'cloud-date', kind: 'calendar', label: 'Cloud date' }, // '29 THU OCT'
  { id: 'acorn-habits', kind: 'habits', label: 'Acorn habits' }, // '3/5'
  { id: 'abyss-battery', kind: 'battery', label: 'Abyss battery' }, // '78%'
  { id: 'constellation-clock', kind: 'clock', label: 'Constellation clock' }, // fixed hands
  { id: 'dunes-photo', kind: 'photo', label: 'Dunes photo' }, // a picture, no value
  { id: 'harbour-focus', kind: 'art', label: 'Harbour focus' }, // '25:00', already art
  { id: 'satin-swan', kind: 'art', label: 'Satin swan' },
].map((o) => ({ ...o, image: IMG, sizes: ALL, background: 'blur' }));

test('value kinds: clock, date, calendar, countdown, habits, battery; photo / quote / art are not', () => {
  assert.deepEqual([...VALUE_KINDS].sort(), ['battery', 'calendar', 'clock', 'countdown', 'date', 'habits']);
  for (const kind of WIDGET_OPTION_KINDS) {
    const baked = fixedValues({ kind });
    assert.equal(baked, VALUE_KINDS.includes(kind), kind);
    assert.equal(fixedValues({ kind, numberFree: true }), false, `${kind} marked number-free`);
    assert.equal(shelfKind({ kind }), baked ? 'art' : kind);
  }
});

test('parse: numberFree true is kept, absent stays absent, a non-boolean drops the option', () => {
  const r = parseWidgetOptions(
    [
      { id: 'free', kind: 'clock', image: IMG, sizes: ['small'], numberFree: true },
      { id: 'plain', kind: 'clock', image: IMG, sizes: ['small'] },
      { id: 'no', kind: 'clock', image: IMG, sizes: ['small'], numberFree: false },
      { id: 'bad', kind: 'clock', image: IMG, sizes: ['small'], numberFree: 'yes' },
    ],
    ASSETS,
  );
  assert.deepEqual(r.options.map((o) => [o.id, o.numberFree]), [['free', true], ['plain', undefined], ['no', undefined]]);
  assert.deepEqual(r.errors, ['widgets[3] (bad): bad numberFree']);
});

test('shelf: pictures with fixed numbers sit with the art (pack order), no Live badge; photo stays practical', () => {
  const { options, errors } = parseWidgetOptions(PRODUCTION_LIKE, ASSETS);
  assert.deepEqual(errors, []);
  for (const size of ['small', 'medium', 'large'] as const) {
    const shelf = widgetShelf(options, size);
    assert.deepEqual(shelf.map((b) => b.group), ['practical', 'art']);
    const practical = shelf[0].group === 'practical' ? shelf[0].sections.flatMap((s) => s.options.map((o) => o.id)) : [];
    assert.deepEqual(practical, ['dunes-photo']);
    const art = shelf[1].group === 'art' ? shelf[1].options.map((o) => o.id) : [];
    assert.deepEqual(art, ['rehearsal-countdown', 'cloud-date', 'acorn-habits', 'abyss-battery', 'constellation-clock', 'harbour-focus', 'satin-swan']);
  }
  const badge = options.filter(showsLiveBadge).map((o) => o.id);
  assert.deepEqual(badge, ['dunes-photo'], 'only a piece that can itself be live keeps the badge');
  // Marked number-free, the same countdown is practical again, with its badge.
  const freed = parseWidgetOptions([{ ...PRODUCTION_LIKE[0], numberFree: true }, PRODUCTION_LIKE[7]], ASSETS).options;
  assert.deepEqual(shelfOptions(freed, 'small').map((o) => o.id), ['rehearsal-countdown', 'satin-swan']);
  assert.equal(widgetShelf(freed, 'small')[0].group, 'practical');
  assert.equal(showsLiveBadge(freed[0]), true);
});

test('names: the pack label; derived v1 pieces by shape; else "Art n" by pack place, the same in every size', () => {
  const v1 = widgetOptionsFromV1([
    { path: 's', role: 'widget-small', width: 510, height: 510 },
    { path: 'm', role: 'widget-medium', width: 1092, height: 510 },
    { path: 'l', role: 'widget-large', width: 1092, height: 1146 },
  ]);
  assert.deepEqual(
    v1.map((o) => optionName(o, v1)),
    [{ key: heroNameKey('small') }, { key: heroNameKey('medium') }, { key: heroNameKey('large') }],
  );
  // The shelf order changes per size, the names do not.
  const names = (size: 'small' | 'medium' | 'large') => Object.fromEntries(shelfOptions(v1, size).map((o) => [o.id, JSON.stringify(optionName(o, v1))]));
  assert.deepEqual(names('small'), names('medium'));
  assert.deepEqual(names('small'), names('large'));
  const plain = parseWidgetOptions(
    [
      { id: 'b', kind: 'art', image: IMG, sizes: ['medium'] },
      { id: 'a', kind: 'art', image: IMG, sizes: ['small'], label: 'Fox' },
      { id: 'c', kind: 'art', image: IMG, sizes: ['small'] },
    ],
    ASSETS,
  ).options;
  assert.deepEqual(optionName(plain[1], plain), { text: 'Fox' });
  assert.deepEqual(optionName(plain[2], plain), { key: 'tabs.widgetsTab.art.numbered', params: { n: 3 } });
  assert.deepEqual(optionName(plain[0], plain), { key: 'tabs.widgetsTab.art.numbered', params: { n: 1 } });
  // A v2 option that happens to be called hero-small is not a derived piece.
  const fake: WidgetOption = { ...plain[0], id: 'hero-small' };
  assert.equal('key' in optionName(fake, [fake]) && optionName(fake, [fake]).key, 'tabs.widgetsTab.art.numbered');
});

test('every locale has the new strings (hero names, live-instead button and hint, fixed-numbers note)', () => {
  for (const [loc, msgs] of Object.entries(tabsNs)) {
    const art = (msgs as { widgetsTab: { art: Record<string, unknown> } }).widgetsTab.art;
    for (const k of ['liveInstead', 'liveInsteadHint', 'fixedNote']) assert.ok(typeof art[k] === 'string' && (art[k] as string).length > 0, `${loc} ${k}`);
    const hero = art.heroNames as Record<string, string>;
    for (const s of ['small', 'medium', 'large']) assert.ok(hero?.[s], `${loc} heroNames.${s}`);
    assert.equal(new Set(Object.values(hero)).size, 3, `${loc} hero names differ`);
  }
});

test('UI wiring: the menu names via optionName and badges via showsLiveBadge; the theme widget art labels fixed pieces', () => {
  const menu = strip(read('src', 'ui', 'WidgetArtMenu.tsx'));
  assert.match(menu, /showsLiveBadge\(option\)/);
  assert.match(menu, /optionName\(o, all\)/);
  assert.doesNotMatch(menu, /liveKindOf\(/, 'the badge no longer follows the raw kind');
  assert.doesNotMatch(menu, /index \+ 1/, 'no per-size numbering');
  const art = strip(read('src', 'ui', 'ThemeWidgetArt.tsx'));
  assert.match(art, /const fixed = fixedValues\(pickedItem\.option\)/);
  assert.match(art, /fixed \? t\('tabs\.widgetsTab\.art\.liveInstead'\)/);
  assert.match(art, /tabs\.widgetsTab\.art\.fixedNote/);
  const sheet = read('scripts', 'widget-snapshots.mjs');
  assert.match(sheet, /showsLiveBadge\(o\)/, 'the render check measures the label with the same badge rule');
  assert.match(sheet, /optionName\(o, all\)/);
});
