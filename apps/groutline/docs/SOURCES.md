# Groutline: where every number comes from

Researched 23 Nov 2026. Full notes with a URL against every value, and a status for each (verified from the primary
document, verified secondary, derived, or UNVERIFIED), are in `docs/research/`:

| File | Covers |
|---|---|
| `research/research-formulas.md` | Grout, adhesive, waste, set-out, falls, waterproofing, trim and stair formulas, with worked examples used as unit tests |
| `research/research-au-nz.md` / `.json` | Australia and New Zealand: tiles, adhesive, grout, membranes, primers, tapes, NCC / NZBC values |
| `research/research-uk-ie.md` / `.json` | United Kingdom and Ireland: same, BS 5385 parts, Approved Document K, TGD K |
| `research/research-us-ca.md` / `.json` | United States and Canada: same, ANSI A108/A118, IRC/UPC, NBC Part 9, TTMAC |

Each country file in `src/countries/` repeats the source URL beside every catalogue item (`src`) and code value.
Retailer and brand names appear only in those `src`/`docs` fields and comments; a unit test fails if one reaches UI text.

## Formulas (summary)

- Tiles: net area / ((L + joint) x (W + joint)) x (1 + waste), rounded up; cartons = tiles / per carton, or
  order area / m2 per carton. Waste defaults (no standard publishes them; mid-points of retailer and maker ranges):
  straight 10, brick and third 12, diagonal 15, hexagon 15, herringbone 20 (%).
- Offsets: ANSI A108.02 4.3.8.2: offset side over 15 in means offset at most 33% (CTEF quoting the standard).
- Set-out: joint on centre vs tile on centre, keep the larger edge cut (TTA Guide to Tiling: centralise, avoid
  small cuts). One of the two is always at least half a module.
- Grout: kg/m2 = (A + B) / (A x B) x C x D x K (MAPEI Ultracolor Plus TDS, K = 1.6; ARDEX-FLEX FS 1.5; FL 1.75;
  Kerakoll about 1.9). US sanded K = 1.76 back-solved from Custom's coverage chart (12x12x3/8 at 1/8 = 348 sq ft per 25 lb).
- Adhesive: maker's coverage per notch where published; otherwise 0.45 kg/m2 per mm of square notch (US data
  sheets 0.41 to 0.50, AU/EU 0.28 to 0.33; the higher figure is used so a job never runs out). Back-butter adds
  1.2 kg/m2 (derived). Suggested notch by tile size from the Davco Ultraflex data sheet, TTA guide, ARDEX TB001.010.
- Falls: rise = run / N for 1:N. Plane basis (default, matches NCC 2022 HP 10.2.12 "fall of a floor plane"):
  run = waste to furthest wall. Valley basis: run = waste to furthest corner. AU 1:80 to 1:50 (NCC 2022 HP 10.2.12);
  NZ 1:50 within 1500 mm of the rose (E3/AS1 via BRANZ); US/CA 1/4 to 1/2 in per ft (IRC P2709, UPC 408); UK/IE
  1:80 to 1:35 trade range (BS 5385-4 figure unverified, flagged in the app).
- Waterproofing: floor + shower walls x height + (perimeter - shower walls - door) x upturn; tape = junction +
  internal corners x height. AU shower walls 1800 mm (NCC 10.2.2); the 150 mm upturn is trade practice (flagged).
- Trim: cut list by first-fit decreasing over stock lengths (2.5/3.0 m AU/NZ, 2.5 m UK/IE, 98.5 in US/CA).
- Stairs: tiles per face = ceil(width / module) x ceil(depth / module); riser, going and 2R+G limits per country
  (NCC 11.2.2, Approved Document K, TGD K, D1/AS1, IRC R311.7.5, NBC 9.8.4).

## Not verified (shown as generic in the app)
UK/IE wet-room fall figure inside BS 5385-4; US shower-wall height (IRC R307.2) and upturn; Canada shower slope and
membrane heights; several NZ/IE pack thicknesses and box contents (marked verified: false, the UI says to check the
label); epoxy grout factors for most brands. Countries other than the six use generic metric guidance and say so.
