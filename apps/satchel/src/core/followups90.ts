// T84 run-90 follow-ups that need a small pure helper of their own. No React Native imports.
import { hashString } from './covers.ts';

/**
 * Which avatar tone a companion gets, as an index into a palette of `n` tones: from a hash of the companion's id,
 * so a person keeps their colour when others are added, removed or reordered (the list index changed it before).
 * Two companions can share a tone; their initials and names still tell them apart.
 */
export function companionToneIndex(id: string, n: number): number {
  if (!Number.isInteger(n) || n <= 0) return 0;
  return hashString(`companion:${id}`) % n;
}
