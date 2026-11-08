// T159: every internet host the app's own code calls or builds a URL for must be named in docs/privacy.html.
// Scans app/ and src/ (not src/content, whose source links only open in the browser when tapped, and not tests),
// strips comments, and collects the host of every http(s) URL literal. Attribution / licence links and the demo
// sample link are listed below as not runtime calls. A second check pins the set of files that touch the network,
// so a new fetch or download is noticed and the privacy page re-checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Hosts that are never a runtime call the app makes on its own. */
const NOT_RUNTIME = new Set([
  'example.com',
  'example.org',
  'x.invalid', // placeholder in emergency.ts completeness check
  'localhost',
  'www.japan.travel', // demo trip sample idea link: opens in the browser only when tapped
]);

/** Files that hold attribution / licence text: their links open in the browser only when tapped. */
const LINK_ONLY_FILES = new Set(['src/core/licences.ts', 'src/core/fontlicence.ts']);

/** Files that call the network themselves (fetch or a file download). Update docs/privacy.html when this changes. */
const NETWORK_FILES = ['src/native/cityMaps.ts', 'src/native/help.ts', 'src/native/toilets.ts', 'src/native/weather.ts'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(ROOT, p).split('\\').join('/');
    if (rel === 'src/content' || name === 'node_modules') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

/** Code without comments: block comments that start a line, and // comments not part of a URL (scheme:// keeps its colon). */
export function stripComments(src: string): string {
  return src.replace(/^\s*\/\*[\s\S]*?\*\//gm, '').replace(/(^|[^:\w"'`/\\])\/\/.*$/gm, '$1');
}

export function hostsIn(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/\bhttps?:\/\/([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi)) out.push(m[1].toLowerCase());
  return out;
}

const files = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'src'))];
const privacy = readFileSync(join(ROOT, 'docs/privacy.html'), 'utf8').toLowerCase();

test('comment stripping keeps URL literals and drops comment URLs', () => {
  const code = "const a = 'https://api.example.net/x'; // see https://docs.example.net\n/** https://block.example.net */\nconst b = 1;";
  assert.deepEqual(hostsIn(stripComments(code)), ['api.example.net']);
});

test('the scan finds the known runtime hosts (so it is really looking)', () => {
  const found = new Set(files.filter((f) => !LINK_ONLY_FILES.has(f)).flatMap((f) => hostsIn(stripComments(readFileSync(join(ROOT, f), 'utf8')))));
  for (const h of ['api.met.no', 'overpass-api.de', 'github.com', 'maps.apple.com']) assert.ok(found.has(h), `expected ${h} in the code scan`);
});

test('every host the app calls or builds a URL for is named in docs/privacy.html', () => {
  const missing: string[] = [];
  for (const f of files) {
    if (LINK_ONLY_FILES.has(f)) continue;
    for (const h of hostsIn(stripComments(readFileSync(join(ROOT, f), 'utf8')))) {
      if (NOT_RUNTIME.has(h) || h.endsWith('.invalid') || h.endsWith('.example')) continue;
      if (!privacy.includes(h)) missing.push(`${h} (${f})`);
    }
  }
  assert.deepEqual([...new Set(missing)], [], 'add these hosts to docs/privacy.html (what is sent, to whom) or to NOT_RUNTIME with a reason');
});

test('the files that use the network are the known ones (re-check docs/privacy.html when this list changes)', () => {
  const net = files.filter((f) => /\bfetch\(|createDownloadResumable|downloadAsync\(|\bXMLHttpRequest\b|new WebSocket\(/.test(stripComments(readFileSync(join(ROOT, f), 'utf8'))));
  assert.deepEqual(net.sort(), [...NETWORK_FILES].sort());
});
