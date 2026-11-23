# Spigot country data: NZ, GB, IE, US, CA (plus AU stocked materials)

Compiled 23 Nov 2026. This follows the format of `spigot-plumbing-data.md`, and AU code data there is not redone. Values marked `verified: true` were read from a page or PDF that was actually opened. Values seen only in search-result titles or snippets are `verified: false`, which means the app should show generic guidance for them. `derived` means the value was worked out here from sourced values.

No personal details were sent in any request, and nothing was downloaded or executed. Some PDFs that WebFetch saved were text-extracted locally. Unit conversions: 1 in = 25.4 mm and 1 ft = 0.3048 m.

**Access problems.** The following could not be fetched (403, 429, DNS failure, or empty pages):
- codes.iccsafe.org, nrc.canada.ca HTML, ontario.ca/laws, copper.org
- Home Depot, Lowe's, RONA, homedepot.ca, Home Hardware
- Screwfix, B&Q, Wickes, Conex, Pegler
- Chadwicks, Woodie's, Heiton Buckley, Brooks, Grafton
- Mitre 10 NZ, Kembla NZ, Tradelink
- gov.ie (TGD H was read from a mirror copy)

US and Canada retail stock lengths therefore depend mostly on search titles and are `verified: false`.

---

## Key findings, including corrections to the brief's assumptions

1. **NZ drain minimum is not 1:60.** G13/AS2 Table 2 (para 3.5.3) sizes drains by discharge units. The flattest gradient listed is 1:100 for DN80, **1:120 for DN100** and 1:200 for DN150. The 1:60 figure is the flattest column in G13/AS1 Table 4, which covers discharge pipes above ground. AS/NZS 3500.2 (2021 edition cited) is also an Acceptable Solution, through G13/AS3.
2. **NZ copper.** G12/AS1 Table 1 accepts NZS 3501, which is bore-based, or AS 1432 Types A/B/C, which are OD-based. A snippet of MBIE guidance says the two are not dimensionally compatible. NZ copper dimensions and stock are unverified.
3. **UPC 708.1** was read through the California Plumbing Code 2025, which is based on the UPC. It requires **1/4 in/ft (2%) for all sizes**. Building drains of 4 in and larger may use 1/8 in/ft (1%) where 1/4 is impractical, with AHJ approval. **No "Table 708.1" appears in that text**, so the brief's assumed per-size UPC table was not found.
4. **IPC Table 704.1 is confirmed:**
   - 2-1/2 in or less: 1/4 in/ft
   - 3 to 6 in: 1/8 in/ft
   - 8 in or larger: 1/16 in/ft

   The sources were ICC 2018 IPC Essentials and the NYC 2022 code, which is based on the IPC. The 2021 and 2024 ICC text itself was not opened.
5. **NPC 2020 Art. 2.4.8.1.(1):** 1 in 50 for NPS 3 or less. Larger pipe has no single minimum. The flattest slope allowed by Table 2.4.10.6.-C is 1 in 100 (NPS 4), 1 in 133 (NPS 5–6), 1 in 200 (NPS 8–10) and 1 in 400 (NPS 12–15). **NPC 2.6.3.5.(1) sets no fixed velocity limit:** it defers to the manufacturer's recommendation. An NPC 2025 has been published; its text is unverified.
6. **GB ADH Table 6:** a 100 mm drain needs **1:40 when peak flow is under 1 l/s**. With peak flow over 1 l/s it can go to 1:80, but only with at least 1 WC. 150 mm can go to 1:150 with at least 5 WCs.
7. **Ireland TGD H Table 6 differs from GB:**
   - 100 mm: 1:60 (one dwelling, under 2.5 l/s) or 1:100 (over 2.5 l/s, up to 3 dwellings)
   - 150 mm: 1:150 (3 to 8 dwellings)
   - The minimum foul drain is 100 mm, so there is no 75 mm foul row.
8. **GB branch pipes are given in "mm fall per metre".** ADH Table 2 prints the washbasin branch as **30 mm**, while Table 1 gives the trap as 32 mm. The single-appliance branch slopes for bath, shower, sink and basin appear only in **Diagram 3**, an image that could not be read in either ADH or TGD H, so those are unverified.
9. **AU PEX straights are 5 m at trade, not 6 m.** The 6 m PEX found was SmarteX at Bunnings. **AU Bunnings copper** comes in 1.5/3/6 m lengths and 18 m coils, with imperial labels and no Type A/B stated. **Solid-wall DN100 SN8 DWV is not stocked**: DN100 is SN6 (standard) or SN10.
10. **Ireland trade lengths differ from GB.** Pipelife IE sells waste pipe in **4 m** lengths (GB uses 3 m), 110 soil in 3/4/6 m, and EN 1401 sewer pipe in 6 m. GB uses 3 m waste, 3/4 m soil and 3 m underground.
11. **Canada big-box lengths are 12 ft** for copper (also 3 and 6 ft) and ABS, against 10 ft in the US. These come from search titles only and are unverified. No metric "(38 mm)" labels were found on any Canadian listing.
12. **Fitting take-offs.** No GB, IE, NZ or AU manufacturer was found publishing centre-to-pipe-stop dimensions. Wavin GB gives an "A" dimension and socket depth, but "A" is defined only in a drawing, so take-off is null and `verified: false`. Charlotte **ABS** DWV take-offs and hub depths are verified. **SharkBite** insertion depths are verified.

---

## NZ

