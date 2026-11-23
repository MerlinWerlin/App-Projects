/**
 * Canada. Researched 23 Nov 2026 (session notes research-us-ca.md; summary in docs/SOURCES.md).
 * Trade practice mixes units: tiles in inches and sq ft per case, bags labelled kg and lb, codes in mm. We default to
 * imperial for tile work (switchable in Settings). Tiles: Home Depot Canada and RONA listings. Thinset: MAPEI
 * Ultraflex 2 (25 lb / 11.3 kg Canada bag on the TDS). Grout: MAPEI Keracolor S 11.3 kg. Membranes: RedGard (Home Depot
 * Canada), KERDI rolls. Stairs: NBC-based Part 9 values (BC Building Code 2018 Tables 9.8.4.1/9.8.4.2).
 * Shower floor slope: no NPC/NBC number found; 1/4 in per ft is trade practice (TTMAC / local bulletins) -> unverified.
 */
import { CONTACT_RULES, IMPERIAL_NOTCHES } from '../core/notch.ts';
import { IN, kgPerM2FromSqFt, lbToKg, lPerM2FromSqFtPerGal, sqFtToM2, type Country } from './types.ts';

const n = (label: string) => IMPERIAL_NOTCHES.find(x => x.label.startsWith(label))!.mm;
const HD = 'https://www.homedepot.ca/product/';

