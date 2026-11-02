import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORD_CLOCK_HOURS, WORD_CLOCK_LEAD, WORD_CLOCK_MINUTES, wordClockPhrase, wordClockSupported } from './wordClock.ts';

const fixture = JSON.parse(readFileSync('src/core/__fixtures__/wordClock.json', 'utf8')) as { hour: number; minute: number; text: string }[];
const swift = readFileSync('targets/widget/WordClock.swift', 'utf8').replace(/\/\/.*$/gm, '');

/** A Swift `static let name: [String] = [...]` array literal, parsed. */
function swiftArray(name: string): string[] {
  const m = swift.match(new RegExp(`static let ${name}: \\[String\\] = \\[([^\\]]*)\\]`));
  assert.ok(m, `WordClock.swift declares ${name}`);
  return [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]);
}

test('fixture phrases (shared with the Swift mirror)', () => {
  assert.ok(fixture.length >= 12);
  for (const { hour, minute, text } of fixture) {
    assert.equal(wordClockPhrase(hour, minute).text, text, `${hour}:${minute}`);
  }
});

test('every minute of the day rounds to the nearest five and names the right hour', () => {
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m++) {
      const p = wordClockPhrase(h, m);
      assert.equal(p.lines[0], WORD_CLOCK_LEAD);
      assert.equal(p.lines.length, 3);
      const total = h * 60 + m;
      const rounded = Math.round(total / 5) * 5; // integers: x.5 never happens below .4/.6 boundaries
      const rm = rounded % 60;
      assert.equal(p.step, rm / 5, `${h}:${m}`);
      const hourShown = Math.floor(rounded / 60) + (rm >= 35 ? 1 : 0);
      const hourWord = WORD_CLOCK_HOURS[hourShown % 12];
      assert.ok(p.lines.includes(hourWord), `${h}:${m} → ${p.text}`);
    }
  }
});

test('the two examples from the brief', () => {
  assert.deepEqual(wordClockPhrase(22, 30).lines, ["IT'S", 'HALF PAST', 'TEN']);
  assert.equal(wordClockPhrase(5, 40).text, "IT'S TWENTY TO SIX");
});

test('bad input does not throw', () => {
  assert.equal(wordClockPhrase(Number.NaN, Number.NaN).text, "IT'S TWELVE O'CLOCK");
  assert.equal(wordClockPhrase(-1, 99).text, "IT'S TWELVE O'CLOCK");
});

test('English only; other languages fall back to the digital time', () => {
  for (const t of ['en', 'en-GB', 'en_US', 'EN']) assert.equal(wordClockSupported(t), true, t);
  for (const t of ['de', 'fr', 'pt-BR', 'zh-Hans', 'eng', '', null, undefined]) assert.equal(wordClockSupported(t), false, String(t));
});

test('Swift WordClock mirrors the TS tables and rules exactly', () => {
  assert.deepEqual(swiftArray('hours'), [...WORD_CLOCK_HOURS]);
  assert.deepEqual(swiftArray('minutes'), [...WORD_CLOCK_MINUTES]);
  assert.match(swift, /static let lead = "IT'S"/);
  assert.equal(WORD_CLOCK_LEAD, "IT'S");
  // Same rounding, roll-over, next-hour and line-order rules as wordClockPhrase.
  assert.match(swift, /var step = \(m \+ 2\) \/ 5/);
  assert.match(swift, /if step == 12 \{\s*step = 0\s*base \+= 1\s*\}/);
  assert.match(swift, /let shown = step >= 7 \? base \+ 1 : base/);
  assert.match(swift, /let hourWord = hours\[shown % 12\]/);
  assert.match(swift, /if step == 0 \{ return \[lead, hourWord, minutes\[0\]\] \}/);
  assert.match(swift, /return \[lead, minutes\[step\], hourWord\]/);
  assert.match(swift, /t == "en" \|\| t\.hasPrefix\("en-"\) \|\| t\.hasPrefix\("en_"\)/);
  // Re-run the fixture through a literal transcription of the Swift rules.
  const swiftLines = (hour: number, minute: number): string[] => {
    const hours = swiftArray('hours');
    const minutes = swiftArray('minutes');
    const m = Math.min(59, Math.max(0, minute));
    let step = Math.trunc((m + 2) / 5);
    let base = ((hour % 24) + 24) % 24;
    if (step === 12) {
      step = 0;
      base += 1;
    }
    const shown = step >= 7 ? base + 1 : base;
    const hourWord = hours[shown % 12];
    return step === 0 ? ["IT'S", hourWord, minutes[0]] : ["IT'S", minutes[step], hourWord];
  };
  for (const { hour, minute, text } of fixture) assert.equal(swiftLines(hour, minute).join(' '), text, `${hour}:${minute}`);
});
