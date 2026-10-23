// Grid overlay geometry: interior lines of an N×M grid over a rect, plus presets.

export type Rect = { x: number; y: number; width: number; height: number };
export type Line = { x1: number; y1: number; x2: number; y2: number };
export type GridPresetId = 'off' | '3x3' | '4x4';
export type GridPreset = { id: GridPresetId; cols: number; rows: number };

export const MIN_GRID = 1;
export const MAX_GRID = 12;

export const GRID_PRESETS: readonly GridPreset[] = [
  { id: 'off', cols: 1, rows: 1 },
  { id: '3x3', cols: 3, rows: 3 },
  { id: '4x4', cols: 4, rows: 4 },
];

export function isValidGridSize(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_GRID && n <= MAX_GRID;
}

/** Round and clamp a custom grid size into 1..12 (non-finite → 1). */
export function clampGridSize(n: number): number {
  if (!Number.isFinite(n)) return MIN_GRID;
  return Math.min(MAX_GRID, Math.max(MIN_GRID, Math.round(n)));
}

/** Interior lines only: cols-1 vertical lines (left to right), then rows-1 horizontal lines (top to bottom). */
export function gridLines(rect: Rect, cols: number, rows: number): Line[] {
  const { x, y, width, height } = rect;
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return [];
  const c = clampGridSize(cols);
  const r = clampGridSize(rows);
  const lines: Line[] = [];
  for (let i = 1; i < c; i++) {
    const lx = x + (width * i) / c;
    lines.push({ x1: lx, y1: y, x2: lx, y2: y + height });
  }
  for (let j = 1; j < r; j++) {
    const ly = y + (height * j) / r;
    lines.push({ x1: x, y1: ly, x2: x + width, y2: ly });
  }
  return lines;
}

export function gridPreset(id: string): GridPreset {
  return GRID_PRESETS.find((p) => p.id === id) ?? GRID_PRESETS[0];
}

/** Cycle off → 3x3 → 4x4 → off. Unknown ids behave like 'off'. */
export function nextGridPreset(id: string): GridPreset {
  const i = GRID_PRESETS.findIndex((p) => p.id === id);
  return GRID_PRESETS[(Math.max(i, 0) + 1) % GRID_PRESETS.length];
}
