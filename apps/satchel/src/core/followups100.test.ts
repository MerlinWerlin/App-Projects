// Run 100 (T58): values re-checked online on 2026-11-01 are pinned here so later edits can't drift from the sources.
// Matariki: Te Kāhui o Matariki Public Holiday Act 2022, Schedule 1 (legislation.govt.nz). Essentials: IEC World Plugs
// type pages (pubweb2.iec.ch/worldplugs/typeD/F/G/I/K.htm), used only to fill fields that were null.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { findEssentials, rowProblems, type EssentialsTable } from './essentials.ts';
import { holidaysForYear } from './holidays.ts';

const table = JSON.parse(readFileSync(new URL('../content/country_essentials.json', import.meta.url), 'utf8')) as EssentialsTable;

test('Matariki 2023-2035 match the Act schedule exactly', () => {
  const schedule: Record<number, string> = {
    2023: '2023-07-14',
    2024: '2024-06-28',
    2025: '2025-06-20',
    2026: '2026-07-10',
    2027: '2027-06-25',
    2028: '2028-07-14',
    2029: '2029-07-06',
    2030: '2030-06-21',
    2031: '2031-07-11',
    2032: '2032-07-02',
    2033: '2033-06-24',
    2034: '2034-07-07',
    2035: '2035-06-29',
  };
  for (const [y, date] of Object.entries(schedule)) {
    const m = holidaysForYear('NZ', Number(y)).filter((h) => h.name === 'Matariki');
    assert.deepEqual(
      m.map((h) => h.date),
      [date],
      y,
    );
  }
});

type Pin = { plugs?: string[]; voltage?: number[]; frequency?: number[] };
const IEC_FILLED: Record<string, Pin> = {
  BT: { plugs: ['C', 'D', 'F', 'G', 'M'] },
  ET: { plugs: ['C', 'E', 'F', 'L'] },
  IM: { voltage: [240] },
  KN: { plugs: ['A', 'B', 'D', 'G'], frequency: [60] },
  KP: { plugs: ['A', 'C', 'F'] },
  LB: { plugs: ['A', 'B', 'C', 'D', 'G'] },
  MF: { plugs: ['C', 'F'], voltage: [120, 220], frequency: [60] },
  MG: { plugs: ['C', 'D', 'E', 'J', 'K'] },
  MM: { plugs: ['C', 'D', 'F', 'G'] },
  MO: { plugs: ['D', 'F', 'G', 'M'] },
  MV: { plugs: ['A', 'C', 'D', 'G', 'J', 'K', 'L'] },
  NE: { plugs: ['A', 'B', 'C', 'D', 'E', 'F'] },
  NG: { voltage: [230] },
  SB: { plugs: ['G', 'I'] },
  SN: { plugs: ['C', 'D', 'E', 'K'] },
  SR: { plugs: ['C', 'F'] },
  TD: { plugs: ['C', 'D', 'E', 'F'] },
  TL: { plugs: ['C', 'E', 'F', 'I'] },
  VC: { plugs: ['A', 'C', 'E', 'G', 'I', 'K'] },
  YE: { plugs: ['A', 'D', 'G'] },
  ZW: { voltage: [220] },
};

test('essentials nulls filled from IEC World Plugs keep their values, an IEC type-page source and the check date', () => {
  for (const [iso2, pin] of Object.entries(IEC_FILLED)) {
    const r = findEssentials(table, iso2);
    assert.ok(r, iso2);
    for (const k of ['plugs', 'voltage', 'frequency'] as const) if (pin[k]) assert.deepEqual(r[k], pin[k], `${iso2} ${k}`);
    assert.ok(r.sources.some((u) => u.startsWith('https://pubweb2.iec.ch/worldplugs/type')), `${iso2} IEC type page`);
    assert.equal(r.checked, '2026-11-01', iso2);
    assert.deepEqual(rowProblems(r), [], iso2);
  }
});

test('nulls left open after the run-100 re-check (no reliable IEC/ITU source reached) stay null, not guessed', () => {
  const open: Record<string, ('plugs' | 'voltage' | 'frequency' | 'driving' | 'calling_code')[]> = {
    BQ: ['plugs', 'voltage', 'frequency'],
    EH: ['plugs', 'voltage', 'frequency', 'calling_code'],
    GS: ['plugs', 'voltage', 'frequency', 'driving'],
    MS: ['plugs', 'voltage', 'frequency'],
    PF: ['plugs', 'voltage', 'frequency'],
    PN: ['plugs', 'voltage', 'frequency', 'driving'],
    RW: ['plugs'],
    SH: ['plugs', 'voltage', 'frequency'],
    SO: ['plugs'],
    TK: ['driving'],
    TV: ['voltage'],
    WF: ['plugs', 'voltage', 'frequency'],
  };
  const nullsNow = table.countries.flatMap((r) =>
    (['plugs', 'voltage', 'frequency', 'driving', 'calling_code'] as const).filter((k) => r[k] === null).map((k) => `${r.iso2}.${k}`),
  );
  const want = Object.entries(open).flatMap(([iso2, ks]) => ks.map((k) => `${iso2}.${k}`));
  assert.deepEqual(nullsNow.sort(), want.sort());
});
