// T63: honest paywall guard (docs/MARKET.md "What users hate" #3, "Pricing proposal").
// - The Plus sheet has a large, always-visible, labelled close and an always-visible Restore purchases.
// - Settings shows Restore purchases too; nothing opens the Plus sheet at launch.
// - Plus cards carry the Plus badge before tapping; free themes are fully free.
// - Plus copy says one-time price, no subscription; no app copy invents counts, ranks, likes, laurels
//   or badges (shots-1018 L6/L8).
// Source-text checks: UI code can't be compiled or rendered under Node, so these read the files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../i18n/locales/en.ts';
import { TRANSLATIONS } from '../i18n/locales/index.ts';
import { GLYPH_SETS } from './glyphsets.ts';
import { isPluralMessage } from './i18n.ts';
import { PLUS_THEMES } from './plusThemes.ts';
import { THEMES } from './themes.ts';

const root = process.cwd();
const read = (...p: string[]): string => readFileSync(join(root, ...p), 'utf8');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

function texts(tree: unknown, prefix = ''): [string, string][] {
  if (typeof tree === 'string') return [[prefix, tree]];
  if (isPluralMessage(tree)) {
    return Object.entries(tree as Record<string, unknown>)
      .filter((e): e is [string, string] => typeof e[1] === 'string')
      .map(([cat, s]) => [`${prefix}#${cat}`, s]);
  }
  if (!tree || typeof tree !== 'object') return [];
  return Object.entries(tree).flatMap(([k, v]) => texts(v, prefix ? `${prefix}.${k}` : k));
}

// ------------------------------------------------------------------ invented social proof

/** Invented downloads, ratings, ranks, likes, laurels and award badges. App copy must never say these. */
const SOCIAL_PROOF: readonly RegExp[] = [
  /laurel/i,
  /\b\d[\d,.]*\s*[km]?\+?\s*(downloads?|installs?|users|people|ratings?|reviews?|likes?|hearts?|fans|members)\b/i,
  /\b(millions?|thousands?) of (users|people|fans|downloads)\b/i,
  /#\s?1\b/,
  /\bno\.\s?1\b/i,
  /\bnumber one\b/i,
  /\btop[- ](rated|ranked|charts?|grossing|\d+)\b/i,
  /\branked\b|\branking\b|\brank #/i,
  /\bbest[- ]?sell(er|ing)\b/i,
  /\beditor['’]?s?['’]? (choice|pick)\b/i,
  /\bapp of the (day|week|year)\b/i,
  /\b\d(\.\d)?\s*(★|stars?\b)/i,
  /★{3,}/,
  /\bmost (popular|downloaded|loved)\b/i,
  /\btrending(?![-\w])/i,
  /\bloved by\b/i,
  /\baward[- ]winning\b/i,
  /\bas seen (in|on)\b/i,
];

const proofHits = (s: string): RegExp[] => SOCIAL_PROOF.filter((r) => r.test(s));

test('the social-proof patterns catch invented claims and leave honest copy alone', () => {
  const bad = [
    'Join 2M+ users', '10,000 downloads', '4.8 stars', '4.9 ★', '#1 icon app', 'Top rated', 'Top 10 in Lifestyle',
    'Editor’s Choice', 'App of the Day', 'Ranked first', 'Best-selling themes', 'Loved by millions', 'Trending now',
    'Award-winning design', '1.2k likes', 'Most popular', 'laurel wreath', 'Millions of users',
  ];
  for (const s of bad) assert.ok(proofHits(s).length > 0, `should reject: ${s}`);
  const ok = [
    'One-time A$2.99. No subscription, ever.', '32 more themes in 4 packs', 'Make-your-own icons, unlimited',
    'trending-up', 'Rate Glaze', 'Star', '8 icons', 'Top of the screen', 'Award', 'Your 3 loops',
  ];
  for (const s of ok) assert.deepEqual(proofHits(s), [], `should allow: ${s}`);
});

test('no English catalogue string invents downloads, ratings, ranks, likes, laurels or badges', () => {
  for (const [key, s] of texts(en)) assert.deepEqual(proofHits(s), [], `${key}: "${s}"`);
});

