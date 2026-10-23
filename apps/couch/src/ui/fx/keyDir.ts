/**
 * Where each key sits relative to the remote's centre (x right, y down, both -1..1), so the cinema
 * glow can pulse from the pressed key's side; and which keys step the volume (volume HUD).
 * Pure TS (no React Native import).
 */
import type { Key } from '../../core/keys';

export interface Dir {
  x: number;
  y: number;
}

const CENTRE: Dir = { x: 0, y: 0 };

const DIRS: Partial<Record<Key, Dir>> = {
  // Top row: power, source, settings.
  POWER: { x: -0.7, y: -1 },
  SOURCE: { x: 0, y: -1 },
  SETTINGS: { x: 0.7, y: -1 },
  INPUT: { x: 0, y: -1 },
  // D-pad: each arrow from its side, OK from the centre.
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
  OK: CENTRE,
  ENTER: CENTRE,
  // Volume on the left, channel on the right.
  VOL_UP: { x: -1, y: 0.2 },
  VOL_DOWN: { x: -1, y: 0.4 },
  MUTE: { x: -0.6, y: 0.3 },
  CH_UP: { x: 1, y: 0.2 },
  CH_DOWN: { x: 1, y: 0.4 },
  // Playback and colour keys along the bottom.
  REW: { x: -0.6, y: 1 },
  PLAY_PAUSE: { x: 0, y: 1 },
  FF: { x: 0.6, y: 1 },
  RED: { x: -0.6, y: 1 },
  GREEN: { x: -0.2, y: 1 },
  YELLOW: { x: 0.2, y: 1 },
  BLUE: { x: 0.6, y: 1 },
};

/** Direction of a key from the remote's centre; unknown keys pulse from the centre. */
export function keyDir(key: Key): Dir {
  return DIRS[key] ?? CENTRE;
}

/** Volume step for the volume HUD, or null for any other key. */
export function volumeStep(key: Key): 'up' | 'down' | 'mute' | null {
  if (key === 'VOL_UP') return 'up';
  if (key === 'VOL_DOWN') return 'down';
  if (key === 'MUTE') return 'mute';
  return null;
}