```json
{"country":"NZ",
"codes":[
 {"name":"NZ Building Code clause G13 Foul water: Acceptable Solutions G13/AS1 Sanitary Plumbing, G13/AS2 Drainage, G13/AS3 (AS/NZS 3500.2 as modified by para 1.0.2)","publisher":"MBIE","url":"https://www.building.govt.nz/assets/Uploads/building-code-compliance/g-services-and-facilities/g13-foul-water/asvm/g13-foul-water-2nd-edition-amendment-10.pdf","edition":"2nd Ed Amdt 10, effective 2 Nov 2023; AS/NZS 3500.2:2021 cited (CodeHub https://codehub.building.govt.nz/resources/g13as2-amd-10)","verified":true},
 {"name":"NZ Building Code clause G12 Water supplies: G12/AS1; G12/AS3 accepts AS/NZS 3500.1 and 3500.4 (modified by paras 1.0.3/1.0.4)","publisher":"MBIE","url":"https://www.building.govt.nz/assets/Uploads/building-code-compliance/g-services-and-facilities/g12-water-supplies/asvm/g12-water-supplies-3rd-edition-amendment-14.pdf","edition":"3rd Ed Amdt 14, effective 2 Nov 2024; AS/NZS 3500.1:2021 cited. AS/NZS 3500.1 is not cited in G12/AS1 itself","verified":true}],
"minSlopes":[
 {"context":"drain","size_dn":80,"min_gradient":"1:100","pct":1.0,"clause":"G13/AS2 3.5.3 Table 2 (34 DU at 1:100); DN80 only for waste-water-only drains (3.6.2)","source":"G13 Amdt 10 PDF p.41","verified":true},
 {"context":"drain","size_dn":100,"min_gradient":"1:120","pct":0.83,"clause":"G13/AS2 3.5.3 Table 2 (104 DU at 1:120); min drain dia 100 (3.6.2)","source":"G13 Amdt 10 PDF p.41","verified":true},
 {"context":"drain","size_dn":150,"min_gradient":"1:200","pct":0.5,"clause":"G13/AS2 Table 2 (515 DU)","source":"G13 Amdt 10 PDF p.41","verified":true},
 {"context":"drain levelling","note":"verifiable levelling devices required at 1:80 or flatter (G13/AS2 5.2.2)","verified":true},
 {"context":"discharge pipe","size_dn":32,"min_gradient":"1:20","pct":5.0,"clause":"G13/AS1 4.4.1 Table 4 (column alignment inferred from text extract)","source":"G13 Amdt 10 PDF p.20","verified":false},
 {"context":"discharge pipe","size_dn":40,"min_gradient":"1:40","pct":2.5,"clause":"G13/AS1 Table 4 (inferred)","verified":false},
 {"context":"discharge pipe","size_dn":50,"min_gradient":"1:40","pct":2.5,"clause":"G13/AS1 Table 4 (inferred)","verified":false},
 {"context":"discharge pipe","size_dn":65,"min_gradient":"1:40","pct":2.5,"clause":"G13/AS1 Table 4 (inferred)","verified":false},
 {"context":"discharge pipe","size_dn":80,"min_gradient":"1:60","pct":1.67,"clause":"G13/AS1 4.4.1 Table 4","source":"G13 Amdt 10 PDF p.20","verified":true},
 {"context":"discharge pipe","size_dn":100,"min_gradient":"1:60","pct":1.67,"clause":"G13/AS1 4.4.1 Table 4","source":"G13 Amdt 10 PDF p.20","verified":true},
 {"context":"vent pipe","size_dn":null,"min_gradient":"1:80","pct":1.25,"clause":"G13/AS1 section 5","verified":true}],
"maxVelocity":[
 {"value_m_s":null,"service":"water supply","clause":"G12/AS1 Amdt 14 states no velocity limit","verified":true},
 {"value_m_s":3.0,"service":"cold water via AS/NZS 3500.1 (G12/AS3)","clause":"AS/NZS 3500.1 cl 3.4 heading seen only; value secondary","verified":false}],
"pipes":[
 {"material":"PVC-U DWV Marley OPTIM (AS/NZS 1260)","size":"DN40","od_mm":42.95,"id_mm":38.35,"stockLengths_m":[3,6],"stockists":["Bunnings NZ"],"source":"Marley NZ DWV Technical Design Manual Jun 2026 §2.3 p.8 (id = column labelled 'Socket OD', read as ID - unverified); https://www.bunnings.co.nz/marley-40mm-x-6m-optim-dwv-pipe_p0335045 ; https://www.bunnings.co.nz/marley-40mm-x-3m-optim-dwv-pipe_p0106031","verified":true},
 {"material":"PVC-U DWV Marley OPTIM","size":"DN50","od_mm":55.85,"id_mm":50.95,"stockLengths_m":[3],"stockists":["Bunnings NZ"],"source":"https://www.bunnings.co.nz/marley-50mm-x-3m-optim-dwv-pipe_p0106133 (6 m at Mitre 10 in snippet only)","verified":true},
 {"material":"PVC-U DWV Marley OPTIM","size":"DN65","od_mm":68.90,"id_mm":63.10,"stockLengths_m":[3],"stockists":["Bunnings NZ"],"source":"https://www.bunnings.co.nz/marley-65mm-x-3m-optim-dwv-pipe_p0106179","verified":true},
 {"material":"PVC-U DWV Marley OPTIM","size":"DN80","od_mm":82.50,"id_mm":76.00,"stockLengths_m":[3,6],"stockists":["Bunnings NZ (3 m)","Mitre 10 (6 m)"],"source":"search snippets only","verified":false},
 {"material":"PVC-U DWV Marley OPTIM SN6","size":"DN100","od_mm":110.20,"id_mm":107.00,"stockLengths_m":[3,6],"stockists":["Bunnings NZ","PlaceMakers (Iplex Novadrain RRJ 6 m, snippet)"],"source":"https://www.bunnings.co.nz/marley-100mm-x-6m-sn6-optim-dwv-pipe_p0185395 ; https://www.bunnings.co.nz/marley-optim-100mm-x-3m-waste-pipe_p0106350","verified":true},
 {"material":"PVC-U DWV Marley OPTIM SN4","size":"DN150","od_mm":160.25,"id_mm":152.25,"stockLengths_m":[6],"stockists":["Mitre 10"],"source":"snippet only","verified":false},
 {"material":"Copper (NZS 3501 or AS 1432 A/B/C)","size":"15/20/25 mm","od_mm":null,"wall_mm":null,"stockLengths_m":[5,1],"stockists":["Mitre 10 (Hurricane 5 m std/light gauge; SPK 1 m)"],"source":"standards: G12/AS1 Table 1 (verified); lengths: Mitre 10 snippets only","verified":false},
 {"material":"PE-Xb PN16 Buteline Pexline (AS/NZS 2492)","size":"16 mm","od_mm":16,"wall_mm":2.1,"id_mm":11.8,"stockLengths_m":[5],"coil_m":[50,100],"stockists":["PlaceMakers"],"source":"https://pimstorageaueprod.blob.core.windows.net/placemakers/media-assets/1139200_NZPPM1121PexlineNZPlumbersManualiLR.pdf (bore table p.23; wall derived)","verified":true},
 {"material":"PE-Xb PN16 Pexline","size":"20 mm","od_mm":20,"wall_mm":2.4,"id_mm":15.2,"stockLengths_m":[5],"coil_m":[50,100],"stockists":["PlaceMakers"],"source":"Pexline manual","verified":true},
 {"material":"PE-Xb PN16 Pexline","size":"25 mm","od_mm":25,"wall_mm":2.95,"id_mm":19.1,"stockLengths_m":[5],"coil_m":[50],"stockists":["PlaceMakers"],"source":"Pexline manual","verified":true},
 {"material":"PE-Xb PN16 Pexline","size":"32 mm","od_mm":32,"stockLengths_m":[5],"coil_m":[],"source":"Pexline manual","verified":true},
 {"material":"PE-X SharkBite","size":"16 mm","coil_m":[25],"stockists":["Bunnings NZ"],"source":"https://www.bunnings.co.nz/sharkbite-16mm-25m-length-pex-pipe_p0692332","verified":true},
 {"material":"PE-X SharkBite","size":"20 mm","stockLengths_m":[2.4],"stockists":["Bunnings NZ"],"source":"https://www.bunnings.co.nz/sharkbite-20mm-x-2-4m-pex-pipe_p0692347","verified":true},
 {"material":"PE-X REHAU RAUTITAN","size":"16/20/25 mm","id_mm":"11.5/14.4/18.0 (per Pexline p.23 comparison)","stockLengths_m":[5],"source":"16x2.2/20x2.8/25x3.5 from snippets only","verified":false}],
"fittings":[
 {"material":"PVC-U DWV Marley OPTIM RRJ","size":"DN100","name":"min effective sealing length","takeoff_mm":null,"engagement_mm":45,"source":"Marley manual Jun 2026 §2.3 p.8","verified":true},
 {"material":"PVC-U DWV Marley OPTIM RRJ","size":"DN150","name":"min effective sealing length","takeoff_mm":null,"engagement_mm":47,"source":"Marley manual §2.3 p.8","verified":true},
 {"material":"PVC-U DWV Marley","size":"DN40-150","name":"bends/junctions take-off","takeoff_mm":null,"engagement_mm":null,"source":"not in Jun 2026 manual (BRANZ Appraisal 1236 points to Jan 2020 manual §7-8, not found)","verified":false},
 {"material":"PVC-U DWV Iplex","size":"DN40-150","name":"see spigot-plumbing-data.md §3a (Iplex NZ take-offs)","verified":true}],
"terms":{"gradient":"G13 defined term, ratio or % (write 1:60)","graded":"G13 verb form","fall":"trade usage, not a G13 term","diameter":"nominal internal diameter in mm; G13 does not say 'DN' (Marley does)","drain":"below-ground pipe","discharge pipe":"above-ground sanitary pipe","waste pipe":"waste-water fixtures to a gully trap","gully trap":"NZ term","discharge stack":"stack","soil fixture":"WC/urinal","DU":"discharge unit","spouting":"gutter","downpipe":"downpipe","access point / inspection point / cleaning eye":"G13 terms"},
"supportSpacing_bonus":{"copper_10_15mm":"1.5 m vertical / 1.2 m horizontal","copper_20_25mm":"2.0 / 1.5","source":"G12/AS1 Amdt 14 Table 9 p.38A","verified":true}}
```

---

## GB (England; Wales follows similar ADs. Scotland and NI below)

Scotland: Building standards technical handbook 2022 (Domestic), Section 3.7. It has no gradient tables of its own and defers to BS EN 12056-2, BS EN 752 and BS EN 1610: https://www.gov.scot/publications/building-standards-technical-handbook-2022-domestic/3-environment/3-7-wastewater-drainage/

Northern Ireland: Technical Booklet N, Drainage, October 2012 (PDF not opened): https://www.finance-ni.gov.uk/sites/default/files/publications/dfp/Technical-booklet-N-Drainage-October-2012.pdf

The app should use generic guidance for Scotland and NI unless they are added later.

