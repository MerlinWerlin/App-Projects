/**
 * Shown on the Sources screen. Mirrors the comments at the top of each core module and core/country.ts, which name
 * the exact data sheets, merchants and quarries. Brand and retailer names stay in code comments only, never in the UI.
 */
export const SOURCES: { topic: string; what: string; refs: string[] }[] = [
  { topic: 'Volumes', what: 'Prisms L × W × D, cylinders πr²h, triangles ½bh. Steps as stacked blocks: W × R × G × n(n+1)/2.', refs: ['Standard solid geometry'] },
  { topic: 'Waste allowance', what: '5 % by default, editable. Ordering a margin for spillage, uneven sub-base and form bulge is standard practice.', refs: ['Ready-mix suppliers’ ordering guidance (5–10 %)'] },
  { topic: 'Truck orders', what: 'Rounded up to the plant’s ordering step and split into even loads. Step and truck size follow your country and are editable.', refs: ['Ready-mix suppliers’ ordering pages and trade bodies in each country', 'AS 1379 cl. 4.2.5 (Australia): discharge within 90 minutes; 5–35 °C at delivery'] },
  { topic: 'Bagged concrete', what: 'Bags per volume from the yield printed by the maker for your country’s bag sizes, e.g. 108 × 20 kg bags per m³, or 0.60 ft³ per 80 lb bag. You can type the yield from your bag.', refs: ['Makers’ product data sheets in each country'] },
  { topic: 'Site mix', what: 'Nominal volume mixes with a dry-volume factor of 1.54 (estimating rule of thumb) and cement at 1440 kg/m³. Non-structural work only.', refs: ['Engineering ToolBox: Portland cement 1362–1522 kg/m³'] },
  { topic: 'Mesh and chairs', what: 'Your country’s stocked sheets (e.g. SL82, SE62, A193, 6×6 wire mesh). The two outer cross-wires of each sheet overlap; the default lap is editable. One chair per spacing × spacing cell.', refs: ['NCC 2019 Vol. 2 Table 3.2.3.1 (AS 2870 / AS 3600)', 'BS 4483 fabric sizes', 'ACI 318 plain wire reinforcement splices', 'Reinforcing makers’ product guides'] },
  { topic: 'Bars and trench mesh', what: 'Nominal bar mass 7850 × πd²/4 kg/m. Laps from the drawings (40d prefilled as a rule of thumb). Trench mesh: 500 mm end laps, full-width laps at corners and T-junctions.', refs: ['AS/NZS 4671, BS 4449, ASTM A615 and CSA G30.18 bar sizes', 'NCC 2019 Vol. 2 Table 3.2.3.1'] },
  { topic: 'Falls', what: 'Percent = drop ÷ run × 100; ratio 1 : run ÷ drop; fall per metre or per foot. Presets follow your country’s rules.', refs: ['NCC 2022 Housing Provisions 3.3.3 (AU)', 'NZ Building Code E1/AS1, E2/AS1', 'Approved Document H (UK)', 'IRC R401.3 (US)', 'NBC 9.14.6.1 (Canada)'] },
  { topic: 'Steps', what: 'Rise and going limits from your country’s code; shown only where we could confirm them.', refs: ['NCC 2022 Housing Provisions 11.2.2', 'NZBC D1/AS1', 'Approved Document K', 'IRC R311.7.5', 'NBC Part 9'] },
  { topic: 'Bulk materials', what: 'Your country’s common materials with loose densities from local quarries and landscape suppliers, or Engineering ToolBox where none was found. All editable.', refs: ['Local quarry and landscape-supply price lists', 'Natural Resources Canada stone conversion', 'Engineering ToolBox bulk material densities'] },
  { topic: 'Pavers', what: 'Pavers per m² = 1 ÷ ((L + joint) × (W + joint)). Bedding sand 20–30 mm compacted; joints 2–5 mm.', refs: ['AUS-SPEC 1145 Segmental paving', 'ICPI: at least 100 mm base for pedestrian paving'] },
  { topic: 'Retaining walls', what: 'Courses × blocks per course plus waste; 300 mm drainage gravel; levelling pad. Approval thresholds vary by place.', refs: ['Block makers’ installation guides', 'Council and municipal guidance'] },
  { topic: 'Pour weather', what: 'Evaporation E = 5([Tc+18]^2.5 − r[Ta+18]^2.5)(V+4) × 10⁻⁶ kg/m²/h. Act above 0.5, high risk above 1.0.', refs: ['Uno (1998), ACI Materials Journal 95(4)', 'ACI 305R Hot Weather Concreting', 'CCAA Data Sheet: Plastic Shrinkage Cracking'] },
  { topic: 'Unit conversion', what: '1 ft = 0.3048 m, 1 in = 25.4 mm, 1 lb = 0.45359237 kg (exact).', refs: ['NIST SP 811 Appendix B'] },
];
