// Guards for the store listing and the hosted pages (T57 privacy/support, T58 docs/STORE.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const docs = (f: string) => join(root, 'docs', f);
const COMPETITORS = /AR Drawing|Artrace|PicTrace|SketchAR/i;

type Field = { title: string; limit: number; stated: string; text: string };

/** Every "### Title (≤N) [count]" heading followed by a ```text block. */
function limitedFields(md: string): Field[] {
  const re = /^### (.+?) \(≤(\d+)\) \[(\w+)\]\n(?:(?!###)[^\n]*\n)*?```text\n([\s\S]*?)\n```/gm;
  const out: Field[] = [];
  for (const m of md.matchAll(re)) out.push({ title: m[1], limit: Number(m[2]), stated: m[3], text: m[4] });
  return out;
}

const chars = (s: string) => [...s].length;

test('T58: docs/STORE.md exists and names no competitor', () => {
  assert.ok(existsSync(docs('STORE.md')), 'docs/STORE.md missing');
  const md = readFileSync(docs('STORE.md'), 'utf8');
  assert.doesNotMatch(md, COMPETITORS);
  // "Best match" is the name of an outline style in the app; ranking claims are not allowed.
  assert.doesNotMatch(md, /#1\b|\bthe best\b|\bbest (app|tracing|drawing)|\bnumber one\b|\btop[- ]rated\b/i, 'no "best" / "#1" claims');
});

test('T58: every limited field fits its limit and its stated character count is exact', () => {
  const md = readFileSync(docs('STORE.md'), 'utf8');
  const fields = limitedFields(md);
  const titles = fields.map((f) => f.title);
  for (const t of ['App name', 'Subtitle', 'Promotional text', 'Keywords', 'Description', 'Short description']) {
    assert.ok(titles.includes(t), `${t} block missing`);
  }
  for (const f of fields) {
    const n = chars(f.text);
    assert.ok(n <= f.limit, `${f.title}: ${n} > ${f.limit}`);
    assert.equal(f.stated, String(n), `${f.title}: stated [${f.stated}] but counted ${n}`);
  }
});

test('T58: keywords are comma separated with no spaces and no words from the name or subtitle', () => {
  const fields = limitedFields(readFileSync(docs('STORE.md'), 'utf8'));
  const get = (t: string) => fields.find((f) => f.title === t)!.text;
  const kw = get('Keywords');
  assert.doesNotMatch(kw, /,\s|\s,/);
  const used = new Set(`${get('App name')} ${get('Subtitle')}`.toLowerCase().match(/[a-z]+/g));
  for (const w of kw.toLowerCase().split(',')) {
    assert.ok(w.length > 0, 'empty keyword');
    assert.ok(!used.has(w), `keyword "${w}" already in name/subtitle`);
  }
});

// Owner 24 Oct 2026 asked for the 2-word "Made for…" headline on shot 2, so 2 words is allowed.
test('T58: screenshot headlines are 2–5 words, 6–8 shots', () => {
  const md = readFileSync(docs('STORE.md'), 'utf8');
  const rows = [...md.matchAll(/^\| (\d) \| \*\*(.+?)\*\* \|/gm)].map((m) => m[2]);
  assert.ok(rows.length >= 6 && rows.length <= 8, `${rows.length} shots`);
  for (const h of rows) {
    const words = h.split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 2 && words <= 5, `"${h}" has ${words} words`);
  }
});

test('T57: privacy page says Data Not Collected; privacy and support pages are self-contained', () => {
  const privacy = readFileSync(docs('privacy.html'), 'utf8');
  assert.match(privacy, /Data Not Collected/);
  assert.match(privacy, /18 October 2026/);
  for (const f of ['privacy.html', 'support.html']) {
    const html = readFileSync(docs(f), 'utf8');
    assert.doesNotMatch(html, COMPETITORS);
    assert.doesNotMatch(html, /<script|<link|src=|https?:\/\//i, `${f} loads no external resources`);
    assert.match(html, /prefers-color-scheme: dark/);
    assert.match(html, /jaredbradley272@gmail\.com/, `${f} shows the support email (owner 22 Oct 2026)`);
  }
});
