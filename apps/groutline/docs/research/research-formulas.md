# Tiler calculator: formulas, sources, unit tests

Researched 23 Nov 2026. Labels used below:
- **VERIFIED**: I read it in the primary document (data sheet text pulled from the PDF, or the official code web page).
- **VERIFIED (secondary)**: quoted by a reputable trade body or article, but I could not open the standard itself.
- **DERIVED**: my own arithmetic from verified figures. The working is shown.
- **UNVERIFIED**: could not be confirmed. Treat as a placeholder.

Paywalled standards (BS 5385, AS 3958.1, AS 3740, ANSI A108) could not be read directly. Wherever a clause is quoted, the quote comes through the source named next to it.

---

## 1. Grout quantity

### 1.1 Metric manufacturer formula (VERIFIED)

```
kg/m² = (A + B) / (A × B) × C × D × K
```
A = tile length (mm), B = tile width (mm), C = joint depth, normally the tile thickness (mm), D = joint width (mm), K = the product's "grout coverage figure" (kg/L, roughly the density of the mixed grout).

The geometry checks out: (A+B)/(A×B) × C × D gives joint volume in litres per m², because 1 mm over 1 m² is 1 L. Multiplying by K turns that into kg.

| Maker / product | K | Evidence |
|---|---|---|
| **MAPEI Ultracolor Plus** (CG2WA) | **1.6** | The TDS defines "A = tile length (mm) B = tile width (mm) C = tile thickness (mm) D = joint width (mm)" under "FORMULA APPLIED TO CALCULATE CONSUMPTION RATE". The equation itself is printed as an image, so I back-calculated it from the TDS table: 100×100×7 at a 2 mm joint gives 0.448, and the table says 0.4. At a 10 mm joint it gives 2.24 and the table says 2.2. 75×150×6 at a 10 mm joint gives 1.92 and the table says 1.9. **K = 1.6 confirmed.** The TDS also gives "Density of mix: 1980 kg/m³". MAPEI's online calculator says to add **5–10 % overage**. |
| **ARDEX-FLEX FS** (UK) | **1.5** | TDS text: "the grout coverage figure, which for ARDEX-FLEX FS is 1.5 … 1. ADD length and breadth … 2. MULTIPLY result by joint width. 3. MULTIPLY result by joint depth. 4. MULTIPLY result by Grout Coverage Figure … 5. DIVIDE result by length of tile. 6. DIVIDE result by breadth of tile." Worked example: "300 x 5 x 3 x 1.5 ÷ 150 ÷ 150 = 0.3kg/m²". |
| **ARDEX-FLEX FL** (UK) | **1.75** | TDS worked example, quoted through search: "300 x 5 x 5 x 1.75 ÷ 150 ÷ 150 = 0.58kg/m²". I couldn't open the PDF (404). |
| **Kerakoll Fugabella Color** (resin-cement) | **≈1.9** | DERIVED from the TDS coverage table (P1091 2024/05). 30×30 cm × 10 mm at a 3 mm joint is listed at 380 g/m², and the formula gives 0.2 L/m², so K = 1.90. 60×60×10 at 5 mm is listed at 316 g/m² against 0.1667 L/m², so K = 1.90. The TDS says the table already allows for "normal site wastage". "Specific weight of the mixture 1,86 kg/dm³". |
| **ARDEX FG 8** (AU) | n/a | The TDS says "Allow an additional 15 - 20% for wastage" (quoted through search). |

### 1.2 Imperial version (US)

Custom Building Products, LATICRETE and MAPEI US don't publish a formula. They publish charts and calculators, and Custom calls its calculator formula "patent-pending". I DERIVED the imperial form by fitting Custom's printed chart:

```
lb per ft² = 144 × (L + W)/(L × W) × T × J × ρ      (all inches; ρ in lb/in³)
           ≈ (L + W)/(L × W) × T × J × 9.2          (cement grout, ρ = 0.0639 lb/in³ ≈ 110 lb/ft³ ≈ 1.77 kg/L)
```
Fit: Custom Polyblend Plus Sanded, 12"×12"×3/8" at a 1/8" joint, is listed at **348 ft² per 25 lb**, which is 0.0718 lb/ft². The joint volume is 144 × (24/144) × 0.375 × 0.125 = 1.125 in³/ft², so ρ = 0.0639 lb/in³. Cross-check: 4¼"×4¼"×¼" at 1/8" predicts 185 ft² per 25 lb, and the chart says 192, so the fit is within 4 %.
Epoxy: Custom CEG-Lite at 12×12×3/8 and 1/8" is 187 ft² per 9.5 lb, which back-calculates to ρ ≈ 0.045 lb/in³ (1.25 kg/L). "Lite" epoxies are light, so **treat the epoxy density as product-specific**. For MAPEI Kerapoxy the 1.6 factor is UNVERIFIED (I could not open its TDS).

