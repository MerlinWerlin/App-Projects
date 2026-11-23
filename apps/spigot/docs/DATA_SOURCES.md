# Plumbing calculator reference data (AU-first), with sources

Compiled 23 Nov 2026. All values were read directly from the cited document unless the row says `derived` (worked out here from sourced values) or `verified: false`. Unit conversions: 1 in = 25.4 mm, rounded to 0.1 mm.

## Key findings and corrections

1. **AS 1432 DN15 is 12.70 mm OD, not 15.88 mm.** 15.88 mm (5/8") is **DN18**. MM Kembla's AS 1432 brochure lists DN6, DN10, DN15, DN18, DN20 and so on. Reece's Auspex manual also gives "Copper DN15" as 12.7 OD x 0.91 wall.
2. **US ASME B16.22 fittings only fit AU tube where the outside diameters match.** AU tube OD equals the imperial size (for example 1/2" = 12.70 mm). US tube OD is the nominal size + 1/8" (for example 1/2" nominal = 15.88 mm).
   - US 3/8" = AU DN15, US 1/2" = AU DN18 and US 5/8" = AU DN20.
   - US 3/4" (22.22 mm) and 1" (28.58 mm) have **no** AU AS 1432 equivalent.
   - Key the app's fitting data by tube OD, never by "nominal".
3. I could not find free AS 3688 (Australian capillary fitting) dimension tables from MM Kembla or Ardent. All AU copper fitting take-offs are `unverified`.
4. The AS/NZS 3500.2 grades below come from the **2003 edition (Amdt 1–3)**, the only full text I could access. The current edition is 2025 (2015, 2018 and 2021 were also published). Check whether the table number or values changed before release.
5. AS/NZS 3500.1's 3.0 m/s limit is confirmed through **NCC 2022 Vol 3, B1P2**, which is the legal requirement. I could not confirm the clause number in AS/NZS 3500.1 itself.

---

## 1. Copper tube, AS 1432 (Types A, B, C, plus D)

Sources:
- **[K]** MM Kembla, "Copper Tube to AS1432" brochure, D54/18, Type A/B/C/D tables (p.5–6). Public copy in the Anti-Dumping Commission record EPR 557: https://www.industry.gov.au/sites/default/files/adc/public-record/557_-_non-confidential_attachment_a-3-3.1_-_kembla_copper_tube_brochure_to_as1432.pdf
- **[AW]** Austral Wright Metals, Copper Tubing AS1432 table: https://australwright.com.au/products/copper-brass-bronze/copper-tubing

ID = OD − 2t (derived). Kembla does not stock Type A DN10, so that row comes from [AW] only. All other rows agree between [K] and [AW].

```json
{
  "table": "copper_tube_as1432",
  "units": "mm",
  "source": "MM Kembla 'Copper Tube to AS1432' brochure D54/18, Type A/B/C/D tables (industry.gov.au ADC public record 557); cross-checked with Austral Wright Metals AS1432 table (australwright.com.au/products/copper-brass-bronze/copper-tubing)",
  "note": "id_mm is derived = od - 2*wall. DN18 (15.88) is included because it is a standard AS1432 size (= US 1/2 inch nominal).",
  "rows": [
    {"dn":10, "imperial_od":"3/8\"", "od":9.52,  "type":"A", "wall":1.02, "id":7.48,  "verified":true, "src":"AW only (A10)"},
    {"dn":10, "imperial_od":"3/8\"", "od":9.52,  "type":"B", "wall":0.91, "id":7.70,  "verified":true},
    {"dn":10, "imperial_od":"3/8\"", "od":9.52,  "type":"C", "wall":0.71, "id":8.10,  "verified":true},
    {"dn":15, "imperial_od":"1/2\"", "od":12.70, "type":"A", "wall":1.02, "id":10.66, "verified":true},
    {"dn":15, "imperial_od":"1/2\"", "od":12.70, "type":"B", "wall":0.91, "id":10.88, "verified":true},
    {"dn":15, "imperial_od":"1/2\"", "od":12.70, "type":"C", "wall":0.71, "id":11.28, "verified":true},
    {"dn":18, "imperial_od":"5/8\"", "od":15.88, "type":"A", "wall":1.22, "id":13.44, "verified":true},
    {"dn":18, "imperial_od":"5/8\"", "od":15.88, "type":"B", "wall":1.02, "id":13.84, "verified":true},
    {"dn":18, "imperial_od":"5/8\"", "od":15.88, "type":"C", "wall":0.91, "id":14.06, "verified":true},
    {"dn":20, "imperial_od":"3/4\"", "od":19.05, "type":"A", "wall":1.42, "id":16.21, "verified":true},
    {"dn":20, "imperial_od":"3/4\"", "od":19.05, "type":"B", "wall":1.02, "id":17.01, "verified":true},
    {"dn":20, "imperial_od":"3/4\"", "od":19.05, "type":"C", "wall":0.91, "id":17.23, "verified":true},
    {"dn":25, "imperial_od":"1\"",   "od":25.40, "type":"A", "wall":1.63, "id":22.14, "verified":true},
    {"dn":25, "imperial_od":"1\"",   "od":25.40, "type":"B", "wall":1.22, "id":22.96, "verified":true},
    {"dn":25, "imperial_od":"1\"",   "od":25.40, "type":"C", "wall":0.91, "id":23.58, "verified":true},
    {"dn":32, "imperial_od":"1-1/4\"","od":31.75,"type":"A", "wall":1.63, "id":28.49, "verified":true},
    {"dn":32, "imperial_od":"1-1/4\"","od":31.75,"type":"B", "wall":1.22, "id":29.31, "verified":true},
    {"dn":32, "imperial_od":"1-1/4\"","od":31.75,"type":"D", "wall":0.91, "id":29.93, "verified":true},
    {"dn":40, "imperial_od":"1-1/2\"","od":38.10,"type":"A", "wall":1.63, "id":34.84, "verified":true},
    {"dn":40, "imperial_od":"1-1/2\"","od":38.10,"type":"B", "wall":1.22, "id":35.66, "verified":true},
    {"dn":40, "imperial_od":"1-1/2\"","od":38.10,"type":"D", "wall":0.91, "id":36.28, "verified":true},
    {"dn":50, "imperial_od":"2\"",   "od":50.80, "type":"A", "wall":1.63, "id":47.54, "verified":true},
    {"dn":50, "imperial_od":"2\"",   "od":50.80, "type":"B", "wall":1.22, "id":48.36, "verified":true},
    {"dn":50, "imperial_od":"2\"",   "od":50.80, "type":"D", "wall":0.91, "id":48.98, "verified":true},
    {"dn":65, "imperial_od":"2-1/2\"","od":63.50,"type":"A", "wall":1.63, "id":60.24, "verified":true},
    {"dn":65, "imperial_od":"2-1/2\"","od":63.50,"type":"B", "wall":1.22, "id":61.06, "verified":true},
    {"dn":65, "imperial_od":"2-1/2\"","od":63.50,"type":"D", "wall":0.91, "id":61.68, "verified":true},
    {"dn":80, "imperial_od":"3\"",   "od":76.20, "type":"A", "wall":2.03, "id":72.14, "verified":true},
    {"dn":80, "imperial_od":"3\"",   "od":76.20, "type":"B", "wall":1.63, "id":72.94, "verified":true},
    {"dn":80, "imperial_od":"3\"",   "od":76.20, "type":"D", "wall":1.22, "id":73.76, "verified":true},
    {"dn":100,"imperial_od":"4\"",   "od":101.60,"type":"A", "wall":2.03, "id":97.54, "verified":true},
    {"dn":100,"imperial_od":"4\"",   "od":101.60,"type":"B", "wall":1.63, "id":98.34, "verified":true},
    {"dn":100,"imperial_od":"4\"",   "od":101.60,"type":"D", "wall":1.22, "id":99.16, "verified":true}
  ]
}
```

Type C is only made in DN10–DN25. Type D is only made in DN32 and above (Kembla p.6).

---

## 2. Copper capillary (solder) fittings

### 2a. AU AS 3688 fittings (MM Kembla, Ardent)
`verified: false`. No free published centre-to-end or socket-depth tables were found. Measure the fittings or ask the manufacturers for their drawings.

### 2b. US wrought fittings (ASME B16.22 pattern), keyed by tube OD

Sources:
- **Socket (cup) depth G:** Copper Development Association, *Copper Tube Handbook*, CDA Pub. A4015-14/19, **Table 14.9** "Dimensions of Solder Joint Ends for Wrought and Cast Pressure Fittings", p.83. This table reproduces the ASME B16.22 minimum depths. Copy used: https://www.inspectapedia.com/plumbing/Copper-Tube-Handbook-CDA.pdf
- **Take-off (centre to cup bottom/stop):** BMI Canada, *Technical Information #125, Wrot Copper Pressure Fittings*: "Elbows 90°" and "Elbows 45°" (p.5) and "Tees" (p.7). The A, B and C dimensions run from the centreline to the cup bottom (the solder stop), as the drawings show. https://www.bmicanada.com/products/bmi_specs_wrot_copper_pressure_fittings.pdf

**Caveats:**
- BMI does not state B16.22 conformance on these pages. These are one manufacturer's values, not the standard's dimensions. (B16.22 sets minimum laying lengths, not a single value.)
- `centre_to_end` is **derived** as BMI take-off + CDA minimum cup depth, so it is approximate.

```json
{
  "table": "copper_solder_fittings_us_b16_22_pattern",
  "units": "mm",
  "source": "Take-off: BMI Canada Technical Information #125 Wrot Copper Pressure Fittings, p.5 (90/45 elbows, dims A=B) and p.7 (tees: A=B run, C branch). Cup depth: CDA Copper Tube Handbook A4015-14/19 Table 14.9 p.83 (ASME B16.22 min. depth G).",
  "definitions": {"takeoff":"centre to cup bottom (tube-end stop)", "cup_depth":"socket depth, min", "centre_to_end":"derived = takeoff + cup_depth"},
  "warning": "US nominal != AU DN. Tube OD = nominal + 1/8 in. Only US 3/8 (12.70 OD = AU DN15), 1/2 (15.88 = AU DN18), 5/8 (19.05 = AU DN20) match AS1432 ODs.",
  "rows": [
    {"us_nominal":"1/2",  "tube_od":15.88, "au_dn_equiv":18,   "cup_depth":12.7, "elbow90_takeoff":10.1, "elbow90_c2e":22.8,  "elbow45_takeoff":6.7,  "elbow45_c2e":19.4, "tee_run_takeoff":8.0,  "tee_run_c2e":20.7,  "tee_branch_takeoff":9.5,  "tee_branch_c2e":22.2,  "verified":true},
    {"us_nominal":"3/4",  "tube_od":22.22, "au_dn_equiv":null, "cup_depth":19.1, "elbow90_takeoff":14.1, "elbow90_c2e":33.2,  "elbow45_takeoff":8.7,  "elbow45_c2e":27.8, "tee_run_takeoff":11.4, "tee_run_c2e":30.5,  "tee_branch_takeoff":13.1, "tee_branch_c2e":32.2,  "verified":true},
    {"us_nominal":"1",    "tube_od":28.58, "au_dn_equiv":null, "cup_depth":23.1, "elbow90_takeoff":19.0, "elbow90_c2e":42.1,  "elbow45_takeoff":10.6, "elbow45_c2e":33.7, "tee_run_takeoff":14.6, "tee_run_c2e":37.7,  "tee_branch_takeoff":17.0, "tee_branch_c2e":40.1,  "verified":true},
    {"us_nominal":"1-1/4","tube_od":34.92, "au_dn_equiv":null, "cup_depth":24.6, "elbow90_takeoff":21.7, "elbow90_c2e":46.3,  "elbow45_takeoff":12.2, "elbow45_c2e":36.8, "tee_run_takeoff":17.8, "tee_run_c2e":42.4,  "tee_branch_takeoff":20.2, "tee_branch_c2e":44.8,  "verified":true},
    {"us_nominal":"1-1/2","tube_od":41.28, "au_dn_equiv":null, "cup_depth":27.7, "elbow90_takeoff":24.6, "elbow90_c2e":52.3,  "elbow45_takeoff":14.5, "elbow45_c2e":42.2, "tee_run_takeoff":21.0, "tee_run_c2e":48.7,  "tee_branch_takeoff":23.9, "tee_branch_c2e":51.6,  "verified":true},
    {"us_nominal":"2",    "tube_od":53.98, "au_dn_equiv":null, "cup_depth":34.0, "elbow90_takeoff":33.1, "elbow90_c2e":67.1,  "elbow45_takeoff":16.7, "elbow45_c2e":50.7, "tee_run_takeoff":27.3, "tee_run_c2e":61.3,  "tee_branch_takeoff":30.4, "tee_branch_c2e":64.4,  "verified":true},
    {"us_nominal":"2-1/2","tube_od":66.68, "au_dn_equiv":null, "cup_depth":37.3, "elbow90_takeoff":43.8, "elbow90_c2e":81.1,  "elbow45_takeoff":21.9, "elbow45_c2e":59.2, "tee_run_takeoff":33.7, "tee_run_c2e":71.0,  "tee_branch_takeoff":37.5, "tee_branch_c2e":74.8,  "verified":true},
    {"us_nominal":"3",    "tube_od":79.38, "au_dn_equiv":null, "cup_depth":42.2, "elbow90_takeoff":50.0, "elbow90_c2e":92.2,  "elbow45_takeoff":24.6, "elbow45_c2e":66.8, "tee_run_takeoff":40.1, "tee_run_c2e":82.3,  "tee_branch_takeoff":44.2, "tee_branch_c2e":86.4,  "verified":true},
    {"us_nominal":"4",    "tube_od":104.78,"au_dn_equiv":null, "cup_depth":54.9, "elbow90_takeoff":70.1, "elbow90_c2e":125.0, "elbow45_takeoff":32.7, "elbow45_c2e":87.6, "tee_run_takeoff":52.9, "tee_run_c2e":107.8, "tee_branch_takeoff":59.0, "tee_branch_c2e":113.9, "verified":true}
  ]
}
```

CDA Table 14.9 also gives the min cup depth for **3/8" nominal (12.70 OD = AU DN15)** as 0.38 in (9.7 mm), and for 5/8" nominal (19.05 OD = AU DN20) as 0.75 in (19.1 mm). BMI has a 3/8" 90° elbow take-off of 8.8 mm and a 5/8" of 12.2 mm. A 3/8" tee is 6.6 mm on the run and 7.9 mm on the branch. A 5/8" tee is 9.7 mm on the run and 11.4 mm on the branch. These are the only B16.22 rows that physically fit AU DN15 and DN20 tube.

---

## 3. PVC DWV

### 3a. AU/NZ PVC-U DWV, AS/NZS 1260 (solvent weld)

Sources:
- **[IP]** Iplex NZ, *Plumbing Drain, Waste and Vent Pipe and Fittings System Guide* V4, Jun 2023:
  - §7.1 pipe table (Novadrain SC joint), p.32 (PDF p.35)
  - §7.2 "101 Plain Bend F&F", p.35
  - "104 Plain Junction F&F", p.37
  - https://www.iplex.co.nz/assets/Uploads/Iplex-DWV-Systems-Guide-V4-Jun-2023.pdf
- **[MA]** Marley NZ, *DWV Sanitary Systems Technical Design Manual*, Jun 2026, OPTIM DWV pipe dimensions table: https://marley.co.nz/wp-content/uploads/dlm_uploads/2026/06/DWV-Technical-Design-Manual-Jun-2026.pdf

Both are NZ catalogues made to the joint AS/NZS 1260. I could not download Vinidex AU or Reliance/Holman AU catalogues (vinidex.com.au did not resolve).

```json
{
  "table": "pvc_dwv_pipe_asnzs1260",
  "units": "mm",
  "source": "Iplex NZ DWV Systems Guide V4 (Jun 2023) §7.1 table p.32 (min mean OD L1, mean ID L2); Marley NZ DWV Technical Design Manual (Jun 2026) OPTIM pipe table (mean OD)",
  "note": "wall_derived = (iplex_min_mean_od - iplex_mean_id)/2. DN40-80 are unclassed (no SN) in Iplex; Iplex DN100 offered SN6/SN10/SN16, DN150 SN4/SN8/SN16. SH (stiffness/hardness) designation not found -> unverified.",
  "rows": [
    {"dn":40, "sn":null, "iplex_min_mean_od":43,  "marley_mean_od":42.95,  "mean_id":38.9,  "wall_derived":2.05, "verified":true},
    {"dn":50, "sn":null, "iplex_min_mean_od":56,  "marley_mean_od":55.85,  "mean_id":51.4,  "wall_derived":2.30, "verified":true},
    {"dn":65, "sn":null, "iplex_min_mean_od":69,  "marley_mean_od":68.90,  "mean_id":63.5,  "wall_derived":2.75, "verified":true},
    {"dn":80, "sn":null, "iplex_min_mean_od":82,  "marley_mean_od":82.50,  "mean_id":76.7,  "wall_derived":2.65, "verified":true},
    {"dn":100,"sn":"SN6","iplex_min_mean_od":110, "marley_mean_od":110.20, "mean_id":103.8, "wall_derived":3.10, "verified":true},
    {"dn":150,"sn":"SN4","iplex_min_mean_od":160, "marley_mean_od":160.25, "mean_id":152.1, "wall_derived":3.95, "verified":true},
    {"dn":150,"sn":"SN8","iplex_min_mean_od":160, "marley_mean_od":160.25, "mean_id":null,  "wall_derived":null, "verified":false, "note":"Iplex SN8 SC-joint pipe ID not listed in §7.1; Marley column for DN150 SN8 = 150.25 but header label ambiguous"}
  ]
}
```

Marley's third column is labelled "Socket OD", but its values (for example DN100 SN6 = 107.00) are smaller than the OD. It is probably the mean ID. I treated it as `unverified` and did not use it.

**Fittings (Iplex solvent-weld).**

Bends ("101 Plain Bend F&F"):
- L and L1 = centre to socket mouth on each leg.
- L2 = socket depth.

Junctions ("104 Plain Junction F&F"):
- L = overall run length.
- L1 = run/branch centreline intersection to branch socket mouth.
- L2 = bottom run socket mouth to the intersection.
- L3 = socket depth.

Take-offs (mouth distance − socket depth) are **derived**.

```json
{
  "table": "pvc_dwv_fittings_iplex_nz",
  "units": "mm",
  "source": "Iplex NZ DWV Systems Guide V4 Jun 2023: '101 Plain Bend F&F' p.35; '104 Plain Junction F&F' p.37",
  "socket_depth_solvent_weld": [
    {"dn":40,"socket_depth":27},{"dn":50,"socket_depth":30},{"dn":65,"socket_depth":40},
    {"dn":80,"socket_depth":47},{"dn":100,"socket_depth":51},{"dn":150,"socket_depth":78}
  ],
  "bends": [
    {"dn":40, "angle":88, "L":58,  "L1":58,  "socket":27, "takeoff":31, "verified":true},
    {"dn":40, "angle":45, "L":37,  "L1":37,  "socket":27, "takeoff":10, "verified":true},
    {"dn":50, "angle":88, "L":69,  "L1":69,  "socket":30, "takeoff":39, "verified":true},
    {"dn":50, "angle":45, "L":43,  "L1":43,  "socket":30, "takeoff":13, "verified":true},
    {"dn":65, "angle":88, "L":98,  "L1":98,  "socket":40, "takeoff":58, "verified":true},
    {"dn":65, "angle":45, "L":54,  "L1":54,  "socket":39, "takeoff":15, "verified":true},
    {"dn":80, "angle":88, "L":118, "L1":118, "socket":47, "takeoff":71, "verified":true},
    {"dn":80, "angle":45, "L":63,  "L1":63,  "socket":45, "takeoff":18, "verified":true},
    {"dn":100,"angle":88, "L":13,  "L1":131, "socket":51, "takeoff":80, "verified":false, "note":"catalogue prints L=13, almost certainly a typo for 131; takeoff uses L1"},
    {"dn":100,"angle":45, "L":76,  "L1":76,  "socket":51, "takeoff":25, "verified":true},
    {"dn":150,"angle":88, "L":222, "L1":256, "socket":78, "takeoff_L":144, "takeoff_L1":178, "verified":false, "note":"legs printed unequal; confirm which leg is which"},
    {"dn":150,"angle":45, "L":116, "L1":137, "socket":77, "takeoff_L":39,  "takeoff_L1":60,  "verified":false, "note":"legs printed unequal"}
  ],
  "junctions": [
    {"dn":40, "angle":45, "L":132,"L1":84, "L2":48, "socket":29, "branch_takeoff":55, "run_bottom_takeoff":19, "run_top_takeoff":55, "verified":true},
    {"dn":50, "angle":45, "L":143,"L1":101,"L2":42, "socket":30, "branch_takeoff":71, "run_bottom_takeoff":12, "run_top_takeoff":71, "verified":true},
    {"dn":65, "angle":45, "L":204,"L1":143,"L2":63, "socket":40, "branch_takeoff":103,"run_bottom_takeoff":23, "run_top_takeoff":101,"verified":true},
    {"dn":80, "angle":45, "L":218,"L1":152,"L2":66, "socket":47, "branch_takeoff":105,"run_bottom_takeoff":19, "run_top_takeoff":105,"verified":true},
    {"dn":100,"angle":45, "L":268,"L1":188,"L2":80, "socket":51, "branch_takeoff":137,"run_bottom_takeoff":29, "run_top_takeoff":137,"verified":true, "note":"threaded inlet mainway variant"},
    {"dn":150,"angle":45, "L":413,"L1":276,"L2":137,"socket":77, "branch_takeoff":199,"run_bottom_takeoff":60, "run_top_takeoff":199,"verified":true, "note":"threaded branch variant"},
    {"dn":40, "angle":88, "L":105,"L1":57, "L2":null,"socket":27, "branch_takeoff":30, "verified":false, "note":"L2 blank in catalogue"},
    {"dn":50, "angle":88, "L":133,"L1":70, "L2":72, "socket":32, "branch_takeoff":38, "run_bottom_takeoff":40, "run_top_takeoff":29, "verified":true},
    {"dn":65, "angle":88, "L":172,"L1":100,"L2":null,"socket":40, "branch_takeoff":60, "verified":false, "note":"L2 blank"},
    {"dn":80, "angle":88, "L":202,"L1":118,"L2":null,"socket":47, "branch_takeoff":71, "verified":false, "note":"L2 blank"},
    {"dn":100,"angle":88, "L":239,"L1":130,"L2":136,"socket":51, "branch_takeoff":79, "run_bottom_takeoff":85, "run_top_takeoff":52, "verified":true, "note":"threaded inlet mainway+branch variant"},
    {"dn":150,"angle":88, "L":405,"L1":222,"L2":256,"socket":79, "verified":false, "note":"row coded 104.100.88 and L1/L2 duplicate the DN150 bend values; likely a catalogue error"}
  ]
}
```

The 45° junction take-offs come out symmetrical (branch = top run), which supports reading the drawing this way. Manufacturer fittings differ by brand, so tag every value with its brand in the app.

### 3b. US PVC Sch 40 DWV (ASTM D2665), Charlotte Pipe

Source: Charlotte Pipe and Foundry, *Plastic DWV Pipe and Fitting Dimensions* (DC-DWV, updated 7 Apr 2026). https://www.charlottepipe.com/uploads/documents/technical/Plastic_Pipe_Fittings_DC-DWV609.pdf
- Pipe data: p.7 (PVC Sch 40 DWV pipe, avg OD / min wall).
- Part 300 "1/4 Bend": p.26.
- Part 321 "1/8 Bend": p.32.
- Part 400 "Sanitary Tee": p.36.

In the drawings, **A is measured from the centreline to the socket bottom, so A is the take-off.**
- Sanitary tee: A = centre (branch) to socket bottom, for the branch and the lower run. B = run socket-bottom to socket-bottom. The upper-run take-off B−A is derived from that reading of the drawing.
- Charlotte does not publish socket depth. The ASTM D2665 socket table is paywalled, so socket depth is `unverified`.

```json
{
  "table": "pvc_dwv_sch40_us_charlotte",
  "units": "in (mm)",
  "source": "Charlotte Pipe DC-DWV catalogue (2026): pipe p.7; 1/4 Bend part 300 p.26; 1/8 Bend part 321 p.32; Sanitary Tee part 400 p.36. Values are PVC rows.",
  "rows": [
    {"nps":"1-1/2","od_in":1.900,"min_wall_in":0.145,"od_mm":48.3, "wall_mm":3.7, "bend90_takeoff_mm":44.5, "bend45_takeoff_mm":28.6, "santee_A_mm":44.5, "santee_B_mm":69.9,  "santee_top_takeoff_mm":25.4, "socket_depth":"unverified"},
    {"nps":"2",    "od_in":2.375,"min_wall_in":0.154,"od_mm":60.3, "wall_mm":3.9, "bend90_takeoff_mm":58.7, "bend45_takeoff_mm":38.1, "santee_A_mm":58.7, "santee_B_mm":93.7,  "santee_top_takeoff_mm":34.9, "socket_depth":"unverified"},
    {"nps":"3",    "od_in":3.500,"min_wall_in":0.216,"od_mm":88.9, "wall_mm":5.5, "bend90_takeoff_mm":77.8, "bend45_takeoff_mm":44.5, "santee_A_mm":77.8, "santee_B_mm":123.8, "santee_top_takeoff_mm":46.0, "socket_depth":"unverified"},
    {"nps":"4",    "od_in":4.500,"min_wall_in":0.237,"od_mm":114.3,"wall_mm":6.0, "bend90_takeoff_mm":98.4, "bend45_takeoff_mm":55.6, "santee_A_mm":98.4, "santee_B_mm":155.6, "santee_top_takeoff_mm":57.2, "socket_depth":"unverified"},
    {"nps":"6",    "od_in":6.625,"min_wall_in":0.280,"od_mm":168.3,"wall_mm":7.1, "bend90_takeoff_mm":127.0,"bend45_takeoff_mm":52.4, "santee_A_mm":127.0,"santee_B_mm":215.9, "santee_top_takeoff_mm":88.9, "socket_depth":"unverified", "note":"6in 1/8 bend (2-1/16) printed smaller than 4in (2-3/16) - as published; verify"}
  ],
  "fractions_as_printed_in": {"bend90":{"1-1/2":"1-3/4","2":"2-5/16","3":"3-1/16","4":"3-7/8","6":"5"},"bend45":{"1-1/2":"1-1/8","2":"1-1/2","3":"1-3/4","4":"2-3/16","6":"2-1/16"}}
}
```

---

## 4. PE-X pipe (AS/NZS 2492)

Source: Reece, *Auspex Water Manual* 06/22 V1, "PE-X Dimensions", p.16. The manual describes Auspex as SDR9 pipe made "within tighter tolerances of AS 2492". https://www.reece.com.au/site-assets/Component-pages/Auspex/Auspex_Water_Manual_0622_V1_web-compressed.pdf

```json
{
  "table": "pex_auspex_as2492",
  "units": "mm",
  "source": "Reece Auspex Water Manual 0622 V1, 'PE-X Dimensions' p.16 (SDR9)",
  "rows": [
    {"od_nom":16, "od_range":[16.0,16.3], "wall_range":[2.0,2.3], "id_range":[11.4,12.3], "sdr":9, "verified":true},
    {"od_nom":20, "od_range":[20.0,20.3], "wall_range":[2.3,2.7], "id_range":[14.6,15.7], "sdr":9, "verified":true},
    {"od_nom":25, "od_range":[25.0,25.3], "wall_range":[2.8,3.2], "id_range":[18.6,19.7], "sdr":9, "verified":true},
    {"od_nom":32, "od_range":[32.0,32.3], "wall_range":[3.6,4.1], "id_range":[23.8,25.1], "sdr":9, "verified":true}
  ],
  "unverified": [
    "AS/NZS 2492 normative table (SDR 7.4/9/11 series) - standard is paywalled",
    "Rehau RAUTITAN / Reliance / Uponor AU wall and ID - Rehau PDFs returned 'Access Denied'",
    "SharkBite AU PEX: 16 mm avg wall 2.15 / ID 11.7; 20 mm avg wall 2.45 / ID 15.2 (search-result snippet only, not opened)",
    "Crimp/press insertion depths - not gathered"
  ]
}
```

---

## 5. Steel pipe, threads, malleable fittings

### 5a. Pipe dimensions

Sources:
- **AS 1074 Medium:**
  - Steel & Tube NZ, *Reticulation Catalogue* Mar 2015, "Medium (M)" table, p.5. This is the only source for the DN15 row. https://steelandtube.co.nz/sites/default/files/catalogues/S%26T_Reticulation_Catalogue_Mar2015_0.pdf
  - InfraBuild Steel Centre, *Pipe & Fittings Data Charts* (Oct 2022), "Medium & Heavy Pipe to Australian Standards", p.15. https://infrabuild.com/wp-content/uploads/sites/8/2019/05/IBSC_Pipe-Fittings-Data-Charts_A4_Oct22_24pp.pdf
  - The two sources agree for DN20–DN100.
- **ASME B36.10 Sch 40 (= STD for NPS ≤ 10):**
  - InfraBuild Data Charts, "American Standard Steel Pipe ASME B36.10", p.3.
  - Cross-checked against Charlotte p.7 for NPS 1-1/4–4. PVC Sch 40 shares the same OD and wall: 1.660/0.140, 1.900/0.145, 2.375/0.154, 3.500/0.216, 4.500/0.237 in.

```json
{
  "table": "steel_pipe",
  "units": "mm",
  "source": "AS1074 Medium: Steel & Tube NZ Reticulation Catalogue Mar2015 p.5 + InfraBuild Pipe & Fittings Data Charts Oct22 p.15. ASME B36.10 Sch40: InfraBuild Data Charts p.3, cross-checked with Charlotte Pipe DC-DWV p.7.",
  "note": "id = od - 2*wall (derived)",
  "as1074_medium": [
    {"dn":15, "od":21.3, "wall":2.6, "id":16.1,  "verified":true, "src":"S&T only"},
    {"dn":20, "od":26.9, "wall":2.6, "id":21.7,  "verified":true},
    {"dn":25, "od":33.7, "wall":3.2, "id":27.3,  "verified":true},
    {"dn":32, "od":42.4, "wall":3.2, "id":36.0,  "verified":true},
    {"dn":40, "od":48.3, "wall":3.2, "id":41.9,  "verified":true},
    {"dn":50, "od":60.3, "wall":3.6, "id":53.1,  "verified":true},
    {"dn":65, "od":76.1, "wall":3.6, "id":68.9,  "verified":true},
    {"dn":80, "od":88.9, "wall":4.0, "id":80.9,  "verified":true},
    {"dn":100,"od":114.3,"wall":4.5, "id":105.3, "verified":true}
  ],
  "asme_b36_10_sch40": [
    {"dn":15, "nps":"1/2",   "od":21.3, "wall":2.77, "id":15.76,  "verified":true},
    {"dn":20, "nps":"3/4",   "od":26.7, "wall":2.87, "id":20.96,  "verified":true},
    {"dn":25, "nps":"1",     "od":33.4, "wall":3.38, "id":26.64,  "verified":true},
    {"dn":32, "nps":"1-1/4", "od":42.2, "wall":3.56, "id":35.08,  "verified":true},
    {"dn":40, "nps":"1-1/2", "od":48.3, "wall":3.68, "id":40.94,  "verified":true},
    {"dn":50, "nps":"2",     "od":60.3, "wall":3.91, "id":52.48,  "verified":true},
    {"dn":65, "nps":"2-1/2", "od":73.0, "wall":5.16, "id":62.68,  "verified":true},
    {"dn":80, "nps":"3",     "od":88.9, "wall":5.49, "id":77.92,  "verified":true},
    {"dn":100,"nps":"4",     "od":114.3,"wall":6.02, "id":102.26, "verified":true}
  ]
}
```

Note that the ODs differ between the two tables: AS 1074 DN20 is 26.9 mm against 26.7 mm for B36.10, and DN25 is 33.7 against 33.4. AS 1074 follows ISO 65.

### 5b. Thread engagement (make-up)

```json
{
  "table": "thread_makeup",
  "units": "mm (in)",
  "npt": {
    "source": "Engineering ToolBox 'NPT - National Pipe Taper Threads' (citing ANSI/ASME B1.20.1), column 'Approximate Total Thread Makeup, Hand and Wrench' - https://www.engineeringtoolbox.com/npt-national-pipe-taper-threads-d_750.html (secondary source; approximate)",
    "rows": [
      {"nps":"1/2",  "tpi":14,   "makeup_in":"7/16",   "makeup_mm":11.1},
      {"nps":"3/4",  "tpi":14,   "makeup_in":"1/2",    "makeup_mm":12.7},
      {"nps":"1",    "tpi":11.5, "makeup_in":"9/16",   "makeup_mm":14.3},
      {"nps":"1-1/4","tpi":11.5, "makeup_in":"9/16",   "makeup_mm":14.3},
      {"nps":"1-1/2","tpi":11.5, "makeup_in":"9/16",   "makeup_mm":14.3},
      {"nps":"2",    "tpi":11.5, "makeup_in":"5/8",    "makeup_mm":15.9},
      {"nps":"2-1/2","tpi":8,    "makeup_in":"7/8",    "makeup_mm":22.2},
      {"nps":"3",    "tpi":8,    "makeup_in":"1",      "makeup_mm":25.4},
      {"nps":"4",    "tpi":8,    "makeup_in":"1-1/16", "makeup_mm":27.0}
    ],
    "verified": "partial - secondary source; ASME B1.20.1 Table 2 L1 (hand-tight) + L3 (wrench) not obtained (snippet only: L1 1/2=0.320 in, 3/4=0.339 in)"
  },
  "bspt_as1722_1_iso7_1": {
    "verified": false,
    "note": "AS 1074 pipe uses taper Whitworth (BSPT) threads per AS 1722.1 (InfraBuild p.15; S&T). ISO 7-1 gauge lengths not confirmed from a source - do not ship BSPT make-up values yet."
  }
}
```

### 5c. Malleable iron Class 150 elbows (ASME B16.3)

Source: Anvil International, *Pipe Fittings* catalogue PF-11.13. These fittings "conform to ASME B16.3" (p.17).
- Fig. 1101 90° Elbow, dim A (centre to end): p.18. https://suppliesdepot.com/mm5/graphics/pdf/ANVILIE00416_17_18.pdf
- Fig. 1102 45° Elbow, dim C (centre to end): p.19. https://suppliesdepot.com/mm5/graphics/pdf/ANVILIE00416_17_19.pdf

The take-off is centre-to-end minus thread make-up. Combining the two tables in the app is a **derived** step.

```json
{
  "table": "malleable_iron_class150_elbows",
  "units": "in / mm (mm as printed by Anvil)",
  "source": "Anvil PF catalogue: Fig.1101 90° Elbow dim A p.18; Fig.1102 45° Elbow dim C p.19; conformance to ASME B16.3 stated p.17",
  "rows": [
    {"nps":"1/2",  "dn":15, "elbow90_A_in":"1-1/8",  "elbow90_A_mm":29, "elbow45_C_in":"7/8",    "elbow45_C_mm":22, "verified":true},
    {"nps":"3/4",  "dn":20, "elbow90_A_in":"1-5/16", "elbow90_A_mm":33, "elbow45_C_in":"1",      "elbow45_C_mm":25, "verified":true},
    {"nps":"1",    "dn":25, "elbow90_A_in":"1-1/2",  "elbow90_A_mm":38, "elbow45_C_in":"1-1/8",  "elbow45_C_mm":29, "verified":true},
    {"nps":"1-1/4","dn":32, "elbow90_A_in":"1-3/4",  "elbow90_A_mm":44, "elbow45_C_in":"1-5/16", "elbow45_C_mm":33, "verified":true},
    {"nps":"1-1/2","dn":40, "elbow90_A_in":"1-15/16","elbow90_A_mm":49, "elbow45_C_in":"1-7/16", "elbow45_C_mm":37, "verified":true},
    {"nps":"2",    "dn":50, "elbow90_A_in":"2-1/4",  "elbow90_A_mm":57, "elbow45_C_in":"1-11/16","elbow45_C_mm":43, "verified":true},
    {"nps":"2-1/2","dn":65, "elbow90_A_in":"2-11/16","elbow90_A_mm":68, "elbow45_C_in":"1-15/16","elbow45_C_mm":49, "verified":true},
    {"nps":"3",    "dn":80, "elbow90_A_in":"3-1/16", "elbow90_A_mm":78, "elbow45_C_in":"2-3/16", "elbow45_C_mm":56, "verified":true},
    {"nps":"4",    "dn":100,"elbow90_A_in":"3-13/16","elbow90_A_mm":98, "elbow45_C_in":"2-5/8",  "elbow45_C_mm":67, "verified":true}
  ]
}
```

These are US NPT fittings. AU malleable fittings (BSPT, AS 3673 / EN 10242) may differ slightly; those values are `unverified`.

---

## 6. AS/NZS 3500.2 minimum grades of drains

Source: AS/NZS 3500.2:2003 (incorporating Amdts 1, 2 and 3):
- Clause **3.4.1** "Minimum grade": "The minimum grade of drains shall be as given in Table 3.2."
- **Table 3.2** "Minimum grades of drains".
- Clause 3.4.2 / **Table 3.3** "Minimum fixture unit loadings for reduced grade drains".

I read these from an OCR'd copy on archive.org: https://archive.org/stream/as-nzs.3500.2.2003/as-nzs.3500.2.2003_djvu.txt

**This edition is superseded.** The current edition is AS/NZS 3500.2:2025 (store.standards.org.au), and its table and clause numbers may differ. CCC Engineering's design memo also gives 2.50 / 1.65 / 1.00 % for DN65 / 100 / 150: https://cccengineering.com.au/design-memos/sanitary-plumbing-drainage-design/

```json
{
  "table": "asnzs3500_2_min_drain_grades",
  "source": "AS/NZS 3500.2:2003 (Amdt 1-3) Clause 3.4.1, Table 3.2 (archive.org OCR copy). Superseded - confirm against AS/NZS 3500.2:2025.",
  "rows": [
    {"dn":65,  "min_grade_pct":2.50, "ratio":"1:40",  "verified":true},
    {"dn":80,  "min_grade_pct":1.65, "ratio":"1:60",  "verified":true},
    {"dn":100, "min_grade_pct":1.65, "ratio":"1:60",  "verified":true, "footnote":"except drains from septic tanks, sewage treatment plants and unvented discharge pipes from tundishes: min 1.00%"},
    {"dn":125, "min_grade_pct":1.25, "ratio":"1:80",  "verified":true},
    {"dn":150, "min_grade_pct":1.00, "ratio":"1:100", "verified":true},
    {"dn":225, "min_grade_pct":0.65, "ratio":"~1:154","verified":true},
    {"dn":300, "min_grade_pct":0.40, "ratio":"1:250", "verified":true}
  ],
  "reduced_grades_table_3_3": {
    "note": "Clause 3.4.2: reduced grades allowed only if fixture-unit loading >= value; 'X' = not permitted, '-' = permitted by Table 3.2 anyway. OCR transcription - verify.",
    "columns_dn": [80,100,125,150],
    "rows": [
      {"grade_pct":1.45, "min_fu":[9,10,"-","-"]},
      {"grade_pct":1.25, "min_fu":[10,18,"-","-"]},
      {"grade_pct":1.10, "min_fu":["X","X",27,"-"]},
      {"grade_pct":1.00, "min_fu":["X","X",38,"-"]},
      {"grade_pct":0.85, "min_fu":["X","X","X",75]},
      {"grade_pct":0.65, "min_fu":["X","X","X",160]}
    ],
    "verified": false
  }
}
```

The ratios are 1/(%/100): 1.65 % ≈ 1:60.6, which the trade calls 1:60. Store the percentage and display the ratio.

---

## 7. Hazen-Williams and velocity

```json
{
  "table": "hazen_williams",
  "formula_si": "h_f = 10.67 * L * Q^1.852 / (C^1.852 * d^4.8704)   [h_f m, L m, Q m^3/s, d internal diameter m]",
  "velocity_form_si": "V = 0.849 * C * R^0.63 * S^0.54   [V m/s, R hydraulic radius m, S = h_f/L]",
  "formula_us": "P = 4.52 * Q^1.85 / (C^1.85 * d^4.87)   [P psi per ft, Q gpm, d in]  (CDA Copper Tube Handbook A4015-14/19, Table 14.6 note 4, p.82)",
  "source": "Wikipedia 'Hazen–Williams equation' (pipe-equation section; secondary, cites Engineering ToolBox for C values) https://en.wikipedia.org/wiki/Hazen%E2%80%93Williams_equation ; Engineering ToolBox metric form uses exponents 1.85/4.8655 https://www.engineeringtoolbox.com/hazen-williams-water-d_797.html ; validity: water at ordinary temperatures (~4-25 °C)",
  "c_values": {
    "source": "Engineering ToolBox 'Hazen-Williams Coefficients' https://www.engineeringtoolbox.com/hazen-williams-coefficients-d_798.html",
    "rows": [
      {"material":"copper",                    "c":"130-140", "suggested":140, "verified":true, "note":"CDA handbook equivalent-length tables use C=150"},
      {"material":"PVC / CPVC",                "c":150,       "verified":true},
      {"material":"PE (polyethylene)",         "c":140,       "verified":true},
      {"material":"PE-X",                      "c":"140-150", "verified":false, "note":"no PE-X entry found; PE value used as proxy"},
      {"material":"steel, unlined new",        "c":"140-150", "verified":true, "note":"Wikipedia's generic 'steel' row gives 90-120 (unreferenced) - choose conservatively"},
      {"material":"galvanised iron",           "c":120,       "verified":true},
      {"material":"old galvanised / corroded", "c":"~100 (common practice)", "verified":false, "note":"no direct entry; aged cast iron listed 107-113 (10 yr), 89-100 (20 yr), 75-90 (30 yr)"}
    ]
  }
}
```

```json
{
  "table": "max_water_velocity",
  "rows": [
    {"service":"cold water (drinking)", "max_m_s":3.0, "rule":"not exceeded for more than 1% of the time during the annual peak hour",
     "source":"NCC 2022 Vol 3 (Plumbing Code of Australia) Part B1, Performance Requirement B1P2 'Velocity'; B1D3 deems AS/NZS 3500.1 compliance - https://ncc.abcb.gov.au/editions/ncc-2022/adopted/volume-three/b-water-services/part-b1-cold-water-services", "verified":true},
    {"service":"non-drinking water", "max_m_s":3.0, "source":"NCC 2022 Vol 3 Part B3", "verified":true},
    {"service":"AS/NZS 3500.1 clause number", "value":"Clause 3.4 'Velocity requirements' in the 2003 edition (TOC only); current 2025 clause number not confirmed", "verified":false},
    {"service":"heated water, non-circulatory", "max_m_s":3.0, "source":"MM Kembla AS1432 brochure D54/18 'Maximum allowable velocities' p.6 (mirrors AS/NZS 3500.4; clause not confirmed)", "verified":true},
    {"service":"heated water, circulatory flow", "max_m_s":1.2, "source":"same", "verified":true},
    {"service":"heated water, circulatory return", "max_m_s":1.0, "source":"same", "verified":true}
  ]
}
```

---

## What's still unverified and the next step for each

- **AS 3688 copper fitting take-offs (MM Kembla, Ardent):** ask the manufacturers for their drawings.
- **AS/NZS 1260 normative socket depths, SH classes and Vinidex/Holman AU fitting dims:** the vinidex.com.au domain did not resolve from here. Try the Vinidex DWV SWJ product catalogue.
- **AS/NZS 3500.2:2025 grade table:** confirm the table number and values; I used the 2003 edition.
- **AS/NZS 3500.1 velocity clause number:** confirm in the current edition.
- **ASTM D2665 socket depths, ISO 7-1 / AS 1722.1 BSPT gauge lengths, and ASME B1.20.1 L1/L3:** these standards are paywalled.
- **PE-X:** the AS/NZS 2492 SDR table, Rehau, Uponor and Reliance data, and crimp/press insertion depths.
