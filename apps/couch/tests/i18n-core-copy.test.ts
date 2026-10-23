/**
 * owner-1016 R3e (T51): user-facing copy produced in src/core and src/plus goes through the
 * catalogue and follows the active language on read (never translated at module load).
 * Node built-ins only (Jest and Bun).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { addTvReducer, createAddTvState, foundLabel, pairStepFor } from '../src/core/addTv';
import { ago, formatLogEntry } from '../src/core/diagnostics';
import { KEY_LABEL } from '../src/core/keys';
import { GLOW_OPTIONS, SETTING_COPY, THEME_OPTIONS } from '../src/core/prefs';
import { VOICE_NOTES } from '../src/core/voice';
import { PLATFORM_LABEL } from '../src/core/types';
import { en } from '../src/i18n/catalog';
import { coreEn } from '../src/i18n/catalog/en/core';
import { setLocale } from '../src/i18n/core';
import { PLUS_FEATURE_COPY, plusPromise } from '../src/plus/entitlement';
import { TIP_TIERS, tipJarCopy } from '../src/plus/tipJar';

const root = join(__dirname, '..');

function files(p: string): string[] {
  if (!existsSync(p)) return [];
  if (statSync(p).isFile()) return /\.(ts|tsx)$/.test(p) ? [p] : [];
  return readdirSync(p).flatMap((n) => files(join(p, n)));
}

/** 'core.*' only: driver code also has protocol ids such as 'com.jared797.couch'. */
const KEY_RE = /['"`](core\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)['"`]/g;

function pseudoCopy(): string[] {
  const s = addTvReducer({ ...createAddTvState(), step: 'manual', ip: '', error: null, probing: false }, { type: 'probeResult', candidate: null });
  return [
    SETTING_COPY.simple.title,
    SETTING_COPY.glow.hint,
    THEME_OPTIONS[0]!.label,
    GLOW_OPTIONS[0]!.label,
    GLOW_OPTIONS[0]!.short,
    KEY_LABEL.POWER,
    KEY_LABEL.VOL_UP,
    VOICE_NOTES.listening,
    VOICE_NOTES.sent('x'),
    PLATFORM_LABEL.mock,
    foundLabel(2),
    s.step === 'manual' ? (s.error ?? '') : '',
    pairStepFor('androidtv').kind === 'code' ? (pairStepFor('androidtv') as { message: string }).message : '',
    ago(10_000, 5_000),
    formatLogEntry({ at: 0, from: null, to: 'connected', attempt: 2 }),
    plusPromise(),
    PLUS_FEATURE_COPY.widgets.title,
    TIP_TIERS[0]!.label,
    tipJarCopy(),
  ];
}

describe('core + plus copy follows the active language', () => {
  afterEach(() => setLocale('en'));

  it('comes back pseudo-localised under the pseudo locale', () => {
    setLocale('pseudo');
    for (const text of pseudoCopy()) expect({ text, pseudo: text.startsWith('[') }).toEqual({ text, pseudo: true });
  });

  it('switching back to English restores the English copy', () => {
    setLocale('pseudo');
    setLocale('en');
    expect(SETTING_COPY.simple.title).toBe('Simple mode');
    expect(GLOW_OPTIONS.map((o) => o.label)).toEqual(['Remote theme', 'Warm amber', 'Cool blue', 'Violet', 'Match TV', 'Off']);
    expect(KEY_LABEL.POWER).toBe('Power');
    expect(KEY_LABEL.NUM_7).toBe('7');
    expect(foundLabel(0)).toBe('No TVs found');
    expect(foundLabel(1)).toBe('Found 1 TV');
    expect(foundLabel(3)).toBe('Found 3 TVs');
    expect(plusPromise()).toBe('Every button on the remote stays free. Plus adds extras, never takes controls away.');
    expect(VOICE_NOTES.sent('cooking shows')).toBe('Sent to the TV: "cooking shows"');
    expect(formatLogEntry({ at: 0, from: null, to: 'connected', attempt: 2 })).toBe('00:00:00 start -> connected (attempt 2)');
    expect(ago(70_000, 5_000)).toBe('1m ago');
  });

  it('the shared diagnostics report stays English', () => {
    setLocale('pseudo');
    expect(formatLogEntry({ at: 0, from: 'connected', to: 'off', attempt: 0 }, 'en')).toBe('00:00:00 connected -> off');
    expect(ago(10_000, 5_000, 'en')).toBe('5s ago');
  });
});

describe('src/core + src/plus message keys', () => {
  const sources = ['src/core', 'src/plus']
    .flatMap((d) => files(join(root, d)))
    .filter((p) => !/\.test\.tsx?$/.test(p))
    .map((p) => ({ path: relative(root, p), src: readFileSync(p, 'utf8') }));

  it('every message key literal used exists in the English catalogue', () => {
    const missing: string[] = [];
    let used = 0;
    for (const { path, src } of sources) {
      for (const m of src.matchAll(KEY_RE)) {
        used += 1;
        if (!Object.prototype.hasOwnProperty.call(en, m[1]!)) missing.push(`${path}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
    expect(used).toBeGreaterThan(100);
  });

  it("core catalogue keys are 'core.<area>.<name>'", () => {
    for (const k of Object.keys(coreEn)) expect(k).toMatch(/^core\.[a-z][A-Za-z0-9]*\.[A-Za-z0-9_.]+$/);
  });
});
