/**
 * Ireland. Researched 23 Nov 2026 (session notes research-uk-ie.md; summary in docs/SOURCES.md).
 * No Irish ceramic tiling code of practice exists: NSAI sells BS 5385 and Irish data sheets cite it, so BS 5385 is
 * named (marked as UK practice used in Ireland). Stairs: TGD K 2014 Table 1. Slip: Health and Safety Authority.
 * Tiles: Woodies (box data), Tile Style (sizes/thickness only, rate-limited), Delforno (search listing).
 * Adhesive: BAL Flex One (sold in IE), Nicobond, Evo-Stik bags. Grout: Nicobond, Butech, Evo-Stik bags.
 * Tanking: Everbuild/Sika Ireland Aquaseal kit. Wet room falls: no Irish figure found -> generic, flagged.
 */
import { CONTACT_RULES } from '../core/notch.ts';
import type { Country, TileItem } from './types.ts';

const t = (id: string, l: number, w: number, thk: number, use: TileItem['use'], boxM2: number | undefined, perBox: number | undefined, src: string, extra: Partial<TileItem> = {}): TileItem =>
  ({ id: `ie-${id}`, label: `${Math.max(l, w)} × ${Math.min(l, w)}`, lengthMm: Math.max(l, w), widthMm: Math.min(l, w), thicknessMm: thk, use, boxM2, perBox, src, ...extra });
const TS = 'https://tilestyle.ie/products/';
const AQUA = 'https://irl.sika.com/dms/getdocument.get/aa8f7649-28e2-4eb7-a8a4-7cf56c7b5406/everbuild_aquasealwetrooms';
const TGDK = 'https://www.propertyhealthcheck.ie/wp-content/uploads/2015/07/tgd-part-k-2014.pdf';