### 1.3 Recommendation for the app
- **Default K = 1.6 kg/L for cement grout**, which is MAPEI's published factor, **plus a 10 % overage** (the top of MAPEI's 5–10 %). 1.6 × 1.10 = 1.76, which matches the density implied by Custom's US chart (1.77).
- Let the user pick a product preset: MAPEI 1.6, ARDEX FS 1.5, ARDEX FL 1.75, Kerakoll ≈1.9 (wastage already included, so no overage), custom.
- Epoxy: default 1.6 with a "check your product data sheet" note (UNVERIFIED). Lightweight epoxy is around 1.25.
- Joint depth defaults to the tile thickness, but let the user override it.

### 1.4 Unit tests (grout)
| # | Inputs | Expected |
|---|---|---|
| G1 | 300×300×10, D=3, K=1.6 | 600/90000 × 10 × 3 × 1.6 = **0.320 kg/m²** |
| G2 | 600×600×10, D=3, K=1.6 | **0.160 kg/m²** |
| G3 | 100×100×7, D=2, K=1.6 | **0.448 kg/m²** (MAPEI table 0.4) |
| G4 | 150×150×5, D=3, K=1.5 | **0.300 kg/m²** (ARDEX FS example) |
| G5 | 150×150×5, D=5, K=1.75 | **0.5833 kg/m²** (ARDEX FL example 0.58) |
| G6 | 300×300×10, D=3, K=1.9 | **0.380 kg/m²** (Kerakoll table 380 g) |
| G7 | G1 × 20 m² × 1.10 overage | **7.04 kg**, which is 2 × 5 kg bags or 1 × 23 kg bag |
| G8 | Imperial 12"×12"×3/8", 1/8" joint, factor 9.2 | **0.0719 lb/ft²**, so 25 lb covers **348 ft²** (Custom chart 348) |
| G9 | 4¼×4¼×¼, 1/8", factor 9.2 | 0.1353 lb/ft², so 25 lb covers 184.8 ft² (chart 192; allow ±5 %) |

---

## 2. Adhesive (thinset)

### 2.1 Why notch depth sets consumption
A square-notch trowel has teeth and gaps of equal width. The combed ridges therefore hold notch depth × ½ of mortar volume, and the bed collapses to about **half the notch depth** in theory. ARDEX Australia TP002.005 measured it: "the empirical final bed thickness for a 10mm notch comb adhesive bed, fully flattened would be between 4 and 4.5mm. Since the trowel angle of attack is rarely as recommended [60°], the actual figure is commonly 2.5 to 3mm."
MAPEI Keraflex Maxi S1 gives "Consumption: 1.2 kg/m² per mm of thickness" (MAPEI regional product pages, through search).

### 2.2 Manufacturer coverage by notch (VERIFIED from TDS text)
| Product (region) | Notch | Published coverage | kg/m² | kg/m² per mm of notch depth |
|---|---|---|---|---|
| LATICRETE 254 Platinum (US) | 6×6 mm | 80–95 ft² per 50 lb (7.4–8.8 m²/22.7 kg) | 2.6–3.1 | 0.47 |
| LATICRETE 254 Platinum | 6×9 mm | 50–60 ft² per 50 lb (4.6–5.6 m²) | 4.1–4.9 | 0.50 |
| LATICRETE 254 Platinum | 12×12 mm | 40–45 ft² per 50 lb (3.7–4.2 m²) | 5.4–6.1 | 0.48 |
| MAPEI Ultraflex 2 (US) | 6×6×6 mm | 75–90 ft² per 50 lb (6.97–8.36 m²) | 2.7–3.3 | 0.50 |
| MAPEI Ultraflex 2 | 6×10×6 mm | 55–65 ft² per 50 lb (5.11–6.04 m²) | 3.8–4.4 | 0.41 |
| Davco (Sika) Ultraflex (AU) | 6 mm | "20kg bag … covers approximately 12m2 (based on a 6mm notch trowel)" | 1.67 | 0.28 |
| Schomburg Monoflex S2 (DE), via search | 4/6/8/10 mm; 20 mm half-moon | 1.3/1.9/2.5/3.2; 6.2 | — | 0.31–0.33 |
| Würth CERAfix 403 Plus (DE), via search | 6/8/10 mm | 1.6–1.9 / 2.2–2.5 / 2.9–3.2 | — | 0.29–0.32 |