test('no string literal in app/ or src/ invents downloads, ratings, ranks, likes, laurels or badges', () => {
  const files = [...walk(join(root, 'app')), ...walk(join(root, 'src'))];
  assert.ok(files.length > 0);
  const lit = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  for (const f of files) {
    const src = read(f.slice(root.length + 1));
    for (const m of src.matchAll(lit)) {
      const s = m[1] ?? m[2] ?? m[3] ?? '';
      assert.deepEqual(proofHits(s), [], `${f}: "${s}"`);
    }
    // JSX text between tags.
    for (const m of src.matchAll(/>([^<>{}\n]+)</g)) assert.deepEqual(proofHits(m[1]), [], `${f}: "${m[1]}"`);
  }
});

// ------------------------------------------------------------------ pricing copy

test('1.0.41: Plus copy states the yearly price and how to cancel, in English and every locale', () => {
  const price = en.plus.lock.price;
  assert.match(price, /a year/i);
  assert.match(price, /cancel anytime in Settings/i);
  assert.ok(price.includes('{price}'));
  assert.match(en.plus.lock.renewal, /renews automatically every year at \{price\}/);
  assert.match(en.plus.lock.renewal, /24 hours/);
  assert.match(en.plus.lock.renewal, /No free trial/);
  for (const [locale, cat] of Object.entries(TRANSLATIONS)) {
    const lock = (cat as { plus?: { lock?: Record<string, unknown> } }).plus?.lock ?? {};
    for (const k of ['price', 'renewal', 'unlockBuy']) {
      assert.equal(typeof lock[k], 'string', `${locale} plus.lock.${k}`);
      assert.ok((lock[k] as string).includes('{price}'), `${locale} plus.lock.${k} keeps {price}`);
    }
    for (const k of ['terms', 'privacy']) assert.equal(typeof lock[k], 'string', `${locale} plus.lock.${k}`);
  }
  // 1.0.42: the price is StoreKit's only; no hard-coded price constant or hint.
  const ent = read('src', 'plus', 'entitlement.ts');
  assert.doesNotMatch(ent, /PLUS_PRICE_HINT|export const PLUS_PRICE\b/);
});

test('1.0.41: one yearly plan only; no weekly or monthly plan, free trial offer, special or limited-time offer', () => {
  const plans = /\b(weekly|monthly|per (week|month)|a (week|month)|\/\s?(wk|week|mo|month))\b|special offer|limited[- ]time|start (your|a) free trial|try (it )?free for/i;
  for (const [key, s] of texts(en)) assert.ok(!plans.test(s), `${key}: "${s}"`);
  // The App Store product is the one yearly subscription, with no introductory offer.
  const doc = read('store', 'SUBSCRIPTION.md');
  assert.match(doc, /\| Product ID \| `com\.jared797\.glaze\.yearly`/);
  assert.match(doc, /\| Subscription Duration \| 1 Year \|/);
  assert.match(doc, /\| Introductory Offers \| \*\*None\.\*\*/);
});

// ------------------------------------------------------------------ sheet behaviour

test('the Plus sheet has a large labelled close that sits outside the scrolling body', () => {
  const sheet = read('src', 'ui', 'Sheet.tsx');
  assert.match(sheet, /closeLabel\?: string/);
  const header = sheet.indexOf('styles.header');
  const scroll = sheet.indexOf('<ScrollView');
  const labelled = sheet.indexOf('label={closeLabel}');
  assert.ok(header > 0 && labelled > header && labelled < scroll, 'labelled close renders in the header, above the ScrollView');
  const lock = read('src', 'plus', 'PlusLockSheet.tsx');
  assert.match(lock, /<Sheet[^>]*closeLabel=\{t\('plus\.lock\.close'\)\}/s);
  // Backdrop tap and the system back gesture also close it.
  assert.match(sheet, /onRequestClose=\{onClose\}/);
  assert.match(sheet, /styles\.backdrop[\s\S]*?onPress=\{onClose\}|onPress=\{onClose\}[\s\S]*?styles\.backdrop/);
});

