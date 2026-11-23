import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ToolId } from '../state/data';

export interface ToolInfo {
  id: ToolId;
  title: string;
  blurb: string;
  icon: keyof typeof Ionicons.glyphMap;
  free: boolean;
}

/** Simple offsets, fall and the quick reference are free forever; the rest needs the trial or Full Unlock. */
export const TOOLS: ToolInfo[] = [
  { id: 'offset', title: 'Offset', blurb: 'Travel and run for 11¼° to 90° fittings', icon: 'git-merge-outline', free: true },
  { id: 'fall', title: 'Fall', blurb: 'Grade, total drop and finish levels', icon: 'trending-down-outline', free: true },
  { id: 'cut', title: 'Cut length', blurb: 'Measure to fittings, take off the allowance', icon: 'cut-outline', free: false },
  { id: 'rolling', title: 'Rolling offset', blurb: 'Rise and roll at once, true offset', icon: 'cube-outline', free: false },
  { id: 'flow', title: 'Volume & flow', blurb: 'Litres in a pipe, velocity, pressure loss', icon: 'water-outline', free: false },
  { id: 'cutlist', title: 'Cut list', blurb: 'Fit your lengths into stock lengths, least waste', icon: 'list-outline', free: false },
];

export const toolInfo = (id: ToolId) => TOOLS.find(t => t.id === id)!;

export function isLocked(id: ToolId, unlocked: boolean) {
  return !unlocked && !toolInfo(id).free;
}

import type { CountryProfile } from '../country/types';

/** Sample inputs a locked tool shows (blurred) so people see the real output before they unlock. Values in mm. */
export function sampleInputs(id: ToolId, country: CountryProfile): Record<string, unknown> {
  switch (id) {
    case 'rolling': return { rise: 300, roll: 400, angle: 45 };
    case 'cut': return { measured: 1000, qty: 1, refA: 'centre', refB: 'centre', ...(country.fittings[0] ? { fitA: country.fittings[0].id, fitB: country.fittings[0].id } : { refA: 'none', refB: 'none' }) };
    case 'flow': return { mode: 'volume', pipe: country.pipes[0]?.id, length: 25000 };
    case 'cutlist': return { pieces: [{ length: 1450, qty: 5 }, { length: 875, qty: 7 }, { length: 2210, qty: 3 }], stock: country.stockLengthMm, kerf: 3, trim: 0 };
    case 'offset': return { offset: 300, angle: 45 };
    case 'fall': return { mode: 'drop', length: 12000, gradeKind: 'ratio', grade: country.commonGrades[0] ?? 60 };
  }
}

/** Tool name in the person's trade words (US/CA say slope, others fall). */
export function toolTitle(id: ToolId, country: Pick<CountryProfile, 'terms'>): string {
  return id === 'fall' ? country.terms.fall : toolInfo(id).title;
}

export const toolHref = (id: ToolId) => `/tool/${id}` as const;
