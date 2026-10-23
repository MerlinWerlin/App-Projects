import { KEY_LABEL } from '../../core/keys';
import { t } from '../../i18n/core';
import { SIMPLE_CONTROLS, SIMPLE_KEY_MIN_HEIGHT, SIMPLE_NOTE_KEYS, simpleRows } from './simple';

describe('simple mode layout', () => {
  it('matches the prototype order and captions exactly', () => {
    expect(SIMPLE_CONTROLS.map((c) => [c.key, c.label, c.caption])).toEqual([
      ['POWER', 'Power', 'Power'],
      ['HOME', 'Home', 'Home'],
      ['VOL_UP', 'Volume up', 'Louder'],
      ['CH_UP', 'Channel up', 'Next channel'],
      ['VOL_DOWN', 'Volume down', 'Quieter'],
      ['CH_DOWN', 'Channel down', 'Previous channel'],
    ]);
  });

  it('labels come from KEY_LABEL', () => {
    for (const c of SIMPLE_CONTROLS) expect(c.label).toBe(KEY_LABEL[c.key]);
  });

  it('only power is styled as power', () => {
    expect(SIMPLE_CONTROLS.filter((c) => c.power).map((c) => c.key)).toEqual(['POWER']);
  });

  it('lays out as 3 rows of 2 big keys', () => {
    const rows = simpleRows();
    expect(rows.map((r) => r.length)).toEqual([2, 2, 2]);
    expect(rows[1]?.map((c) => c.key)).toEqual(['VOL_UP', 'CH_UP']);
    expect(SIMPLE_KEY_MIN_HEIGHT).toBeGreaterThanOrEqual(84);
  });

  it('has the prototype note', () => {
    expect(SIMPLE_NOTE_KEYS.map((k) => t(k)).join(' · ')).toBe('Simple mode · turn off in TVs › Settings');
  });
});