```json
{"country":"GB",
"codes":[
 {"name":"The Building Regulations 2010, Approved Document H: Drainage and waste disposal","publisher":"DLUHC / gov.uk","url":"https://assets.publishing.service.gov.uk/media/5a80cf9ded915d74e33fc8ae/BR_PDF_AD_H_2015.pdf","edition":"2015 edition (England)","verified":true},
 {"name":"Approved Document G: Sanitation, hot water safety and water efficiency","publisher":"gov.uk","url":"https://assets.publishing.service.gov.uk/media/66f6c6ce3b919067bb4828cc/ADG_with_2024_amendments.pdf","edition":"2015 incorporating 2016 and 2024 amendments","verified":true},
 {"name":"The Water Supply (Water Fittings) Regulations 1999 (SI 1999/1148)","publisher":"legislation.gov.uk","url":"https://www.legislation.gov.uk/uksi/1999/1148/contents/made","edition":"1999","verified":true},
 {"name":"BS EN 12056-2:2000 Gravity drainage systems inside buildings - Sanitary pipework, layout and calculation","publisher":"BSI","url":"https://knowledge.bsigroup.com/products/gravity-drainage-systems-inside-buildings-sanitary-pipework-layout-and-calculation","edition":"2000 (cited ADH para 1.39)","verified":false},
 {"name":"BS EN 752 Drain and sewer systems outside buildings","publisher":"BSI","url":"","edition":"current edition not checked","verified":false},
 {"name":"BS EN 806-1 to -5 (Part 3:2006 pipe sizing, simplified method)","publisher":"BSI","url":"https://knowledge.bsigroup.com/products/specifications-for-installations-inside-buildings-conveying-water-for-human-consumption-pipe-sizing-simplified-method","edition":"806-3:2006","verified":false},
 {"name":"BS 8558:2015 (complementary guidance to BS EN 806)","publisher":"BSI","url":"","edition":"2015","verified":false}],
"minSlopes":[
 {"context":"foul drain, peak flow <1 l/s","size_mm":75,"min_gradient":"1:40","mm_per_m":25,"clause":"ADH H1 Table 6 p.16, para 2.34","source":"ADH 2015 PDF","verified":true},
 {"context":"foul drain, peak flow <1 l/s","size_mm":100,"min_gradient":"1:40","mm_per_m":25,"clause":"ADH Table 6","verified":true},
 {"context":"foul drain, peak flow >1 l/s, no WC","size_mm":75,"min_gradient":"1:80","mm_per_m":12.5,"condition":"WC drains need >=100 mm (para 2.33)","clause":"ADH Table 6","verified":true},
 {"context":"foul drain, peak flow >1 l/s","size_mm":100,"min_gradient":"1:80","mm_per_m":12.5,"condition":"minimum 1 WC","clause":"ADH Table 6","verified":true},
 {"context":"foul drain, peak flow >1 l/s","size_mm":150,"min_gradient":"1:150","mm_per_m":6.67,"condition":"minimum 5 WCs","clause":"ADH Table 6","verified":true},
 {"context":"rainwater drain","size_mm":100,"min_gradient":"1:100","condition":"75 and 100 mm; 150 at 1:150; 225 at 1:225","clause":"ADH H3 para 3.15","verified":true},
 {"context":"branch, WC outlet >80 mm, max 8 WCs, max 15 m","size_mm":100,"mm_per_m":"18-90","condition":"may reduce to 9 mm/m on long runs if >1 WC (note 2)","clause":"ADH H1 Table 2 p.9, para 1.19","verified":true},
 {"context":"branch, WC outlet <80 mm, 1 WC, max 15 m","size_mm":75,"mm_per_m":"18-90","clause":"ADH Table 2","verified":true},
 {"context":"branch, urinal trough","size_mm":65,"mm_per_m":"18-90","clause":"ADH Table 2","verified":true},
 {"context":"branch, washbasin/bidet, max 1.7 m","size_mm":30,"mm_per_m":"18-22","condition":"printed 30 mm; trap 32 mm (Table 1)","clause":"ADH Table 2","verified":true},
 {"context":"branch, washbasin/bidet, max 1.1 m","size_mm":30,"mm_per_m":"18-44","clause":"ADH Table 2","verified":true},
 {"context":"branch, washbasin/bidet, max 0.7 m","size_mm":30,"mm_per_m":"18-87","clause":"ADH Table 2","verified":true},
 {"context":"branch, washbasins/bidets, max 3.0 m","size_mm":40,"mm_per_m":"18-44","clause":"ADH Table 2","verified":true},
 {"context":"branch, washbasins/bidets, max 4, max 4.0 m","size_mm":50,"mm_per_m":"18-44","clause":"ADH Table 2","verified":true},
 {"context":"single-appliance branch bath/shower/sink/washing machine","size_mm":40,"mm_per_m":null,"clause":"ADH Diagram 3 (image, unreadable)","verified":false}],
"maxVelocity":[
 {"value_m_s":2.0,"service":"service duct/riser/plant room (NR50), metal; plastic 2.5","clause":"CIPHE Plumbing Engineering Services Design Guide, Hot and cold water supplies, Table 17 p.16","source":"https://ciphe.org.uk/contentassets/4b4bacf3f042403aa1bf869185de15be/p1-p39-rfc_hot__cold_water_supplies-v.pdf","verified":true},
 {"value_m_s":1.5,"service":"ceiling void (NR40) / circulation areas (NR35)","clause":"CIPHE Table 17","verified":true},
 {"value_m_s":1.25,"service":"seating/meeting areas (NR30)","clause":"CIPHE Table 17","verified":true},
 {"value_m_s":1.0,"service":"bedrooms (NR25)","clause":"CIPHE Table 17 (text: avoid >1.5 m/s through occupied areas)","verified":true},
 {"value_m_s":0.75,"service":"theatre/cinema (NR20); recording studio 0.5","clause":"CIPHE Table 17","verified":true},
 {"note":"CIPHE: erosion/corrosion may begin above 2.5 m/s","verified":true},
 {"value_m_s":null,"service":"BS EN 806-3 / BS 8558 / CIBSE Guide G","clause":"paywalled","verified":false}],
"pipes":[
 {"material":"copper EN 1057 R250 half-hard (Wednesbury Black Label)","size":"15 mm","od_mm":15,"wall_mm":0.7,"id_mm":13.6,"stockLengths_m":[2,3,6],"stockists":["Toolstation (2, 3 m)","MKM (6 m)"],"source":"https://www.wednesburytube.com/downloads/UK/BlackLabel-v3.pdf ; https://www.toolstation.com/plumbing/copper-pipe/c211 ; https://mkm.com/product/copper-tube-eec-tx-kitemarked-15mm-6m-length-l001730","verified":true,"note":"Wednesbury bundle data says 5.8 m for merchant 'long' lengths"},
 {"material":"copper EN 1057 R250","size":"22 mm","od_mm":22,"wall_mm":0.9,"id_mm":20.2,"stockLengths_m":[2,3],"stockists":["Toolstation"],"source":"https://www.toolstation.com/wednesbury-copper-pipe/p39919","verified":true},
 {"material":"copper EN 1057 R250","size":"28 mm","od_mm":28,"wall_mm":0.9,"id_mm":26.2,"stockLengths_m":[3],"stockists":["Toolstation"],"source":"Wednesbury sheet + Toolstation c211","verified":true},
 {"material":"copper microbore coil","size":"10 mm","od_mm":10,"wall_mm":null,"coil_m":[10,25],"stockists":["Toolstation"],"source":"Toolstation c211","verified":true},
 {"material":"copper EN 1057","size":"15/22 mm","stockLengths_m":[1],"stockists":["B&Q marketplace"],"source":"search snippet","verified":false},
 {"material":"PVC-C solvent waste (Wavin, BS EN 1566-1)","size":"32 mm","od_mm":36.3,"wall_mm":2.0,"stockLengths_m":[3],"source":"https://mediahub.wavin.com/m/285c278dc941a9bd/original/Wavin-Solvent-Soil-Product-and-Installation-Manual.pdf Table 3 (OD 36.1-36.5, wall 1.8-2.2)","verified":true},
 {"material":"PVC-C solvent waste (Wavin)","size":"40 mm","od_mm":42.9,"wall_mm":2.1,"stockLengths_m":[3],"source":"Wavin manual Table 3 (OD 42.7-43.1)","verified":true},
 {"material":"PVC-C solvent waste (Wavin)","size":"50 mm","od_mm":55.9,"wall_mm":2.2,"stockLengths_m":[3],"source":"Wavin manual Table 3 (OD 55.7-56.1)","verified":true},
 {"material":"ABS solvent waste (BS EN 1455-1 / BS 5255)","size":"32/40/50 mm","od_mm":null,"stockLengths_m":[3],"stockists":["FloPlast (via Screwfix/Wickes)","Toolstation Aquaflow"],"source":"https://cdn.shopify.com/s/files/1/0222/7290/1216/files/FloPlast-Soil-Waste-Brochure-2020.pdf ; https://www.toolstation.com/plumbing/solvent-weld-waste/c297","verified":true,"note":"ABS/MUPVC ODs not found; use Wavin ODs only for Wavin"},
 {"material":"PP push-fit waste (BS EN 1451-1 / BS 5254)","size":"32/40/50 mm","od_mm":null,"stockLengths_m":[3],"stockists":["FloPlast"],"source":"FloPlast brochure 2020","verified":true},
 {"material":"PVC-U soil (BS EN 1329-1 / BS 4514)","size":"110 mm","od_mm":110.15,"wall_mm":3.35,"stockLengths_m":[1,3,4],"stockists":["FloPlast (plain 3/4 m; single socket 1/3/4 m)","Wavin (3/4 m)"],"source":"FloPlast brochure 2020; Wavin manual Table 1 (OD 110.0-110.3, wall 3.2-3.5)","verified":true,"note":"2.5 m length not found"},
 {"material":"PVC-U soil","size":"160 mm","od_mm":160.2,"stockLengths_m":[3,4],"stockists":["Wavin"],"source":"Wavin manual Table 1","verified":true},
 {"material":"PVC-U soil","size":"82 mm","stockLengths_m":[],"source":"only a 110x82 reducer found","verified":false},
 {"material":"PVC-U underground (BS EN 1401-1)","size":"110 mm","od_mm":110,"wall_mm":3.2,"stockLengths_m":[3],"stockists":["Toolstation Aquaflow (75373)"],"source":"https://www.toolstation.com/shop/p75373","verified":true},
 {"material":"PB push-fit Hep2O","size":"15 mm","stockLengths_m":[3,6],"coil_m":[25,50,100,200],"source":"https://mediahub.wavin.com/m/18f52563019aac42/original/WAVIN-HEP2O-Product-List.pdf","verified":true},
 {"material":"PB push-fit Hep2O","size":"22 mm","stockLengths_m":[3,6],"coil_m":[25,50],"source":"Hep2O product list","verified":true},
 {"material":"PB push-fit Hep2O","size":"28 mm","stockLengths_m":[6],"coil_m":[25,50],"source":"Hep2O product list (no 10 mm)","verified":true},
 {"material":"PEX barrier JG Speedfit","size":"15 mm","od_mm":15,"stockLengths_m":[3],"stockists":["Toolstation 10x3 m pack (53686)"],"source":"https://www.toolstation.com/jg-speedfit-b-pex-barrier-pipe/p53686","verified":true},
 {"material":"PEX barrier JG Speedfit","size":"10/15/22 mm","coil_m":[25,50],"source":"snippets","verified":false}],
"fittings":[
 {"material":"copper EN 1254-1 end-feed/solder-ring","size":"15/22 mm","name":"90 elbow, equal tee (Yorkshire, Endex, Conex)","takeoff_mm":null,"engagement_mm":null,"source":"manufacturer pages blocked; Pegler/Mercia W Range sheet TS60249 has no dims","verified":false},
 {"material":"PVC-C solvent waste (Wavin)","size":"40 mm","name":"87.5 bend 5M161, A=58 (32 mm: 47, 50 mm: 72)","takeoff_mm":null,"engagement_mm":23,"source":"Wavin manual p.23; socket depth Table 4 (32: 21, 40: 23, 50: 28)","verified":false,"note":"engagement verified; A not defined in readable text"},
 {"material":"PVC-C solvent waste (Wavin)","size":"40 mm","name":"knuckle bend 90 5M160 A=52; 45 bend 5M163 A=43","takeoff_mm":null,"engagement_mm":23,"source":"Wavin manual p.23","verified":false},
 {"material":"PVC-U solvent soil (Wavin)","size":"110 mm","name":"87.5 bend 4S461E A=152 B=166; 45 bend A=87 B=87 C=148; 87.5 branch 4S490E A=159 B=112 C=152; 45 branch 4S410E A=136 B=192 C=85","takeoff_mm":null,"engagement_mm":54,"source":"Wavin manual pp.9-13 (solvent socket 54, 65 with expansion cap; ring-seal 65)","verified":false},
 {"material":"push-fit (Speedfit / Hep2O)","size":"15/22 mm","name":"elbow/tee","takeoff_mm":null,"engagement_mm":null,"source":"not published in opened sources","verified":false}],
"terms":{"fall":"'mm fall per metre' (ADH Table 2)","gradient":"'1:40', header '1 in ...'","stack":"discharge stack, stub stack, ventilating stack, stack vent (ADH); 'soil and vent pipe'/'soil stack' (trade)","branch":"branch discharge pipe","trap":"trap, water seal, depth of seal","access":"rodding point, access point, cleaning eye, gully, invert","tap":"tap (not faucet)","centre":"centre line / centreline","sizes":"nominal mm (ADH 0.3); copper/plastic pressure pipe is OD in mm; DN rare","copper_temper":"half hard = R250 ('Table X' old BS 2871)","bend":"bend (not elbow) for soil/waste; elbow for copper"}}
```

