/**
 * United Kingdom. Researched 23 Nov 2026 (session notes research-uk-ie.md; summary in docs/SOURCES.md).
 * Tiles: Wickes and Topps Tiles product pages (Topps box counts from the page's tiles_per_box field; m² derived).
 * Adhesive: BAL Flex One, ARDEX X 77, Palace Super-Grip data sheets. Grout: Mapei Ultracolor Plus (factor 1.6),
 * BAL Micromax3, BAL Floor Epoxy. Tanking: BAL Waterproof 1C (kg), Everbuild/Sika Aquaseal wet-room kit (L).
 * Primer: BAL Primer 1C 6 m²/L. Tape: BAL Waterproof 1C tape 100 mm × 5 m. Trims: 2.5 m (Screwfix listings).
 * Code: BS 5385-1:2018, -3:2024 (replaces -3:2014 and -5:2009), -4:2015; Approved Document K (England).
 */
import { CONTACT_RULES } from '../core/notch.ts';
import type { Country, TileItem } from './types.ts';

const t = (id: string, l: number, w: number, thk: number, use: TileItem['use'], boxM2: number | undefined, perBox: number | undefined, src: string, extra: Partial<TileItem> = {}): TileItem =>
  ({ id: `gb-${id}`, label: `${Math.max(l, w)} × ${Math.min(l, w)}`, lengthMm: Math.max(l, w), widthMm: Math.min(l, w), thicknessMm: thk, use, boxM2, perBox, src, ...extra });
const WK = 'https://www.wickes.co.uk/';
const TP = 'https://www.toppstiles.co.uk/';
const BAL1C = 'https://www.bal-adhesives.com/wp-content/uploads/2026/03/BAL-WATERPROOF-1C-MAY-25.pdf';
const AQUA = 'https://irl.sika.com/dms/getdocument.get/aa8f7649-28e2-4eb7-a8a4-7cf56c7b5406/everbuild_aquasealwetrooms';

