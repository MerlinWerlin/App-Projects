# Tiling data: United States and Canada

Researched 23 Nov 2026. The data lives in `research-us-ca.json`, and every value there carries a source URL. This file summarises it and says how much to trust each part.

**How the values were checked (the `verifiedBy` field)**
- **page:** I fetched and read the product page.
- **tds-pdf:** I downloaded the manufacturer data sheet PDF and extracted its text.
- **search-listing:** The value comes from the retailer's own listing title or snippet in search results. Home Depot (US and CA), Lowe's and RONA all blocked automated fetching, so these pages were not opened.
- **secondary:** The value comes from a trade article or city handout that quotes the code. The official ICC, ANSI and NRC texts could not be fetched.

---

## 1. Units and currency
| | US | Canada |
|---|---|---|
| Tile sizes | inches (nominal) | inches at retail |
| Coverage | sq ft per case/box | sq ft per case |
| Bags | lb | kg and lb (RONA label: "11,3kg") |
| Codes | inches | metric (mm) |
| Currency | USD | CAD |

**Nominal vs actual size:** actual sizes are smaller than nominal. At Floor & Decor, a 24x24 measures 23.5x23.5 in, a 12x24 measures 11.7x23.5 in and a 24x48 measures 23.7x47.4 in. The app should let the user enter the actual size.

## 2. Tiles (examples of stocked SKUs)
### US (Floor & Decor pages were read directly)
| Size (in) | Thk | Pcs/box | sq ft/box | Use |
|---|---|---|---|---|
| 24x24 porcelain | 9 mm | 4 | 15.48 | floor/wall |
| 12x24 porcelain | 9 mm | 7 | 13.44 | floor/wall |
| 6x24 wood-look | 8 mm | 18 | 17.46 | floor/wall |
| 24x48 porcelain | 8 mm | 2 | 15.5 | floor/wall |
| 12x12 ceramic | 7 mm | 22 | 23.1 | floor/wall |
| 2x2 mosaic on 12x12 sheet | 8 mm | 5 sheets | 4.9 | floor/wall, shower floor |
| 3x6 subway (F&D) | 10 mm | 80 | 10.4 | wall only |
| 3x6 subway (Daltile Restore, HD) | – | 100 | 12.5 | wall (search-listing) |
| 4x12 ceramic | 8.5 mm | 15 | 4.83 | wall only |
| 8x8 porcelain | 8 mm | 16 | 6.88 | floor/wall |

Search summaries of Home Depot 12x24 listings show 15.5 to 16 sq ft and 7 to 8 pieces per case. Floor & Decor's 12x24 box above is a smaller 7-piece box.

### Canada (Home Depot Canada and RONA, search listings only)
| Size | Pcs/case | sq ft/case |
|---|---|---|
| 12x24 | 6 / 7 / 8 | 11.62 / 14.53 / 15.52–16.68 |
| 24x24 | 4 | 15.52 |
| 24x48 | 2 | 15.49 |
| 6x24 wood-look (5/16 in) | 15 | 14.53 |
| 12x12 ceramic | 11 / 15 | 10.98 / 14.53 |
| 3x6 subway | 86 / 88 | 11.18 / 10.656 |
| 2x2 mosaic on 12x12 sheet | 5 per box (one product) | 7.76 per carton (another product) |

I did not check 4x12 or 8x8 for Canada.

## 3. Thinset and mortar
| Product | Class | Bag | 1/4x1/4 sq | 1/4x3/8 sq | 1/2x1/2 sq |
|---|---|---|---|---|---|
| MAPEI Ultraflex 2 (TDS dated 11 Apr 2024) | A118.4E + A118.11 (**not** A118.15) | 50 lb (25 lb and 10 lb sold in Canada) | 75–90 | 55–65 | not on the data sheet |
| LATICRETE 254 Platinum (DS-677.0-1215) | A118.4, A118.11, A118.15 | 50 lb | 80–95 | 50–60 | 40–45 |
| Custom ProLite | A118.15HET + A118.11 | **30 lb** | 90–100 | 63–70 | 45–50 |

