/**
 * Couch's own remote icon set (fb-1017b H2): path data as a pure TS table, so it is unit-tested,
 * rendered by RemoteIcon.tsx and reusable by the prototype mirror. Every drawing is original.
 *
 * Grid: 24 x 24 viewBox, 2pt safe margin. One stroke weight (ICON_STROKE), round caps and joins,
 * 2pt corner radius on boxes. Parts are stroked outlines unless `fill` is set (small solid dots).
 * Colour always comes from the caller (remote theme tokens); nothing here names a colour.
 *
 * Physical-control icons (arrows, rewind / fast-forward, chevrons) are drawn in absolute screen
 * directions and are never mirrored in right-to-left languages (NeverMirror rule, owner-1016 R3).
 */
import { ICON_NAMES, type IconName } from './names';

export const ICON_VIEWBOX = 24;
export const ICON_STROKE = 1.9;

export interface IconPart {
  /** SVG path data in the 24 x 24 grid. */
  d: string;
  /** Solid shape filled with the icon colour (no stroke). Default: stroked outline. */
  fill?: boolean;
}

const n = (v: number): string => String(Math.round(v * 100) / 100);

/** Full circle as path data (two half arcs). */
export function circlePath(cx: number, cy: number, r: number): string {
  return `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0z`;
}

/** Rounded rectangle as path data. */
export function roundRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const k = Math.min(r, w / 2, h / 2);
  return (
    `M${n(x + k)} ${n(y)}h${n(w - 2 * k)}a${n(k)} ${n(k)} 0 0 1 ${n(k)} ${n(k)}` +
    `v${n(h - 2 * k)}a${n(k)} ${n(k)} 0 0 1 ${n(-k)} ${n(k)}` +
    `h${n(-(w - 2 * k))}a${n(k)} ${n(k)} 0 0 1 ${n(-k)} ${n(-k)}` +
    `v${n(-(h - 2 * k))}a${n(k)} ${n(k)} 0 0 1 ${n(k)} ${n(-k)}z`
  );
}

