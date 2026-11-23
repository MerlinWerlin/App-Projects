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

/** Tool name in the person's trade words (US/CA say slope, others fall). */
export function toolTitle(id: ToolId, country: Pick<CountryProfile, 'terms'>): string {
  return id === 'fall' ? country.terms.fall : toolInfo(id).title;
}

export const toolHref = (id: ToolId) => `/tool/${id}` as const;
