/**
 * New Zealand. Researched 23 Nov 2026 (session notes research-au-nz.md; summary in docs/SOURCES.md).
 * Tiles: Bunnings NZ spec blocks; 600×1200 from Tile Warehouse (search listing). Adhesive: ARDEX NZ X 56 page.
 * Grout: ARDEX FG 8 (NZ). Membrane: ARDEX WPM 155 Rapid (NZ), Mapei Mapelastic AquaDefense (NZ TDS).
 * Code: NZBC E3 / E3/AS1 and D1/AS1 Table 6 as summarised by BRANZ / LEVEL (the code PDFs could not be text-read).
 */
import type { Country, TileItem } from './types.ts';

const BN = 'https://www.bunnings.co.nz/';
const t = (id: string, l: number, w: number, thk: number, use: TileItem['use'], boxM2: number | undefined, perBox: number | undefined, path: string, extra: Partial<TileItem> = {}): TileItem =>
  ({ id: `nz-${id}`, label: `${Math.max(l, w)} × ${Math.min(l, w)}`, lengthMm: Math.max(l, w), widthMm: Math.min(l, w), thicknessMm: thk, use, boxM2, perBox, src: path.startsWith('http') ? path : BN + path, ...extra });
const LEVEL = 'https://www.level.org.nz/wet-areas/waterproofing-tiled-showers/';

