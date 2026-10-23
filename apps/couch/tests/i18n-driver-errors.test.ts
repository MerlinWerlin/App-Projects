/**
 * T53: user-facing driver error messages go through the i18n catalogue.
 * DriverError codes stay stable for logic; messages are t(key) at throw time (src/core/drivers/errors.ts).
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { en } from '../src/i18n/catalog';
import { setLocale, t } from '../src/i18n/core';
import { asDriverError, driverError } from '../src/core/drivers/errors';
import { MockTv } from '../src/core/drivers/mock';
import { IR_BRAND_CHOICES, NOT_SURE, irBrandChoiceLabel } from '../src/core/ir/codes';
import { describeError } from '../src/core/session';
import { DriverError } from '../src/core/types';

const ROOT = join(__dirname, '..');
const DRIVERS = join(ROOT, 'src', 'core', 'drivers');

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== '__fixtures__') out.push(...sources(p));
    } else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

afterEach(() => setLocale('en'));

describe('driver sources', () => {
  const files = sources(DRIVERS);

  it('no DriverError is built from an English literal', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const lines = readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, i) => {
        // new DriverError('code', 'text' | "text" | `text`), possibly with the message on the next line.
        const joined = line + (lines[i + 1] ?? '') + (lines[i + 2] ?? '');
        if (/new DriverError\(/.test(line) && /new DriverError\(\s*[^,]+,\s*['"`]/.test(joined)) {
          offenders.push(`${relative(ROOT, f)}:${i + 1}`);
        }
        if (/type:\s*'error',\s*message:\s*['"`]/.test(line)) offenders.push(`${relative(ROOT, f)}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('every core.driver.* key used in the drivers exists in the English catalogue', () => {
    const used = new Set<string>();
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(/'(core\.driver\.[\w.]+)'/g)) used.add(m[1]!);
    }
    expect(used.size).toBeGreaterThan(50);
    for (const k of used) expect(Object.prototype.hasOwnProperty.call(en, k)).toBe(true);
  });
});

describe('driverError / describeError', () => {
  it('translates at throw time and keeps the code', () => {
    const e = driverError('unsupported', 'core.driver.firetv.vegaOs');
    expect(e).toBeInstanceOf(DriverError);
    expect(e.code).toBe('unsupported');
    expect(e.message).toBe(t('core.driver.firetv.vegaOs'));
  });

  it('pseudo-locale: forbidden / unsupported / network toasts are pseudo-localised', () => {
    setLocale('pseudo');
    for (const e of [
      driverError('forbidden', 'core.driver.roku.blocked'),
      driverError('forbidden', 'core.driver.sony.pskHelp'),
      driverError('unsupported', 'core.driver.firetv.vegaOs'),
      driverError('network', 'core.driver.common.deviceHttp', { device: 'Roku', status: '500' }),
      driverError('forbidden', 'core.driver.common.pinMismatch'),
    ]) {
      const shown = describeError(e);
      expect(shown).toMatch(/^\[.*\]$/);
      expect(shown).toBe(e.message);
    }
    const http = describeError(driverError('network', 'core.driver.common.deviceHttp', { device: 'Roku', status: '500' }));
    expect(http).toContain('Roku');
    expect(http).toContain('500');
  });

  it('placeholders: ports are not number-formatted', () => {
    expect(t('core.driver.common.channelFailed', { port: '8002' })).toBe("Can't open the TV's remote channel (port 8002).");
  });

  it('unexpected errors become a translated network error that keeps the detail', () => {
    setLocale('pseudo');
    const e = asDriverError(new Error('ECONNRESET'));
    expect(e.code).toBe('network');
    expect(e.message).toMatch(/^\[/);
    expect(e.message).toContain('ECONNRESET');
    const same = new DriverError('timeout', 'x');
    expect(asDriverError(same)).toBe(same);
  });

  it('the demo driver reports pseudo-localised errors through the session mapping', async () => {
    setLocale('pseudo');
    const d = new MockTv();
    await d.connect();
    let err: unknown;
    try {
      await d.launchApp('no-such-app');
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ code: 'unsupported' });
    const shown = describeError(err);
    expect(shown).toMatch(/^\[/);
    expect(shown).toContain('no-such-app');
  });
});

describe('IR brand choice', () => {
  it('"Not sure" is translated; brand names are data', () => {
    setLocale('pseudo');
    expect(irBrandChoiceLabel(NOT_SURE)).toBe(t('core.ir.notSure', undefined, 'pseudo'));
    expect(irBrandChoiceLabel(NOT_SURE)).not.toBe('Not sure');
    for (const c of IR_BRAND_CHOICES) if (c !== NOT_SURE) expect(irBrandChoiceLabel(c)).toBe(c);
  });
});
