// T53 (in T67): the docs/spec string catalogues match src/i18n for the owner-1031 / run 84-86 groups.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { en } from './en.ts';
import { inSpecGroups, SPEC_CATALOGUES, specDrift, syncSpec } from './specsync.ts';

const FIX = 'run: node tools/i18n/sync-spec-catalogues.mjs';

for (const rel of SPEC_CATALOGUES) {
  test(`spec catalogue ${rel} matches src/i18n for the synced groups`, () => {
    const cat = JSON.parse(readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')) as Record<string, unknown>;
    const d = specDrift(cat, en);
    assert.deepEqual(d.missing, [], `missing keys (${FIX})`);
    assert.deepEqual(d.stale, [], `keys no longer in src/i18n (${FIX})`);
    assert.deepEqual(d.changed, [], `wording differs from src/i18n (${FIX})`);
  });
}

test('spec groups: the listed groups (incl. run-86 journal / travels / jetlag, run-87 share / brief / triproute / weather), not older groups', () => {
  for (const k of ['share.title', 'brief.eyebrow', 'triproute.heading', 'weather.credit', 'map.online', 'emergency.fallbackCall', 'emergency.noNumber', 'toilets.title', 'help.offlinePackNote', 'readiness.check.map', 'convert.title', 'spending.title', 'journal.title', 'travels.title', 'jetlag.title', 'tab.toilets', 'settings.homeCountry']) {
    assert.ok(inSpecGroups(k), k);
  }
  for (const k of ['map.title', 'emergency.title', 'settings.title', 'trips.title', 'sharePlan.x', 'weatherly.x']) assert.equal(inSpecGroups(k), false, k);
  // every listed group has strings in src/i18n
  for (const p of ['toilets.', 'design.', 'citymaps.', 'spending.', 'essentials.', 'phrases.', 'privacy.', 'help.', 'readiness.', 'convert.', 'journal.', 'travels.', 'jetlag.', 'emergency.fallback', 'share.', 'brief.', 'triproute.', 'weather.']) {
    assert.ok(Object.keys(en).some((k) => k.startsWith(p)), p);
  }
});

test('syncSpec: replaces in place, drops stale group keys, appends new ones, leaves other keys alone', () => {
  const cat = { 'a.x': '1', 'help.old': 'gone', 'help.kept': 'old wording', 'b.y': '2' };
  const src = { 'help.kept': 'new wording', 'help.added': 'added', 'a.x': 'not synced' };
  const out = syncSpec(cat, src);
  assert.deepEqual(Object.entries(out), [
    ['a.x', '1'],
    ['help.kept', 'new wording'],
    ['b.y', '2'],
    ['help.added', 'added'],
  ]);
  assert.deepEqual(specDrift(out, src), { missing: [], stale: [], changed: [] });
  assert.deepEqual(specDrift(cat, src), { missing: ['help.added'], stale: ['help.old'], changed: ['help.kept'] });
});
