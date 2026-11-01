// T158: store listing checker. Reads docs/STORE.md, pulls out every paste-ready field (table rows with a
// "n / limit" column, and the fenced block under each "### ... (N limit)" heading) and checks it against its
// store limit, the keyword rules and the banned-claims list. Used by src/core/storelimits.test.ts (npm test).
// Usage: node tools/store/limits.mjs [path/to/STORE.md]   (prints each field with its count; exit 1 on a problem)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Characters as the stores count them (code points, so "→" or "é" is one). */
export const chars = (s) => [...s].length;

/** Every field the listing must have, with the store's limit. */
export const REQUIRED = {
  'ios:Name': 30,
  'ios:Subtitle': 30,
  'ios:Keywords': 100,
  'ios:Promotional text': 170,
  'ios:Description': 4000,
  "ios:What's New in 0.1.0": 4000,
  'play:App name': 30,
  'play:Short description': 80,
  'play:Full description': 4000,
};

/** Competitor, travel-app, map, airline, ride and phone-maker names: none of them belong in store copy. */
export const BRANDS =
  /\b(tripit|wanderlog|tripadvisor|lonely planet|rick steves|culture trip|rome2rio|google|apple|iphone|ipad|android|samsung|pixel|maps\.me|citymapper|moovit|waze|airbnb|booking\.com|expedia|kayak|skyscanner|hopper|uber|lyft|grab|didi|bolt|wise|revolut|polarsteps|tripcase|sygic|organic maps|here we ?go|mapbox|protomaps|openai|chatgpt|qantas|emirates|ryanair|easyjet|eurostar|amtrak|jr pass|whatsapp|facetime|instagram|tiktok|wikipedia|wikitravel)\b/i;

/** Claims the copy must never make (Starter Standard §3, marketing claims_to_avoid, T158 brief). */
export const BANNED_CLAIMS = [
  { name: 'battery-life number', re: /battery[^.\n]*\d|\d[^.\n]*battery/i },
  { name: 'battery-life promise', re: /\b(save|saves|saving|extend|extends|longer)\b[^.\n]*battery life/i },
  { name: 'works-on-your-phone claim', re: /\b(works|tested|runs) (great |perfectly |reliably )?on (your|any|every) (phone|device)\b/i },
  { name: 'guarantee', re: /\bguarantee[ds]?\b|\b100 ?%|\bcertified\b|\balways (accurate|correct|up to date)\b/i },
  { name: 'medical or legal advice', re: /\b(medical|legal) advice\b|\bdiagnos|\bcures?\b|\bprescri/i },
  { name: 'official emergency numbers', re: /\bofficial (emergency )?numbers?\b/i },
  { name: 'offline maps (not live yet)', re: /\boffline (city )?maps?\b|\bcity maps?\b|\bmap packs?\b|\bdownload(ed|s)? (a |your |the )?(cit(y|ies)|maps?)\b/i },
  { name: 'Satchel Plus (only unlocks offline cities, not live yet)', re: /\bsatchel plus\b|\bin-app purchase\b|\bupgrade\b|\bpremium\b/i },
  { name: 'unbuilt sync or widgets', re: /\b(icloud|cloud sync|sync(s|ed)? across|widgets?|lock screen)\b/i },
  { name: 'ads wording other than "no ads"', re: /(?<!\bno )\bads\b/i },
];

/** Where an emergency number is mentioned, the same field must say to verify it locally. */
export const EMERGENCY_NUMBERS = /\bemergency numbers?\b/i;
export const VERIFY_LOCALLY = /\bverify (them |it )?locally\b/i;

/**
 * Pull the paste-ready fields out of STORE.md. Only the "## App Store" and "## Google Play" sections are read:
 * notes, rejected drafts and "Add when shipped" are not copy and are skipped.
 * @param {string} md
 * @returns {{ store: 'ios' | 'play', field: string, text: string, limit: number, stated?: number }[]}
 */
export function parseStore(md) {
  const out = [];
  const lines = md.split(/\r?\n/);
  let store = null;
  let pending = null; // { field, limit } waiting for its fenced block
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2 && !line.startsWith('###')) {
      store = /^App Store/i.test(h2[1]) ? 'ios' : /^Google Play/i.test(h2[1]) ? 'play' : null;
      pending = null;
      continue;
    }
    if (!store) continue;
    const h3 = /^###\s+(.+?)\s*\((\d[\d,]*) limit\)\s*$/.exec(line);
    if (h3) {
      pending = { field: h3[1].trim(), limit: Number(h3[2].replace(/,/g, '')) };
      continue;
    }
    if (/^#{3,}\s/.test(line)) {
      pending = null;
      continue;
    }
    if (pending && /^```/.test(line)) {
      const body = [];
      for (i++; i < lines.length && !/^```\s*$/.test(lines[i]); i++) body.push(lines[i]);
      out.push({ store, field: pending.field, text: body.join('\n'), limit: pending.limit });
      pending = null;
      continue;
    }
    const row = /^\|([^|]+)\|([^|]+)\|\s*(\d[\d,]*)\s*\/\s*(\d[\d,]*)\s*\|\s*$/.exec(line);
    if (row) {
      const text = row[2].trim().replace(/^`(.*)`$/, '$1');
      out.push({ store, field: row[1].trim(), text, limit: Number(row[4].replace(/,/g, '')), stated: Number(row[3].replace(/,/g, '')) });
    }
  }
  return out;
}

