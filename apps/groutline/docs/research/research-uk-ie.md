# Tiling data: United Kingdom and Ireland

Researched 23 Nov 2026. The JSON file next to this one (`research-uk-ie.json`) has the same data with a source URL on every row.

How to read the status labels:
- **Verified**: I read the value directly from the cited page or PDF.
- **searchIndex**: I only saw the value in a search-engine extract, because the site blocked automated fetches or rate-limited them. Recheck these before shipping.
- **UNVERIFIED**: I found no readable source.

---

## UNITED KINGDOM (GBP)

### 1. Stocked tile sizes (verified unless noted)
| Size (mm) | Thk | Use | Per box | m²/box | Source |
|---|---|---|---|---|---|
| 200x100 metro | 7 | wall | 50 | 1.0 | [Wickes 166211](https://www.wickes.co.uk/Wickes-Metro-White-Gloss-Ceramic-Wall-Tile---200-x-100mm/p/166211) |
| 400x250 | 8 | wall | 10 | 1.0 | [Wickes 273047](https://www.wickes.co.uk/Wickes-White-Gloss-Ceramic-Wall-Tile---400-x-250mm/p/273047) |
| 600x600 | 9 | wall+floor (incl. wetroom floors) | 4 | 1.44 | [Wickes 556908](https://www.wickes.co.uk/Wickes-Boutique-Genova-Beige-Matt-Porcelain-Wall+Floor-Tile---600-x-600mm/p/556908) |
| 1200x600 | 9.7 | wall+floor | 2 | 1.44 | [Wickes 287253](https://www.wickes.co.uk/Wickes-Boutique-Harmony-Natural-Matt-Porcelain-Wall+Floor-Tile---1200-x-600mm/p/287253) |
| 1200x600 | 9 | wall+floor (not wetroom floor) | 2 | 1.44 | [Wickes 345714](https://www.wickes.co.uk/Wickes-Boutique-Cayman-White-Matt-Porcelain-Wall+Floor-Tile---1200-x-600mm/p/345714) |
| 600x600 | 9.5 | both | 4* | 1.44* | [Topps Elementi](https://www.toppstiles.co.uk/bathroom-tiles/elementi-grey-tile-60cm-x-60cm) |
| 300x600 | 8.7 | both | 7* | 1.26* | [Topps Elementi](https://www.toppstiles.co.uk/bathroom-tiles/elementi-grey-tile-30cm-x-60cm) |
| 600x1200 | 8 | both | 2* | 1.44* | [Topps Aldbury](https://www.toppstiles.co.uk/bathroom-tiles/aldbury-bone-tile-60cm-x-120cm) |
| 200x1200 plank | 9 | both | 5* | 1.20* | [Topps Nordbon](https://www.toppstiles.co.uk/bathroom-tiles/nordbon-arena-tile-20cm-x-120cm) |
| 200x200 | 10 | ? | 24* | 0.96* | [Topps Cotto](https://www.toppstiles.co.uk/bathroom-tiles/cotto-tile-20cm-x-20cm) |
| 200x400 | 10 | wall | 12 | 0.96 | [Topps Kelham Loft](https://www.toppstiles.co.uk/bathroom-tiles/kelham-lofttm-chalk-tile-20cm-x-40cm) |
| 100x200 metro | 7.7 | wall | 50* | 1.0* | [Topps Metro Grey](https://www.toppstiles.co.uk/metro/metro-grey-tile) |
| 75x150 | 7.5 | wall | 60* | 0.675* | [Topps Campagna](https://www.toppstiles.co.uk/bathroom-tiles/campagna-artisan-taupe-tile-7-5cm-x-15cm) |

\* Topps: I read the size, thickness and per-tile coverage from the product JSON embedded in the page. The "per box" figure comes from Topps' `tiles_per_box_wastage` field, and m²/box = per box × tile area, which I calculated myself. On a pack-priced item (Kelham Loft), the same field structure shows a pack of 12 and 0.96 m².
I couldn't verify 330x330 or 300x300 floor tiles in the UK, or any B&Q pack data (diy.com blocked fetches).

### 2. Adhesives
| Product (generic) | Brand for docs | Pack | Coverage | Source |
|---|---|---|---|---|
| Standard-set flexible C2TE S1 powder | BAL Flex One | 20 kg | 4mm notch 0.6 m²/kg (1.67 kg/m²); 6mm dry wall 0.5 m²/kg (2.0); 6mm wet wall solid bed 0.4 m²/kg (2.5); 10mm ext/floor solid bed 0.26 m²/kg (3.85) | [BAL TDS](https://www.theunderfloorheatingstore.com/cdn/shop/files/BAL-FLEX-ONE-TDS-FEB-22.pdf) (verified, Oct 2022) |
| Flexible fibre C2TE S1 powder | ARDEX X 77 | 20 kg | 8 m² per bag with 8x8mm trowel (≈2.5 kg/m²); 5.5 m² @ 3mm bed. ~1.05 kg/m²/mm (searchIndex) | [CTD Tiles](https://www.ctdtiles.co.uk/product/ardex-x-77-microtec-fibre-reinforced-flexible-standard-set-adhesive-grey-s1-20kg) |
| Ready-mixed wall D1TE | Palace Super-Grip | 3.75 / 7.5 / 15 kg tubs | ~1.7 kg/m² notched (6mm trowel); solid bed ~0.7 m² per 1.7 kg | [Palace TDS](https://palacechemicals.co.uk/wp-content/uploads/2019/01/SuperGrip-TDS-Live.pdf) |

Useful limits from the BAL TDS: tile weight on gypsum plaster up to 20 kg/m², on plasterboard up to 32 kg/m². BAL's trowel guide: mosaics 4mm, walls 6mm, wet walls 6mm with a solid bed, floors and external 10mm with a solid bed, large format 20mm notch (about 7mm bed).

### 3. Grout
| Product | Pack | Kind | Density / SG | Coverage | Source |
|---|---|---|---|---|---|
| BAL Micromax3 ECO, CG2WA, 1–30mm | 2.5 / 5 / 10 kg | cement | SG 1.5 | 200x200x6 @2mm 6.05 m²/kg; 300x300x9 @3mm 4.03; 600x600x9 @3mm 8.01 | [BAL TDS May 2025](https://www.bal-adhesives.com/wp-content/uploads/2026/03/BAL-MICROMAX3-ECO-MAY-25.pdf) |
| Mapei Ultracolor Plus, CG2WA, 2–20mm | 23 kg, 5 kg, 2 kg | cement | powder 1,400 kg/m³; mix 1,980 kg/m³ | **Formula: kg/m² = (A+B)/(A×B) × C × D × 1.6** (A,B tile mm; C thickness mm; D joint mm) | [Mapei UK TDS 2801-10-2017](https://www.tilemountain.co.uk/pdf/Ultracolor_Plus_Datasheet.pdf) |
| BAL Grout Flex, CG2, ≤5mm walls | 5 / 10 kg | cement | UNVERIFIED | – | [BAL](https://www.bal-adhesives.com/product/bal-grout-flex/) |
| BAL Floor Epoxy, RG1, ≤20mm | 10 kg | epoxy (3-part) | SG 1.75 | 200x200x9 @3mm 2.2 m²/kg; 300x300x9 @3mm 3.25 | [BAL TDS](https://www.bal-adhesives.com/wp-content/uploads/2026/03/BAL-FLOOR-EPOXY-MAY-25.pdf) |

Suggestion for the app: use the Mapei formula with a per-product density (1.6 is Mapei's factor, BAL's cement grout is SG 1.5 and BAL's epoxy is SG 1.75). As a check, the formula gives about 5.6 m²/kg for BAL's 200x200x6 @2mm row against the published 6.05, so BAL's tables run slightly leaner than the formula.

### 4. Waterproofing ("tanking")
- **BAL Waterproof 1C**: one-part liquid tanking, 5 kg tub (sold by weight, not litres). Walls 0.8mm dry gives 6 m² per tub (≈0.83 kg/m²). Floors 1.6mm gives 3 m² per tub (≈1.67 kg/m²), with two coats recommended. Tile after 2 h. Approved under an EAD/ETA. [TDS](https://www.bal-adhesives.com/wp-content/uploads/2026/03/BAL-WATERPROOF-1C-MAY-25.pdf)
- **Everbuild Aquaseal Wet Room System (Sika)**: kit with 1 L primer, 3 L (standard, 4.5 m²) or 5 L (large, 7.5 m²) membrane, a 10 m tape roll and a drain mat. The membrane goes on in 2 coats, which works out at about 0.33 L/m² per coat (my calculation). Tile after 12 h. [Sika PDS](https://irl.sika.com/dms/getdocument.get/aa8f7649-28e2-4eb7-a8a4-7cf56c7b5406/everbuild_aquasealwetroomsystem.pdf)
- **Schluter KERDI-200 sheet**: 1 m wide in 5 / 10 / 30 m rolls (1.5 m and 2 m widths also exist), about 0.2mm thick. searchIndex only: [flyer](https://eu.schluter.com/statics/www_schlueter_gb_2x/downloads/cumulus/557276_Flyer_KERDI_200_30qm_GB.pdf)
- **Primer**: BAL Primer 1C, 1 L, 6 m²/L undiluted, dry in 15–30 min. [TDS](https://www.bal-adhesives.com/wp-content/uploads/2026/03/BAL-PRIMER-1C-MAY-25.pdf)
- **Tape**: BAL Waterproof 1C Tape 100mm × 5m ([BAL](https://www.bal-adhesives.com/product/bal-waterproof-1c-tape/)). Schluter KERDI-KEBA comes in 85 / 125 / 150 / 185 / 250mm widths and 5 or 30 m rolls ([Schluter GB](https://eu.schluter.com/en-GB/waterproofing-224/e/21978/kerdi-keba)). The Aquaseal tape is 10 m, but I couldn't verify its width.

### 5. Standards and rules
- **BS 5385-1:2018**: wall tiling in normal internal conditions. **BS 5385-2**: external walls (2015 edition per searchIndex). **BS 5385-3:2024**: all floor tiling, published 30 May 2024. It replaces both 5385-3:2014 and **5385-5:2009 (Part 5 is withdrawn)**. **BS 5385-4:2015**: special conditions, including wet areas. ([TTA list](https://www.tiles.org.uk/relevant-standards/), [TTA 2024 update](https://www.tiles.org.uk/tta-urges-awareness-on-updates-to-the-british-standard-for-wall-floor-tiling/))
- **BS 8000-11:2011**: workmanship code for wall and floor tiling. A revision is in progress. (searchIndex, [BSI](https://knowledge.bsigroup.com/products/workmanship-on-building-sites-internal-and-external-wall-and-floor-tiling-ceramic-and-agglomerated-stone-tiles-natural-stone-and-terrazzo-tiles-and-slabs-and-mosaics-code-of-practice))
- **BS EN 12004-1:2017** adhesive classes: C / D / R types, 1 or 2 for performance level, F fast, T reduced slip, E extended open time, S1 / S2 deformability. **BS EN 13888-1:2022** grout classes: CG1 / CG2 with W and A, and RG for resin. The class codes above appear on the verified TDSs, but I couldn't verify the full requirement values (the standards are paywalled).
- **Slip**: [HSE GEIS2](https://www.hse.gov.uk/pubns/geis2.pdf) uses the UKSRG 2011 bands: PTV 0–24 high slip potential, 25–35 moderate, **36+ low**. Slider 96 is for shod pedestrians and Slider 55 for barefoot. The pendulum test is BS 7976-1 to -3.
- **Stairs**: [Approved Document K 2013](https://assets.publishing.service.gov.uk/media/60d5bdcde90e07716f516cfd/Approved_Document_K.pdf), Table 1.1, verified. Private stair: **rise 150–220mm, going 220–300mm, 2R+G 550–700mm, max pitch 42°**. Utility stair: rise 150–190, going 250–400. General access: rise 150–170, going 250–400. This is England only.
- **Wet room falls (sources conflict)**: a [Building CPD article](https://building.co.uk/cpd/-cpd-14-2015-integrated-solutions-for-wetrooms-with-tile-and-stone-coverings/5076632.article) gives **1:80 to 1:35** within the shower but doesn't attribute it to a standard. [Premier Guarantee](https://www.premierguarantee.com/en/insite/Technical/Showers-and-wet-room-construction.html) and [LABC Warranty](https://www.labcwarranty.co.uk/blog/domestic-shower-and-wet-room-construction/) give **1:80 to 1:100 to the drain**, with waterproofing 150mm up the walls. **I couldn't verify the BS 5385-4 numeric value.**

### 6. Terms (UK)
tanking (Topps menu says "Waterproofing & Tanking"), tile trim, grout, colour, screed, plasterboard, tile backer board, substrate matting / uncoupling mat, wet room tray, doorbar. Units are mm, m², kg and L. Sources: Topps site navigation and BAL TDS.

---

## IRELAND (EUR)

### 1. Stocked tile sizes
| Size (mm) | Thk | Use | Per box | m²/box | Source |
|---|---|---|---|---|---|
| 100x200 metro | 7 | wall | 50 | 1.0 (€31.99/m²) | [Woodies](https://www.woodies.ie/metro-white-ceramic-wall-100x200mm-pk50-1192398) |
| 75x300 | 10 | wall | 19 | 0.42 (€57.12/m²) | [Woodies](https://www.woodies.ie/beverley-white-ceramic-wall-tile-75x300mm-pk19-1192402) |
| 331x331 | ? | wall+floor | ? | ? | [Woodies](https://www.woodies.ie/laura-ashley-heritage-wicker-charcoal-ceramic-wall-and-floor-tile-331x331mm-1135468) |
| 498x498 | ? | wall+floor | ? | ? | [Woodies](https://www.woodies.ie/hd-laurel-carrara-marble-ceramic-wall-and-floor-tile-498x498mm-1135438) |
| 600x600 | 9.5 | both | ? | ? (€91.71/box) | [Tile Style](https://tilestyle.ie/products/classica-nero-marquina-matt-60x60) |
| 300x600 | 8.7 | both | ? | ? | [Tile Style](https://tilestyle.ie/products/advance-mink-30x60) |
| 600x1200 | 10 | both | ? | ? | [Tile Style](https://tilestyle.ie/products/volterra-stone-60x120) |
| 1200x1200 | 10.5 | both | ? | ? | [Tile Style](https://tilestyle.ie/products/leccese-perla-120x120-mat) |
| 300x300 | 9.5 | both | ? | ? | [Tile Style](https://tilestyle.ie/products/classica-carrara-matt-30x30) |
| 200x200 | 9.5 | both | ? | ? | [Tile Style](https://tilestyle.ie/products/form3-anthracite-20x20) |
| 100x200 bevel | 7 | wall | ? | ? | [Tile Style](https://tilestyle.ie/products/bevelled-gris-10x20) |
| 75x150 bevel | 7 | wall | ? | ? | [Tile Style](https://tilestyle.ie/products/bevelled-blanco-gloss-7-5x15) |
| 590x590 | ? | ? | 3 | 1.05 (€50/box) | [Delforno](https://www.delforno.ie/products/sandstone-white-59x59), searchIndex |
| 600x1200 | ? | ? | 2 | 1.44 (€88.13/box) | [Delforno](https://www.delforno.ie/products/dark-flow-natural-porcelain-tile-60x120cm), searchIndex |

I took the Tile Style sizes, thickness and wall/floor use from its Shopify product JSON. Its box contents are UNVERIFIED because the site rate-limited me. The most common sizes across Tile Style's ranges are 60x120, 60x60, 120x120, 30x60, 30x30, 20x120 and 45x120 (wall). Metro sizes are mostly 10x20, 10x30, 7.5x15, 7.5x30 and 5.2x16.

### 2. Adhesives
- **BAL Flex One**, 20 kg: the same BAL TDS coverage as the UK, and BAL's data sheets cover "UK and Ireland". An Irish stockist ([bathroomoutlet.ie](https://bathroomoutlet.ie/products/bal-flex-one-white-wall-floor-tile-adhesive-20kg)) lists it at €59 (searchIndex).
- **Nicobond Rapidflex S1**, 20 kg, €57.65 at Tile Style. The Tile Style page states "Coverage 2–4 kg/m²" and a 12mm max bed. NBS Source (searchIndex) splits that into 2 kg/m² notched and 3–4 kg/m² solid bed at 3mm, but gives no notch size.
- **Butech One Flex Pro** C2TE S1, 25 kg, €56.96 at Tile Style. Coverage UNVERIFIED.
- **Evo-Stik Technik Rapid Set Flexible**, 20 kg, €2.00/kg at Woodies. Coverage UNVERIFIED.

### 3. Grout
Tile Style stocks Nicobond GroutPro Flexible (2.5 / 10 kg), Butech Colorstuk Rapid (5 kg), Colorstuk Especial (2 kg) and Nicobond Starlike Evo resin grout (2.5 kg, €120.87). Woodies stocks Evo-Stik Technik TGS (5 / 10 kg). Woodies also shows "SG 1.8 mixed" for TGS, but the identical text is on its adhesive page, so treat that figure as UNVERIFIED. For coverage, use the BAL or Mapei method above.

### 4. Waterproofing
- **Everbuild Aquaseal Wet Room System**: data sheet from Sika **Ireland**, same figures as the UK section (3 L = 4.5 m², 5 L = 7.5 m², 2 coats, 1 L primer, 10 m tape).
- **Arc Tanking Kit System**: 5 m², contains primer, tanking paste and sealing strip. €69.89 inc VAT / €56.82 ex VAT (the ratio is 1.23, Ireland's 23% VAT). Pack volumes and number of coats UNVERIFIED. [McMahons](https://www.mcmahons.ie/arc-tanking-kit-system-5sq-m-60550)
- **BAL Waterproof 1C**: marketed for the UK and Ireland, but I couldn't confirm an Irish stockist.

### 5. Standards
- **Ireland has no Irish ceramic-tiling code of practice that I could find.** NSAI sells the BS 5385 parts (e.g. [BS 5385-3:2024 on shop.standards.ie](https://shop.standards.ie/en-ie/standards/bs-5385-3-2024-250737_saig_bsi_bsi_3427705)), and the data sheets sold in Ireland (BAL, Palace) reference BS 5385. That's indirect evidence that Irish tilers work to BS 5385, not confirmation. Don't confuse this with I.S. ICP 2 / S.R. 82, which covers **roof** slating and tiling.
- Irish-adopted EN standards: I.S. CEN/TR 13548:2004 (ceramic tiling design and installation, technical report), EN 12004-1:2017, I.S. EN 14891:2017 (liquid waterproofing), all searchIndex. I couldn't verify the I.S. edition of EN 13888-1.
- **Slip**: the [HSA](https://www.hsa.ie/eng/topics/slips_trips_falls/pedestrian_surfaces/measuring_slip_resistance/) recommends considering a **wet PTV of 36+ in final use conditions** and uses the pendulum test. Verified.
- **Stairs**: TGD K 2014, Table 1, verified ([PDF copy](https://www.propertyhealthcheck.ie/wp-content/uploads/2015/07/tgd-part-k-2014.pdf)). Private stair: **rise optimum 175 / max 220mm, going min 220 / optimum 250mm, pitch optimum 35° / max 42°, 2R+G 550–700mm (optimum 600)**. The table has no minimum rise and no maximum going. Semi-public: rise 165/190, going 250/300, pitch 31/38°. Public: rise 150/180, going 280/300, pitch 27/33°.
- **Wet room falls**: I found no Irish regulatory figure. UNVERIFIED.

### 6. Terms (IE)
Irish sources use the same words as the UK: tanking ("Waterproof Tanking Kit"), trim ("L-Shaped Trim", "Square Edge Trim"), grout, colour, tile spacers, levelling clips, silicone sealant. Woodies prices by "per sqm". I didn't confirm screed, plasterboard, backer board or wetroom former on an Irish page; I'm assuming they match UK usage.

---

## Main gaps
1. The falls figure in BS 5385-4 (the standard is paywalled). The trade and warranty figures conflict: 1:35–1:80 versus 1:80–1:100.
2. Box contents for Irish floor tiles (Tile Style and Delforno rate-limited me), and B&Q pack data in the UK.
3. Coverage per notch for Mapei Keraflex Maxi S1 UK: I only found the Australian data sheet (1.2 kg/m²/mm), so it's not included.
4. Full requirement values for the EN 12004 and EN 13888 classes, and current edition numbers for the I.S. versions.
5. Box counts for Topps tiles rest on an embedded data field, not on visible page text.
