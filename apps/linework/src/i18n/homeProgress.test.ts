// T80: Home's progress stat counts trace sessions while "My drawings" counts saved snapshots. The two are different
// numbers, so the progress text must never read like a drawing count in any language.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGS, EN } from './catalogs.ts';
import { LOCALES, translate } from './core.ts';

const COUNTS = [0, 1, 2, 3, 5, 11, 21, 100, 1_000_000];

test('the old drawing-count progress key is gone', () => {
  assert.equal(EN['home.progress.drawings'], undefined);
  for (const { code } of LOCALES) assert.equal(CATALOGS[code]['home.progress.drawings'], undefined, code);
});

for (const { code } of LOCALES) {
  test(`${code}: the progress stat says sessions, never the My drawings count`, () => {
    const cat = CATALOGS[code];
    assert.ok(cat['home.progress.sessions'] !== undefined, `${code} has home.progress.sessions`);
    assert.ok(cat['home.stat.sessions'] !== undefined, `${code} has home.stat.sessions`);
    for (const count of COUNTS) {
      const sessions = translate(code, cat, EN, 'home.progress.sessions', { count });
      const drawings = translate(code, cat, EN, 'drawings.count', { count });
      assert.notEqual(sessions, drawings, `${code} count ${count}`);
      const unit = translate(code, cat, EN, 'home.stat.sessions', { count });
      assert.ok(!drawings.includes(unit), `${code} count ${count}: unit "${unit}" reads like "${drawings}"`);
      const label = translate(code, cat, EN, 'home.progress.labelNoStreak', { sessions, minutes: 'M' });
      assert.ok(label.includes(sessions), `${code} label keeps the sessions text`);
    }
  });
}

test('English wording names sessions explicitly', () => {
  for (const count of [1, 4]) {
    assert.match(translate('en', EN, EN, 'home.progress.sessions', { count }), /session/);
    assert.match(translate('en', EN, EN, 'home.stat.sessions', { count }), /session/);
  }
});
