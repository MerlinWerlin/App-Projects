/**
 * Every other country: metric units and generic guidance only. No local catalogue was verified, so the pickers offer
 * plain sizes with no box data (the tiler types what the box says) and generic coverage rates that come from the
 * formula research (docs/SOURCES.md). The UI tells the user this guidance is generic.
 */
import { CONTACT_RULES } from '../core/notch.ts';
import type { Country, TileItem } from './types.ts';

const G = 'docs/SOURCES.md#generic';
const t = (l: number, w: number, thk: number, use: TileItem['use']): TileItem => ({ id: `xx-${l}x${w}`, label: `${l} × ${w}`, lengthMm: l, widthMm: w, thicknessMm: thk, use, src: G, verified: false });

export const GENERIC: Country = {
  code: 'XX', name: 'Other country', flag: '', system: 'metric', currency: '', locale: 'en-GB', spelling: 'british',
  terms: { waterproofing: 'Waterproofing', membrane: 'Membrane', adhesive: 'Tile adhesive', trim: 'Tile trim', falls: 'Falls', waste: 'floor waste', setOut: 'Set-out', box: 'box', colour: 'colour', backer: 'backer board' },
  falls: { min: 80, max: 50, verified: false, label: 'Generic: 1:80 to 1:50 is a common range for shower floors. Check your local building rules.', src: G },
  membraneHeights: { showerWallMm: 1800, upturnMm: 150, verified: false, label: 'Generic: shower walls to 1800 mm and a 150 mm upturn elsewhere. Check your local rules and the membrane maker.', src: G },
  stairs: null,
  contactRule: CONTACT_RULES.ANSI,
  trimStockMm: [2500],
  jointMm: { floor: 3, wall: 2 },
  standards: [
    { topic: 'materials', name: 'ISO 13007 / EN 12004 / EN 13888', note: 'International classes for adhesives (C1, C2, T, E, S1, S2) and grouts (CG1, CG2, RG) printed on most bags.', src: 'https://cdnmedia.mapei.com/docs/librariesprovider14/products-documents/1_02801_ultracolor-plus_en-au.pdf' },
  ],
  catalogue: {
    tiles: [t(600, 600, 9, 'both'), t(1200, 600, 10, 'both'), t(600, 300, 9, 'both'), t(450, 450, 8, 'floor'), t(300, 300, 8, 'both'), t(200, 200, 8, 'both'), t(300, 100, 8, 'wall'), t(150, 75, 8, 'wall')],
    adhesives: [{ id: 'xx-20', label: 'Cement-based adhesive, 20 kg', bagKg: 20, src: G, verified: false }, { id: 'xx-25', label: 'Cement-based adhesive, 25 kg', bagKg: 25, src: G, verified: false }],
    grouts: [{ id: 'xx-5', label: 'Cement grout, 5 kg', bagKg: 5, density: 1.6, kind: 'cement', src: G, verified: false }, { id: 'xx-epoxy-5', label: 'Epoxy grout, 5 kg', bagKg: 5, density: 1.55, kind: 'epoxy', src: G, verified: false }],
    membranes: [{ id: 'xx-liquid-20', label: 'Liquid membrane, 20 L (generic 0.75 L/m² per coat)', packL: 20, litresPerM2PerCoat: 0.75, coats: 2, src: G, verified: false }],
  },
  extras: { primerM2PerLitre: null, tapeRollMm: null, src: G, verified: false },
  guided: false,
};