- **254 Platinum:** the data sheet also lists 105–115 sq ft with a 1/4x3/16 notch for setting Hydro Ban or Strata_Mat, and a wet density of 103 lb/ft³.
- **ProLite U-notch:** a 3/4 U-notch covers 36–45 sq ft held at 45° and 40–50 sq ft at 30°.
- **Canadian bag sizes:** Ultraflex 2 comes in 11.3 kg / 25 lb (Canada only) and 4.54 kg / 10 lb. Ultraflex RS comes in 11.3 and 22.7 kg. Centura Large Format Tile Mortar comes in 22.68 kg.
- **Unresolved:** a newer 254 Platinum revision may list 60–70 sq ft for 1/4x3/8, and I could not confirm it. I also found no premixed thinset sold by the gallon.

## 4. Grout
- **Custom Polyblend Plus Sanded** (ANSI A118.6/A118.7): 25 lb bag, also a 7 lb box, for joints 1/8 to 1/2 in. The JSON has the full coverage chart. For example, 12x12x3/8 tile with a 1/8 in joint covers 348 sq ft per 25 lb.
- **Polyblend Plus Non-Sanded:** 10 lb bag, for joints up to 1/8 in.
- **CEG-Lite epoxy** (A118.3): 9.5 lb and 19 lb kits.
- **Prism SCG premixed** (A118.19): 1 gal.
- **Canada:** MAPEI Keracolor S sanded comes in 11.3 kg bags for joints of 3–16 mm. Kerapoxy epoxy comes in 945 mL.
- **Formula:** neither Custom nor Laticrete publishes a grout formula.
  - Laticrete's estimator asks for tile length, width and thickness, joint width and depth, and area, and says to add 10% waste.
  - Using V = (L+W)/(L·W) × joint width × depth, Custom's chart works out to about **108–110 lb/ft³ for sanded** and **about 106 lb/ft³ for unsanded**. I derived these densities myself; Custom does not publish them.

## 5. Waterproofing
| Product | Packs | Coverage | Coats | Thickness |
|---|---|---|---|---|
| RedGard (TDS-104, 2018) | 1, 3.5 gal | 110 sq ft/gal per coat, so 55 sq ft/gal finished. IAPMO pan liner: 80 per coat (40 finished). A118.12 crack isolation: 50 per coat | 2 | wet film never over 125 mils |
| Hydro Ban (DS-663-0821) | 4x1 gal carton, 5 gal | 50 sq ft/gal finished (5 gal = 250 sq ft) | 2 | wet 15–22 mils per coat, dry 20–30 mils |
| Mapelastic AquaDefense (Jun 2025) | 1 gal (4-pack), 3.5, 5, 55 gal | 60 / 210 / 300 / 3300 sq ft for 2 coats | 2 | at least 20 mils dry combined |

- **Kerdi sheet rolls:** 39 in (3 ft 3 in) wide, in rolls of 54, 75, 108, 215 and 323 sq ft. Home Depot also sells a wide roll, 6 ft 7 in x 98 ft 5 in.
- **Other Canadian sheet:** PROVA, 25 m² (269 sq ft) per roll.
- **Kerdi-Shower pre-sloped trays (US):** 38x38, 38x60 (centre or off-centre drain), 48x60, 48x72, 60x60 and 72x72. In Canada I saw 38x60 and 48x72 (CAD 274 at RONA).
- **RedGard in Canada:** Home Depot Canada sells 3.78 L and 13.25 L. Its listing says "100 sq ft", which is the crack-prevention rate, not the waterproofing rate.