---

## IE

```json
{"country":"IE",
"codes":[
 {"name":"Building Regulations Part H, Technical Guidance Document H: Drainage and Waste Water Disposal","publisher":"Department of Housing, Local Government and Heritage","url":"https://www.gov.ie/en/department-of-housing-local-government-and-heritage/publications/technical-guidance-document-h-drainage-and-waste-water-disposal","edition":"2010 with amendments, applying from 1 Jan 2017 (gov.ie lists '2016'). Read from mirror because gov.ie returned 403: https://ampeid.org/static/543ef73ebc492fbd2d6c0af496c44337/100231_301f205c-c8dd-40d6-8baf-8d5826a51b8a%20(1)..pdf","verified":true},
 {"name":"Technical Guidance Document G: Hygiene","publisher":"gov.ie","url":"https://www.gov.ie/en/publication/d1ec3-technical-guidance-document-g-hygiene","edition":"2008 (reprint 2011) - current status not confirmed","verified":false},
 {"name":"I.S. EN 12056-1/-2/-3:2000; I.S. EN 752:2008; I.S. EN 1610:2015","publisher":"NSAI","edition":"as cited in TGD H 1.1.1.1","verified":true},
 {"name":"S.R. 50-3:2021 Water supply for domestic use within dwellings and their curtilages (complements I.S. EN 806)","publisher":"NSAI","url":"https://www.nsai.ie/about/news/s.r-50-series-standards-plumbing-and-heating/","edition":"2021","verified":true},
 {"name":"I.S. EN 806-3:2006","publisher":"NSAI","url":"https://shop.standards.ie/en-ie/standards/i-s-en-806-3-2006-856445_saig_nsai_nsai_2037400","verified":false},
 {"name":"Uisce Éireann Codes of Practice for Water (CDS-5020-03) and Wastewater (CDS-5030-03) Infrastructure, Rev 03 - for developer mains/sewers, not in-building plumbing","publisher":"Uisce Éireann","url":"https://www.water.ie/connections/developer-services/","edition":"Rev 03, applications from 16 Feb 2026","verified":true}],
"minSlopes":[
 {"context":"foul drain, peak <2.5 l/s, 1 dwelling","size_mm":100,"min_gradient":"1:60","mm_per_m":16.7,"condition":"min 1 wc; min foul drain 100 mm (1.3.4.2)","clause":"TGD H Table 6 p.14, para 1.3.4.3","verified":true},
 {"context":"foul drain, peak >2.5 l/s, up to 3 dwellings","size_mm":100,"min_gradient":"1:100","mm_per_m":10,"condition":"min 1 wc","clause":"TGD H Table 6","verified":true},
 {"context":"foul drain, 3 to 8 dwellings","size_mm":150,"min_gradient":"1:150","mm_per_m":6.67,"condition":"min 5 wcs; max 8 dwellings per drain","clause":"TGD H Table 6","verified":true},
 {"context":"surface water drain","size_mm":100,"min_gradient":"1:100","condition":"75 and 100 mm","clause":"TGD H 1.5.7.2(d)","verified":true},
 {"context":"branch, WCs, max 8, max 15 m","size_mm":100,"mm_per_m":"9-90","clause":"TGD H Table 3 p.9, para 1.2.2.8","verified":true},
 {"context":"branch, urinal stalls, max 6","size_mm":65,"mm_per_m":"18-90","clause":"TGD H Table 3","verified":true},
 {"context":"branch, washbasins, max 4, max 4 m, no bends","size_mm":50,"mm_per_m":"18-45","clause":"TGD H Table 3","verified":true},
 {"context":"branch, urinal bowls, max 5","size_mm":50,"mm_per_m":"?-90","clause":"TGD H Table 3 (row garbled)","verified":false},
 {"context":"single-appliance branches (basin 32, bath/shower/sink 40)","size_mm":32,"mm_per_m":null,"clause":"TGD H 1.2.2.11 Diagram 3 (image)","verified":false}],
"maxVelocity":[{"value_m_s":null,"service":"I.S. EN 806-3 / S.R. 50-3","clause":"paywalled","verified":false}],
"pipes":[
 {"material":"PVC-U solvent waste (Pipelife IE)","size":"32/40/50 mm","stockLengths_m":[4],"stockists":["Pipelife Ireland (40 mm black also 5 m)"],"source":"https://www.pipelife.ie/content/dam/pipelife/ireland/marketing/downloads/brochures/Pipelife%20Ireland%20Solutions%20Ltd%20Trade%20Brochure.pdf pp.63-64","verified":true},
 {"material":"PVC-U ring-seal soil (BS EN 1329-1/BS 4514)","size":"110 mm","stockLengths_m":[3,4,6],"stockists":["Pipelife IE","Screwfix IE FloPlast 3 m (snippet)"],"source":"Pipelife brochure p.57","verified":true},
 {"material":"PVC-U soil","size":"160 mm","stockLengths_m":[6],"stockists":["Pipelife IE"],"source":"Pipelife brochure p.57","verified":true},
 {"material":"PVC-U sewer EN 1401 SN4/SN8","size":"110 mm (also 160/244/315)","stockLengths_m":[6],"stockists":["Pipelife IE"],"source":"Pipelife brochure","verified":true,"note":"225 drain sold as 244 mm OD in IE"},
 {"material":"copper EN 1057 (Wednesbury)","size":"15/22/28 mm","od_mm":"15/22/28","wall_mm":"0.7/0.9/0.9","stockLengths_m":[2,3],"stockists":["Screwfix IE (snippet)"],"source":"dims from Wednesbury sheet (GB, verified); IE stock snippet only","verified":false},
 {"material":"PEX / multilayer (Pipelife Qual-PEX)","size":"16/20/26/32 mm multilayer; 1/2, 3/4, 1 in PEX","coil_m":[25,50,100],"stockLengths_m":[6],"stockists":["Pipelife IE"],"source":"Pipelife brochure","verified":true}],
"fittings":[{"material":"all","name":"No IE-specific take-offs; same GB brands (FloPlast, Wavin, Yorkshire, Speedfit) sold. Use GB rows (all unverified for take-off)","takeoff_mm":null,"engagement_mm":null,"verified":false}],
"terms":{"wastewater":"foul wastewater / wastewater pipework","wc":"lowercase 'wc' in TGD H","gradient":"'1 in ...' header, values '1:60'","fall":"'fall per metre'","branch":"branch pipe","tap":"tap","centre":"centre","sizes":"nominal (TGD H 1.1.1.4)",
 "rule_diffs_vs_GB":"WC branch direct to drain drop 1.5 m (GB 1.3 m); stub stack 2.5 m (GB 2 m); branch vent within 300 mm of trap (GB 750 mm); gully seal 40 mm (GB 38 mm); no copper/mild steel for condensate"}}
```

