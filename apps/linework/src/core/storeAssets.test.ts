// T77: store screenshot set (store/). Checks sizes, captions in every app locale, and listing rules
// (no other apps' names, no ranking claims, no store badges) across every text file in store/.
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
const svgs = (style: string) => readdirSync(join(STORE, 'svg', style)).filter((f) => f.endsWith('.svg')).sort();

// v2 (owner 24 Oct 2026): one pastel style (a); renders for the 6.9" and 6.5" iPhone slots; no hands anywhere.
test('style a has 8 shots at 1320x2868', () => {
  for (const style of ['a']) {
    const files = svgs(style);
    assert.ok(files.length >= 6, `style ${style} has ${files.length} shots`);
    for (const f of files) {
      const head = readFileSync(join(STORE, 'svg', style, f), 'utf8').slice(0, 400);
      assert.match(head, /<svg[^>]*\swidth="1320"/, `${style}/${f} width`);
      assert.match(head, /<svg[^>]*\sheight="2868"/, `${style}/${f} height`);
      assert.match(head, /viewBox="0 0 1320 2868"/, `${style}/${f} viewBox`);
    }
  }
  assert.equal(svgs('a').length, 8);
  assert.ok(!existsSync(join(STORE, 'svg', 'b')), 'style b was dropped');
});

test('captions cover every shot in all 11 locales', () => {
  const c = JSON.parse(readFileSync(join(STORE, 'captions.json'), 'utf8')) as Captions;
  assert.deepEqual([...c.locales].sort(), [...LOCALES].sort());
  const ids = svgs('a').map((f) => f.replace(/\.svg$/, ''));
  assert.deepEqual(c.shots.map((s) => s.id).sort(), ids);
  for (const s of c.shots) {
    for (const l of LOCALES) {
      assert.ok(s.headline[l]?.trim(), `${s.id} headline ${l}`);
      assert.ok(s.subtitle[l]?.trim(), `${s.id} subtitle ${l}`);
      assert.ok(s.headline[l].length <= 40, `${s.id} headline ${l} is short`);
    }
  }
  for (const l of LOCALES) assert.equal(c.localeInfo[l].status, l === 'en' ? 'source' : 'machine', l);
  assert.equal(c.localeInfo.ar.dir, 'rtl');
  assert.ok(c.localeInfo.ar.mirroring && c.localeInfo.ar.mirroring.length > 20, 'Arabic mirroring note');
});

test('renders, when present, are exactly 1320x2868 and the set stays small', () => {
  let total = 0;
  const SIZES: Record<string, [number, number]> = { a: [1320, 2868], 'a-6.5': [1284, 2778] };
  for (const style of Object.keys(SIZES)) {
    const dir = join(STORE, 'jpg', style);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      const buf = readFileSync(join(dir, f));
      total += buf.length;
      assert.equal(buf[0], 0xff, `${f} is a JPEG`);
      // Find the SOF0/SOF2 marker and read height then width.
      let i = 2, size: [number, number] | null = null;
      while (i < buf.length) {
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        if (marker === 0xc0 || marker === 0xc2) { size = [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]; break; }
        i += 2 + len;
      }
      assert.deepEqual(size, SIZES[style], `${style}/${f} size`);
    }
  }
  const sheet = join(STORE, 'contact-sheet.png');
  if (existsSync(sheet)) assert.ok(statSync(sheet).size <= 600 * 1024, 'contact sheet <= 600 KB');
  assert.ok(total < 8 * 1024 * 1024, `renders total ${total} bytes`);
});

test('no other apps, ranking claims or store badges in store/', () => {
  const banned: [RegExp, string][] = [
    [/AR\s*Drawing/i, 'competitor'], [/Artrace/i, 'competitor'], [/PicTrace/i, 'competitor'], [/Sketch\s*AR/i, 'competitor'],
    [/#\s*1\b/, 'ranking'], [/\bno\.\s*1\b/i, 'ranking'], [/number one/i, 'ranking'], [/top[- ]rated/i, 'ranking'],
    [/best[- ]?sell/i, 'ranking'], [/\branked\b/i, 'ranking'], [/\bdownload/i, 'badge'], [/App\s*Store/i, 'badge'],
    [/Google\s*Play/i, 'badge'], [/get it on/i, 'badge'], [/editor'?s choice/i, 'ranking'],
  ];
  const text = walk(STORE).filter((p) => ['.svg', '.json', '.md', '.mjs'].includes(extname(p)));
  assert.ok(text.length > 12);
  for (const p of text) {
    const body = readFileSync(p, 'utf8');
    for (const [re, kind] of banned) assert.ok(!re.test(body), `${kind} ${re} in ${p.slice(ROOT.length + 1)}`);
  }
});

test('shots draw no hands, fingers or pencil-holding hands (owner 24 Oct 2026)', () => {
  const build = readFileSync(join(STORE, 'src', 'build.mjs'), 'utf8');
  assert.ok(!/pencilHand|finger\(|function finger/.test(build), 'hand drawing helpers are gone');
  for (const f of svgs('a')) {
    const svg = readFileSync(join(STORE, 'svg', 'a', f), 'utf8');
    for (const c of ['#EDBE9C', '#D79F7B', '#B97F5C', '#F6D7C6']) assert.ok(!svg.includes(c), `${f} uses skin colour ${c}`);
  }
});

test('the phone is an iPhone-style frame (Dynamic Island, no punch-hole camera)', () => {
  for (const f of svgs('a')) {
    const svg = readFileSync(join(STORE, 'svg', 'a', f), 'utf8');
    assert.ok(svg.includes('width="128" height="38" rx="19"'), `${f} has the island`);
    assert.ok(!svg.includes('cx="300" cy="34" r="13"'), `${f} has no punch-hole`);
  }
});

test('every SVG says it is an illustrative mockup', () => {
  for (const style of ['a']) for (const f of svgs(style)) {
    assert.match(readFileSync(join(STORE, 'svg', style, f), 'utf8'), /Illustrative mockup, not a real-device capture/);
  }
});