export const NZ: Country = {
  code: 'NZ', name: 'New Zealand', flag: '🇳🇿', system: 'metric', currency: 'NZD', locale: 'en-NZ', spelling: 'british',
  terms: { waterproofing: 'Waterproofing', membrane: 'Membrane', adhesive: 'Tile adhesive', trim: 'Tile trim', falls: 'Falls', waste: 'floor waste', setOut: 'Set-out', box: 'carton', colour: 'colour', backer: 'fibre cement board' },
  falls: { min: 50, max: null, verified: true, label: 'E3/AS1 3.3.2.3: open (level-entry) showers fall at least 1:50 to the waste within 1500 mm of the rose. BRANZ gives 1:60 for enclosed showers with an upstand.', src: LEVEL, docs: 'Secondary (LEVEL / BRANZ).' },
  membraneHeights: { showerWallMm: 1800, upturnMm: 150, verified: true, label: 'E3/AS1: enclosures impervious to at least 1800 mm above the floor and 300 mm above the rose. The 150 mm upturn outside the shower is generic trade practice.', src: LEVEL },
  stairs: { riserMin: 0, riserMax: 190, goingMin: 280, goingMax: 100_000, source: 'D1/AS1 Table 6 (main private stair)', verified: true, src: 'https://www.branz.co.nz/documents/4044/BU625-Stair-Design.pdf', docs: 'Pitch max 37°. Secondary private 200/250/41°, service 220/220/47°. NZ does not use 2R+G. Max 5 mm variation between steps.' },
  contactRule: 'Lift a tile to check contact: aim for full bedding in wet areas (WMA Code of Practice). AS 3958 contact figures are widely used in NZ.',
  trimStockMm: [2500, 3000],
  jointMm: { floor: 3, wall: 2 },
  standards: [
    { topic: 'waterproofing', name: 'NZBC E3 / E3/AS1', note: 'Tiles max 6% water absorption; shower floor and walls impervious; enclosures to 1800 mm and 300 mm above the rose; open showers fall 1:50 within 1500 mm of the rose.', src: LEVEL },
    { topic: 'waterproofing', name: 'E3/AS2', note: 'Internal wet-area membranes: WMA Code of Practice (4th ed.), membranes to AS/NZS 4858, all parts from one supplier.', src: LEVEL },
    { topic: 'materials', name: 'NZBC B2', note: 'Waterproofing under wet-area tiling needs at least 15 years durability.', src: LEVEL },
    { topic: 'stairs', name: 'D1/AS1 Table 6', note: 'Main private stairs: riser 190 mm max, going 280 mm min, pitch 37° max. Max 5 mm between steps.', src: 'https://www.branz.co.nz/documents/4044/BU625-Stair-Design.pdf' },
    { topic: 'slip', name: 'D1/AS1 2.1', note: 'Level access routes: coefficient of friction 0.4 or more (AS/NZS 3661.1, or AS 4586).', src: 'https://www.building.govt.nz/building-code-compliance/d-access/d1-access-routes/slip-resistance/' },
  ],
  catalogue: {
    tiles: [
      t('600x1200', 1200, 600, 9.5, 'both', 1.44, 2, 'https://tilewarehouse.co.nz/tile-ranges/pisa-gold/pisa-gold-polished-600x1200/', { verified: false }),
      t('600x600-4', 600, 600, 9, 'floor', 1.44, 4, 'johnson-tiles-600-x-600mm-1-44m-anthracite-matt-chicago-4-pack_p0335558', { verified: false, note: 'Thickness not listed: check the box' }),
      t('600x600-3', 600, 600, 9, 'both', 1.08, 3, 'duratile-60-x-60cm-1-08m-aggregate-grey-porcelain-indoor-floor-tile-3-car', { verified: false, note: 'Thickness not listed: check the box' }),
      t('300x600-7', 600, 300, 9, 'floor', 1.26, 7, 'johnson-tiles-300-x-600mm-pavement-haze-matt-1-26m2-carton-of-7_p0469226'),
      t('300x600-6', 600, 300, 9.5, 'both', 1.08, 6, 'practa-solutions-30-x-60cm-1-08m-light-grey-terrazzo-porcelain-floor-and-'),
      t('300x300', 300, 300, 7.2, 'both', 1.35, 15, 'johnson-tiles-300-x-300mm-1-35m-carrara-matt-statuari-ceramic-floor-tile-'),
      t('200x300', 300, 200, 7.8, 'wall', 1.44, 24, 'johnson-tiles-300-x-200mm-1-44m-ultra-white-gloss-tile-24-carton_p0393855'),
      t('200x200', 200, 200, 7.8, 'wall', 1.52, 38, 'johnson-200-x-200mm-1-52m-ultra-white-gloss-ceramic-wall-tile-38-carton_p'),
      t('150x150', 150, 150, 5, 'wall', 0.99, 44, 'johnson-tiles-150-x-150mm-ultra-white-gloss-ceramic-wall-tile-44-carton_p'),
      t('100x300', 300, 100, 8, 'wall', 1.2, 40, 'johnson-tiles-100-x-300mm-1-2m-black-gloss-tile-40-carton_p0405646'),
      t('75x300', 300, 75, 8, 'wall', 0.99, 44, 'johnson-tiles-75-x-300mm-0-99m2-grey-matt-artisan-wall-tile-carton-of-44_', { verified: false, note: 'Thickness not listed: check the box' }),
      t('100x200', 200, 100, 8, 'wall', 1.0, 50, 'johnson-tiles-200-x-100mm-white-ceramic-wall-tile-carton-50_p0012683'),
      t('mosaic-301', 301, 301, 6, 'wall', undefined, 1, 'johnson-tiles-301-x-301mm-white-satin-luna-mosaic-wall-tile_p0814727', { sheet: true, label: '301 × 301 mosaic sheet', note: 'Sold per sheet', verified: false }),
    ],
    adhesives: [
      { id: 'nz-c1-15', label: 'Flexible rapid adhesive, 15 kg', bagKg: 15, coverage: [{ notchMm: 6, kgPerM2: 15 / 8 }, { notchMm: 10, kgPerM2: 15 / 6 }], src: 'https://www.ardex.co.nz/product/ardex-x-56/', docs: 'ARDEX X 56 (NZ page): 8 m² walls (6 mm), 6 m² floors (10 mm) per 15 kg.' },
      { id: 'nz-c2-20', label: 'Flexible C2 adhesive, 20 kg', bagKg: 20, verified: false, src: 'https://www.mapei.com/nz/en/products-and-solutions/products/detail/keraflex-maxi-s1', docs: 'Sold in NZ; maker states 1.2 kg/m² per mm of bed, not per notch, so the generic notch rate is used.' },
    ],
    grouts: [
      { id: 'nz-cement-5', label: 'Flexible cement grout, 5 kg', bagKg: 5, density: 1.6, kind: 'cement', verified: false, src: 'https://www.ardex.co.nz/product/ardex-fg-8/', docs: 'ARDEX FG 8 NZ (5 / 20 kg). Factor not published: generic 1.6. Maker calculator adds 15% wastage.' },
      { id: 'nz-cement-20', label: 'Flexible cement grout, 20 kg', bagKg: 20, density: 1.6, kind: 'cement', verified: false, src: 'https://www.ardex.co.nz/product/ardex-fg-8/' },
    ],
    membranes: [
      { id: 'nz-hybrid-wall', label: 'Rapid hybrid membrane, 15 L, walls (0.5 mm)', packL: 15, litresPerM2PerCoat: 15 / 17.2 / 2, coats: 2, src: 'https://www.ardex.co.nz/product/ardex-wpm-155-rapid/', docs: 'ARDEX WPM 155 Rapid NZ: walls 17.2 m² for 2 coats at 0.5 mm DFT.' },
      { id: 'nz-hybrid-floor', label: 'Rapid hybrid membrane, 15 L, floors (1.0 mm)', packL: 15, litresPerM2PerCoat: 15 / 8.6 / 2, coats: 2, src: 'https://www.ardex.co.nz/product/ardex-wpm-155-rapid/', docs: 'Floors 8.6 m² for 2 coats at 1.0 mm DFT.' },
      { id: 'nz-elastic-15', label: 'One-part elastic membrane, 15 kg', packL: 15 / 1.3, litresPerM2PerCoat: 0.5 / 1.3, coats: 2, note: '1 kg/m² for 2 coats', src: 'https://cdnmedia.mapei.com/docs/librariesprovider22/products-documents/1_14224_mapelastic-aquadefense_en.pdf' },
    ],
  },
  extras: { primerM2PerLitre: 6, tapeRollMm: 15000, src: 'https://www.ardex.co.nz/product/ardex-multiprime/', docs: 'Primer: ARDEX Multiprime 6 m²/L. Tape: ARDEX STB 75 mm × 15 m.' },
  guided: true,
};
