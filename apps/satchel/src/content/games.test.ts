// T125: checks on src/content/games.json (travel bingo tiles, spot-it lists and the question decks). Original,
// family-friendly content written by the build on 2026-11-01; see ops/DECISIONS.md.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildCard, contentProblems, DECKS, GAME_ICONS, GAME_MODES, TILES_NEEDED, type GamesContent } from '../core/games.ts';

const data = JSON.parse(readFileSync(new URL('./games.json', import.meta.url), 'utf8')) as GamesContent;
const allText = (): string[] => [
  ...GAME_MODES.flatMap((m) => data.bingo[m].map((t) => t.label)),
  ...GAME_MODES.flatMap((m) => data.spy[m].map((s) => s.text)),
  ...DECKS.flatMap((d) => data.decks[d].map((c) => c.text)),
];

test('games content: no problems (ids, counts, icons, lengths, spacing); dated', () => {
  assert.deepEqual(contentProblems(data), []);
  assert.equal(data.written, '2026-11-01');
  assert.match(data.note, /Original/);
});

test('games content: every mode can build a card with spare tiles, every glyph is used, no label twice in a mode', () => {
  const used = new Set<string>();
  for (const m of GAME_MODES) {
    assert.ok(data.bingo[m].length > TILES_NEEDED, `${m} has spares for variety`);
    assert.ok(buildCard(data.bingo[m], m, 1), m);
    const labels = data.bingo[m].map((t) => t.label.toLowerCase());
    assert.equal(new Set(labels).size, labels.length, m);
    for (const t of data.bingo[m]) used.add(t.icon);
  }
  assert.deepEqual([...GAME_ICONS].filter((i) => !used.has(i)), []);
});

test('games content: decks read as their kind', () => {
  for (const c of data.decks.rather) assert.match(c.text, /^Would you rather .+ or .+\?$/, c.id);
  for (const c of data.decks.tell) assert.match(c.text, /^Tell me about .+\.$/, c.id);
  for (const c of data.decks.memory) assert.match(c.text, /[?.]$/, c.id);
});

test('games content: family-friendly, no brands, characters or scary words', () => {
  const BAD =
    /\b(kill|dead|die|blood|gun|weapon|beer|wine|alcohol|drunk|sexy|kiss|hate|stupid|ugly|fat|scary|horror|ghost|zombie|bomb|crash|terror|hijack|drugs?|cigarette|vape|gamble|bet)\b/i;
  const BRANDS =
    /\b(disney|pixar|marvel|pokemon|pok[eé]mon|lego|barbie|mario|nintendo|playstation|xbox|starbucks|mcdonald|coca|pepsi|boeing|airbus|qantas|emirates|ryanair|easyjet|eurostar|amtrak|uber|google|apple|iphone|instagram|tiktok|youtube|harry potter|batman|superman|spider-man|elsa|mickey|peppa|bluey)\b/i;
  for (const s of allText()) {
    assert.doesNotMatch(s, BAD, s);
    assert.doesNotMatch(s, BRANDS, s);
  }
});