---

## US

```json
{"country":"US",
"codes":[
 {"name":"International Plumbing Code (IPC) 2021 / 2024","publisher":"International Code Council (ICC)","url":"https://codes.iccsafe.org/content/IPC2024V1.0","edition":"2021, 2024 (ICC site 403; text not opened)","verified":false},
 {"name":"Uniform Plumbing Code (UPC) 2024","publisher":"IAPMO","url":"https://epubs.iapmo.org/2024/UPC/","edition":"2024 (title page confirmed; chapters not opened)","verified":true},
 {"name":"California Plumbing Code 2025 (CCR Title 24 Part 5, UPC-based) - used as UPC proxy","publisher":"CA Building Standards Commission","url":"https://gocodebook.com/library/us/ca/ca-plumbing-code/chapter-7-sanitary-drainage/708.1-general.-building-drain-and-other-horizontal-drainage","edition":"2025, eff. 1 Jan 2026","verified":true},
 {"name":"NYC Plumbing Code 2022 Ch.7 (IPC-based) - used as IPC proxy","publisher":"NYC DOB","url":"https://www.nyc.gov/assets/buildings/codes-pdf/cons_codes_2022/2022PC_Chapter7_SanitaryDrainageWBwm.pdf","edition":"2022","verified":true},
 {"name":"NSF/ANSI/CAN 61 Drinking Water System Components","publisher":"NSF","edition":"cited in manufacturer submittals","verified":true},
 {"note":"State adoption (IPC vs UPC) not sourced - let user choose code","verified":false}],
"minSlopes":[
 {"context":"IPC horizontal drainage","size_in":"<=2-1/2","min_slope_in_per_ft":"1/4","pct":2.08,"ratio":"1:48","clause":"IPC 704.1 Table 704.1","source":"NYC 2022 PC Ch.7; https://www.iccsafe.org/wp-content/uploads/2018_ipc_ess_p61.pdf","verified":true},
 {"context":"IPC horizontal drainage","size_in":"3-6","min_slope_in_per_ft":"1/8","pct":1.04,"ratio":"1:96","clause":"IPC Table 704.1","verified":true},
 {"context":"IPC horizontal drainage","size_in":">=8","min_slope_in_per_ft":"1/16","pct":0.52,"ratio":"1:192","clause":"IPC Table 704.1","verified":true},
 {"context":"IPC upstream of grease interceptor","size_in":"all","min_slope_in_per_ft":"1/4","clause":"IPC 704.1 (ICC 2018 Essentials p.61)","verified":true},
 {"context":"UPC horizontal drainage","size_in":"all","min_slope_in_per_ft":"1/4","pct":2.0,"clause":"UPC 708.1 (read as CPC 2025 708.1)","verified":false,"note":"verified in CPC; UPC itself not opened"},
 {"context":"UPC building drain where 1/4 impractical, prior AHJ approval","size_in":">=4","min_slope_in_per_ft":"1/8","pct":1.0,"clause":"UPC 708.1 exception (CPC 2025)","verified":false}],
"maxVelocity":[
 {"value":"8 ft/s (2.4 m/s)","service":"cold, copper","clause":"UPC 610.12.1 (read as CPC 2025)","source":"https://gocodebook.com/library/us/ca/ca-plumbing-code/chapter-6-water-supply-and-distribution/610.12-sizing-for-velocity.-water-piping-systems-shall-not","verified":false},
 {"value":"5 ft/s (1.5 m/s)","service":"hot, copper","clause":"UPC 610.12.1 (CPC 2025)","verified":false},
 {"value":"8 ft/s cold; 5 ft/s hot to ~140 F; 2-3 ft/s hot routinely >140 F","service":"copper","clause":"CDA Copper Tube Handbook A4015-14/17 p.14 'Water Velocity Limitations'","source":"https://www.buildsite.com/pdf/cerro_flow_products/Cerro-Flow-Products-Handbook-Installation-Instructions-1595822.pdf","verified":true},
 {"value":"none found","service":"IPC","verified":false}],
"pipes":[
 {"material":"Copper Type K (ASTM B88)","size":"1/2","od_mm":15.88,"wall_mm":1.245,"id_mm":13.39,"source":"CDA handbook Table 14.2a p.64","verified":true},
 {"material":"Copper Type K","size":"3/4","od_mm":22.23,"wall_mm":1.651,"id_mm":18.92,"source":"CDA 14.2a","verified":true},
 {"material":"Copper Type K","size":"1","od_mm":28.58,"wall_mm":1.651,"id_mm":25.27,"source":"CDA 14.2a","verified":true},
 {"material":"Copper Type K","size":"1-1/4","od_mm":34.93,"wall_mm":1.651,"id_mm":31.62,"source":"CDA 14.2a","verified":true},
 {"material":"Copper Type K","size":"1-1/2","od_mm":41.28,"wall_mm":1.829,"id_mm":37.62,"source":"CDA 14.2a","verified":true},
 {"material":"Copper Type K","size":"2","od_mm":53.98,"wall_mm":2.108,"id_mm":49.76,"source":"CDA 14.2a","verified":true},
 {"material":"Copper Type L","size":"1/2","od_mm":15.88,"wall_mm":1.016,"id_mm":13.84,"stockLengths_ft":[10],"stockLengths_m":[3.05],"stockists":["Home Depot (Mueller Streamline LH04010; Everbilt 10 ft soft coil)"],"source":"CDA Table 14.2b p.65 (dims verified); stock from search titles","verified":true,"stock_verified":false},
 {"material":"Copper Type L","size":"3/4","od_mm":22.23,"wall_mm":1.143,"id_mm":19.94,"stockLengths_ft":[10],"source":"CDA 14.2b; stock not checked","verified":true,"stock_verified":false},
 {"material":"Copper Type L","size":"1","od_mm":28.58,"wall_mm":1.27,"id_mm":26.04,"stockLengths_ft":[10],"source":"CDA 14.2b","verified":true,"stock_verified":false},
 {"material":"Copper Type L","size":"1-1/4","od_mm":34.93,"wall_mm":1.397,"id_mm":32.13,"source":"CDA 14.2b","verified":true},
 {"material":"Copper Type L","size":"1-1/2","od_mm":41.28,"wall_mm":1.524,"id_mm":38.23,"source":"CDA 14.2b","verified":true},
 {"material":"Copper Type L","size":"2","od_mm":53.98,"wall_mm":1.778,"id_mm":50.42,"source":"CDA 14.2b","verified":true},
 {"material":"Copper Type M","size":"1/2","od_mm":15.88,"wall_mm":0.711,"id_mm":14.45,"stockLengths_ft":[2,5,10],"stockLengths_m":[0.61,1.52,3.05],"stockists":["Home Depot (Cerro, Mueller MH04002/MH04005)","Lowe's (Streamline MH04002RT)"],"source":"CDA Table 14.2c p.66; stock search titles","verified":true,"stock_verified":false},
 {"material":"Copper Type M","size":"3/4","od_mm":22.23,"wall_mm":0.813,"id_mm":20.60,"stockLengths_ft":[10],"source":"CDA 14.2c","verified":true,"stock_verified":false},
 {"material":"Copper Type M","size":"1","od_mm":28.58,"wall_mm":0.889,"id_mm":26.80,"source":"CDA 14.2c","verified":true},
 {"material":"Copper Type M","size":"1-1/4","od_mm":34.93,"wall_mm":1.067,"id_mm":32.79,"source":"CDA 14.2c","verified":true},
 {"material":"Copper Type M","size":"1-1/2","od_mm":41.28,"wall_mm":1.245,"id_mm":38.79,"source":"CDA 14.2c","verified":true},
 {"material":"Copper Type M","size":"2","od_mm":53.98,"wall_mm":1.473,"id_mm":51.03,"source":"CDA 14.2c","verified":true},
 {"material":"PVC Sch40 DWV (ASTM D2665) / foam core (F891)","size":"1-1/2, 2, 3, 4","od_mm":"48.3/60.3/88.9/114.3","wall_mm":"3.7/3.9/5.5/6.0","stockLengths_ft":[10,2],"stockists":["Home Depot (Charlotte PVC 04300 0600 3 in x 10 ft; PVC071120200HA 1-1/2 in x 2 ft)","Lowe's (Charlotte)"],"source":"dims: Charlotte DC-DWV p.7 (see spigot-plumbing-data.md 3b, verified); stock: search titles (e.g. https://www.homedepot.com/p/Charlotte-Pipe-3-in-x-10-ft-PVC-Schedule-40-Foam-Core-DWV-Pipe-PVC-04300-0600/100348479)","verified":true,"stock_verified":false,"note":"no 5 ft/8 ft DWV found"},
 {"material":"ABS Sch40 DWV foam core (ASTM F628)","size":"1-1/2","od_mm":48.26,"wall_mm":3.68,"stockLengths_ft":[10,20],"stockLengths_m":[3.05,6.10],"stockists":["Charlotte (mfr)"],"source":"https://www.charlottepipe.com/uploads/documents/technical/Plastic_Pipe_Fittings_DC-DWV609.pdf p.3","verified":true},
 {"material":"ABS Sch40 DWV foam core","size":"2","od_mm":60.33,"wall_mm":3.91,"stockLengths_ft":[10,20],"source":"DC-DWV609 p.3","verified":true},
 {"material":"ABS Sch40 DWV foam core","size":"3","od_mm":88.9,"wall_mm":5.49,"stockLengths_ft":[10,20],"stockists":["Charlotte","Lowe's (snippet)"],"source":"DC-DWV609 p.3","verified":true},
 {"material":"ABS Sch40 DWV foam core","size":"4","od_mm":114.3,"wall_mm":6.02,"stockLengths_ft":[10,20],"source":"DC-DWV609 p.3","verified":true},
 {"material":"PEX-a Uponor AquaPEX (ASTM F876/F877, CTS SDR9)","size":"1/2","od_mm":15.88,"id_mm":12.07,"wall_mm":1.91,"stockLengths_ft":[20],"coil_ft":[100],"stockists":["Uponor sticks F1930500","Home Depot 100 ft coil (snippet)"],"source":"https://www.uponor.com/en-us/getsubmittalpdf/22431/standard/ (OD/ID; wall derived nominal, not F876 min)","verified":true},
 {"material":"PEX-a Uponor AquaPEX","size":"3/4","od_mm":22.23,"id_mm":17.04,"wall_mm":2.59,"stockLengths_ft":[20],"source":"Uponor submittal","verified":true},
 {"material":"PEX-a Uponor AquaPEX","size":"1","od_mm":28.58,"id_mm":21.90,"wall_mm":3.34,"stockLengths_ft":[20],"source":"Uponor submittal","verified":true},
 {"material":"PEX-B SharkBite","size":"1/2, 3/4, 1","od_mm":"15.88/22.23/28.58","stockLengths_ft":[10,20],"coil_ft":[100,300,500],"stockists":["Lowe's (U870W10, U870B20)","Home Depot (U870W20)"],"source":"coils: SharkBite Technical Manual https://pdf.lowes.com/howtoguides/697285503595_how.pdf p.27; sticks: search titles","verified":false},
 {"material":"CPVC CTS SDR11 (ASTM D2846) - Spears","size":"1/2","od_mm":15.88,"wall_mm":1.45,"id_mm":11.91,"stockLengths_ft":[10],"stockists":["Home Depot (Charlotte FlowGuard Gold, snippet)"],"source":"https://www.spearsmfg.com/IP-4/04%20Dimensions%20&%20Pressure%20Ratings.pdf","verified":false,"note":"min wall 0.057 in here conflicts with 0.068 in elsewhere"},
 {"material":"CPVC CTS SDR11 - Spears","size":"3/4","od_mm":22.23,"wall_mm":2.03,"id_mm":17.65,"source":"Spears","verified":true},
 {"material":"CPVC CTS SDR11 - Spears","size":"1","od_mm":28.58,"wall_mm":2.59,"id_mm":22.89,"source":"Spears","verified":true}],
"fittings":[
 {"note":"PVC Sch40 DWV (Charlotte) and wrot copper (BMI) take-offs: see spigot-plumbing-data.md 2b and 3b"},
 {"material":"PVC/ABS DWV hub depth (Charlotte)","size":"1-1/2 / 2 / 3 / 4","engagement_mm":"17.45 / 19.05 / 38.1 / 44.45","source":"DC-DWV609 hub dimension table p.10 - fills the 'socket_depth unverified' gap in 3b","verified":true},
 {"material":"ABS DWV (Charlotte)","size":"1-1/2","name":"1/4 bend (300)","takeoff_mm":44.45,"engagement_mm":17.45,"source":"DC-DWV609 (ABS = PVC dims unless listed)","verified":true},
 {"material":"ABS DWV","size":"2","name":"1/4 bend (ABS-specific row)","takeoff_mm":57.15,"engagement_mm":19.05,"verified":true},
 {"material":"ABS DWV","size":"3","name":"1/4 bend","takeoff_mm":77.79,"engagement_mm":38.1,"verified":true},
 {"material":"ABS DWV","size":"4","name":"1/4 bend","takeoff_mm":98.43,"engagement_mm":44.45,"verified":true},
 {"material":"ABS DWV","size":"1-1/2","name":"1/8 bend (321)","takeoff_mm":28.58,"engagement_mm":17.45,"verified":true},
 {"material":"ABS DWV","size":"2","name":"1/8 bend","takeoff_mm":38.1,"engagement_mm":19.05,"verified":true},
 {"material":"ABS DWV","size":"3","name":"1/8 bend","takeoff_mm":44.45,"engagement_mm":38.1,"verified":true},
 {"material":"ABS DWV","size":"4","name":"1/8 bend","takeoff_mm":55.56,"engagement_mm":44.45,"verified":true},
 {"material":"ABS DWV","size":"1-1/2","name":"sanitary tee (400) A=43.66 B=67.47","takeoff_mm":43.66,"engagement_mm":17.45,"verified":true},
 {"material":"ABS DWV","size":"2","name":"sanitary tee A=58.74 B=91.28","takeoff_mm":58.74,"engagement_mm":19.05,"verified":true},
 {"material":"ABS DWV","size":"3","name":"sanitary tee A=76.99 B=122.24","takeoff_mm":76.99,"engagement_mm":38.1,"verified":true},
 {"material":"ABS DWV","size":"4","name":"sanitary tee A=98.43 B=155.58","takeoff_mm":98.43,"engagement_mm":44.45,"verified":true},
 {"material":"SharkBite brass push-fit","size":"1/2 / 3/4 / 1","name":"insertion depth","takeoff_mm":null,"engagement_mm":"23.83 / 28.58 / 33.35","source":"SharkBite Technical Manual 2014 https://pdf.lowes.com/howtoguides/697285503595_how.pdf","verified":true},
 {"material":"SharkBite Max","size":"1/2 / 3/4","name":"insertion depth","takeoff_mm":null,"engagement_mm":"25.4 / 31.75","source":"https://pdf.lowes.com/productdocuments/c7035dc5-42e2-4681-b8af-2d6f69174375/63417296.pdf (Rev 12-05-22)","verified":true},
 {"material":"SharkBite Max","size":"1/2","name":"90 elbow UR248 A=1.9 in, B=1.0 in (labels undefined)","takeoff_mm":null,"verified":false},
 {"material":"PEX expansion Uponor ProPEX","size":"1/2-1","name":"elbow take-off","takeoff_mm":null,"verified":false}],
"terms":{"slope":"'slope', inch per foot (IPC Table 704.1); UPC also %","fittings":"1/4 Bend, 1/8 Bend, Sanitary Tee, Wye, Combination Wye & 1/8 Bend, Closet Bend, Long Sweep, Street (Charlotte)","centerline":"centerline (US spelling)","sizes":"nominal inch, e.g. '1/2 in. x 10 ft.'","faucet":"faucet",
 "takeoff":"'take-off' / 'fitting allowance' / 'make-up' not found in any opened source - choose UI label, unverified","pitch":"not seen in sources"}}
```

