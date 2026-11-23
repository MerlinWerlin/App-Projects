import type { Terms } from './country.ts';
// The tool list: id, route, name, one-line purpose and whether it is always free (src/core/access.ts).
export type ToolId = 'stairs' | 'rafter' | 'hip' | 'pitch' | 'mitre' | 'crown' | 'layout' | 'decking' | 'cutlist' | 'square' | 'arc' | 'convert';

export type ToolInfo = { id: ToolId; name: string; blurb: string; free: boolean; group: 'Frame' | 'Roof' | 'Trim' | 'Set-out' };

export const TOOLS: readonly ToolInfo[] = Object.freeze([
  { id: 'stairs', name: 'Stairs', blurb: 'Risers, going, 2R+G, stringer', free: false, group: 'Frame' },
  { id: 'layout', name: 'Stud & joist layout', blurb: 'Marks at 450 / 600 centres', free: false, group: 'Frame' },
  { id: 'decking', name: 'Decking', blurb: 'Boards, rip, lengths, screws', free: false, group: 'Frame' },
  { id: 'cutlist', name: 'Cut list', blurb: 'Fewest lengths, least offcut', free: false, group: 'Frame' },
  { id: 'rafter', name: 'Common rafter', blurb: 'Length, plumb cut, birdsmouth', free: false, group: 'Roof' },
  { id: 'hip', name: 'Hip & valley', blurb: 'Hip pitch, length, creepers', free: false, group: 'Roof' },
  { id: 'pitch', name: 'Roof pitch', blurb: 'Degrees, rise/run, x in 12', free: true, group: 'Roof' },
  { id: 'mitre', name: 'Mitre', blurb: 'Any corner or polygon', free: true, group: 'Trim' },
  { id: 'crown', name: 'Cornice & compound', blurb: 'Bevel and mitre settings', free: false, group: 'Trim' },
  { id: 'square', name: 'Square check', blurb: 'Diagonals and 3-4-5', free: true, group: 'Set-out' },
  { id: 'arc', name: 'Arch & radius', blurb: 'Trammel radius, offsets', free: false, group: 'Set-out' },
  { id: 'convert', name: 'Fractions ↔ mm', blurb: 'Tape fractions, feet, mm', free: true, group: 'Set-out' },
]);

export const toolById = (id: string): ToolInfo | undefined => TOOLS.find((t) => t.id === id);


const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Tool name and blurb in the chosen country's trade words (mitre/miter, cornice/coving/crown, going/run). */
export function localTool(t: ToolInfo, terms: Terms): { name: string; blurb: string } {
  switch (t.id) {
    case 'mitre':
      return { name: terms.Mitre, blurb: 'Any corner or polygon' };
    case 'crown':
      return { name: `${cap(terms.cornice)} & compound`, blurb: `Bevel and ${terms.mitre} settings` };
    case 'stairs':
      return { name: 'Stairs', blurb: `Risers, ${terms.going}, stringer, code check` };
    case 'layout':
      return { name: 'Stud & joist layout', blurb: `Marks on centres, ${terms.noggin} lengths` };
    default:
      return { name: t.name, blurb: t.blurb };
  }
}