## 6. Standards and codes
### Installation standards (US)
- **A108.5 mortar coverage:** at least 80% contact in dry interior areas and at least 95% in exterior and shower installations, checked by lifting at least 3 tiles. For natural stone, the TCNA Handbook asks for 95%.
- **A108.02 lippage:** 1/32 in (1 mm) plus warpage for joints under 1/4 in, and 1/16 in (2 mm) plus warpage for joints of 1/4 in or more. Gauged porcelain panels allow 1 mm. Sources disagree on whether the smallest joint in the first band is 1/8 or 1/16 in.
- **A137.1 slip resistance:** wet DCOF must be at least 0.42 for level interior floors walked on when wet, measured by the ANSI A326.3 test.
- **Material classes:**
  - Membranes: A118.10 (and A118.10-LV) waterproofing, A118.12 crack isolation.
  - Mortars: A118.4, A118.4E, A118.11, A118.15.
  - Grouts: A118.6, A118.7, A118.19.
  - Epoxy (mortar or grout): A118.3.
- **TCNA Handbook:** the 2025 edition is current.

### Shower floors (US)
- **IRC P2709 (from secondary sources):**
  - Liner and finished floor slope at least **1/4 in per ft**. Finished floor no more than **1/2 in per ft**.
  - Liner runs at least 2 in past the rough jambs and at least 2 in above the finished threshold.
- **UPC 408** (used in western states, per a Sammamish, WA handout):
  - Slope from 1/4 to 1/2 in per ft.
  - Threshold 2–9 in above the drain.
  - Membrane at least 3 in above the finished threshold.
- **ADA showers:** threshold no more than 1/2 in.

### Stairs (US)
IRC 2021 R311.7.5: risers no more than 7-3/4 in, treads at least 10 in, nosing 3/4 to 1-1/4 in. Nosing is not needed when the tread is at least 11 in deep. Risers, treads and nosings may each vary by at most 3/8 in within a flight.

### Canada
- **TTMAC Specification Guide 09 30 00 Tile Installation Manual, 2025 edition.** It supersedes the 2019–2021 edition.
- **Stairs (Part 9):** private stairs have a rise of 125–200 mm and a run of 255–355 mm. Public stairs have a rise of 125–180 mm.
  - Tolerances are 5 mm between adjacent treads and 10 mm across a flight. Treads slope no more than 1 in 50.
  - I read these from the BC Building Code 2018, which follows the NBC. I did not fetch the NBC 2020 text itself.
- **Shower slope:** the NPC gives no prescriptive slope; it only requires the shower to be leak-proof. Local bulletins, such as Kelowna's, use 1/4 in per ft.

## 7. Terminology
- **US:** thinset, modified/unmodified, mortar bed (mud bed), backer board, Schluter strip/edge trim, shower pan, pre-slope, curb, liner. Labels use "gray" and "color", and retailers sell by the "case" (Home Depot) or "box" (Floor & Decor).
- **Canada:** "colour". Labels are bilingual English/French ("membrane d'impermeabilisation"). Bags are labelled in kg with a comma decimal.

## Not verified
- **US:**
  - Exact wording of IPC 417.5.2.
  - IRC R307.2 shower wall height.
  - Porcelain absorption limit in A137.1 (≤0.5%).
  - Premixed thinset sold by the gallon.
  - Whether Kerdi is 39-3/8 in wide (retailers list 39 in), and its thickness.
  - Ultraflex 2 coverage with a 1/2x1/2 notch.
  - The newer 254 Platinum 1/4x3/8 figure.
  - Grout densities: the values above are derived, not published.
- **Canada:**
  - Every Canadian retail figure is a search-listing value; no Canadian retail page could be opened.
  - Canadian 4x12 and 8x8 tile.
  - Canadian pack sizes for Laticrete and Mapei membranes.
  - Unsanded grout sizes.
  - CSA tile standards.
  - The NBC 2020 text itself.
  - A slope rule in the NPC.
  - Details of the Lowe's Canada to RONA+ rebrand.
  - Ciot product data (none found).