/** Eight-tooth gear outline around (12, 12): trapezoid teeth, straight flanks. */
export function gearPath(teeth = 8, outer = 9.6, inner = 7.3): string {
  const pts: string[] = [];
  const step = 360 / teeth;
  const at = (r: number, deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${n(12 + r * Math.cos(a))} ${n(12 + r * Math.sin(a))}`;
  };
  for (let i = 0; i < teeth; i++) {
    const c = i * step;
    pts.push(at(inner, c - step * 0.36), at(outer, c - step * 0.2), at(outer, c + step * 0.2), at(inner, c + step * 0.36));
  }
  return `M${pts.join('L')}z`;
}

const SPEAKER_BODY = 'M3.5 10v4a1 1 0 0 0 1 1h3l4.6 3.7a.6.6 0 0 0 .98-.47V5.77a.6.6 0 0 0-.98-.47L7.5 9h-3a1 1 0 0 0-1 1z';
const PLUS = 'M12 5v14M5 12h14';
const MINUS = 'M5 12h14';
const CHEVRON_UP = 'M6 15l6-6 6 6';
const CHEVRON_DOWN = 'M6 9l6 6 6-6';

const dots = (centres: readonly (readonly [number, number])[], r: number): IconPart[] =>
  centres.map(([x, y]) => ({ d: circlePath(x, y, r), fill: true }));

export const ICON_PATHS: Readonly<Record<IconName, readonly IconPart[]>> = {
  // Open ring with a bar through the gap.
  power: [{ d: 'M6.86 6.87A8 8 0 1 0 17.14 6.87' }, { d: 'M12 3v8.5' }],
  // Box open on its leading side, arrow entering it.
  source: [
    { d: 'M9 8.5V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-2.5' },
    { d: 'M3 12h11.5M11 8.5l3.5 3.5-3.5 3.5' },
  ],
  settings: [{ d: gearPath() }, { d: circlePath(12, 12, 3) }],
  home: [{ d: 'M3.5 11.5 12 4l8.5 7.5' }, { d: 'M6 9.5V19a1 1 0 0 0 1 1h3.5v-5h3v5H17a1 1 0 0 0 1-1V9.5' }],
  // Return arrow: head pointing left, tail curling back underneath.
  back: [{ d: 'M8.5 5 4 9.5 8.5 14' }, { d: 'M4 9.5h10.5a5.25 5.25 0 0 1 0 10.5H11' }],
  menu: [{ d: 'M4 6.5h16M4 12h16M4 17.5h16' }],
  mute: [{ d: SPEAKER_BODY }, { d: 'M16.5 9.5l5 5M21.5 9.5l-5 5' }],
  speaker: [{ d: SPEAKER_BODY }, { d: 'M16.5 9a4.2 4.2 0 0 1 0 6' }, { d: 'M19 6.5a7.8 7.8 0 0 1 0 11' }],
  volUp: [{ d: PLUS }],
  volDown: [{ d: MINUS }],
  plus: [{ d: PLUS }],
  minus: [{ d: MINUS }],
  chUp: [{ d: CHEVRON_UP }],
  chDown: [{ d: CHEVRON_DOWN }],
  up: [{ d: 'M6.5 14.5 12 9l5.5 5.5' }],
  down: [{ d: 'M6.5 9.5 12 15l5.5-5.5' }],
  left: [{ d: 'M14.5 6.5 9 12l5.5 5.5' }],
  right: [{ d: 'M9.5 6.5 15 12l-5.5 5.5' }],
  playPause: [
    { d: 'M3.5 6.6v10.8a.7.7 0 0 0 1.07.6l8.6-5.4a.7.7 0 0 0 0-1.2l-8.6-5.4A.7.7 0 0 0 3.5 6.6z' },
    { d: 'M17 6.5v11M21 6.5v11' },
  ],
  rewind: [
    { d: 'M11.5 7v10a.6.6 0 0 1-.95.5L3.6 12.5a.6.6 0 0 1 0-1l6.95-5a.6.6 0 0 1 .95.5z' },
    { d: 'M20.5 7v10a.6.6 0 0 1-.95.5l-6.95-5a.6.6 0 0 1 0-1l6.95-5a.6.6 0 0 1 .95.5z' },
  ],
  fastForward: [
    { d: 'M3.5 7v10a.6.6 0 0 0 .95.5l6.95-5a.6.6 0 0 0 0-1L4.45 6.5A.6.6 0 0 0 3.5 7z' },
    { d: 'M12.5 7v10a.6.6 0 0 0 .95.5l6.95-5a.6.6 0 0 0 0-1l-6.95-5a.6.6 0 0 0-.95.5z' },
  ],
  mic: [
    { d: 'M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z' },
    { d: 'M5.5 11a6.5 6.5 0 0 0 13 0' },
    { d: 'M12 17.5V21M9 21h6' },
  ],
  keyboard: [
    { d: roundRectPath(2, 6, 20, 12, 2) },
    ...dots([[6, 10], [10, 10], [14, 10], [18, 10]], 1),
    { d: 'M7 14.25h10' },
  ],
  numpad: dots(
    [[6, 6], [12, 6], [18, 6], [6, 12], [12, 12], [18, 12], [6, 18], [12, 18], [18, 18]],
    1.7,
  ),
  apps: [
    { d: roundRectPath(4, 4, 6.5, 6.5, 2) },
    { d: roundRectPath(13.5, 4, 6.5, 6.5, 2) },
    { d: roundRectPath(4, 13.5, 6.5, 6.5, 2) },
    { d: roundRectPath(13.5, 13.5, 6.5, 6.5, 2) },
  ],
  tv: [{ d: roundRectPath(2.5, 4, 19, 13, 2) }, { d: 'M12 17v3.5M8 20.5h8' }],
  search: [{ d: circlePath(10.5, 10.5, 6.5) }, { d: 'M15.4 15.4 20.5 20.5' }],
  close: [{ d: 'M6 6l12 12M18 6 6 18' }],
  backspace: [
    { d: 'M9 5h10.5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6.5-7z' },
    { d: 'M12 9.5l5 5M17 9.5l-5 5' },
  ],
  enter: [{ d: 'M20 5v6a3 3 0 0 1-3 3H5' }, { d: 'M9 10l-4 4 4 4' }],
  check: [{ d: 'M5 12.5l4.5 4.5L19 7.5' }],
  // Stopwatch: round face, crown on top, one hand, side button (sleep timer, T72).
  timer: [
    { d: circlePath(12, 13.5, 7.5) },
    { d: 'M10 3h4M12 3v3' },
    { d: 'M12 13.5V9.5' },
    { d: 'M18.2 7.3l1.5-1.5' },
  ],
  // Screen with signal waves rising to it from a dot below (AirPlay / Screen Mirroring shortcut, T92).
  screenMirror: [
    { d: roundRectPath(3.5, 2.5, 17, 10.5, 2) },
    { d: 'M7.71 16.9A5.6 5.6 0 0 1 16.29 16.9' },
    { d: 'M9.55 18.44A3.2 3.2 0 0 1 14.45 18.44' },
    { d: circlePath(12, 20.5, 1.1), fill: true },
  ],
  // Tab bar: a handheld remote (body, d-pad ring, two buttons) and "send to TV" (screen with signal
  // arcs from its bottom-start corner). Original drawings on the same grid and stroke.
  remote: [
    { d: roundRectPath(7, 2.5, 10, 19, 3) },
    { d: circlePath(12, 8.5, 2.4) },
    { d: circlePath(10, 15, 0.9), fill: true },
    { d: circlePath(14, 15, 0.9), fill: true },
    { d: 'M10 18.5h4' },
  ],
  cast: [
    { d: 'M3 8V6.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-6' },
    { d: 'M3 12.5a7 7 0 0 1 7 7' },
    { d: 'M3 16a3.5 3.5 0 0 1 3.5 3.5' },
    { d: circlePath(3.9, 19.1, 0.9), fill: true },
  ],
};

/** Every id with its parts, in ICON_NAMES order (handy for galleries / the prototype). */
export function iconEntries(): Array<[IconName, readonly IconPart[]]> {
  return ICON_NAMES.map((id) => [id, ICON_PATHS[id]]);
}
