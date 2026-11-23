/**
 * Australia. Researched 23 Nov 2026 (session notes research-au-nz.md; summary in docs/SOURCES.md).
 * Tiles: Bunnings and Beaumont Tiles product spec blocks (size, thickness, m² and pieces per carton).
 * Adhesive: ARDEX X 56, Mapei Keraflex Easy S1, Bostik Excelflex, Davco Ultraflex data sheets.
 * Grout: Mapei Ultracolor Plus (AU TDS, formula factor 1.6), Kerapoxy (1550 kg/m³), ARDEX FG 8, Davco Easy Grout.
 * Membrane: Davco K10 Plus, ARDEX WPM 155 Rapid Plus, Mapei Mapelastic AquaDefense; ARDEX STB tape 75 mm × 15 m.
 * Code: NCC 2022 Housing Provisions Parts 10.2 (wet areas) and 11.2 (stairs); AS 3958:2023; AS 3740:2021.
 */
import { CONTACT_RULES } from '../core/notch.ts';
import type { Country, TileItem } from './types.ts';

const BN = 'https://www.bunnings.com.au/';
const t = (id: string, l: number, w: number, thk: number, use: TileItem['use'], boxM2: number | undefined, perBox: number | undefined, path: string, extra: Partial<TileItem> = {}): TileItem =>
  ({ id: `au-${id}`, label: `${Math.max(l, w)} × ${Math.min(l, w)}`, lengthMm: Math.max(l, w), widthMm: Math.min(l, w), thicknessMm: thk, use, boxM2, perBox, src: path.startsWith('http') ? path : BN + path, ...extra });

const NCC10 = 'https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/10-health-and-amenity/part-102-wet-area-waterproofing';
const NCC11 = 'https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/11-safe-movement-and-access/part-112-stairway-and-ramp-construction';

