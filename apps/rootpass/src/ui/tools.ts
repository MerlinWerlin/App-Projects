import type { ToolId } from '../plus/entitlement.ts';

export const TOOL_ORDER: ToolId[] = ['saddle', 'lobster', 'frame', 'cutlist', 'weight', 'weld', 'bend', 'pcd'];

export const TOOL_META: Record<ToolId, { title: string; short: string; pitch: string }> = {
  saddle: { title: 'Saddle cut', short: 'Pipe-to-pipe fishmouth template, any angle or offset', pitch: 'Fishmouth templates for any branch angle, size and offset, printed true scale to wrap round the pipe.' },
  lobster: { title: 'Lobster-back', short: 'Segmented bends: lengths, cut angles, template', pitch: 'Segmented bends with every piece length, the cut angle and a printable wrap template.' },
  frame: { title: 'Frame mitres', short: 'Rectangles and polygons: cut angles and lengths', pitch: 'Mitre angles and long and short points for rectangular and polygon frames.' },
  cutlist: { title: 'Cut list', short: 'Fewest stock lengths, kerf counted', pitch: 'Fits your parts into the fewest stock lengths, counting the blade kerf, with the offcuts shown.' },
  weight: { title: 'Steel weight', short: 'Plate, flat, round, CHS, RHS, angle', pitch: 'Mass of plate, bar, tube and angle in mild steel, stainless and aluminium.' },
  weld: { title: 'Weld metal', short: 'Filler wire or rods for a job', pitch: 'How much wire or how many rods a fillet or butt weld needs, by process.' },
  bend: { title: 'Sheet bending', short: 'Bend allowance, deduction, flat blank', pitch: 'Bend allowance, bend deduction and flat blank size for sheet and plate.' },
  pcd: { title: 'Bolt circle', short: 'PCD hole positions and drill template', pitch: 'Hole coordinates for a bolt circle, with a true-scale drilling template.' },
};
