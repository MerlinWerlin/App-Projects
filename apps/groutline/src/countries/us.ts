/**
 * United States. Researched 23 Nov 2026 (notes: research-us-ca.md in the session notes; summary in docs/SOURCES.md).
 * Tiles: stocked SKUs at a national tile superstore (Floor & Decor) with actual sizes, pieces and sq ft per box.
 * Thinset: MAPEI Ultraflex 2, LATICRETE 254 Platinum, Custom ProLite data sheets. Grout: Custom Polyblend Plus chart.
 * Membranes: Custom RedGard, LATICRETE Hydro Ban, MAPEI Mapelastic AquaDefense data sheets.
 */
import { CONTACT_RULES, IMPERIAL_NOTCHES } from '../core/notch.ts';
import { IN, kgPerM2FromSqFt, lbToKg, lPerM2FromSqFtPerGal, galToL, sqFtToM2, type Country } from './types.ts';

const n = (label: string) => IMPERIAL_NOTCHES.find(x => x.label.startsWith(label))!.mm;
const FD = 'https://www.flooranddecor.com/porcelain-tile/';

export const US: Country = {
  code: 'US', name: 'United States', flag: '🇺🇸', system: 'imperial', currency: 'USD', locale: 'en-US', spelling: 'american',
  terms: { waterproofing: 'Waterproofing', membrane: 'Membrane', adhesive: 'Thinset', trim: 'Edge trim', falls: 'Slope', waste: 'drain', setOut: 'Layout', box: 'box', colour: 'color', backer: 'backer board' },
  falls: {
    min: 48, max: 24, target: 48, label: 'IRC P2709 / UPC 408: shower floor slopes ¼ to ½ in per ft to the drain', verified: true,
    src: 'https://finehomebuilding.com/2019/05/09/284-site-built-shower-pans', docs: 'Secondary sources quoting IRC P2709.1 and UPC 408; ICC viewer blocked automated reading.',
  },
  membraneHeights: {
    showerWallMm: 72 * IN, upturnMm: 150, verified: false,
    label: 'Shower walls to 72 in (IRC R307.2, from secondary sources). Outside the shower: generic 6 in upturn, check your local code.',
    src: 'https://www.jaspector.com/codes/irc-2021/ch27-plumbing-fixtures/shower-threshold-height-code/',
  },
  stairs: {
    riserMin: 0, riserMax: 7.75 * IN, goingMin: 10 * IN, goingMax: 100_000, source: 'IRC R311.7.5', verified: true,
    src: 'https://www.cityofboise.org/media/14405/437-treads-risers_march-2022.pdf', docs: 'Max riser 7¾ in, min tread 10 in, nosing ¾–1¼ in where tread < 11 in, variation ≤ ⅜ in.',
  },
  contactRule: CONTACT_RULES.ANSI,
  trimStockMm: [98.5 * IN],
  jointMm: { floor: IN / 8, wall: IN / 16 },
  standards: [
    { topic: 'installation', name: 'ANSI A108.5', note: 'Thinset contact: 80% average in dry interiors, 95% in showers and outside (lift 3 tiles to check).', src: 'https://www.ceramictilefoundation.org/blog/insufficient-mortar' },
    { topic: 'installation', name: 'ANSI A108.02 §4.3.8', note: 'Offset side over 15 in: offset 33% max unless the tile maker allows more; joints at least ⅛ in (rectified) or 3/16 in (calibrated).', src: 'https://www.ceramictilefoundation.org/blog/offsets-grout-joints-customer-expectations' },
    { topic: 'installation', name: 'ANSI A108.02 §4.4 lippage', note: 'Joints ⅛ to under ¼ in: 1/32 in plus tile warpage. ¼ in and wider: 1/16 in plus warpage.', src: 'https://www.constructionspecifier.com/tile-and-stone-lippage-what-is-acceptable-and-how-is-it-measured/' },
    { topic: 'waterproofing', name: 'ANSI A118.10', note: 'Load-bearing bonded waterproof membranes. Coverage and thickness come from each product\'s data sheet.', src: 'https://pdf.lowes.com/productdocuments/4be996dd-a8dc-4b68-a446-27695926e2ce/72338196.pdf' },
    { topic: 'falls', name: 'IRC P2709 / UPC 408', note: 'Shower floor ¼ in per ft minimum, ½ in per ft maximum to the drain; liner at least 2 in above the threshold.', src: 'https://www.sammamish.us/media/eladgwff/residential-shower-subpan-guideline.pdf' },
    { topic: 'slip', name: 'ANSI A137.1 / A326.3', note: 'Level interior floors walked on wet: wet DCOF 0.42 or more.', src: 'https://marazziusa.com/our-mission/industry-standards' },
    { topic: 'stairs', name: 'IRC R311.7.5', note: 'Riser 7¾ in max, tread 10 in min, nosing ¾–1¼ in where the tread is under 11 in; risers and treads within ⅜ in in a flight.', src: 'https://www.cityofboise.org/media/14405/437-treads-risers_march-2022.pdf' },
    { topic: 'materials', name: 'TCNA Handbook (2025)', note: 'Installation methods, movement joints (EJ171).', src: 'https://webstore.ansi.org/standards/tca/2025tcnahandbookceramicglass' },
  ],
  catalogue: {
    tiles: [
      { id: 'us-24x24', label: '24 × 24 in', lengthMm: 23.5 * IN, widthMm: 23.5 * IN, thicknessMm: 9, use: 'both', perBox: 4, boxM2: sqFtToM2(15.48), note: 'Actual 23½ × 23½ in', src: `${FD}venato-matte-porcelain-tile-100610799.html` },
      { id: 'us-12x24', label: '12 × 24 in', lengthMm: 23.5 * IN, widthMm: 11.7 * IN, thicknessMm: 9, use: 'both', perBox: 7, boxM2: sqFtToM2(13.44), note: 'Actual 11.7 × 23½ in', src: `${FD}venato-matte-porcelain-tile-100610781.html` },
      { id: 'us-6x24', label: '6 × 24 in plank', lengthMm: 23.2 * IN, widthMm: 6 * IN, thicknessMm: 8, use: 'both', perBox: 18, boxM2: sqFtToM2(17.46), note: 'Wood-look, actual 6 × 23.2 in', src: `${FD}sierra-beige-wood-plank-matte-porcelain-tile-100490168.html` },
      { id: 'us-24x48', label: '24 × 48 in', lengthMm: 47.4 * IN, widthMm: 23.7 * IN, thicknessMm: 8, use: 'both', perBox: 2, boxM2: sqFtToM2(15.5), note: 'Actual 23.7 × 47.4 in', src: `${FD}luxe-sand-matte-porcelain-tile-101317865.html` },
      { id: 'us-12x12', label: '12 × 12 in', lengthMm: 12.3 * IN, widthMm: 12.3 * IN, thicknessMm: 7, use: 'both', perBox: 22, boxM2: sqFtToM2(23.1), note: 'Ceramic, actual 12.3 in', src: 'https://www.flooranddecor.com/ceramic-tile/bristol-beige-ceramic-tile-100486547.html' },
      { id: 'us-8x8', label: '8 × 8 in', lengthMm: 8 * IN, widthMm: 8 * IN, thicknessMm: 8, use: 'both', perBox: 16, boxM2: sqFtToM2(6.88), src: `${FD}chelsea-porcelain-tile-100999945.html` },
      { id: 'us-4x12', label: '4 × 12 in', lengthMm: 12 * IN, widthMm: 4 * IN, thicknessMm: 8.5, use: 'wall', perBox: 15, boxM2: sqFtToM2(4.83), src: 'https://www.flooranddecor.com/porcelain-ceramic-decoratives/carrara-catalina-polished-ceramic-tile-100978204.html' },
      { id: 'us-3x6', label: '3 × 6 in subway', lengthMm: 6 * IN, widthMm: 3 * IN, thicknessMm: 10, use: 'wall', perBox: 80, boxM2: sqFtToM2(10.4), src: 'https://www.flooranddecor.com/porcelain-ceramic-decoratives/bright-white-ice-subway-ceramic-tile-914100887.html' },
      { id: 'us-2x2', label: '2 × 2 in mosaic (12 in sheet)', lengthMm: 11.8 * IN, widthMm: 11.8 * IN, thicknessMm: 8, use: 'both', perBox: 5, boxM2: sqFtToM2(4.9), sheet: true, note: 'Count is in sheets', src: `${FD}forum-ivory-square-matte-porcelain-mosaic-100212927.html` },
    ],
    adhesives: [
      { id: 'us-mod-50', label: 'Modified thinset, 50 lb', bagKg: lbToKg(50), coverage: [{ notchMm: n('1/4 × 1/4'), kgPerM2: kgPerM2FromSqFt(50, 75) }, { notchMm: n('1/4 × 3/8'), kgPerM2: kgPerM2FromSqFt(50, 55) }], src: 'https://www.buildsite.com/pdf/mapei/Ultraflex-2-Product-Data-2378042.pdf', docs: 'MAPEI Ultraflex 2 (A118.4E/A118.11): 75–90 / 55–65 sq ft per 50 lb; low end used.' },
      { id: 'us-premium-50', label: 'Premium modified thinset (A118.15), 50 lb', bagKg: lbToKg(50), coverage: [{ notchMm: n('1/4 × 1/4'), kgPerM2: kgPerM2FromSqFt(50, 80) }, { notchMm: n('1/4 × 3/8'), kgPerM2: kgPerM2FromSqFt(50, 50) }, { notchMm: n('1/2 × 1/2'), kgPerM2: kgPerM2FromSqFt(50, 40) }], src: 'https://contractorsdirect.com/cdn/shop/files/laticrete-254-platinum-file.pdf', docs: 'LATICRETE 254 Platinum: 80–95 / 50–60 / 40–45 sq ft per 50 lb; low end used.' },
      { id: 'us-lite-30', label: 'Lightweight large-format mortar, 30 lb', bagKg: lbToKg(30), lightweight: true, coverage: [{ notchMm: n('1/4 × 1/4'), kgPerM2: kgPerM2FromSqFt(30, 90) }, { notchMm: n('1/4 × 3/8'), kgPerM2: kgPerM2FromSqFt(30, 63) }, { notchMm: n('1/2 × 1/2'), kgPerM2: kgPerM2FromSqFt(30, 45) }], src: 'https://www.custombuildingproducts.com/products/prolite-premium-large-format-tile-mortar', docs: 'Custom ProLite (A118.15HET).' },
    ],
    grouts: [
      { id: 'us-sanded-25', label: 'Sanded grout, 25 lb', bagKg: lbToKg(25), density: 1.76, kind: 'sanded', src: 'https://www.custombuildingproducts.com/wp-content/uploads/Grout_Card_CC25_6-25_WEB-2.pdf', docs: 'Custom Polyblend Plus Sanded. K = 1.76 kg/L back-solved from the coverage chart (12×12×⅜ at ⅛ = 348 sq ft per 25 lb).' },
      { id: 'us-unsanded-10', label: 'Unsanded grout, 10 lb (joints to ⅛ in)', bagKg: lbToKg(10), density: 1.7, kind: 'unsanded', src: 'https://www.custombuildingproducts.com/wp-content/uploads/Grout_Card_CC25_6-25_WEB-2.pdf', docs: 'Custom Polyblend Plus Non-Sanded; ≈106 lb/ft³ back-solved from the chart.' },
      { id: 'us-sanded-7', label: 'Sanded grout, 7 lb box', bagKg: lbToKg(7), density: 1.76, kind: 'sanded', src: 'https://www.custombuildingproducts.com/wp-content/uploads/Grout_Card_CC25_6-25_WEB-2.pdf' },
      { id: 'us-epoxy-9', label: 'Epoxy grout kit, 9.5 lb', bagKg: lbToKg(9.5), density: 1.25, kind: 'epoxy', src: 'https://www.custombuildingproducts.com/wp-content/uploads/Grout_Card_CC25_6-25_WEB-2.pdf', docs: 'Custom CEG-Lite: 187 sq ft per 9.5 lb at 12×12×⅜, ⅛ joint -> ≈1.25 kg/L. Epoxies vary: check the kit.' },
    ],
    membranes: [
      { id: 'us-liquid-1', label: 'Liquid membrane, 1 gal (2 coats)', packL: galToL(1), litresPerM2PerCoat: lPerM2FromSqFtPerGal(110), coats: 2, note: '55 sq ft per gal finished', src: 'https://cdn.shopify.com/s/files/1/0049/0995/7154/files/TDS-104.pdf', docs: 'Custom RedGard: 110 sq ft/gal per coat, 2 coats.' },
      { id: 'us-liquid-35', label: 'Liquid membrane, 3.5 gal (2 coats)', packL: galToL(3.5), litresPerM2PerCoat: lPerM2FromSqFtPerGal(110), coats: 2, note: '55 sq ft per gal finished', src: 'https://cdn.shopify.com/s/files/1/0049/0995/7154/files/TDS-104.pdf' },
      { id: 'us-liquid-hb1', label: 'Thin liquid membrane, 1 gal (2 coats, 50 sq ft)', packL: galToL(1), litresPerM2PerCoat: lPerM2FromSqFtPerGal(100), coats: 2, src: 'https://cdn.shopify.com/s/files/1/1531/7095/files/Hydro_Ban_Data_Sheet.pdf', docs: 'LATICRETE Hydro Ban: 50 sq ft per gallon finished.' },
      { id: 'us-liquid-hb5', label: 'Thin liquid membrane, 5 gal (2 coats, 250 sq ft)', packL: galToL(5), litresPerM2PerCoat: lPerM2FromSqFtPerGal(100), coats: 2, src: 'https://cdn.shopify.com/s/files/1/1531/7095/files/Hydro_Ban_Data_Sheet.pdf' },
      { id: 'us-rubber-1', label: 'Liquid-rubber membrane, 1 gal (2 coats, 60 sq ft)', packL: galToL(1), litresPerM2PerCoat: lPerM2FromSqFtPerGal(120), coats: 2, src: 'https://pdf.lowes.com/productdocuments/4be996dd-a8dc-4b68-a446-27695926e2ce/72338196.pdf', docs: 'MAPEI Mapelastic AquaDefense: 60 sq ft per gal for 2 coats, 20 mils dry min.' },
    ],
  },
  extras: { primerM2PerLitre: null, tapeRollMm: null, src: '', verified: false },
  guided: true,
};
