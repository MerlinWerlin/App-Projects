// T283: the Little Line widget (targets/widget/QuoteWidget.swift) shows one ORIGINAL line a day.
// The lines live only in Swift; no Xcode here, so this source guard is what pins them: enough
// lines, unique, short, no attributions or famous quotes, a day-based pick (DayProvider, not the
// old hourly provider) and the index formula mirrored below.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SWIFT = readFileSync(join(process.cwd(), 'targets/widget/QuoteWidget.swift'), 'utf8');

function lines(): string[] {
  const m = /static let all: \[String\] = \[([\s\S]*?)\n {2}\]/.exec(SWIFT);
  assert.ok(m, 'GlazeLines.all not found');
  const out: string[] = [];
  for (const l of m[1].split('\n')) {
    const t = l.trim();
    if (!t) continue;
    const q = /^"((?:[^"\\]|\\.)*)",$/.exec(t);
    assert.ok(q, `unexpected line in GlazeLines.all: ${t}`);
    out.push(q[1]);
  }
  return out;
}

/** Mirrors GlazeLines.index(year:dayOfYear:count:). */
function dailyLineIndex(year: number, dayOfYear: number, count: number): number {
  if (count <= 0) return 0;
  const raw = (year * 7 + dayOfYear - 1) % count;
  return raw < 0 ? raw + count : raw;
}

test('at least 60 lines, unique, short, plain', () => {
  const all = lines();
  assert.ok(all.length >= 60, `only ${all.length} lines`);
  assert.equal(new Set(all.map((s) => s.toLowerCase())).size, all.length, 'duplicate line');
  for (const s of all) {
    assert.ok(s.length >= 8 && s.length <= 60, `length ${s.length}: ${s}`);
    assert.doesNotMatch(s, /\\/, `escape in ${s}`);
  }
});

test('lines are original: no attributions, quote marks or well-known sayings', () => {
  const famous = [
    /journey of a thousand miles/i,
    /this too shall pass/i,
    /one day at a time/i,
    /be the change/i,
    /carpe diem/i,
    /keep calm/i,
    /what doesn.t kill/i,
    /stay hungry/i,
    /live,? laugh,? love/i,
    /the only way out is through/i,
    /less is more/i,
    /rome wasn.t built/i,
    /every cloud has/i,
    /follow your (heart|dreams)/i,
    /you miss 100%/i,
  ];
  for (const s of lines()) {
    assert.doesNotMatch(s, /\s[—–-]\s*[A-Z]|~|“|”|\bsaid\b|\bquote\b/i, `looks attributed: ${s}`);
    for (const f of famous) assert.doesNotMatch(s, f, `well-known saying: ${s}`);
  }
  assert.match(SWIFT, /original to Glaze/);
});

test('the pick is daily and deterministic by local day of the year', () => {
  assert.match(SWIFT, /provider: DayProvider\((sample: \d+)?\)/);
  assert.doesNotMatch(SWIFT, /HourProvider|\.hour\b/);
  assert.match(SWIFT, /ordinality\(of: \.day, in: \.year, for: date\)/);
  assert.match(SWIFT, /let raw = \(year \* 7 \+ dayOfYear - 1\) % count/);
  assert.match(SWIFT, /changes every day\./);
  const providers = readFileSync(join(process.cwd(), 'targets/widget/Providers.swift'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.match(providers, /struct HourProvider/); // kept for the Moon widget (T277)
});

test('every line is reached within a year and consecutive days differ', () => {
  const n = lines().length;
  const seen = new Set<number>();
  for (let d = 1; d <= 365; d++) {
    const i = dailyLineIndex(2026, d, n);
    assert.ok(i >= 0 && i < n);
    seen.add(i);
    if (d > 1) assert.notEqual(i, dailyLineIndex(2026, d - 1, n));
  }
  assert.equal(seen.size, n);
  // Same date, next year: a different line.
  assert.notEqual(dailyLineIndex(2026, 100, n), dailyLineIndex(2027, 100, n));
  assert.equal(dailyLineIndex(2026, 1, 0), 0);
});

test('Little Line keeps theme colours and typeface in every size, never the theme name', () => {
  const code = SWIFT.replace(/\/\/.*$/gm, '');
  assert.match(code, /\.containerBackground\(for: \.widget\) \{ GlazeBackground\(theme: t\) \}/);
  assert.match(code, /t\.typeface\(size: textSize/);
  assert.match(code, /t\.accentColor/);
  assert.match(code, /t\.inkColor/);
  assert.match(code, /\.supportedFamilies\(\[\.systemSmall, \.systemMedium, \.systemLarge\]\)/);
  assert.doesNotMatch(code, /\bt\.name\b|theme\.name\b/);
});