---

## CA

```json
{"country":"CA",
"codes":[
 {"name":"National Plumbing Code of Canada 2020","publisher":"Canadian Commission on Building and Fire Codes / NRC","url":"https://publications.gc.ca/collections/collection_2022/cnrc-nrc/NR24-29-2020-eng.pdf","edition":"2020 (NRCC-CONST-56436E)","verified":true},
 {"name":"National Plumbing Code of Canada 2025","publisher":"NRC","url":"https://publications.gc.ca/site/eng/9.950294/publication.html","edition":"2025 - text not opened; check before release","verified":false},
 {"name":"Ontario Building Code 2024 (O. Reg. 163/24), Division B Part 7 Plumbing","publisher":"Ontario MMAH","url":"https://www.publications.gov.on.ca/store/20170501121/Free_Download_Files/301719.pdf","edition":"in force 1 Jan 2025, replaces O. Reg. 332/12","verified":true},
 {"name":"Code de construction du Québec, Chapitre III – Plomberie, et Code national de la plomberie – Canada 2020 (modifié)","publisher":"RBQ","url":"https://www.rbq.gouv.qc.ca/lois-reglements-et-codes/par-domaine/plomberie/","edition":"in force 11 Jul 2024","verified":true},
 {"name":"BC Plumbing Code 2024","publisher":"Province of BC","url":"https://www2.gov.bc.ca/gov/content/industry/construction-industry/building-codes-standards/bc-codes/2024-bc-codes/plumbing","edition":"2024, eff. 8 Mar 2024 (snippet)","verified":false},
 {"name":"CSA B137.5 (PEX), CSA B137.6 (CPVC)","publisher":"CSA Group","edition":"cited in Uponor/SharkBite docs","verified":true}],
"minSlopes":[
 {"context":"drainage pipe","size_in":"<=3 (NPS)","ratio":"1 in 50","pct":2.0,"clause":"NPC 2020 Div B 2.4.8.1.(1)","source":"NPC 2020 PDF p.2-30","verified":true},
 {"context":"building drain/sewer, flattest slope in Table 2.4.10.6.-C","size_in":"4","ratio":"1 in 100","pct":1.0,"clause":"NPC Table 2.4.10.6.-C; Note A-2.4.8.1.(1) (slopes <1 in 100 only >NPS 4, where necessary)","verified":true},
 {"context":"building drain/sewer","size_in":"5-6","ratio":"1 in 133","pct":0.75,"clause":"NPC Table 2.4.10.6.-C (column mapping from interleaved PDF text - check p.2-31)","verified":false},
 {"context":"building drain/sewer","size_in":"8-10","ratio":"1 in 200","pct":0.5,"clause":"NPC Table 2.4.10.6.-C","verified":true},
 {"context":"building drain/sewer","size_in":"12-15","ratio":"1 in 400","pct":0.25,"clause":"NPC Table 2.4.10.6.-C","verified":true},
 {"context":"Ontario drainage pipe","size_in":"<=3","ratio":"1 in 50","pct":2.0,"clause":"OBC 7.4.8.1.(1); (3) lower slope if gravity flow >=0.6 m/s (2012 text, third-party https://www.buildingcode.online/1059.html)","verified":false}],
"maxVelocity":[
 {"value":"manufacturer's recommended maximum","service":"all water piping","clause":"NPC 2020 2.6.3.5.(1)","source":"NPC 2020 PDF p.2-57","verified":true},
 {"value":"3.0 / 2.4 / 1.5 m/s are sizing columns, not limits","clause":"NPC Table 2.6.3.4 + Note (1)","source":"NPC PDF p.2-56","verified":true},
 {"value":"2.4 m/s cold, 1.5 m/s hot (copper)","clause":"CDA Copper Tube Handbook p.14 (manufacturer-type guidance NPC defers to)","verified":true}],
"pipes":[
 {"material":"Copper Type M/L (ASTM B88)","size":"1/2, 3/4, 1","od_mm":"15.88/22.23/28.58","wall_mm":"see US rows","stockLengths_ft":[3,6,12],"stockLengths_m":[0.91,1.83,3.66],"stockists":["Home Depot Canada (Great Lakes)","Home Hardware #3249201 (3/4 x 12 ft M)","RONA (Wolverine, Cerro)","Lowe's Canada"],"source":"dims CDA 14.2b/c (verified); lengths search titles e.g. https://www.homehardware.ca/en/34-x-12-type-m-copper-pipe/p/3249201","verified":false},
 {"material":"ABS DWV cellular core (IPEX, ASTM F628 / CSA B181.1)","size":"1-1/2, 2, 3, 4","od_mm":"48.26/60.33/88.9/114.3","stockLengths_ft":[12],"stockLengths_m":[3.66],"stockists":["Home Depot Canada","RONA (079118, 079134)","Lowe's Canada (50110, 52502, 53765)"],"source":"OD from Charlotte DC-DWV609 (same ASTM OD); 12 ft from search titles","verified":false},
 {"material":"PEX-a/PEX-b","size":"1/2, 3/4","od_mm":"15.88/22.23","coil_ft":[100],"stockists":["Home Depot Canada (Apollo, SharkBite)","RONA (BOW)","Home Hardware (COLDX)"],"source":"search titles; dims see US Uponor rows","verified":false},
 {"material":"PVC DWV","size":"-","note":"Not checked for Canada; ABS dominates residential DWV listings found","verified":false}],
"fittings":[
 {"material":"ABS DWV","size":"1-1/2 to 4","name":"use US Charlotte ABS rows as proxy; IPEX/Canplas catalogues not opened","takeoff_mm":null,"engagement_mm":null,"verified":false},
 {"material":"Copper wrot","name":"BMI Canada take-offs - see spigot-plumbing-data.md 2b","verified":true}],
"terms":{"slope":"ratio '1 in 50' (NPC); 'grade' also used","size":"NPS (nominal pipe size), imperial inches in retail","centreline":"'centre line' / 'centreline' (Canadian spelling)","fittings":"'sanitary T' (OBC index)","metric_labels":"no '(38 mm)'-style labels found at Canadian retailers","french":"'pente' not verified (Quebec UI would need a French source)"}}
```