export const GB: Country = {
  code: 'GB', name: 'United Kingdom', flag: '🇬🇧', system: 'metric', currency: 'GBP', locale: 'en-GB', spelling: 'british',
  terms: { waterproofing: 'Tanking', membrane: 'Tanking', adhesive: 'Tile adhesive', trim: 'Tile trim', falls: 'Falls', waste: 'drain', setOut: 'Setting out', box: 'box', colour: 'colour', backer: 'tile backer board' },
  falls: {
    min: 80, max: 35, target: 60, verified: false,
    label: 'Wet room floors: 1:80 shallowest to 1:35 steepest is the usual trade range (BS 5385-4 practice); warranty bodies quote 1:80–1:100 to the drain. The BS figure itself could not be checked (paywalled).',
    src: 'https://building.co.uk/cpd/-cpd-14-2015-integrated-solutions-for-wetrooms-with-tile-and-stone-coverings/5076632.article',
  },
  membraneHeights: { showerWallMm: 1800, upturnMm: 150, verified: true, label: 'Warranty guidance (Premier Guarantee): showers tanked 150 mm above the floor junction and water resistant to at least 1800 mm. Wet rooms are "frequent wetting" under BS 5385-4: tank the whole floor.', src: 'https://www.premierguarantee.com/en/insite/Technical/Showers-and-wet-room-construction.html' },
  stairs: { riserMin: 150, riserMax: 220, goingMin: 220, goingMax: 300, twoRGMin: 550, twoRGMax: 700, source: 'Approved Document K Table 1.1 (private stair, England)', verified: true, src: 'https://assets.publishing.service.gov.uk/media/60d5bdcde90e07716f516cfd/Approved_Document_K.pdf', docs: 'Max pitch 42°. Scotland, Wales and NI have their own regulations.' },
  contactRule: CONTACT_RULES.BS5385,
  trimStockMm: [2500],
  jointMm: { floor: 3, wall: 2 },
  standards: [
    { topic: 'installation', name: 'BS 5385-1:2018', note: 'Internal wall tiling in normal conditions.', src: 'https://www.tiles.org.uk/relevant-standards/' },
    { topic: 'installation', name: 'BS 5385-3:2024', note: 'All internal and external floor tiling. Replaces BS 5385-3:2014 and BS 5385-5 (withdrawn).', src: 'https://www.tiles.org.uk/tta-urges-awareness-on-updates-to-the-british-standard-for-wall-floor-tiling/' },
    { topic: 'waterproofing', name: 'BS 5385-4:2015', note: 'Special conditions: wet areas, pools, heated screeds. Frequently wet areas need a watertight structure behind the tiles and solid bedding.', src: 'https://knowledge.bsigroup.com/products/wall-and-floor-tiling-design-and-installation-of-ceramic-natural-stone-and-mosaic-tiling-in-special-conditions-code-of-practice' },
    { topic: 'installation', name: 'BS 8000-11:2011', note: 'Workmanship on site: wall and floor tiling.', src: 'https://knowledge.bsigroup.com/products/workmanship-on-building-sites-internal-and-external-wall-and-floor-tiling' },
    { topic: 'materials', name: 'BS EN 12004 / BS EN 13888', note: 'Adhesive classes C/D/R, 1/2, F, T, E, S1/S2. Grout classes CG1/CG2 (W, A) and RG.', src: 'https://knowledge.bsigroup.com/products/adhesives-for-ceramic-tiles-requirements-assessment-and-verification-of-constancy-of-performance-classification-and-marking' },
    { topic: 'waterproofing', name: 'BS EN 14891', note: 'Liquid-applied waterproofing under bonded tiling.', src: 'https://www.tiles.org.uk/relevant-standards/' },
    { topic: 'slip', name: 'HSE GEIS2 / UKSRG', note: 'Pendulum Test Value 36 or more is low slip potential (0–24 high, 25–35 moderate).', src: 'https://www.hse.gov.uk/pubns/geis2.pdf' },
    { topic: 'stairs', name: 'Approved Document K', note: 'Private stairs: rise 150–220 mm, going 220–300 mm, 2R + G 550–700 mm, pitch 42° max.', src: 'https://assets.publishing.service.gov.uk/media/60d5bdcde90e07716f516cfd/Approved_Document_K.pdf' },
  ],
  catalogue: {
    tiles: [
      t('600x600-wk', 600, 600, 9, 'both', 1.44, 4, `${WK}Wickes-Boutique-Genova-Beige-Matt-Porcelain-Wall+Floor-Tile---600-x-600mm/p/`),
      t('600x600-tp', 600, 600, 9.5, 'both', 1.44, 4, `${TP}bathroom-tiles/elementi-grey-tile-60cm-x-60cm`),
      t('1200x600-wk', 1200, 600, 9.7, 'both', 1.44, 2, `${WK}Wickes-Boutique-Harmony-Natural-Matt-Porcelain-Wall+Floor-Tile---1200-x-600mm/p/`),
      t('1200x600-tp', 1200, 600, 8, 'both', 1.44, 2, `${TP}bathroom-tiles/aldbury-bone-tile-60cm-x-120cm`),
      t('600x300', 600, 300, 8.7, 'both', 1.26, 7, `${TP}bathroom-tiles/elementi-grey-tile-30cm-x-60cm`),
      t('1200x200', 1200, 200, 9, 'both', 1.2, 5, `${TP}bathroom-tiles/nordbon-arena-tile-20cm-x-120cm`, { label: '1200 × 200 plank' }),
      t('400x250', 400, 250, 8, 'wall', 1.0, 10, `${WK}Wickes-White-Gloss-Ceramic-Wall-Tile---400-x-250mm/p/273047`),
      t('400x200', 400, 200, 10, 'wall', 0.96, 12, `${TP}bathroom-tiles/kelham-lofttm-chalk-tile-20cm-x-40cm`),
      t('200x200', 200, 200, 10, 'both', 0.96, 24, `${TP}bathroom-tiles/cotto-tile-20cm-x-20cm`),
      t('200x100', 200, 100, 7, 'wall', 1.0, 50, `${WK}Wickes-Metro-White-Gloss-Ceramic-Wall-Tile---200-x-100mm/p/166211`, { label: '200 × 100 metro' }),
      t('150x75', 150, 75, 7.5, 'wall', 0.675, 60, `${TP}bathroom-tiles/campagna-artisan-taupe-tile-7-5cm-x-15cm`),
    ],
    adhesives: [
      { id: 'gb-c2-20', label: 'Flexible C2TE S1 adhesive, 20 kg', bagKg: 20, coverage: [{ notchMm: 4, kgPerM2: 1.67 }, { notchMm: 6, kgPerM2: 2.0 }, { notchMm: 10, kgPerM2: 3.85 }], src: 'https://www.theunderfloorheatingstore.com/cdn/shop/files/BAL-FLEX-ONE-TDS-FEB-22.pdf', docs: 'BAL Flex One: 4 mm 1.67, 6 mm 2.0 (2.5 solid bed), 10 mm solid bed 3.85 kg/m².' },
      { id: 'gb-c2-fibre-20', label: 'Fibre-reinforced C2TE S1 adhesive, 20 kg', bagKg: 20, coverage: [{ notchMm: 8, kgPerM2: 2.5 }], src: 'https://www.ctdtiles.co.uk/product/ardex-x-77-microtec-fibre-reinforced-flexible-standard-set-adhesive', docs: 'ARDEX X 77: 8 m² per 20 kg with an 8 × 8 mm trowel.' },
      { id: 'gb-ready-15', label: 'Ready-mixed wall adhesive (D1TE), 15 kg tub', bagKg: 15, coverage: [{ notchMm: 6, kgPerM2: 1.7 }], src: 'https://palacechemicals.co.uk/wp-content/uploads/2019/01/SuperGrip-TDS-Live.pdf', docs: 'Palace Super-Grip: ~1.7 kg/m²; tubs 3.75 / 7.5 / 15 kg. Walls only.' },
    ],
    grouts: [
      { id: 'gb-cg2-5', label: 'Cement grout CG2WA, 5 kg', bagKg: 5, density: 1.6, kind: 'cement', src: 'https://www.tilemountain.co.uk/pdf/Ultracolor_Plus_Datasheet.pdf', docs: 'Mapei Ultracolor Plus UK TDS: (A+B)/(A×B) × thickness × joint × 1.6. Also 2 and 23 kg.' },
      { id: 'gb-cg2-2', label: 'Cement grout CG2WA, 2 kg', bagKg: 2, density: 1.6, kind: 'cement', src: 'https://www.tilemountain.co.uk/pdf/Ultracolor_Plus_Datasheet.pdf' },
      { id: 'gb-cg2-10', label: 'Flexible cement grout, 10 kg', bagKg: 10, density: 1.6, kind: 'cement', verified: false, src: 'https://www.bal-adhesives.com/wp-content/uploads/2026/03/BAL-MICROMAX3-ECO-MAY-25.pdf', docs: 'BAL Micromax3 2.5 / 5 / 10 kg (SG 1.5, coverage table). Generic factor 1.6 used for the formula.' },
      { id: 'gb-epoxy-10', label: 'Epoxy floor grout RG1, 10 kg', bagKg: 10, density: 1.75, kind: 'epoxy', src: 'https://www.bal-adhesives.com/wp-content/uploads/2026/03/BAL-FLOOR-EPOXY-MAY-25.pdf', docs: 'BAL Floor Epoxy: specific gravity 1.75.' },
    ],
    membranes: [
      { id: 'gb-1c-wall', label: 'Liquid tanking 5 kg, walls (0.8 mm dry)', packL: 5, packUnit: 'kg', litresPerM2PerCoat: 5 / 6 / 2, coats: 2, note: '6 m² per 5 kg on walls', src: BAL1C, docs: 'BAL Waterproof 1C: walls 6 m², floors 3 m² per 5 kg.' },
      { id: 'gb-1c-floor', label: 'Liquid tanking 5 kg, floors (1.6 mm dry)', packL: 5, packUnit: 'kg', litresPerM2PerCoat: 5 / 3 / 2, coats: 2, note: '3 m² per 5 kg on floors', src: BAL1C },
      { id: 'gb-kit-3', label: 'Wet room tanking kit, 3 L (4.5 m²)', packL: 3, litresPerM2PerCoat: 3 / 4.5 / 2, coats: 2, note: 'Kit includes primer and 10 m tape', src: AQUA, docs: 'Everbuild Aquaseal Wet Room System: 3 L = 4.5 m², 5 L = 7.5 m², 2 coats.' },
      { id: 'gb-kit-5', label: 'Wet room tanking kit, 5 L (7.5 m²)', packL: 5, litresPerM2PerCoat: 5 / 7.5 / 2, coats: 2, note: 'Kit includes primer and 10 m tape', src: AQUA },
    ],
  },
  extras: { primerM2PerLitre: 6, tapeRollMm: 5000, src: 'https://www.bal-adhesives.com/product/bal-waterproof-1c-tape/', docs: 'BAL Primer 1C 6 m²/L; BAL Waterproof 1C tape 100 mm × 5 m.' },
  guided: true,
};
