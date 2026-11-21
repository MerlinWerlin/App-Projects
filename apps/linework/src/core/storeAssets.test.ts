// Store screenshot set (store/README.md). From 1.0.4 every phone screen is a real capture of the app
// (store/capture/), framed by store/src/build.py. Checks sizes, captions in every app locale, that each shot has its
// capture, and listing rules (no other apps' names, no ranking claims, no store badges) across store/ text files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STORE = join(ROOT, 'store');
const LOCALES = ['en', 'ar', 'de', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'pt-BR', 'zh-Hans'];

type Captions = {
  locales: string[];
  localeInfo: Record<string, { status: string; dir: string; mirroring?: string }>;
  shots: { id: string; headline: Record<string, string>; subtitle: Record<string, string> }[];
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const shots = (dir: string) => readdirSync(join(STORE, 'jpg', dir)).filter((f) => f.endsWith('.jpg')).sort();

/** [width, height] of a baseline or progressive JPEG. */
function jpegSize(buf: Buffer): [number, number] | null {
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xc0 || marker === 0xc2) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return null;
}

/** [width, height] of a PNG (IHDR). */
const pngSize = (buf: Buffer): [number, number] => [buf.readUInt32BE(16), buf.readUInt32BE(20)];

test('8 shots in each size, the same names in both', () => {
  assert.equal(shots('a').length, 8);
  assert.deepEqual(shots('a-6.5'), shots('a'));
});

test('captions cover every shot in all 11 locales', () => {
  const c = JSON.parse(readFileSync(join(STORE, 'captions.json'), 'utf8')) as Captions;
  assert.deepEqual([...c.locales].sort(), [...LOCALES].sort());
  assert.deepEqual(c.shots.map((s) => `${s.id}.jpg`), shots('a'));
  for (const s of c.shots) {
    for (const l of LOCALES) {
      assert.ok(s.headline[l]?.trim(), `${s.id} headline ${l}`);
      assert.ok(s.subtitle[l]?.trim(), `${s.id} subtitle ${l}`);
      assert.ok(s.headline[l].length <= 40, `${s.id} headline ${l} is short`);
    }
  }
  for (const l of LOCALES) assert.equal(c.localeInfo[l].status, l === 'en' ? 'source' : 'machine', l);
  assert.equal(c.localeInfo.ar.dir, 'rtl');
});

test('renders are exactly 1320x2868 and 1284x2778 and the set stays small', () => {
  let total = 0;
  const SIZES: Record<string, [number, number]> = { a: [1320, 2868], 'a-6.5': [1284, 2778] };
  for (const style of Object.keys(SIZES)) {
    for (const f of shots(style)) {
      const buf = readFileSync(join(STORE, 'jpg', style, f));
      total += buf.length;
      assert.equal(buf[0], 0xff, `${f} is a JPEG`);
      assert.deepEqual(jpegSize(buf), SIZES[style], `${style}/${f} size`);
    }
  }
  const sheet = join(STORE, 'contact-sheet.png');
  if (existsSync(sheet)) assert.ok(statSync(sheet).size <= 600 * 1024, 'contact sheet <= 600 KB');
  assert.ok(total < 8 * 1024 * 1024, `renders total ${total} bytes`);
});

test('every shot is built from a real capture of the app (2.3.3)', () => {
  const build = readFileSync(join(STORE, 'src', 'build.py'), 'utf8');
  const captures = [...build.matchAll(/\('(\d\d-[a-z-]+)', '([a-z-]+)', (?:LIGHT|DARK)\)/g)];
  assert.deepEqual(captures.map((m) => `${m[1]}.jpg`), shots('a'));
  for (const [, , cap] of captures) {
    const p = join(STORE, 'capture', 'shots', `${cap}.png`);
    assert.ok(existsSync(p), `capture ${cap}.png`);
    assert.deepEqual(pngSize(readFileSync(p)), [1320, 2868], `${cap}.png is a full Pro Max screen`);
  }
  assert.ok(!existsSync(join(STORE, 'svg')), 'the drawn mockups are gone');
  assert.match(readFileSync(join(STORE, 'README.md'), 'utf8'), /real capture/i);
});

test('the listing uploads this set', () => {
  const listing = JSON.parse(readFileSync(join(STORE, 'listing.json'), 'utf8'));
  assert.equal(listing.screenshots.APP_IPHONE_67, 'apps/linework/store/jpg/a');
  for (const iap of listing.inAppPurchases) assert.ok(existsSync(join(ROOT, '..', '..', iap.reviewScreenshot)), iap.productId);
});

test('no other apps, ranking claims or store badges in store/', () => {
  const banned: [RegExp, string][] = [
    [/AR\s*Drawing/i, 'competitor'], [/Artrace/i, 'competitor'], [/PicTrace/i, 'competitor'], [/Sketch\s*AR/i, 'competitor'],
    [/#\s*1\b/, 'ranking'], [/\bno\.\s*1\b/i, 'ranking'], [/number one/i, 'ranking'], [/top[- ]rated/i, 'ranking'],
    [/best[- ]?sell/i, 'ranking'], [/\branked\b/i, 'ranking'], [/\bdownload/i, 'badge'], [/App\s*Store/i, 'badge'],
    [/Google\s*Play/i, 'badge'], [/get it on/i, 'badge'], [/editor'?s choice/i, 'ranking'],
  ];
  const text = walk(STORE).filter((p) => ['.svg', '.json', '.md', '.mjs', '.py', '.yaml'].includes(extname(p)));
  assert.ok(text.length > 8);
  for (const p of text) {
    const body = readFileSync(p, 'utf8');
    // Platform names in channel metadata/provenance are not graphic badges. Keep the badge ban on the captions
    // drawn into the shots; competitor and ranking checks still cover every text file.
    const promoSource = p === join(STORE, 'captions.json');
    for (const [re, kind] of banned) {
      if (kind === 'badge' && !promoSource) continue;
      assert.ok(!re.test(body), `${kind} ${re} in ${p.slice(ROOT.length + 1)}`);
    }
  }
});