US ratings run about 0.45–0.50 kg/m² per mm of notch. EU and AU ratings run about 0.28–0.33, partly because many are lighter, polymer-rich mixes.
**App default (DERIVED, conservative so the job doesn't run short): 0.45 kg/m² per mm of square-notch depth**, editable. Include a "lightweight adhesive" preset at 0.30.

| Notch (square) | 3 | 4 | 6 | 8 | 10 | 12 | 15 | 20 |
|---|---|---|---|---|---|---|---|---|
| Default kg/m² (0.45×) | 1.35 | 1.8 | 2.7 | 3.6 | 4.5 | 5.4 | 6.75 | 9.0* |
| Lightweight (0.30×) | 0.9 | 1.2 | 1.8 | 2.4 | 3.0 | 3.6 | 4.5 | 6.0 |

\*20 mm is usually a round or half-moon notch, which holds less than a square notch. Schomburg gives 6.2 kg/m² for its 20 mm half-moon, so use **6.5** for 20 mm round/half-moon. UNVERIFIED beyond Schomburg.

### 2.3 Back-buttering
No manufacturer kg/m² figure for back-buttering was found (**UNVERIFIED**). DERIVED: a 1 mm skim coat × MAPEI's 1.2 kg/m² per mm = **+1.2 kg/m²** (range +1.0 to +1.8 for a 1–1.5 mm skim). Default to +1.2 kg/m². Per the TTA guide, deep-keyed or ribbed tile backs need more: the skim "should fill any deep keys".

### 2.4 Recommended notch by tile size
- **Davco/Sika Ultraflex PDS (AU), VERIFIED:** Mosaic: 6 mm. 150×150 mm: 6 mm. "150 x 150mm and over": 10 mm. "400 x 400mm and over": 12 mm. Any tile with an uneven back, lugs or grooves: as above by size, and back-buttering required.
- **The Tile Association Guide to Tiling (2026), VERIFIED:** 4 mm square notches at 8 mm centres for "mosaics and wall/floor tiles up to 100 x 100mm". Thin-bed 10 mm tapering notches, 5 mm deep, for "most ceramic wall tiles up to 300 x 300mm". Universal 20 mm round notch 10 mm deep, "100% achievable at 3 to 4mm bed depth". Large format: 20 mm round notch 13 mm deep. For large-format or deep-keyed tiles, "the floating and buttering method".
- **ARDEX AU TB001.010, VERIFIED:** "tiles can now be defined as large format when one side is at least 400mm in length."
- **US (Rubi blog, secondary):** 12×24": "1/2 inch by 1/2 inch or a rounded notches of 3/4 inch". 24×24 flat: 3/8" square. 2×2 mosaic: 1/8–3/16" square. Rule: "the larger the tile the larger the trowel". ANSI A108.5 says to "select a notched trowel sized to facilitate the proper coverage" (CTEF).

**App default notch (longest tile side):** ≤100 mm: **4 mm**. 101–200 mm: **6 mm**. 201–399 mm: **10 mm**. 400–599 mm: **12 mm**. ≥600 mm: **12 mm + back-butter** (offer a 15 mm or 20 mm round notch for floors). Always tell the user to lift a tile and check coverage.

### 2.5 Coverage (contact) requirements
- **ANSI A108.5, VERIFIED (secondary, CTEF quoting the standard):** §3.3.2 floors: "The average uniform contact area shall be not less than 80% except on exterior or shower installations where the contact area shall be 95% when no less than three tiles or tile assemblies are removed for inspection." §2.3.4, 2.4.3 and 2.5.3 use the same 80/95 wording for walls, mosaics and pavers. §2.3.5: "If 95% coverage is specified … back butter each tile." A Stone World excerpt adds that the coverage must be "sufficiently distributed to give full support of the tile with particular attention to all corners and edges".
- **AS 3958.1-2007 cl. 5.6.4.2, VERIFIED (secondary, quoted in ARDEX TP002.005):** internal residential walls 65 %. Residential floors 80 %. Commercial and industrial walls 80 %. Commercial and industrial floors 90 %. Wet areas 90 %. Swimming pools 90 %. External walls 90 %. Exterior floors, decks and roofs 90 %. ARDEX recommends at least 85 % in general and 100 % for submerged installations.
- **BS 5385, VERIFIED (secondary, TTA guide):** "For floor tiling, solid bedding should be achieved." Walls: "Tiles with a surface area of 0.1m² or above should be solidly bedded." Frequent-wetting areas: "solidly bedded so that voids behind them are eliminated." "Tiles should not be fixed using dot and dab technique."

### 2.6 Unit tests (adhesive)
| # | Inputs | Expected |
|---|---|---|
| A1 | 10 m², 6 mm notch, 0.45 | 27.0 kg; +10 % = 29.7 kg, so **2 × 20 kg bags** |
| A2 | 10 m², 12 mm notch + back-butter (+1.2) | (5.4 + 1.2) × 10 = 66 kg; +10 % = 72.6 kg, so **4 × 20 kg bags** |
| A3 | 10 m², 10 mm, lightweight 0.30 | 30 kg, so 3 × 15 kg bags (or 2 × 20 kg bags) |
| A4 | LATICRETE check: 6 mm notch, 22.7 kg bag at 0.47 | 22.7/(0.47 × 6) = **8.05 m²** (TDS says 7.4–8.8) |

---

## 3. Waste factors by layout

Sources disagree widely, and nobody publishes a standard (TCNA has no percentage):
- Bob Vila: "Buying at least 10 percent more tile … should cover you". "Budget up to 20 percent … if you're attempting a more unique pattern" (herringbone or diagonal). https://www.bobvila.com/articles/how-much-tile-do-i-need/
- Artistic Tile, a high-end stone maker and the upper bound: straight lay "20% overage" (25 % with many corners). Diagonal "25 – 30%". Herringbone "20 – 25%" (25–30 % in complex rooms). Chevron, basketweave and brick "25 – 30%". Large format "a minimum of 30%". https://www.artistictile.com/pages/advice-how-to-measure
- Home Depot and Lowe's installation guides use a flat 10 % (seen in search snippets only).
- Most retailer guides: straight 10 %, diagonal 15 % (15–20), herringbone 15–20 % (up to 25).

**App defaults (DERIVED, middle of the published ranges), all editable:**
| Layout | Range seen | **Default** |
|---|---|---|
| Straight / stack / grid | 5–20 % | **10 %** |
| Brick / running bond ½ offset | 10–15 % | **12 %** |
| ⅓ offset | 10–15 % | **12 %** (offcuts reuse less well; add +3 % if the tile is ≥600 mm long) |
| Basketweave | 10–30 % | **15 %** |
| Diagonal 45° | 15–30 % | **15 %** |
| Herringbone 90° | 15–25 % | **20 %** |
| Herringbone 45° / chevron | 20–30 % | **25 %** |
| Hexagon | 15–20 % | **15 %** |

Modifiers: large format (side ≥600 mm) **+5 %**. Small room (<4 m²) **+5 %**. Many corners or penetrations **+5 %**. Always round up to whole boxes. Better still, compute the real cut count from the set-out (section 4) and use the percentage only as a fallback.

**Offset rule, VERIFIED (secondary, CTEF quoting ANSI A108.02 §4.3.8.2):** "For running bond/brick joint and any offset patterns … utilizing tiles … where the side being offset is greater than **15"** (nominal dimension), the offset pattern will be a maximum of 33% unless otherwise specified by the tile manufacturer. If an offset greater than 33% is specified, the specifier and owner must approve the mock-up and lippage." Note: the 18" threshold is from the **2012** TCNA Handbook. The current text says **15"**. §4.3.8.1 sets the joint for offset tiles with any side >15" at an average minimum of 1/8" (rectified) or 3/16" (calibrated), widened by the edge warpage. https://www.ceramictilefoundation.org/blog/offsets-grout-joints-customer-expectations
The TTA guide also says "Large format tiles may not be suitable for fixing in a brick bond pattern."
App rule: warn when the offset is >33 % and the offset side is >381 mm (15").

Unit tests: W1: 12.0 m² straight gives 13.2 m². With 0.72 m²/box (600×600 ×2) that is 18.33, so **19 boxes**. W2: 12.0 m² herringbone gives 14.4 m², so 20 boxes.

---

## 4. Set-out / centring

- **TTA Guide to Tiling, VERIFIED:** "For plain tiles each wall should be centralised avoiding any small cuts." "Set out horizontal position of the tiles so that the same size cuts are made either side of windows". "Avoid small difficult cuts as they can spoil the appearance." Floors: "Mark a chalk line on the floor down the centre of the room parallel to the most suitable wall". https://www.tiles.org.uk/wp-content/uploads/2026/04/TTA-A5-Guide-to-Tiling-Artwork-Update-4.pdf
- The "no cut less than half a tile" rule is widespread trade guidance, but the **exact BS 5385 wording is UNVERIFIED** (paywalled). A "minimum one-third (BS 5385-3)" claim appears only on a commercial site, so it is also **UNVERIFIED**.

**Algorithm (DERIVED):** run length L between the finished faces, module M = tile + joint.
```
cutA = (L/2) mod M              // a joint sits on the centre line
cutB = (L/2 + M/2) mod M        // a tile is centred on the centre line
choose whichever is larger; cut tile piece = cut − joint (and − perimeter gap if one is used)
```
Because cutB = (cutA + M/2) mod M, one of the two options is always ≥ M/2. So centring can always deliver equal edge cuts of at least half a tile. Use a minimum-cut threshold of 0.5 × tile (warn) and 0.33 × tile (hard warn, UNVERIFIED value).
Unit tests: S1: L=3000, tile 600, joint 3. M=603, cutA=294, cutB=595.5, so **centre a tile** and the cut piece is ≈592.5 mm on each side. S2: L=2400, tile 300, joint 3. M=303, cutA=291, cutB=139.5, so **joint on centre** and the piece is ≈288 mm.

---

## 5. Falls / slope

**Formula:** Δh = run × gradient. For 1:n, Δh = run / n. For a percentage, Δh = run × %/100. For in/ft, Δh(in) = run(ft) × rate.
- Centre (point) drain: run to an edge = perpendicular distance from the drain to that edge. Distance to a corner = √((W/2)² + (L/2)²) for a drain at the centre (generally √(dx² + dy²)).
  - With a level perimeter and a 4-plane envelope, each plane falls at g. The hip/valley lines toward the corners fall at only **h/diag** (g/√2 for a square). To keep the valley ≥ the minimum, set h = g_min × diag. Then check that the plane slope h/(W/2) ≤ g_max. DERIVED.
- Linear drain along one wall: single plane, Δh = g × distance from the drain to the far edge.

**Requirements:**
| Jurisdiction | Requirement | Status / source |
|---|---|---|
| **AU NCC 2022 Housing Provisions 10.2.12** | "the minimum continuous fall of a floor plane to the waste must be 1:80; and … the maximum continuous fall of a floor plane to the waste must be 1:50." 10.2.14: shower areas (enclosed or unenclosed) must have a floor waste with falls to 10.2.12. Unenclosed shower waterstop at "a minimum horizontal distance of 1500 mm from the shower rose" (10.2.18). Step-down showers ≥ 25 mm (10.2.15). | VERIFIED. https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/10-health-and-amenity/part-102-wet-area-waterproofing |
| AU older 1:60 figure | AS 3740-2010 practice. The VBA/BPC NCC 2022 roadshow says AS 3740-2021 and the Housing Provisions now require a **minimum 1:80**. The Sika Davco K10 PDS gives 1:80 for wet areas and 1:100 for balconies/rooftops. | VERIFIED (secondary) |
| **US IRC P2709.1** (on-site built receptors) | Finished floor slopes uniformly to the drain "not less than ¼ unit vertical in 12 units horizontal (2-percent slope) nor more than ½ unit … (4-percent slope)". Threshold to drain depth 2–9 in (jaspector paraphrase). | VERIFIED (secondary; one reproduction garbles the max as ⅜). I couldn't open the ICC viewer (403). |
| **US IPC 417.4.1** | Same 2–4 % wording as the IRC is expected. | **UNVERIFIED** (ICC 403). |
| **US UPC 408.x** | Not less than ¼ in/ft and not more than ½ in/ft (20.8–41.8 mm/m). The section number is 408.5 or 408.6 depending on edition. | VERIFIED (secondary: UPC Illustrated Manual excerpt in TileLetter, state study guides) |
| **UK BS 5385-4:2015** wet rooms | Shower area 1:80 (shallowest) to 1:35 (steepest), 1:60 the practical target. Premier Guarantee technical manual: "should fall between 1:80 and 1:100 to the drainage point". | VERIFIED (secondary) for the warranty figure; BS 5385-4 range **UNVERIFIED** (secondary trade sites only) |
| **NZ E3/AS1** | Level-entry / open shower ≥ **1:50** to the waste within a 1500 mm radius of the rose (cl. 3.3.2.3, per Level.org.nz/BRANZ). Enclosed shower with upstand ≥ **1:60** (BRANZ). | VERIFIED (secondary) https://www.level.org.nz/wet-areas/waterproofing-tiled-showers/ |
| **Canada NPC 2020** | No numeric shower-floor slope found. A Kelowna bulletin uses ¼"/ft for curbless showers. | **UNVERIFIED** |

**App defaults:** AU 1:80 min / 1:50 max (suggest 1:60 inside the shower). US 2 % min / 4 % max (¼–½ in/ft). UK 1:80 min / 1:35 max (target 1:60). NZ 1:50 level entry / 1:60 enclosed.

Unit tests: F1: 1200 mm at 1:60 = **20 mm**. F2: 1200 mm at 1:80 = **15 mm**. F3: 30 in at ¼ in/ft = **0.625 in**. F4: 900×900 centre drain, AU 1:80 on the valley. Diag = 636.4 mm, h = 7.95 mm, plane slope = 7.95/450 = 1:56.6, which is ≤ 1:50 max, so OK. F5: 1200×900 with a linear drain on the 900 wall, 1:60 over 1200 mm = 20 mm.

---

## 6. Waterproofing quantity

**AU NCC 2022 10.2.2 (VERIFIED):** shower floor waterproof "including any hob or step-down". Shower walls waterproof "not less than 1800 mm above the floor substrate". Wall junctions in the shower waterproof "not less than 40 mm either side of the junction". Wall/floor junctions in the shower waterproof. 10.2.3, outside the shower: concrete or fibre-cement floor "water resistant" (timber-based floors waterproof); wall/floor junctions waterproof, with a flashing horizontal leg ≥ 40 mm. 10.2.24: perimeter flashing "vertical leg that extends a minimum of 25 mm above the finished floor level". 10.2.4: "within 150 mm above a vessel" (bath or spa). 10.2.28: the hob membrane goes over the hob and ends "not less than 50 mm onto the floor".
The common **150 mm upturn outside the shower** is trade practice (AS 3740-2010 era). Premier Guarantee UK says walk-in shower walls are "waterproofed for a height of 150mm above the floor junction" and "water resistant to a height of at least 1800mm". https://www.premierguarantee.com/en/insite/Technical/Showers-and-wet-room-construction.html
**UK:** BS 5385-4 puts wet rooms in "frequent wetting", which means full tanking (secondary). The extent of wall tanking in BS 5385 is **UNVERIFIED**.
**US:** IRC R307.2: shower walls nonabsorbent "to a height of not less than 6 feet (1829 mm) above the floor" (secondary). Chicago/IPC-style text: 72 in above the room floor and 70 in above the drain. IRC P2709.2 liner ≥ 2 in above the finished threshold (recalled; **UNVERIFIED**). TCNA B421 "3 in above curb" is **UNVERIFIED**.

**Formula:**
```
membrane area = floor area (whole wet area, or whole room)
              + Σ(shower wall lengths) × shower height (1.8 m AU/UK; 1.83 m US)
              + (room perimeter − shower walls − door widths) × upturn (default 0.15 m; NCC minimum is the junction/flashing)
              + hob (top + both faces) + niche internals
litres = area × L/m² for the full system (coats × L/m² per coat)
```
**Product example, VERIFIED (Sika Davco K10 Plus PDS):** "minimum 2 coat application to achieve a 1mm dry film thickness … 0.75mm per coat at wet film thickness … A 20Ltr pail will cover approximately 13.3m2 with 2 coats applied." That works out to **1.50 L/m²** for the system.
**Bond-breaker / tape length:** wall/floor junction length (perimeter − doors) + internal vertical corners × waterproof height (1.8 m inside the shower; 0.15 m outside) + hob edges + changes of plane + sheet joints. The tape must cover ≥ 40 mm either side, so use tape ≥ 80–100 mm wide.

Unit test M1: room 2.4×1.8 m, shower 0.9×1.2 in a corner, door 0.8 m. Floor 4.32 m². Shower walls (0.9+1.2) × 1.8 = 3.78 m². Upturn (8.4 − 2.1 − 0.8) × 0.15 = 0.825 m². **Total 8.925 m²**, × 1.5 L/m² = **13.39 L**, so 1 × 20 L pail. Tape: 7.6 m junction + 1.8 m (one internal shower corner) + 0.15 × 3 other internal corners = **9.85 m**.

---

## 7. Trim / edging

`lengths = ceil(total run / stock length)` is valid only if joins are allowed anywhere. For separate pieces (stair nosings, window reveals), use a cut list: `pieces per length = floor(stock / piece)` and `lengths = ceil(n pieces / pieces per length)`. For mixed pieces, use first-fit-decreasing bin packing. Add a 5 mm saw/mitre allowance per cut.
Stock lengths (VERIFIED retailer pages):
- UK **2.5 m**: Screwfix Homelux and Diall straight aluminium trims "2.5m". https://www.screwfix.com/c/sealants-adhesives/tile-trims/cat9550003 . Victorian Plumbing Tilebank: "Length: 2.5 Metres".
- AU/NZ **2.5 m and 3.0 m**: Bunnings QEP afterfit trims 2.5 m, L-angle trims 3 m. https://www.bunnings.com.au/qep-10mm-x-2-5m-silver-afterfit-tile-trim_p0227376 , https://www.bunnings.com.au/qep-10mm-x-3m-white-angle-l-shape-tile-trim_p0194492
- US/CA: Schluter JOLLY/SCHIENE sold as **8' 2-1/2" (2.5 m, 98.5 in)** (Home Depot, Rona, Sutherlands). https://www.schluter.com/schluter-us/en_US/finishing-profiles/p/JOLLY . An 8 ft generic PVC trim is common but **UNVERIFIED** here.
Unit tests: T1: 7.6 m at 2.5 m gives **4 lengths**. T2: 12 stair nosings at 1.0 m, stock 2.5 m. 2 per length, so **6 lengths**. T3: 12 nosings at 1.2 m, stock 3.0 m. 2 per length, so 6 lengths.

---

## 8. Stairs

Formulas (DERIVED):
```
risers n = ceil(total rise / max riser);  R = total rise / n;  treads = n − 1 (if the top landing is the floor)
choose going G so that the jurisdiction's 2R+G window holds;  Blondel comfort target 2R + G ≈ 600–650 mm
tread tile area per step = width × (G + nosing projection);  riser tile area = width × R
total tiled area = n_treads × tread area + n × riser area (+ landing);  nosing trims = n_treads (cut list, section 7)
```
**Blondel rule:** François Blondel, *Cours d'architecture* (1675 per secondary sources; the "1672" date is **UNVERIFIED**). He based it on an average level-ground stride of about 24 in (2 pieds), so 2R + G ≈ stride. https://www.archdaily.com/892647 (secondary).
Code limits (recalled from the official docs; **another agent is verifying, so treat as UNVERIFIED here**): AU NCC Housing Provisions 11.2.2: riser 115–190, going 240–355, 2R+G 550–700 mm. UK Approved Doc K (private): rise 150–220, going 220–300, 2R+G 550–700, pitch ≤42°. US IRC R311.7.5: riser ≤7¾", tread ≥10", nosing ¾–1¼" where tread <11". NZ D1/AS1 Table 7 and Canada NBC 9.8.4: per the other agent.
Unit test ST1: total rise 2700 mm, max 190, gives n = 15 risers, R = 180 mm. G = 250 gives 2R+G = 610, inside 550–700. Width 1000, nosing 20: 14 treads × 0.27 m² + 15 risers × 0.18 m² = **6.48 m²**.

---

## Source URLs
- MAPEI Ultracolor Plus TDS (UK): https://checkout.mkm.com/content/products/pdf/38559/mapei-ultracolour-plus-grout-cement-grey-5-kg-b089587_TechData_1.pdf
- MAPEI grout calculator (5–10 % overage): https://www.mapei.com/eg/en/tools-and-downloads/product-calculator/grouts
- ARDEX-FLEX FS TDS (UK, Sept 2023): https://www.mandarinstone.com/app/uploads/2023/12/Ardex-FS-Flexible-Wall-Floor-Grout.pdf
- ARDEX-FLEX FL TDS: https://protilertools.co.uk/userfiles/files/1c0a62d40d9f41e38beb2aa2cb0733a0_ARDEX-FLEX-FL%20Technical%20Data%20Sheet.pdf (404 when fetched; formula quoted through search)
- ARDEX FG 8 (AU): https://www.thetilecollective.com.au/wp-content/uploads/2023/06/ARDEX-FG-8-Datasheet.pdf
- Kerakoll Fugabella Color TDS 2024/05: https://twstrade.com.au/uploads/custom/Kerakoll%20Fugabella%20-%20TDS.pdf
- Custom Building Products Grout Card (coverage charts): https://www.custombuildingproducts.com/wp-content/uploads/Grout_Card_CC25_6-25_WEB-2.pdf
- LATICRETE 254 Platinum data sheet: https://cdn.shopify.com/s/files/1/1996/7489/files/Laticrete_254_Platinum_Product_Data_Sheet.pdf ; LATICRETE estimator: https://au.laticrete.com/solutions-for-you/contractors-and-installers/project-estimator
- MAPEI Ultraflex 2 TDS (US): read from a PDF that had already been downloaded; product page https://www.mapei.com/us/en-us/products-and-solutions/products/detail/ultraflex-2 (URL not checked)
- Davco/Sika Ultraflex PDS (AU): https://aus.sika.com/dms/getdocument.get/9872370c-646c-487d-9abb-c8dfbf3872e4/Davco%20Ultraflex%20Data%20Sheet.pdf
- Schomburg Monoflex S2: https://schomburg.com/de/en/products/monoflex-s2 (via search; DNS failed when fetched)
- ARDEX AU TP002.005 Adhesive Coverage: https://ardex.co.nz/nzpdf/Technical%20Bulletins/TP002.005_AdhesiveCoverageIssues.pdf
- ARDEX AU TB001.010 Large Format Tiles: https://www.ardex.co.nz/pdf/tech%20bulletins/TB001.010_Fixing%20Large%20Format%20Tiles.pdf
- TTA Guide to Tiling (2026): https://www.tiles.org.uk/wp-content/uploads/2026/04/TTA-A5-Guide-to-Tiling-Artwork-Update-4.pdf
- CTEF, ANSI A108.5 coverage: https://www.ceramictilefoundation.org/blog/insufficient-mortar
- CTEF, ANSI A108.02 offsets: https://www.ceramictilefoundation.org/blog/offsets-grout-joints-customer-expectations
- Rubi trowel guide: https://www.rubi.com/us/blog/trowel-size-for-tile/
- NCC 2022 Housing Provisions Part 10.2: https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/10-health-and-amenity/part-102-wet-area-waterproofing
- BPC Vic NCC 2022 roadshow (1:80 change): https://www.bpc.vic.gov.au/__data/assets/pdf_file/0024/25890/NCC-2022-Roadshow-Building-Webinar-Presentation.pdf
- Sika Davco K10 Plus PDS (AU): read from a PDF that had already been downloaded; find it via aus.sika.com (URL not recorded)
- Premier Guarantee showers and wet rooms: https://www.premierguarantee.com/en/insite/Technical/Showers-and-wet-room-construction.html
- UK BS 5385-4 range (secondary): https://builderssquad.co.uk/blog/the-wet-room/ , https://squote.app/knowledge/tiling/wet-room-design-and-falls
- NZ: https://www.level.org.nz/wet-areas/waterproofing-tiled-showers/ , https://www.branz.co.nz/design-build/articles/waterproofing-tiled-showers
- US IRC P2709 (secondary): https://www.jaspector.com/codes/irc-2021/ch27-plumbing-fixtures/shower-threshold-height-code/ ; UPC excerpt: https://www.tileletter.com/?p=32535 ; Chicago 417.4.2: https://codelibrary.amlegal.com/codes/chicago/latest/chicago_il/0-0-0-2691147
- Kelowna shower bulletin: https://kelowna.ca/sites/files/1/docs/homes-building/2025_on_site_constructed_shower_-_bulletin.pdf
- Waste: https://www.bobvila.com/articles/how-much-tile-do-i-need/ , https://www.artistictile.com/pages/advice-how-to-measure
- Trims: Screwfix, Victorian Plumbing, Bunnings and Schluter URLs in section 7