export const CA: Country = {
  code: 'CA', name: 'Canada', flag: '🇨🇦', system: 'imperial', currency: 'CAD', locale: 'en-CA', spelling: 'british',
  terms: { waterproofing: 'Waterproofing', membrane: 'Membrane', adhesive: 'Thinset', trim: 'Edge trim', falls: 'Slope', waste: 'drain', setOut: 'Layout', box: 'case', colour: 'colour', backer: 'backer board' },
  falls: { min: 48, max: 24, verified: false, label: 'No shower floor slope is set in the National Plumbing Code. ¼ in per ft (max ½ in) is trade practice (TTMAC, local bulletins): check your province.', src: 'https://kelowna.ca/sites/files/1/docs/homes-building/2025_on_site_constructed_shower_-_bulletin.pdf' },
  membraneHeights: { showerWallMm: 72 * IN, upturnMm: 150, verified: false, label: 'Generic: shower walls to 72 in, 6 in upturn outside the shower. Canada sets no national figure we could verify: follow the membrane maker and TTMAC details.', src: 'https://www.constructioncanada.net/avoiding-waterproofing-mistakes-in-showers/' },
  stairs: { riserMin: 125, riserMax: 200, goingMin: 255, goingMax: 355, source: 'NBC Part 9 (private stairs, 9.8.4)', verified: true, src: 'https://www.bclaws.gov.bc.ca/civix/document/id/bcbc/bcbc2018/bcbc_2018dbp9s98', docs: 'Read from BC Building Code 2018 Tables 9.8.4.1/9.8.4.2, which follow the NBC. Public: rise 125–180. Riser variation 5 mm adjacent, 10 mm in a flight.' },
  contactRule: CONTACT_RULES.ANSI,
  trimStockMm: [98.5 * IN],
  jointMm: { floor: IN / 8, wall: IN / 16 },
  standards: [
    { topic: 'installation', name: 'TTMAC Tile Installation Manual 09 30 00 (2025)', note: 'The Canadian specification guide; makers cite TTMAC Detail 301MJ for movement joints.', src: 'https://www.ttmac.com/' },
    { topic: 'installation', name: 'ANSI A108.5 (used in Canada)', note: 'Canadian-sold setting materials carry ANSI classes: 80% contact dry, 95% in showers and outside.', src: 'https://www.ceramictilefoundation.org/blog/insufficient-mortar' },
    { topic: 'waterproofing', name: 'National Plumbing Code', note: 'Requires a leak-proof shower area but gives little construction detail. Follow the membrane system and TTMAC.', src: 'https://www.constructioncanada.net/avoiding-waterproofing-mistakes-in-showers/' },
    { topic: 'stairs', name: 'NBC 9.8.4', note: 'Private stairs: rise 125–200 mm, run 255–355 mm; risers within 5 mm of the next and 10 mm across a flight.', src: 'https://www.bclaws.gov.bc.ca/civix/document/id/bcbc/bcbc2018/bcbc_2018dbp9s98' },
  ],
  catalogue: {
    tiles: [
      { id: 'ca-12x24', label: '12 × 24 in', lengthMm: 24 * IN, widthMm: 12 * IN, thicknessMm: 10, use: 'both', perBox: 8, boxM2: sqFtToM2(15.52), src: `${HD}modamo-solid-super-black-matte-12-inch-x-24-inch-porcelain-floor-and-wall-tile`, verified: false, note: 'Check actual size on the case' },
      { id: 'ca-24x24', label: '24 × 24 in', lengthMm: 24 * IN, widthMm: 24 * IN, thicknessMm: 9, use: 'both', perBox: 4, boxM2: sqFtToM2(15.52), src: `${HD}modamo-mouro-24-inch-x-24-inch-polished-porcelain-floor-and-wall-tile`, verified: false },
      { id: 'ca-24x48', label: '24 × 48 in', lengthMm: 48 * IN, widthMm: 24 * IN, thicknessMm: 9, use: 'both', perBox: 2, boxM2: sqFtToM2(15.49), src: `${HD}modamo-travertine-cross-cut-24-inch-x-48-inch-porcelain-floor-and-wall-tile`, verified: false },
      { id: 'ca-6x24', label: '6 × 24 in plank', lengthMm: 24 * IN, widthMm: 6 * IN, thicknessMm: 8, use: 'both', perBox: 15, boxM2: sqFtToM2(14.53), src: `${HD}marazzi-montagna-wood-vintage-chic-6-inch-x-24-inch-porcelain-floor-and-wall-tile`, verified: false },
      { id: 'ca-12x12', label: '12 × 12 in', lengthMm: 12 * IN, widthMm: 12 * IN, thicknessMm: 7, use: 'both', perBox: 11, boxM2: sqFtToM2(10.98), src: `${HD}trafficmaster-sonoma-grey-12-inch-x-12-inch-ceramic-floor-and-wall-tile`, verified: false },
      { id: 'ca-3x6', label: '3 × 6 in subway', lengthMm: 6 * IN, widthMm: 3 * IN, thicknessMm: 7, use: 'wall', perBox: 88, boxM2: sqFtToM2(10.656), src: `${HD}jeffrey-court-fresh-white-3-in-x-6-in-glossy-subway-bevel-wall-tile`, verified: false },
      { id: 'ca-2x2', label: '2 × 2 in mosaic (12 in sheet)', lengthMm: 12 * IN, widthMm: 12 * IN, thicknessMm: 8, use: 'wall', perBox: 5, sheet: true, note: 'Count is in sheets', src: 'https://www.rona.ca/en/product/mosaic-porcelain-wall-tiles-12-x-12-brown-5-box-84665901', verified: false },
    ],
    adhesives: [
      { id: 'ca-mod-50', label: 'Modified thinset, 50 lb (22.7 kg)', bagKg: lbToKg(50), coverage: [{ notchMm: n('1/4 × 1/4'), kgPerM2: kgPerM2FromSqFt(50, 75) }, { notchMm: n('1/4 × 3/8'), kgPerM2: kgPerM2FromSqFt(50, 55) }], src: 'https://www.buildsite.com/pdf/mapei/Ultraflex-2-Product-Data-2378042.pdf', docs: 'MAPEI Ultraflex 2.' },
      { id: 'ca-mod-25', label: 'Modified thinset, 25 lb (11.3 kg)', bagKg: lbToKg(25), coverage: [{ notchMm: n('1/4 × 1/4'), kgPerM2: kgPerM2FromSqFt(25, 38) }, { notchMm: n('1/4 × 3/8'), kgPerM2: kgPerM2FromSqFt(25, 28) }], src: 'https://www.buildsite.com/pdf/mapei/Ultraflex-2-Product-Data-2378042.pdf', docs: 'Canada-only 25 lb bag: 38–45 / 28–33 sq ft.' },
    ],
    grouts: [
      { id: 'ca-sanded-11', label: 'Sanded grout, 11.3 kg (25 lb)', bagKg: 11.3, density: 1.76, kind: 'sanded', verified: false, src: 'https://www.rona.ca/en/product/mapei-keracolor-s-sanded-grout-11-3kg-pearl-grey-5uj501911can-21085018', docs: 'MAPEI Keracolor S. Density not published: US chart-derived 1.76 used.' },
      { id: 'ca-epoxy', label: 'Epoxy grout, 945 mL', bagKg: 0.945 * 1.55, density: 1.55, kind: 'epoxy', verified: false, src: 'https://www.rona.ca/en/product/mapei-kerapoxy-stain-free-grout-and-mortar-945ml-bone', docs: 'MAPEI Kerapoxy 945 mL; mix density 1.55 from the AU data sheet.' },
    ],
    membranes: [
      { id: 'ca-liquid-378', label: 'Liquid membrane, 3.78 L (1 gal)', packL: 3.78, litresPerM2PerCoat: lPerM2FromSqFtPerGal(110), coats: 2, note: '55 sq ft per gal as waterproofing', src: `${HD}1000150306`, docs: 'RedGard at Home Depot Canada; the listing\'s "100 sq ft" is the crack-prevention rate.' },
      { id: 'ca-liquid-1325', label: 'Liquid membrane, 13.25 L (3.5 gal)', packL: 13.25, litresPerM2PerCoat: lPerM2FromSqFtPerGal(110), coats: 2, src: `${HD}1000150306` },
    ],
  },
  extras: { primerM2PerLitre: null, tapeRollMm: null, src: '', verified: false },
  guided: true,
};
