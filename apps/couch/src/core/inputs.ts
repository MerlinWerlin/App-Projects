import { t } from '../i18n/core';
import { withCopy } from '../i18n/lazyCopy';
import type { TvDriver } from './driver';
import { DriverError, type TvInput } from './types';

/**
 * Source picker logic (prototype v2 sourceSheet, PLAN 6b). Pure TS so it is tested
 * against MockTv; src/ui/remote/SourceSheet.tsx only renders what this returns.
 *
 * Two modes:
 * - 'list': the TV shares its inputs (capability 'inputs' + listInputs/setInput); the sheet
 *   shows them and "Next source" steps through that list with setInput.
 * - 'cycle': the TV shares no list; "Next source" sends the SOURCE key, like the button
 *   on the TV's own remote.
 */
export type SourceView = { kind: 'list'; inputs: TvInput[] } | { kind: 'cycle' };

/** Prototype labels, in order. Drivers that list a static set use these names. */
export const SOURCE_LABELS = ['TV', 'HDMI 1', 'HDMI 2', 'HDMI 3', 'HDMI 4', 'AV'] as const;

/** Source sheet copy, translated on read (t() getters). */
export const INPUTS_COPY: { readonly note: string; readonly noSource: string } = withCopy(
  { note: '', noSource: '' },
  { note: 'core.inputs.note', noSource: 'core.inputs.noSource' },
);

/** The sheet's footnote in the active language. */
export function sourceNote(): string {
  return t('core.inputs.note');
}

/** Thrown (as DriverError 'unsupported') when the TV can't change source; in the active language. */
export function noSourceMessage(): string {
  return t('core.inputs.noSource');
}

/**
 * English only, kept for src/ui/remote/SourceSheet.tsx until it reads sourceNote() / INPUTS_COPY.note.
 * @deprecated use sourceNote()
 */
export const SOURCE_NOTE =
  'The list comes from your TV where it shares one. If not, Couch cycles through sources like the button on your TV remote.';

function canList(driver: TvDriver): boolean {
  return driver.capabilities.has('inputs') && typeof driver.listInputs === 'function';
}

function canSet(driver: TvDriver): boolean {
  return driver.capabilities.has('inputs') && typeof driver.setInput === 'function';
}

/** What the sheet should show. An empty list from the TV falls back to cycling. */
export async function loadSources(driver: TvDriver): Promise<SourceView> {
  if (!canList(driver) || !driver.listInputs) return { kind: 'cycle' };
  const inputs = await driver.listInputs();
  if (inputs.length === 0) return { kind: 'cycle' };
  return { kind: 'list', inputs: inputs.map((i) => ({ ...i })) };
}

/** Switch straight to one input from the list. */
export async function chooseSource(driver: TvDriver, inputId: string): Promise<void> {
  if (!canSet(driver) || !driver.setInput) throw new DriverError('unsupported', noSourceMessage());
  await driver.setInput(inputId);
}

/** Id of the current input: explicit currentId first, else the one the TV flags as current. */
export function currentSourceId(inputs: readonly TvInput[], currentId?: string | null): string | null {
  if (currentId && inputs.some((i) => i.id === currentId)) return currentId;
  return inputs.find((i) => i.current)?.id ?? null;
}

/** The input after the current one, wrapping; the first one when the current is unknown. */
export function nextInput(inputs: readonly TvInput[], currentId?: string | null): TvInput | null {
  if (inputs.length === 0) return null;
  const cur = currentSourceId(inputs, currentId);
  const i = cur === null ? -1 : inputs.findIndex((x) => x.id === cur);
  return inputs[(i + 1) % inputs.length] ?? null;
}

export interface NextSourceOptions {
  /** The list already shown in the sheet (saves a round trip). Fetched when omitted. */
  inputs?: readonly TvInput[];
  /**
   * The input Couch last chose, for TVs that do not report a current input (Roku).
   * Ignored when it is not in the list.
   */
  currentId?: string | null;
}

/**
 * "Next source": setInput over the TV's list (cycling from the current one) where it has one,
 * else the SOURCE key. Resolves to the id switched to, or null when the SOURCE key was sent
 * (the TV decides what comes next and does not tell us).
 */
export async function nextSource(driver: TvDriver, opts: NextSourceOptions = {}): Promise<string | null> {
  if (canSet(driver) && driver.setInput) {
    let inputs: readonly TvInput[] = opts.inputs ?? [];
    if (inputs.length === 0 && canList(driver) && driver.listInputs) inputs = await driver.listInputs();
    const next = nextInput(inputs, opts.currentId);
    if (next) {
      await driver.setInput(next.id);
      return next.id;
    }
  }
  if (!driver.capabilities.has('keys')) throw new DriverError('unsupported', noSourceMessage());
  try {
    await driver.sendKey('SOURCE');
  } catch (e) {
    // Drivers with no SOURCE key (e.g. Roku players) reject it as unsupported: say it kindly.
    if (e instanceof DriverError && e.code === 'unsupported') throw new DriverError('unsupported', noSourceMessage());
    throw e;
  }
  return null;
}
