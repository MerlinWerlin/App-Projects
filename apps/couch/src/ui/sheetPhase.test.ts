import { duration } from '../theme/motion';
import {
  SHEET_FALLBACK_OFFSET,
  initialSheetPhase,
  nextSheetPhase,
  sheetModalVisible,
  sheetMotion,
  sheetOffset,
  type SheetEvent,
  type SheetPhase,
} from './sheetPhase';

const run = (start: SheetPhase, events: SheetEvent[]): SheetPhase =>
  events.reduce<SheetPhase>((p, e) => nextSheetPhase(p, e), start);

describe('sheet phase', () => {
  it('runs the full cycle closed -> entering -> open -> exiting -> closed', () => {
    expect(nextSheetPhase('closed', 'show')).toBe('entering');
    expect(nextSheetPhase('entering', 'done')).toBe('open');
    expect(nextSheetPhase('open', 'hide')).toBe('exiting');
    expect(nextSheetPhase('exiting', 'done')).toBe('closed');
  });

  it('reverses mid-animation', () => {
    expect(nextSheetPhase('entering', 'hide')).toBe('exiting');
    expect(nextSheetPhase('exiting', 'show')).toBe('entering');
    expect(run('closed', ['show', 'hide', 'show', 'done'])).toBe('open');
  });

  it('ignores events that do not apply', () => {
    expect(nextSheetPhase('closed', 'hide')).toBe('closed');
    expect(nextSheetPhase('closed', 'done')).toBe('closed');
    expect(nextSheetPhase('open', 'show')).toBe('open');
    expect(nextSheetPhase('open', 'done')).toBe('open');
    expect(nextSheetPhase('entering', 'show')).toBe('entering');
    expect(nextSheetPhase('exiting', 'hide')).toBe('exiting');
  });

  it('keeps the Modal mounted until the exit animation finishes', () => {
    expect(sheetModalVisible('closed')).toBe(false);
    expect(sheetModalVisible('entering')).toBe(true);
    expect(sheetModalVisible('open')).toBe(true);
    expect(sheetModalVisible('exiting')).toBe(true);
    expect(sheetModalVisible(run('open', ['hide']))).toBe(true);
    expect(sheetModalVisible(run('open', ['hide', 'done']))).toBe(false);
  });

  it('starts entering when first rendered visible', () => {
    expect(initialSheetPhase(true)).toBe('entering');
    expect(initialSheetPhase(false)).toBe('closed');
  });
});

describe('sheet offset', () => {
  it('uses the measured height, never less than the fallback', () => {
    expect(sheetOffset(520.2)).toBe(521);
    expect(sheetOffset(120)).toBe(SHEET_FALLBACK_OFFSET);
    expect(sheetOffset(null)).toBe(SHEET_FALLBACK_OFFSET);
    expect(sheetOffset(undefined)).toBe(SHEET_FALLBACK_OFFSET);
    expect(sheetOffset(Number.NaN)).toBe(SHEET_FALLBACK_OFFSET);
  });
});

describe('sheet motion', () => {
  it('slides with motion on', () => {
    expect(sheetMotion(false)).toEqual({ slide: true, backdropMs: duration.base, panelFadeMs: 0, exitMs: duration.base });
  });

  it('only fades with Reduce Motion', () => {
    const m = sheetMotion(true);
    expect(m.slide).toBe(false);
    expect(m.backdropMs).toBe(duration.base);
    expect(m.panelFadeMs).toBe(duration.fast);
  });
});