export const IE: Country = {
  code: 'IE', name: 'Ireland', flag: '🇮🇪', system: 'metric', currency: 'EUR', locale: 'en-IE', spelling: 'british',
  terms: { waterproofing: 'Tanking', membrane: 'Tanking', adhesive: 'Tile adhesive', trim: 'Tile trim', falls: 'Falls', waste: 'drain', setOut: 'Setting out', box: 'box', colour: 'colour', backer: 'tile backer board' },
  falls: { min: 80, max: 35, verified: false, label: 'No Irish figure for wet room falls was found. 1:80 to 1:35 is the UK trade range (BS 5385-4 practice) that Irish suppliers follow: check the former maker\'s instructions.', src: 'https://building.co.uk/cpd/-cpd-14-2015-integrated-solutions-for-wetrooms-with-tile-and-stone-coverings/5076632.article' },
  membraneHeights: { showerWallMm: 1800, upturnMm: 150, verified: false, label: 'Generic: shower walls to 1800 mm, 150 mm upturn elsewhere, whole floor in a wet room. No Irish rule found: follow the tanking kit and BS 5385-4.', src: AQUA },
  stairs: { riserMin: 0, riserMax: 220, goingMin: 220, goingMax: 100_000, twoRGMin: 550, twoRGMax: 700, source: 'TGD K 2014 Table 1 (private stair)', verified: true, src: TGDK, docs: 'Optimum rise 175, going 250, 2R+G 600; pitch 42° max. No min rise or max going given.' },
  contactRule: `${CONTACT_RULES.BS5385} (BS 5385 is the code Irish suppliers cite.)`,
  trimStockMm: [2500],
  jointMm: { floor: 3, wall: 2 },
  standards: [
    { topic: 'installation', name: 'BS 5385 (used in Ireland)', note: 'No Irish ceramic tiling code exists. NSAI sells BS 5385 and suppliers\' data sheets cite it.', src: 'https://shop.standards.ie/en-ie/standards/bs-5385-3-2024-250737_saig_bsi_bsi_3427705' },
    { topic: 'installation', name: 'I.S. CEN/TR 13548:2004', note: 'General rules for design and installation of adhesive-bonded ceramic tiling.', src: 'https://shop.standards.ie/en-ie/standards/i-s-cen-tr-13548-2004-871764_saig_nsai_nsai_2072' },
    { topic: 'materials', name: 'I.S. EN 12004-1:2017', note: 'Adhesive classes C/D/R, 1/2, F, T, E, S1/S2.', src: 'https://shop.standards.ie/en-ie/standards/en-12004-1-2017-342317_saig_cen_cen_783947' },
    { topic: 'waterproofing', name: 'I.S. EN 14891:2017', note: 'Liquid-applied waterproofing under bonded tiling.', src: 'https://shop.standards.ie/en-ie/standards/i-s-en-14891-2017-862642_saig_nsai_nsai_2052119' },
    { topic: 'slip', name: 'Health and Safety Authority', note: 'Specify a wet Pendulum Test Value of 36 or more.', src: 'https://www.hsa.ie/eng/topics/slips_trips_falls/pedestrian_surfaces/measuring_slip_resistance/' },
    { topic: 'stairs', name: 'TGD K 2014', note: 'Private stairs: rise 220 mm max (175 best), going 220 mm min (250 best), 2R + G 550–700 mm, pitch 42° max.', src: TGDK },
  ],
  catalogue: {
    tiles: [
      t('1200x600', 1200, 600, 10, 'both', 1.44, 2, 'https://www.delforno.ie/products/dark-flow-natural-porcelain-tile-60x120cm', { verified: false }),
      t('1200x1200', 1200, 1200, 10.5, 'both', undefined, undefined, `${TS}leccese-perla-120x120-mat`),
      t('600x600', 600, 600, 9.5, 'both', undefined, undefined, `${TS}classica-nero-marquina-matt-60x60`),
      t('590x590', 590, 590, 9, 'both', 1.05, 3, 'https://www.delforno.ie/products/sandstone-white-59x59', { verified: false, note: 'Thickness not listed' }),
      t('600x300', 600, 300, 8.7, 'both', undefined, undefined, `${TS}advance-mink-30x60`),
      t('498x498', 498, 498, 9, 'both', undefined, undefined, 'https://www.woodies.ie/hd-laurel-carrara-marble-ceramic-wall-and-floor-tile-498x498mm-1135438', { verified: false, note: 'Thickness not listed' }),
      t('331x331', 331, 331, 8, 'both', undefined, undefined, 'https://www.woodies.ie/laura-ashley-heritage-wicker-charcoal-ceramic-wall-and-floor-tile-331x331mm-1', { verified: false, note: 'Thickness not listed' }),
      t('300x300', 300, 300, 9.5, 'both', undefined, undefined, `${TS}classica-carrara-matt-30x30`),
      t('200x200', 200, 200, 9.5, 'both', undefined, undefined, `${TS}form3-anthracite-20x20`),
      t('300x75', 300, 75, 10, 'wall', 0.42, 19, 'https://www.woodies.ie/beverley-white-ceramic-wall-tile-75x300mm-pk19-1192402'),
      t('200x100', 200, 100, 7, 'wall', 1.0, 50, 'https://www.woodies.ie/metro-white-ceramic-wall-100x200mm-pk50-1192398', { label: '200 × 100 metro' }),
      t('150x75', 150, 75, 7, 'wall', undefined, undefined, `${TS}bevelled-blanco-gloss-7-5x15`),
    ],
    adhesives: [
      { id: 'ie-c2-20', label: 'Flexible C2TE S1 adhesive, 20 kg', bagKg: 20, coverage: [{ notchMm: 4, kgPerM2: 1.67 }, { notchMm: 6, kgPerM2: 2.0 }, { notchMm: 10, kgPerM2: 3.85 }], src: 'https://www.theunderfloorheatingstore.com/cdn/shop/files/BAL-FLEX-ONE-TDS-FEB-22.pdf', docs: 'BAL Flex One, sold in Ireland.' },
      { id: 'ie-rapid-20', label: 'Rapid-set flexible adhesive, 20 kg', bagKg: 20, verified: false, src: 'https://tilestyle.ie/collections/adhesives/products.json', docs: 'Nicobond Rapidflex S1 / Evo-Stik Rapid Set Flexible 20 kg: notch coverage not published, generic rate used.' },
      { id: 'ie-c2-25', label: 'Flexible C2TE S1 adhesive, 25 kg', bagKg: 25, verified: false, src: 'https://tilestyle.ie/collections/adhesives/products.json', docs: 'Butech One Flex Pro 25 kg: coverage not published, generic rate used.' },
    ],
    grouts: [
      { id: 'ie-cement-10', label: 'Flexible cement grout, 10 kg', bagKg: 10, density: 1.6, kind: 'cement', verified: false, src: 'https://tilestyle.ie/collections/grouts/products.json', docs: 'Nicobond GroutPro 2.5 / 10 kg; Evo-Stik TGS 5 / 10 kg. Generic factor 1.6.' },
      { id: 'ie-cement-5', label: 'Cement grout, 5 kg', bagKg: 5, density: 1.6, kind: 'cement', verified: false, src: 'https://www.woodies.ie/evo-stik-technik-tgs-wall-floor-grout-grey-10kg-1111943' },
      { id: 'ie-cement-25', label: 'Flexible cement grout, 2.5 kg', bagKg: 2.5, density: 1.6, kind: 'cement', verified: false, src: 'https://tilestyle.ie/collections/grouts/products.json' },
      { id: 'ie-resin-25', label: 'Resin grout, 2.5 kg', bagKg: 2.5, density: 1.6, kind: 'epoxy', verified: false, src: 'https://tilestyle.ie/collections/grouts/products.json', docs: 'Nicobond Starlike Evo Extreme 2.5 kg; density not published.' },
    ],
    membranes: [
      { id: 'ie-kit-3', label: 'Wet room tanking kit, 3 L (4.5 m²)', packL: 3, litresPerM2PerCoat: 3 / 4.5 / 2, coats: 2, note: 'Kit includes primer and 10 m tape', src: AQUA, docs: 'Everbuild Aquaseal Wet Room System (Sika Ireland).' },
      { id: 'ie-kit-5', label: 'Wet room tanking kit, 5 L (7.5 m²)', packL: 5, litresPerM2PerCoat: 5 / 7.5 / 2, coats: 2, note: 'Kit includes primer and 10 m tape', src: AQUA },
    ],
  },
  extras: { primerM2PerLitre: null, tapeRollMm: 10000, src: AQUA, docs: 'Aquaseal kit tape 10 m (width not published).' },
  guided: true,
};
