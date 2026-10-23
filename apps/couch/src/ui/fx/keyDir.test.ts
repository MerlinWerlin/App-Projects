import { KEYS } from '../../core/keys';
import { keyDir, volumeStep } from './keyDir';

describe('keyDir', () => {
  it('d-pad arrows come from their side, OK from the centre', () => {
    expect(keyDir('UP')).toEqual({ x: 0, y: -1 });
    expect(keyDir('DOWN')).toEqual({ x: 0, y: 1 });
    expect(keyDir('LEFT')).toEqual({ x: -1, y: 0 });
    expect(keyDir('RIGHT')).toEqual({ x: 1, y: 0 });
    expect(keyDir('OK')).toEqual({ x: 0, y: 0 });
  });

  it('volume left, channel right, top row top, playback bottom', () => {
    for (const k of ['VOL_UP', 'VOL_DOWN', 'MUTE'] as const) expect(keyDir(k).x).toBeLessThan(0);
    for (const k of ['CH_UP', 'CH_DOWN'] as const) expect(keyDir(k).x).toBeGreaterThan(0);
    for (const k of ['POWER', 'SOURCE', 'SETTINGS'] as const) expect(keyDir(k).y).toBe(-1);
    for (const k of ['REW', 'PLAY_PAUSE', 'FF'] as const) expect(keyDir(k).y).toBe(1);
  });

  it('defaults to the centre and stays in -1..1 for every key', () => {
    expect(keyDir('NUM_5')).toEqual({ x: 0, y: 0 });
    expect(keyDir('HOME')).toEqual({ x: 0, y: 0 });
    for (const k of KEYS) {
      const d = keyDir(k);
      expect(Math.abs(d.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(d.y)).toBeLessThanOrEqual(1);
    }
  });
});

describe('volumeStep', () => {
  it('maps volume keys only', () => {
    expect(volumeStep('VOL_UP')).toBe('up');
    expect(volumeStep('VOL_DOWN')).toBe('down');
    expect(volumeStep('MUTE')).toBe('mute');
    expect(volumeStep('CH_UP')).toBeNull();
    expect(volumeStep('POWER')).toBeNull();
  });
});