/** Words Apple already indexes from the name and subtitle (lower case, singular and plural both). */
export function indexedWords(name, subtitle) {
  const words = `${name} ${subtitle}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  const set = new Set();
  for (const w of words) {
    set.add(w);
    set.add(w.endsWith('s') ? w.slice(0, -1) : `${w}s`);
  }
  return set;
}

/**
 * Every problem with the listing, as readable strings (empty when the listing is fine).
 * @param {ReturnType<typeof parseStore>} fields
 */
export function storeProblems(fields) {
  const problems = [];
  const byKey = new Map(fields.map((f) => [`${f.store}:${f.field}`, f]));
  for (const [key, limit] of Object.entries(REQUIRED)) {
    const f = byKey.get(key);
    if (!f) problems.push(`${key}: missing`);
    else if (f.limit !== limit) problems.push(`${key}: limit written as ${f.limit}, the store's is ${limit}`);
  }
  for (const f of fields) {
    const key = `${f.store}:${f.field}`;
    const n = chars(f.text);
    if (!f.text.trim()) problems.push(`${key}: empty`);
    if (n > f.limit) problems.push(`${key}: ${n} characters, limit ${f.limit}`);
    if (f.stated !== undefined && f.stated !== n) problems.push(`${key}: table says ${f.stated} characters, text has ${n}`);
    if (f.text !== f.text.trim() && f.field !== 'Description') problems.push(`${key}: leading or trailing space`);
    const brand = BRANDS.exec(f.text);
    if (brand) problems.push(`${key}: brand or competitor name "${brand[0]}"`);
    for (const b of BANNED_CLAIMS) {
      const m = b.re.exec(f.text);
      if (m) problems.push(`${key}: ${b.name} ("${m[0]}")`);
    }
    if (EMERGENCY_NUMBERS.test(f.text) && !VERIFY_LOCALLY.test(f.text)) problems.push(`${key}: mentions emergency numbers without "verify locally"`);
  }
  const kw = byKey.get('ios:Keywords');
  const name = byKey.get('ios:Name');
  const sub = byKey.get('ios:Subtitle');
  if (kw) {
    if (/\s/.test(kw.text)) problems.push('ios:Keywords: contains a space or line break');
    const words = kw.text.split(',');
    if (words.some((w) => !w)) problems.push('ios:Keywords: empty entry (double or trailing comma)');
    const seen = new Set();
    for (const w of words.map((x) => x.trim().toLowerCase())) {
      if (seen.has(w)) problems.push(`ios:Keywords: "${w}" twice`);
      seen.add(w);
    }
    if (name && sub) {
      const indexed = indexedWords(name.text, sub.text);
      for (const w of seen) if (indexed.has(w)) problems.push(`ios:Keywords: "${w}" is already in the name or subtitle`);
    }
  }
  return problems;
}

/** Screenshot captions listed in STORE.md ("1. **Caption** — note"), in order. */
export function storeCaptions(md) {
  return [...md.matchAll(/^\d+\.\s+\*\*(.+?)\*\*/gm)].map((m) => m[1]);
}

/** Captions in the shot table of docs/SCREENSHOTS.md (last column), in order. */
export function screenshotCaptions(md) {
  const out = [];
  for (const line of md.split(/\r?\n/)) {
    const m = /^\|\s*(\d+)\s*\|.*\|\s*([^|]+?)\s*\|\s*$/.exec(line);
    if (m) out.push(m[2]);
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = process.argv[2] ?? new URL('../../docs/STORE.md', import.meta.url);
  const fields = parseStore(readFileSync(path, 'utf8'));
  for (const f of fields) console.log(`${f.store.padEnd(4)} ${f.field.padEnd(24)} ${String(chars(f.text)).padStart(5)} / ${f.limit}`);
  const problems = storeProblems(fields);
  for (const p of problems) console.error(`PROBLEM ${p}`);
  process.exit(problems.length ? 1 : 0);
}