export const AU: Country = {
  code: 'AU', name: 'Australia', flag: '🇦🇺', system: 'metric', currency: 'AUD', locale: 'en-AU', spelling: 'british',
  terms: { waterproofing: 'Waterproofing', membrane: 'Membrane', adhesive: 'Tile adhesive', trim: 'Tile trim', falls: 'Falls', waste: 'floor waste', setOut: 'Set-out', box: 'carton', colour: 'colour', backer: 'fibre cement sheet' },
  falls: { min: 80, max: 50, verified: true, label: 'NCC 2022 Housing Provisions 10.2.12: continuous fall to the floor waste at least 1:80 and no steeper than 1:50', src: NCC10 },
  membraneHeights: { showerWallMm: 1800, upturnMm: 150, verified: true, label: 'NCC 10.2.2: shower walls waterproof to at least 1800 mm, junctions 40 mm each side. The 150 mm upturn outside the shower is trade practice (AS 3740).', src: NCC10 },
  stairs: { riserMin: 115, riserMax: 190, goingMin: 240, goingMax: 355, twoRGMin: 550, twoRGMax: 700, source: 'NCC 2022 Housing Provisions Table 11.2.2a', verified: true, src: NCC11, docs: 'Max 18 risers per flight.' },
  contactRule: CONTACT_RULES.AS3958,
  trimStockMm: [2500, 3000],
  jointMm: { floor: 3, wall: 2 },
  standards: [
    { topic: 'installation', name: 'AS 3958:2023', note: 'Installation of ceramic and stone tiles. Replaces AS 3958.1-2007, which many data sheets still quote.', src: 'https://hia.com.au/resources-and-advice/building-materials-and-products/use-the-right-building-products' },
    { topic: 'installation', name: 'AS 3958.1 contact', note: 'Adhesive contact: 65% residential walls, 80% residential floors, 90% wet areas, commercial floors, pools and outside.', src: 'https://ardex.co.nz/nzpdf/Technical%20Bulletins/TP002.005_AdhesiveCoverageIssues.pdf' },
    { topic: 'waterproofing', name: 'AS 3740:2021', note: 'Waterproofing of domestic wet areas, called up by NCC Housing Provisions 10.2.1.', src: 'https://store.standards.org.au/product/as-3740-2021' },
    { topic: 'waterproofing', name: 'NCC 2022 HP 10.2', note: 'Shower walls to 1800 mm; wall junctions 40 mm each side; waterstop 1500 mm from an unenclosed rose; step-down 25 mm min; hob membrane 50 mm onto the floor; 150 mm above baths and basins.', src: NCC10 },
    { topic: 'falls', name: 'NCC 2022 HP 10.2.12', note: 'Where there is a floor waste: fall at least 1:80, no steeper than 1:50. (The old 1:60–1:80 shower figure is out of date.)', src: NCC10 },
    { topic: 'materials', name: 'AS/NZS 4858:2004', note: 'Wet-area membranes, Class I–III by elongation. Use Class III over timber and sheet.', src: 'https://aus.sika.com/dam/dms/au01/1/davco-k10-plus.pdf' },
    { topic: 'slip', name: 'AS 4586 via NCC Table 11.2.4', note: 'Stair treads and nosing strips: P3 dry, P4 wet.', src: 'https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/11-safe-movement-and-access/part-114-slip-resistance' },
    { topic: 'stairs', name: 'NCC 2022 HP 11.2.2', note: 'Riser 115–190 mm, going 240–355 mm, 2R + G 550–700 mm, 2 to 18 risers per flight.', src: NCC11 },
  ],
  catalogue: {
    tiles: [
      t('600x600-4', 600, 600, 9, 'both', 1.44, 4, 'signorino-600-x-600mm-oxide-ruggine-porcelain-tile-carton-of-4-1-44m2_p0'),
      t('600x600-3', 600, 600, 9.5, 'both', 1.08, 3, 'duratile-60-x-60cm-1-08m-crema-porcelain-indoor-floor-and-wall-tile-3-ca'),
      t('600x1200', 1200, 600, 10, 'both', 1.44, 2, 'https://beaumont-tiles.com.au/products/1297461-basilica-chalk-structured-silk-tile'),
      t('300x600-8', 600, 300, 9.5, 'both', 1.44, 8, 'johnson-30-x-60cm-1-44m-gold-milazzo-non-slip-tile-8-pack-gold_p0624883'),
      t('300x600-6', 600, 300, 9.5, 'both', 1.08, 6, 'duratile-30-x-60cm-1-08m-light-grey-terrazzo-floor-and-wall-tile-6-carto', { note: 'Actual face 298.5 × 600' }),
      t('300x800', 800, 300, 8.5, 'both', 1.44, 6, 'johnson-tiles-800-x-300mm-1-44m-white-matt-cape-flow-tile_p0335527'),
      t('450x450', 450, 450, 8, 'floor', 1.42, 7, 'https://beaumont-tiles.com.au/products/79937-belga-taupe-matt-tile'),
      t('400x400', 400, 400, 8, 'both', 0.96, 6, 'practa-solutions-40-x-40cm-0-96m2-portland-ivory-ceramic-floor-tile_p096'),
      t('300x300', 300, 300, 7.2, 'both', 1.35, 15, 'johnson-tiles-300-x-300mm-carrara-statuari-ceramic-floor-tile-carton-of-'),
      t('200x400', 400, 200, 8.5, 'wall', 1.44, 18, 'johnson-400-x-200mm-white-gloss-wall-tile-carton-of-18_p6661016'),
      t('200x300', 300, 200, 7.2, 'wall', 1.44, 24, 'johnson-300-x-200mm-1-44m-ultra-white-gloss-tile-24-carton_p0393855'),
      t('200x200', 200, 200, 8, 'both', 1.0, 25, 'johnson-tiles-200-x-200mm-grey-matt-elements-tiles-25-carton_p0575848'),
      t('150x150', 150, 150, 5, 'wall', 0.99, 44, 'johnson-tiles-150-x-150mm-ultra-white-gloss-ceramic-wall-tile-carton-of-'),
      t('100x300', 300, 100, 7.8, 'wall', 1.02, 34, 'duratile-10-x-30cm-1-02m-white-gloss-subway-wall-tile-34-carton_p0038766'),
      t('75x300', 300, 75, 9, 'wall', 0.99, 44, 'duratile-75-x-300mm-white-gloss-wall-tile-0-99sqm_p0575350'),
      t('100x200', 200, 100, 8, 'wall', 1.0, 50, 'johnson-tiles-200-x-100mm-white-ceramic-wall-tile-carton-50_p0012683'),
      t('mosaic-300', 300, 300, 8, 'wall', 0.72, 8, 'decor8-tiles-300-x-300-x-8mm-grey-mix-linear-mosaic-tile_p6660778', { sheet: true, label: '300 × 300 mosaic sheet', note: 'Count is in sheets' }),
      t('hex-140', 160, 140, 8, 'both', undefined, 30, 'decor8-tiles-140-x-160mm-capri-bettina-hexagon-blue-porcelain-floor-tile', { label: '160 × 140 hexagon' }),
    ],
    adhesives: [
      { id: 'au-c2-20', label: 'Flexible C2 adhesive, 20 kg', bagKg: 20, coverage: [{ notchMm: 4, kgPerM2: 2.0 }, { notchMm: 6, kgPerM2: 3.0 }, { notchMm: 10, kgPerM2: 5.0 }], src: 'https://cdnmedia.mapei.com/docs/librariesprovider14/products-documents/1_00011_keraflex-easy-s1-_en-au.pdf', docs: 'Mapei Keraflex Easy S1 (C2ES1): 2 / 2.5–3 / 5 kg/m² at 4 / 6 / 10 mm.' },
      { id: 'au-c1-15', label: 'Flexible rapid C1 adhesive, 15 kg', bagKg: 15, coverage: [{ notchMm: 6, kgPerM2: 15 / 12 }, { notchMm: 10, kgPerM2: 15 / 8 }], src: 'https://adheseal.com.au/cdn/shop/files/ardex-x56-tile-adhesive-technical-data-sheet.pdf', docs: 'ARDEX X 56 (C1 E S2): 12–14 m² per 15 kg at 6 mm (walls), 8–10 m² at 10 mm (floors); low end used.' },
      { id: 'au-c1-20', label: 'Flexible C1 adhesive, 20 kg', bagKg: 20, coverage: [{ notchMm: 10, kgPerM2: 2.8 }], src: 'https://www.bostik.com/files/live/sites/shared_bostik/files/import-australia/bostik-tiling-info-sheet.pdf', docs: 'Bostik Excelflex (C1S1T): 2.8 kg/m² at 10 mm.' },
      { id: 'au-rubber-20', label: 'Rubber-modified adhesive, 20 kg', bagKg: 20, coverage: [{ notchMm: 6, kgPerM2: 20 / 12 }], src: 'https://aus.sika.com/dms/getdocument.get/9872370c-646c-487d-9abb-c8dfbf3872e4/Davco%20Ultraflex%20Data%20Sheet.pdf', docs: 'Davco Ultraflex: 12 m² per 20 kg at 6 mm.' },
    ],
    grouts: [
      { id: 'au-cg2-5', label: 'Cement grout CG2, 5 kg', bagKg: 5, density: 1.6, kind: 'cement', src: 'https://cdnmedia.mapei.com/docs/librariesprovider14/products-documents/1_02801_ultracolor-plus_en-au.pdf', docs: 'Mapei Ultracolor Plus AU TDS: kg/m² = (A+B)/(A×B) × C × D × 1.6.' },
      { id: 'au-cg2-2', label: 'Cement grout CG2, 2 kg', bagKg: 2, density: 1.6, kind: 'cement', src: 'https://cdnmedia.mapei.com/docs/librariesprovider14/products-documents/1_02801_ultracolor-plus_en-au.pdf' },
      { id: 'au-cement-20', label: 'Flexible cement grout, 20 kg', bagKg: 20, density: 1.6, kind: 'cement', verified: false, src: 'https://cdn.shopify.com/s/files/1/0281/3560/files/ARDEX_FG_8_Datasheet.pdf', docs: 'ARDEX FG 8 sells 1.5/5/20 kg and publishes a table, not a factor: generic 1.6 used. Maker advises 15–20% wastage.' },
      { id: 'au-epoxy-5', label: 'Epoxy grout kit, 5 kg', bagKg: 5, density: 1.55, kind: 'epoxy', src: 'https://cdnmedia.mapei.com/docs/librariesprovider14/products-documents/1_00141_kerapoxy_en.pdf', docs: 'Mapei Kerapoxy: mix density 1550 kg/m³; kits 2, 5, 10 kg.' },
      { id: 'au-epoxy-2', label: 'Epoxy grout kit, 2 kg', bagKg: 2, density: 1.55, kind: 'epoxy', src: 'https://cdnmedia.mapei.com/docs/librariesprovider14/products-documents/1_00141_kerapoxy_en.pdf' },
      { id: 'au-premix-4', label: 'Premixed grout, 4 L tub', bagKg: 4 * 1.8, density: 1.8, kind: 'cement', src: 'https://aus.sika.com/dam/dms/au01/3/davco-easy-grout.pdf', docs: 'Davco Easy Grout: bulk density 1.8 kg/L, 2 L and 4 L.' },
    ],
    membranes: [
      { id: 'au-pu-20', label: 'Polyurethane membrane, 20 L (Class III)', packL: 20, litresPerM2PerCoat: 0.75, coats: 2, note: '1 mm dry film in 2 coats', src: 'https://aus.sika.com/dam/dms/au01/1/davco-k10-plus.pdf', docs: 'Davco K10 Plus: 20 L ≈ 13.3 m² in 2 coats, 0.75 mm wet per coat.' },
      { id: 'au-pu-4', label: 'Polyurethane membrane, 4 L (Class III)', packL: 4, litresPerM2PerCoat: 0.75, coats: 2, src: 'https://aus.sika.com/dam/dms/au01/1/davco-k10-plus.pdf' },
      { id: 'au-hybrid-15', label: 'Rapid hybrid membrane, 15 L (Class III)', packL: 15, litresPerM2PerCoat: 15 / 17.5 / 2, coats: 2, note: '0.5 mm dry film in 2 coats', src: 'https://ardexaustralia.com/pdf/products/datasheets/waterproofing/ARDEX%20WPM%20155%20Rapid%20Plus%20Datasheet.pdf', docs: 'ARDEX WPM 155 Rapid Plus: 15 L = 17.5 m², 4 L = 4.5 m².' },
      { id: 'au-elastic-15', label: 'One-part elastic membrane, 15 kg', packL: 15 / 1.3, litresPerM2PerCoat: 0.5 / 1.3, coats: 2, note: '1 kg/m² for 2 coats', src: 'https://cdnmedia.mapei.com/docs/librariesprovider14/products-documents/1_14224_mapelastic-aquadefense_en-au.pdf', docs: 'Mapei Mapelastic AquaDefense: 1.0 kg/m² for 2 coats, density 1.3; packs 3.5 / 7.5 / 15 kg.' },
    ],
  },
  extras: { primerM2PerLitre: 1 / (0.15 / 1.01), tapeRollMm: 15000, src: 'https://ardexaustralia.com/product/ardex-stb-tape/', docs: 'Primer: Mapei Primer G 0.08–0.15 kg/m², density 1.01 (high end used). Tape: ARDEX STB 75 mm × 15 m.' },
  guided: true,
};