---

## AU: stocked materials only (item 4). Code data is in `spigot-plumbing-data.md`.

```json
{"country":"AU",
"pipes":[
 {"material":"Copper Type B hard drawn (AS 1432)","sizes_6m":["DN10","DN15","DN18","DN20","DN25","DN32","DN40","DN50","DN65","DN80","DN100","DN125","DN150","DN200"],"sizes_3m":["DN15","DN20","DN25","DN32","DN40","DN50"],"coil_18m":["DN15","DN20","DN25"],"stockists":["Reece (Kembla, Ardent)"],"source":"https://www.reece.com.au/search/plumbing-c544079/pipe-fittings-c543687/copper-pipe-fittings-c543292/plumbing-copper-tube-c543695 (pages 1-3); coils https://www.reece.com.au/search/plumbing-c544079/pipe-fittings-c543687/copper-pipe-fittings-c543292/copper-coils-c543888","verified":true,"note":"Austral Wright also lists 18 m coils B10/B18 (not at Reece)"},
 {"material":"Copper Type A (AS 1432)","sizes_6m":["DN15","DN18","DN20 (named 'Half Hard', 1.42 wall)","DN25","DN32","DN40","DN50","DN65","DN80","DN100","DN150","DN200"],"coil_18m":["DN15","DN25"],"stockists":["Reece"],"source":"Reece copper tube listing pages 1-3","verified":true,"note":"DN10 Type A only at Austral Wright https://www.australwright.com.au/products/copper-brass-bronze/copper-tubing/"},
 {"material":"Copper (Bunnings retail, Kembla; Type not stated)","size":"1/2 in (~DN15)","stockLengths_m":[1.5,3,6],"coil_m":[18],"note":"3 m is annealed","source":"https://www.bunnings.com.au/products/bathroom-plumbing/plumbing/pipe-fittings/copper-tubing","verified":true},
 {"material":"Copper (Bunnings retail)","size":"3/4 in (~DN20)","stockLengths_m":[1.5,6],"coil_m":[3,18],"source":"same","verified":true},
 {"material":"Copper (Bunnings retail)","size":"1 in (~DN25)","stockLengths_m":[1.5,6],"note":"6 m special order","source":"https://www.bunnings.com.au/brands/k/kembla","verified":true},
 {"material":"PVC-U DWV (AS/NZS 1260)","size":"DN40","od_mm":"42.8-43.1","stockLengths_m":[6],"retail_m":[1,3,6],"stockists":["Vinidex 20230","Reece 1400105 (6 m)","Bunnings Holman (1/3/6 m)"],"source":"https://www.vinidex.com.au/app/uploads/pdf/Vinidex-PVC-DWV-Pipe-SCJ-Technical-Datasheet.pdf ; https://www.reece.com.au/search/plumbing-c544079/pipe-fittings-c543687/dwv-sewer-pipe-fittings-c544019/dwv-pipe-c543699 ; https://www.bunnings.com.au/search/products?q=holman+pvc+dwv+pipe","verified":true},
 {"material":"PVC-U DWV","size":"DN50","od_mm":"55.7-56.0","stockLengths_m":[6,5,3],"retail_m":[1,3,6],"stockists":["Vinidex (6, 5 m)","Reece (6, 3 m)","Bunnings Holman"],"source":"as above","verified":true},
 {"material":"PVC-U DWV","size":"DN65","od_mm":"68.7-69.1","stockLengths_m":[6],"retail_m":[1,3,6],"source":"as above","verified":true},
 {"material":"PVC-U DWV","size":"DN80","od_mm":"82.3-82.7","stockLengths_m":[6],"retail_m":[1,6],"note":"no 3 m found","source":"as above","verified":true},
 {"material":"PVC-U DWV SCJ","size":"DN100","od_mm":"110.0-110.4","sn":"SN6 standard (6 m, Reece also 3 m); SN10 'Extra Heavy' 6 m; SN8 only as slotted","retail_m":[1,3,6],"source":"Vinidex datasheet; Reece DWV pipe","verified":true},
 {"material":"PVC-U DWV SCJ","size":"DN150","od_mm":"160.0-160.5","sn":"SN4 6 m; SN8 3 m and 6 m (Reece also SN8 RRJ 3 m)","retail_m":[1,3,6],"source":"Vinidex; Reece; Bunnings","verified":true},
 {"material":"PE-X Auspex PEX 100 (Reece, SDR9 PN20, crimp)","size":"16 mm","stockLengths_m":[5],"coil_m":[50],"source":"https://www.reece.com.au/product/auspex-pipe-pex-100-16mm-x-50mtr-1537759","verified":true},
 {"material":"PE-X Auspex","size":"20 mm","stockLengths_m":[5],"coil_m":[50],"source":"https://www.reece.com.au/search?pageNumber=1&query=auspex+pipe+pex","verified":true},
 {"material":"PE-X Auspex","size":"25 mm","stockLengths_m":[5],"coil_m":[25],"source":"Reece search p.2","verified":true},
 {"material":"PE-X Auspex","size":"32 mm","stockLengths_m":[5],"source":"search result only","verified":false},
 {"material":"PE-Xa Rehau Rautitan Platinum (Reece)","size":"16 / 20 mm","stockLengths_m":[5],"coil_m":[100],"source":"https://www.reece.com.au/search?query=rehau+rautitan+pipe+platinum","verified":true},
 {"material":"PE-Xa Rehau Rautitan Platinum","size":"25 / 32 mm","stockLengths_m":[5],"coil_m":[50],"source":"same","verified":true,"note":"40/50/63 mm also in 5 m"},
 {"material":"PE-Xb SmarteX (Bunnings)","size":"16 / 20 mm","stockLengths_m":[1.2,6],"coil_m":[20,50],"source":"https://www.bunnings.com.au/smartex-16mm-x-6m-pex-pipe_p4950091","verified":true},
 {"material":"PE-Xb SharkBite (Bunnings, AS 2492 SDR9)","size":"16 / 20 mm","od_mm":"16 / 20","id_mm":"- / 15.2","stockLengths_m":[2.4,5],"coil_m":[25],"source":"https://www.bunnings.com.au/search/products?q=pex+pipe ; https://plumbingsales.com.au/sharkbite-pe-x-tube-potable-water-20mm-x-50m.html","verified":true,"note":"no 25/32 mm PEX at Bunnings found"}],
"fittings":[
 {"material":"Copper capillary Ardent (AS 3688)","size":"DN15/20/25/32/40/50","name":"90 short-radius bend / equal tee - socket depth L","takeoff_mm":null,"engagement_mm":"9 / 13.5 / 7.5 / 7.5 / 7.5 / 7.5","source":"Ardent Technical Guide V5 https://digitalassets.reecegroup.com.au/m/5370c02336cb792e/original/Ardent-Technical-Guide.pdf","verified":true,"note":"take-off not published (verified:false); DN25-50 depths as printed - smaller than DN15/20, check against a physical fitting before use. Ardent has no DN18 elbow/tee"},
 {"material":"Copper capillary MM Kembla","takeoff_mm":null,"verified":false}],
"gaps":["Tradelink (HTTP 429), Plumbing Plus/Plumbtec, Middys not verified","Bunnings copper Type/wall not stated","SH DWV class undefined","Kemlow/Holman PEX/PB/PE-RT not found at AU stockists","PVC pressure AS/NZS 1477 not researched"]}
```