test('Restore purchases is always visible: in the Plus sheet and in Settings, never hidden', () => {
  const restore = read('src', 'plus', 'RestorePurchases.tsx');
  assert.match(restore, /restore\(\)/);
  assert.ok(!/return null/.test(restore), 'RestorePurchases never renders nothing');
  assert.match(restore, /t\('plus\.lock\.restore'\)/);
  const lock = read('src', 'plus', 'PlusLockSheet.tsx');
  assert.match(lock, /<RestorePurchases\b/);
  // Not behind a condition in the sheet.
  assert.ok(!/[?&]\s*\(?\s*<RestorePurchases/.test(lock), 'Restore purchases is unconditional in the sheet');
  const settings = read('app', '(tabs)', 'settings.tsx');
  assert.match(settings, /<RestorePurchases\b/);
  assert.ok(!/[?&]\s*\(?\s*<RestorePurchases/.test(settings), 'Restore purchases is unconditional in Settings');
});

test('no launch paywall: the Plus sheet only opens from a tap, never on mount', () => {
  const launch = ['_layout.tsx', 'index.tsx', join('(tabs)', '_layout.tsx')].map((p) => join('app', p)).filter((p) => existsSync(join(root, p)));
  assert.ok(launch.length > 0);
  for (const p of launch) assert.ok(!/plus\/PlusLockSheet/.test(read(p)), `${p} must not show the Plus sheet`);

  const files = [...walk(join(root, 'app')), ...walk(join(root, 'src'))];
  let uses = 0;
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/<PlusLockSheet\b([^>]*?)\/?>/gs)) {
      uses++;
      const vis = /visible=\{\s*([A-Za-z_$][\w$]*)\s*\}/.exec(m[1]);
      assert.ok(vis, `${f}: PlusLockSheet visible must be a state variable`);
      const name = vis[1];
      const init = new RegExp(`const \\[${name}, set\\w+\\] = useState(?:<[^>]*>)?\\(false\\)`);
      assert.match(src, init, `${f}: ${name} starts closed`);
      // Opened only from a handler, never straight from an effect on mount.
      const setter = `set${name[0].toUpperCase()}${name.slice(1)}`;
      assert.ok(!new RegExp(`useEffect\\(\\(\\) => \\{?\\s*${setter}\\(true\\)`).test(src), `${f}: ${setter}(true) on mount`);
    }
  }
  assert.ok(uses >= 2, 'expected PlusLockSheet uses');
  // The sheet itself never offers a timed or auto-opening paywall.
  const lock = read('src', 'plus', 'PlusLockSheet.tsx');
  assert.ok(!/setTimeout|setInterval/.test(lock));
});

// ------------------------------------------------------------------ badges and free content

test('every Plus theme card shows the Plus badge before tapping; the free ten say Premium · Free', () => {
  for (const t of PLUS_THEMES) assert.equal(t.plus, true, t.id);
  const gallery = read('app', '(tabs)', 'themes.tsx');
  assert.match(gallery, /const plus = shared\.showTiers && theme\.plus === true;/);
  assert.match(gallery, /const free = shared\.showTiers && isFreeTheme\(theme\.id\);/);
  assert.match(gallery, /const badge = plus \? PLUS_BADGE : free \? FREE_BADGE : undefined;/);
  assert.match(gallery, /showTiers: !subscribed/);
  const detail = read('app', 'theme', '[id].tsx');
  assert.match(detail, /theme\.plus \? <PlusBadge \/> : null/);
});

test('free items are fully free: no Plus parts inside a free theme', () => {
  const plusGlyphSets = new Set(GLYPH_SETS.filter((s) => s.plus).map((s) => s.id));
  for (const t of THEMES) {
    assert.equal(t.plus, false, t.id);
    assert.equal(t.packId, undefined, `${t.id} is free, so it is not in a Plus pack`);
    assert.ok(!plusGlyphSets.has(t.iconStyle.glyphSet), `${t.id} uses a Plus glyph set`);
  }
  // The sheet lists what stays free, including the three promises in ops/CONVENTIONS.md.
  const lock = read('src', 'plus', 'PlusLockSheet.tsx');
  for (const k of ['plus.lock.freeIcons', 'plus.lock.freeInstall', 'plus.lock.freeLive']) assert.ok(lock.includes(`'${k}'`), k);
});

test('the Plus badge is visible (not hidden) and reads Plus', () => {
  const badge = read('src', 'plus', 'PlusBadge.tsx');
  assert.match(badge, /const PLUS_LABEL = 'Plus'/);
  assert.ok(!/opacity:\s*0[,\s}]/.test(badge));
});