**Picker rule suggested from AU data.** Trade copper should offer DN10–DN50 (B) in 6 m, with 3 m for DN15–50. Retail mode should offer only 1/2, 3/4 and 1 in, in 1.5/3/6 m. PEX trade straights are 5 m. DWV: 6 m trade, and 1/3/6 m retail except DN80, which has no 3 m.

---

## Terminology summary for UI labels

| Concept | AU/NZ | GB | IE | US | CA |
|---|---|---|---|---|---|
| Pipe inclination | grade / gradient (NZ G13: "gradient", "graded"), "fall" (trade) | gradient (drains, 1:80); "mm fall per metre" (branches) | gradient 1:60; "fall per metre" | slope, in/ft ("1/4 in per foot") | slope "1 in 50"; "grade" |
| Size | DN (NZ code: "diameter" in mm) | nominal mm; pressure pipe OD mm | nominal mm | nominal inch | NPS / nominal inch |
| Centre | centre line | centre line / centreline | centre | centerline | centre line / centreline |
| Tap | tap | tap | tap | faucet | faucet |
| Drainage fittings | bend, junction | bend, branch, "soil and vent pipe", stack | bend, branch | 1/4 bend, 1/8 bend, sanitary tee, wye, combo, closet bend | sanitary T, wye |
| Gutter | gutter (AU) / spouting (NZ) | gutter | gutter | gutter | eavestrough (unverified) |
| Take-off label | unverified everywhere: no opened source used "take-off", "fitting allowance" or "make-up". Pick an app label such as "Take-off (centre to stop)" and define it in-app. | | | | |

---

## Hazen-Williams and velocity
No country-specific Hazen-Williams changes were found, so the formula in `spigot-plumbing-data.md` §7 applies everywhere. Velocity summary by country:
- **AU:** 3.0 m/s (NCC).
- **NZ:** no G12/AS1 limit. A 3.0 m/s figure comes via AS/NZS 3500.1 but is unverified.
- **GB:** CIPHE noise-based limits of 0.5–2.5 m/s.
- **IE:** unverified.
- **US:** UPC/CPC 8 ft/s cold and 5 ft/s hot for copper; IPC has none.
- **CA:** NPC defers to the manufacturer; CDA gives 2.4/1.5 m/s.

## Still unverified: next steps
- **NZ:** G13/AS1 Table 4 columns for DN32–65 (check the rendered PDF p.20); NZS 3501/AS 1432 copper dims and NZ copper stock (Mitre 10 was unreachable); Marley fitting dims (Jan 2020 manual §7–8); REHAU/Pexflo stock.
- **GB/IE:** ADH/TGD H Diagram 3 single-appliance slopes (view the image); EN 1254 copper take-offs (Yorkshire/Conex PDFs were blocked); Wavin "A" definition (view the drawing); ABS/MUPVC waste ODs; 82 mm soil; Irish retailer stock; BS EN 806-3 velocity.
- **US:** the IPC/UPC 2024 text itself; retail stock pages (every big-box page returned 403, so try another fetch route); PEX F876 min wall; CPVC 1/2 in wall conflict; ProPEX take-offs.
- **CA:** NPC 2025 changes; 2024 OBC 7.4.8.1 text; the 1 in 133 column mapping; all retail lengths; IPEX/Canplas ABS fitting dims; BC code.
- **AU:** Tradelink, Middys, Plumbtec; Kembla/Ardent copper take-offs; PVC pressure.
