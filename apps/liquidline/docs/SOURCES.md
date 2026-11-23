# Liquidline sources

Every country value, PT reference point and charge-rate example used by the app, with where it came from.
Compiled 23 Nov 2026 by a research pass for this app. PT tables: `tools/gen_pt.py` (CoolProp 8), checked in
`src/core/pt.test.ts` against the NIST Chemistry WebBook (pure fluids) and the values below (blends).
Retailer and brand names appear in docs only, never in the app UI (enforced by `src/core/core.test.ts`).

NIST Chemistry WebBook saturation pressures (fetched 23 Nov 2026), https://webbook.nist.gov/chemistry/fluid/ :
R32, R134a, R290, R22, R744, R717, R600a at -40/-20/0/20/40 C (values in pt.test.ts).

R452A was dropped: no manufacturer table could be found to verify the mixture model against.

---

Compiled 23 Nov 2026. Retailer and brand names appear in this file only.

## How to read the tags

| Tag | Meaning |
|---|---|
| **C** | Confirmed: read on the fetched page or PDF at the URL given. |
| **S** | Seen only in a search-result snippet or listing title for that URL. The page itself was not fetched, usually because the site was blocked or DNS failed. |
| **I** | Inferred, from general industry knowledge or from nearby evidence. Do not ship it as a hard fact. |
| **U** | Unverified. |

Several government sites would not resolve from this machine during research: gov.uk, netregs.org.uk, epa.ie and regulated-professions.service.gov.uk. Claims about those sites are therefore tagged S, or confirmed through legislation.gov.uk instead.

---

## Australia (AU)

### 1. Licensing
- **Issuing body:** Australian Refrigeration Council (ARC), which runs the ARCtick scheme.
  - It works "on behalf of the Australian Government" — **C**, https://www.arctick.org/
  - "the Australian Government established the ARCtick national licence scheme in 2003" — **C**, same page.
- **Licences for individuals:** *Refrigerant Handling Licence* (RHL) — **C**, https://www.arctick.org/
- **Authorisation for businesses:** *Refrigerant Trading Authorisation* (RTA) — **C**, same page.
- **Licence types** (all **S**, from snippets of https://www.arctick.org/licensing/licence-types/):
  - RAC01: Full refrigeration and air conditioning licence, any system of any capacity.
  - RSS03: Restricted split system licence, single-head splits under 18 kW only, with no refrigerant-side servicing.
  - AAC02: Automotive.
  - RDR04: Restricted domestic.
  - RHTL09: Restricted handler, for decanting.
  - RRTA: a restricted RTA.
- **Legislation:** *Ozone Protection and Synthetic Greenhouse Gas Management Act 1989* and its Regulations — **I**. The ARC page refers only to "the Act and the Regulations".

### 2. Safety standard
- **AS/NZS 5149.1:2016** *Refrigerating systems and heat pumps – Safety and environmental requirements*, Parts 1–4. Part 1 is a modified adoption of ISO 5149-1:2014, with Amendment 1:2018.
  - **S**, https://store.standards.org.au/product/as-nzs-5149-1-2016
  - **S**, https://ablis.business.gov.au/service/ag/australian-new-zealand-standard-as-nzs-iso-5149-1-2016-refrigerating-systems-and-heat-pumps-safety-and-environmental-requirements-definitions-classification-and-selection-criteria/31397
  - The Standards Australia store shows an "update available" flag, so a newer edition may exist — **U**.

### 3. Refrigerants
- **Common today:** R32 (residential split), R410A (existing and legacy), R134a, R404A, R448A/R449A (commercial), R744 and R290 (some commercial), R600a (domestic fridges) — **I**.
- **R22:** HCFC imports are capped at 2.5 ODP tonnes a year from 2016 to 2029. Bulk HCFC imports are banned from 1 Jan 2030. Existing equipment may still be serviced.
  - **S**, https://www.agriculture.gov.au/sites/default/files/documents/fs-r22-phase-out.pdf
  - **S**, https://www.agriculture.gov.au/sites/default/files/documents/fs-r22-quick-facts.pdf
  - Import and manufacture of HCFC refrigeration and air conditioning equipment is banned — **S**, https://www.nationalepa.gov.au/node/283
- **Small AC, GWP 750:**
  - From 1 Jul 2024, import and manufacture is banned for small AC (≤2.6 kg charge: portable, window/wall, and non-ducted single-head split outdoor units) using refrigerant with GWP > 750.
  - From 1 Jul 2025 the ban extends to multi-head split and VRF outdoor units.
  - Ducted systems are excluded.
  - All **S**, https://www.nationalepa.gov.au/node/264 (fetch timed out) and https://hvacrnews.com.au/regulations/new-restrictions-for-multi-head-splits-and-vrf-systems/
  - Practical effect: R410A is no longer allowed in new single-head splits, and R32 is the default.
- **Possible later limits:** GWP <750 for ducted and light commercial from 2028, and <150 from 2036. These were reported as a proposal — **U**.

### 4. Copper line sets
- **Pair-coil sizes:**
  - Five sizes: 1/4×3/8, 1/4×1/2, 1/4×5/8, 3/8×5/8 and 3/8×3/4. All are 20 m coils — **C**, Reece "Ardent" pair coil, https://digitalassets.reecegroup.com.au/m/d72817ef547ea9aa/original/Ardent-Pair-Coil.pdf
  - The same five sizes in 20 m — **C**, https://www.sparkydirect.com.au/p/Pair-Coil-3/8-x-5/8-Heavy-Duty-Insulated-Copper-410a-/-R32-20m-BPC3858
- **Lengths:**
  - 20 m is the standard trade coil — **C**, Reece PDF.
  - 10 m retail coils — **C**, iTemp at Bunnings, https://www.bunnings.com.au/itemp-1-4-x-1-2-10m-pre-insulated-copper-pair-coil_p0902700
  - 18 m coils — **S**, MM Kembla, https://mm.mmem.com.au/mmkt99725
  - 15, 25, 30 and 50 m pair coil — **U** (none found).
- **Insulation:**
  - 9 mm — **S**, https://www.ricambi.com.au/twin-pair-coil-white-insulated-copper-pipe-tube-1
  - 10 mm — **C**, Bunnings.
  - 13 mm fire-rated — **C**, https://www.airconditioning-online.com.au/product-category/air-conditioning-equipment/fire-rated-copper-pair-coil/
- **Tube:** imperial OD with metric wall, to AS/NZS 1571. Examples: 6.35×0.81, 9.52×0.81, 12.70×0.81, 15.88×1.02 and 19.05×1.14 mm — **C**, Reece PDF.
- **Pre-flared:** 1/4×3/8 in 5 m (Freddox) — **C**, https://www.ricambi.com.au/pair-coil-freddox-black-pair-coil-1-4-3-8-5mt-pre
- **Pre-charged quick-connect line sets:** **U**.

### 5. Units
- Pressure in kPa (gauge) and temperature in °C. Pipe sizes are still given in inches — **I**, from industry convention. The tube spec above (C) mixes inch OD with mm wall.

---

## New Zealand (NZ)

### 1. Licensing
- **Approved Filler certificate (gas cylinders):**
  - Issued by WorkSafe-authorised compliance certifiers under the *Health and Safety at Work (Hazardous Substances) Regulations 2017* — **S**, https://compliancecertifiers.worksafe.govt.nz/home/show/387/
  - Training providers run separate A1 courses and A2/A2L (flammable) courses — **S**, https://issuu.com/irhace/docs/irhace_april_2023/s/22051482
  - It is widely described as the minimum legal requirement to handle refrigerant, and suppliers require it before selling refrigerant — **S**, same source.
- **Refrigerant Licence Trust Board (RLTB) / "RLNZ":**
  - This is an industry body that runs the Approved Filler training — **S**, IRHACE snippet.
  - It is *not* a statutory licence under the Climate Change Response Act — **U**. I found no source saying it is.
- **WorkSafe RHAC technician licence:**
  - It would cover flammable, toxic and very-high-pressure refrigerants, with WorkSafe as issuer.
  - It is **still being developed**: the MBIE page was last updated 27 Nov 2024, and I found no in-force regulation or commencement date — **S**, https://mbie.govt.nz/business-and-employment/employment-and-skills/health-and-safety/health-and-safety-reform/licensing-system-for-refrigeration-heating-and-air-conditioning-technicians (the fetch returned empty).
  - The 2022 consultation proposed four licence types — **S**, https://mbie.govt.nz/dmsdocument/26823-2022-consultation-document-licensing-regime-for-rhac-technicians-technical-definitions-pdf
  - Treat this licence as **proposed, not in force**.

### 2. Safety standard
- **AS/NZS 5149** (joint standard), sold by Standards New Zealand — **S**, https://standards.govt.nz/shop/asnzs-5149-12016

### 3. Refrigerants
- **Common today:** similar to AU — R32, R410A, R134a, R404A, R448A/R449A, R744 and R290, plus R1234yf in vehicles — **I**.
- **HCFC (R22):**
  - The phase-out of bulk new HCFCs was committed for completion by 1 Jan 2015. Remaining imports need an EPA permit — **S**, https://environment.govt.nz/assets/Publications/regulatory-impact-statement-hcfc-phase-out.pdf
  - R22 is legacy only — **I**.
- **HFC phase-down:**
  - Kigali in force for NZ from 1 Jan 2020. Bulk HFC import, export and transhipment need an EPA permit — **S**, https://environment.govt.nz/what-government-is-doing/international-action/vienna-convention-and-montreal-protocol/
  - A phased prohibition on refrigerant-containing products is under work — **S**, https://environment.govt.nz/assets/publications/impact-summary-phased-prohibition-refrigerant-containing-products-servicing-options.pdf
  - Product-level bans: **U**.

### 4. Copper line sets
- **Pair-coil sizes:** 1/4×3/8, 1/4×1/2, 1/4×5/8, 3/8×5/8 and 3/8×3/4, all 20 m, "PairCoil Premium Fire Rated" — **C**, https://smooth-air.co.nz/copper-tube-bending-springs
- **Lengths:** Totaline boxes in 5, 10 and 20 m — **S**, https://www.ideal.co.nz/nzi/Category/HVAC/Pair-Coil/c/IS400435 (the site returned 429).
- **Insulation:**
  - 9 mm (Freddox) — **S**, Ideal.
  - Otherwise likely the same as AU (9, 10 or 13 mm) — **I**.
- **Tube:** imperial OD to AS/NZS 1571 — **C**/**S**, Smooth-Air.
- **Pre-charged line sets:** **U**.

### 5. Units
- kPa and °C, inch pipe sizes — **I**.

---

## United Kingdom (UK)

### 1. Licensing
- **Regulations in force:**
  - GB: *Regulation (EU) No 517/2014* as retained in UK law (the "GB F gas Regulation"), plus *The Fluorinated Greenhouse Gases Regulations 2015* (SI 2015/310) — **S**, https://www.legislation.gov.uk/uksi/2015/310/part/3/made/data.xht
  - Personnel certification: *Commission Implementing Regulation (EU) 2015/2067* as retained — **C**, https://www.legislation.gov.uk/eur/2015/2067/article/3
  - Northern Ireland follows the EU regulation (EU) 2024/573 under the Windsor Framework — **I**.
- **Personnel categories** (all **C**, legislation.gov.uk 2015/2067 Article 3):
  - **Cat I:** all activities: leak checking, recovery, installation, repair/maintenance/servicing, decommissioning.
  - **Cat II:** leak checking without breaking into the circuit, on any equipment. The other activities only on equipment with <3 kg of F-gas (<6 kg if labelled hermetically sealed).
  - **Cat III:** recovery only, on equipment with <3 kg (<6 kg if hermetically sealed).
  - **Cat IV:** leak checking only, without breaking into the circuit.
  - The mapping of points (a)–(e) to these activity names is **I**, based on Article 2(1) of the same regulation, which was not fetched.
- **Company certification:** companies (including sole traders) servicing others' stationary F-gas equipment must be certified by an approved body — **S**, https://www.gov.uk/guidance/certification-for-companies-working-on-equipment-containing-f-gas
- **Validity in the EU:** UK certificates are not valid for work in the EU — **S**, https://www.gov.uk/qualifications-required-to-work-on-equipment-containing-f-gas
- **Phase-down reform:**
  - Defra consulted on reforming the HFC phase-down (closed 17 Dec 2025). The outcome was that "further work is required", so the existing Annex 5 step continues to apply for 2027 — **S**, https://www.gov.uk/government/consultations/amending-the-hydrofluorocarbon-phasedown-schedule and https://www.coolingpost.com/uk-news/defra-delays-gb-f-gas-phase-down/
  - Further GB amendments: **U**.

### 2. Safety standard
- **BS EN 378-1:2016+A1:2020** *Refrigerating systems and heat pumps – Safety and environmental requirements*, Parts 1–4 — **S**, https://knowledge.bsigroup.com/products/refrigerating-systems-and-heat-pumps-safety-and-environmental-requirements-basic-requirements-definitions-classification-and-selection-criteria-1

### 3. Refrigerants
- **Single split ban:** since 1 Jan 2025, single split AC with <3 kg of F-gas with GWP ≥750 (e.g. R410A) may not be placed on the GB market. Excluded: product-cooling-only units, air-to-water splits and maritime units — **S**, https://refindustry.com/news/great-britain-updates-guidance-on-2025-split-ac-f-gas-ban/
- **Servicing ban:** HFCs with GWP ≥2500 (e.g. R404A) may not be used to service systems with ≥40 t CO2e, except reclaimed or recycled gas — **I**, from the 517/2014 Art. 13(3) carried into GB law; not page-checked.
- **Common today:** R32 (splits and air-to-water heat pumps), R410A (existing stock and VRF), R290 (monobloc heat pumps), R134a, R513A, R448A/R449A, R744 and R1234yf/ze; R404A and R22 are legacy only (R22 cannot be used for servicing) — **I**.

### 4. Copper line sets
- **Pair-coil sizes:**
  - 1/4×3/8, 1/4×1/2, 1/4×5/8 and 3/8×5/8 — **C**, FSW, https://www.fsw.uk.com/product/black-pre-insulated-copper-coil
  - 3/8×3/4 as a pair coil — **U**.
- **Lengths:**
  - 20 m pair coil — **C**, FSW.
  - 25 m pair coil — **C**, Lawton at Greenmill, https://www.greenmillac.com/9mm-Lawton-Pair-Coil-Class-B-Fire-Rated-1-4-1-2-with-9mm-wall-x-25m
  - Single soft ACR coils in 15 m (1/4–7/8") — **C**, Brymec, https://www.brymec.com/category/air-conditioning/refrigeration-copper/copper-coils/15m/
  - Single ACR coils in 6 m and 30 m — **S**.
- **Insulation:** 9 mm and 13 mm — **C**, FSW and Greenmill.
- **Tube:**
  - ACR tube is **imperial OD** (EN 12735-1) — **C**, Brymec lists imperial only.
  - Plumbing tube is metric (EN 1057: 6/8/10/12/15/22/28 mm) — **I**.
- **Install kits:** Orion "15 metre installation pipe kit" in 1/4+1/2, 1/4+5/8, 3/8+5/8 and 3/8+3/4 — **C**, https://www.orionairsales.co.uk/15-meter-installation-pipe-kit-14-and-12-for-air-conditioning-and-refrigeration-39-p.asp
- **Pre-charged quick-connect line sets:** **U**.

### 5. Units
- Pressure in bar (gauge) and temperature in °C. Pipe sizes in inches for ACR — **I**.

---

## Ireland (IE)

### 1. Licensing
- **Regulation:** *Regulation (EU) 2024/573* applies directly. Ireland's implementing statutory instruments, such as S.I. No. 367/2019, still cite the earlier 304/2008 and 2015/2067 regulations — **S**, https://www.irishstatutebook.ie/2019/en/si/0367.html
- **Irish transposition updates for 2024/573:** **U**.
- **Personnel certification bodies:** Quality and Qualifications Ireland (QQI) and the EPA ("the Agency") — **S**, S.I. 367/2019.
- **Company certification body:** F-Gas Registration Ltd, which keeps the public register of certified companies — **S**, https://epa.ie/our-services/compliance--enforcement/air/fluorinated-greenhouse-gases-f-gases/training--qualifications-for-ods-and-f-gases (DNS failed when fetching).
- **EPA role:** competent authority for enforcement of the ODS and F-gas regulations — **S**, https://www.epa.ie/publications/compliance--enforcement/air/ods--f-gas/2026-ODS-and-F-Gas-FAQs-for-Licensees.pdf
- **Other certificates:**
  - Certificates from other EU member states are mutually recognised — **S**, EPA page.
  - UK-only certificates are not valid in Ireland after 30 Jun 2021 — **S**, https://epa.ie/our-services/compliance--enforcement/air/ozone-depleting-substances-ods/brexit-implications-for-ods-and-f-gas-contractors
- **Personnel categories:** I–IV, as for the UK, defined in Reg. 2015/2067. Whether a new 2024/573 implementing act has replaced it is **U**.

### 2. Safety standard
- **I.S. EN 378-1:2016+A1:2020**, identical to EN 378, published by NSAI — **S**, https://shop.standards.ie/en-ie/standards/i-s-en-378-1-2016-a1-2020-868530_saig_nsai_nsai_2900605

### 3. Refrigerants
- **EU placing-on-market bans** (all **C**, https://climate.ec.europa.eu/eu-action/fluorinated-greenhouse-gases/climate-friendly-alternatives-f-gases/air-conditioning_en):
  - From 1 Jan 2025: single split AC with <3 kg of F-gas with GWP ≥750.
  - From 1 Jan 2027: split air-to-water systems ≤12 kW with GWP ≥150 (safety exception).
  - From 1 Jan 2029: split air-to-air systems ≤12 kW with GWP ≥150 (safety exception).
  - From 1 Jan 2029: splits >12 kW with GWP ≥750.
  - From 1 Jan 2033: splits >12 kW with GWP ≥150.
  - From 1 Jan 2035: splits ≤12 kW with any F-gas (safety exception).
- **Common today:** same as UK (R32, R410A existing, R290 heat pumps, R134a, R513A, R448A/R449A, R744; R404A and R22 legacy) — **I**.

### 4. Copper line sets
- **Pair-coil sizes and lengths:**
  - Lawton Class B pair coil 1/4×1/2 and 3/8×5/8, "available in 20 m and 25 m coils", 9 mm or 13 mm insulation — **C**, https://heatmerchants.ie/lawton-class-b-fire-rated-pre-insulated-pair-coil-25m-coil-u49267
  - Cooleo pre-insulated 3/8 and 5/8 in 50 m, 13 mm black — **C**, https://www.heatmerchants.ie/cooleo-pre-insulated-3-8-x-0-8mm-degreased-copper-tube-50m-coil-black-u28749. Whether this is single or twin tube is unclear.
- **Tube:**
  - ACR is imperial (EN 12735-1) — **C**, Cooleo.
  - Plumbing tube is metric, but Irish merchants still label it ½", ¾" and so on — **C**, https://www.heatmerchants.ie/plumbing/pipe-systems/copper-piping
  - Do not map "½-inch" plumbing tube to ACR 1/2" — **I**.
- **Pre-charged line sets:** **U**.

### 5. Units
- bar and °C — **I**.

---

## United States (US)

### 1. Licensing
- **EPA Section 608 Technician Certification:**
  - Type I (small appliances), Type II (high-pressure), Type III (low-pressure) — **C** (labels only), https://www.epa.gov/section608/section-608-technician-certification-0
  - Universal (Types I+II+III) — **I**. It was not shown on that page.
- **AIM Act Technology Transitions** (40 CFR 84 subpart B):
  - New residential and light commercial AC and heat pump systems are limited to GWP 700, from 1 Jan 2025 for manufacture and import — **S**, https://www.copeland.com/en-us/news/complying-with-the-epas-final-technology-transitions-rule
  - The 2023 rule then allowed installation until 1 Jan 2026 of systems built from components made or imported before 1 Jan 2025 — **S**, https://www.govinfo.gov/content/pkg/FR-2023-12-26/html/2023-28500.htm
  - **Update, final rule 21 May 2026:** it "Removes the January 1, 2026, installation compliance date for equipment using refrigerants above the 700 limit that were domestically manufactured or imported into the United States before January 1, 2025". Pre-2025 R410A inventory can be installed until supply runs out — **C**, https://www.epa.gov/system/files/documents/2026-05/fact-sheet-san-12166-technology-transitions-frm.pdf
  - Typical replacements: R454B and R32 — **I** (both well under 700 GWP).

### 2. Safety standards
- **ANSI/ASHRAE Standard 15-2024** (*Safety Standard for Refrigeration Systems*) and **ANSI/ASHRAE Standard 34-2024** (*Designation and Safety Classification of Refrigerants*). They are meant to be used together. Standard 15 is referenced by the IMC and UMC — **S**, https://www.ashrae.org/file%20library/about/government%20affairs/public%20policy%20resources/standards-15-and-24-2024-fact-sheet.pdf
- **UL 60335-2-40**, 4th edition (15 Dec 2022, revised 31 Oct 2025). It is binational US/CA, harmonised with CSA C22.2 No. 60335-2-40, and contains the A2L requirements — **S**, https://www.ul.com/news/ul-standards-update-safety-household-and-similar-electrical-appliances-part-2-40

### 3. Refrigerants
- **R22:** production and import ended 1 Jan 2020. Existing systems may still be serviced with recovered, reclaimed or stockpiled R22 — **S**, https://www.epa.gov/sites/default/files/2020-03/documents/residential_air_conditioning_and_the_phaseout_of_hcfc-22_what_you_need_to_know_final_508.pdf
- **Common today:** R454B and R32 (new residential), R410A (installed base and pre-2025 stock), R134a, R404A (legacy), R448A/R449A, R513A, R744, R290 (small self-contained), R1234yf (vehicles) — **I**.

### 4. Copper line sets
- **Size range** (all **C**, Mueller Streamline submittal, https://res.cloudinary.com/dzhpkjoqj/image/upload/Mueller/Streamline-LineSet_Sub):
  - Standard sets: liquid 1/4–1/2", suction 3/8–1-1/8", lengths 10–50 ft in 5 ft steps plus 60 and 100 ft, insulation 3/8–1".
  - Mini-split sets: 1/4–3/8" × 3/8–3/4", 15–50 ft plus 100 ft.
- **Common stocked pairs:** 1/4×3/8, 1/4×1/2, 1/4×5/8, 3/8×5/8, 3/8×3/4 and 3/8×7/8, in 15/25/35/50 ft — **S**, Ferguson and SupplyHouse listings, e.g. Mueller 61220150/250/350/500 (3/8×3/4×1/2" in 15/25/35/50 ft).
- **Ductless twin-tube:** JMF EZ-Pull 1/4×3/8, 1/4×1/2, 1/4×5/8 and 3/8×5/8, with 1/2" or 3/4" wall — **C**, https://cdn.shopify.com/s/files/1/0366/6162/4969/files/EZ-Pull_Line_Set_Spec_Sheet.pdf
- **Insulation:** 3/8", 1/2" and 3/4", with 1/2" the mini-split default — **C**/**S**.
- **Tube:** imperial ACR, ASTM B280 — **C**, Mueller.
- **Pre-charged quick-connect:** MRCOOL DIY in 16, 25, 35 and 50 ft (1/4×1/2, 3/8×5/8), R410A and R454B versions — **S**, https://www.lowes.com/pd/MRCOOL-16ft-3-8x5-8-Quick-Connect-Line-Set-for-DIY-Mini-Split-24K-36K/1002811454

### 5. Units
- psig and °F; pipe sizes in inches; charge in oz/lb — **I**. Supported by every US manual cited below being in oz/ft.

---

## Canada (CA)

### 1. Licensing
- **Federal regulations:**
  - *Ozone-depleting Substances and Halocarbon Alternatives Regulations* (SOR/2016-137, "ODSHAR") control import, manufacture and products. Importing products containing or designed to contain HCFC-22 is prohibited (s. 40, s. 43 from 1 Jan 2020). HFC product limits are in Schedule 1.1 — **C**, https://laws-lois.justice.gc.ca/eng/regulations/SOR-2016-137/FullText.html
  - *Federal Halocarbon Regulations, 2022* (SOR/2022-110) cover systems owned by federal bodies or works, on federal lands and on Indigenous lands. Only a "certified person" may install or service, meaning one who holds "a valid certificate recognized by at least one province indicating completion of an environmental awareness course". The page also says "The certificate is not the same as a trade certification/qualification" — **C**, https://www.canada.ca/en/environment-climate-change/services/air-pollution/issues/ozone-layer/measures-protect/federal-halocarbon-regulations-information.html
- **Provincial ODS environmental awareness certificate:**
  - Delivered by HRAI (SkillTech Academy) through colleges in most provinces, and by MOPIA in Manitoba — **S**, https://novascotia.ca/nse/air/envirocourses.asp
  - It "does not authorize recipients to conduct servicing procedures" — **S**, https://www.nait.ca/NAIT/Continuing-Education/Courses/RACM111-Refrigerant-Handling-Certification-Cou
  - Ontario's "Certificate to handle refrigerants" — **S**, https://www.ontario.ca/page/certificate-handle-refrigerants
- **Trade certification:**
  - Red Seal trade **"Refrigeration and Air Conditioning Mechanic"** — **S**, https://red-seal.ca/eng/trades/refrig-ac-mech.shtml
  - **313A** is Ontario's trade code ("Refrigeration and Air Conditioning Systems Mechanic", compulsory) — **S**, https://www.skilledtradesontario.ca/
  - Quebec: "Refrigeration Mechanic"; New Brunswick: "Refrigeration and Air Conditioning Technician" — **S**, red-seal.ca.

### 2. Safety standards
- **CSA B52:23** *Mechanical refrigeration code*, 13th edition, superseding B52:18. It removed the residential AC exemption. It has no legal force until a jurisdiction adopts it (Manitoba adopted it in 2024) — **S**, https://www.csagroup.org/store/product/2702258 and https://cti.gov.mb.ca/labour/its/pubs/its24-002_adoption_of_csa_b52-23_mechanical_refrigeration_code.pdf
- **CSA C22.2 No. 60335-2-40**, harmonised with UL 60335-2-40, 4th edition — **S**, https://www.csagroup.org/store/product/2701595/

### 3. Refrigerants
- **ODSHAR Schedule 1.1 HFC limits** (all **C**, SOR/2016-137):
  - Chillers: GWP 750 from 1 Jan 2025.
  - Centralized refrigeration and condensing units: 2,200 from 2020.
  - Stand-alone commercial: 1,400 (medium-temp) and 1,500 (low-temp) from 2020.
  - Stand-alone residential: 150 from 2025.
  - Mobile refrigeration: 2,200 from 2025.
  - Automobile AC: GWP >150 prohibited from model year 2021.
  - Schedule 1.1 has **no entry for residential split AC**, so there is no federal GWP limit for new residential splits.
- **R22:** HCFC-22 equipment cannot be imported — **C**, ss. 40 and 43.
- **Common today:** same as US, with R410A plus R454B/R32 arriving as US-market equipment changes over — **I**.

### 4. Copper line sets
- **Sizes and lengths** (all **S**, rsl.ca listing titles; the site would not load):
  - Great Lakes Copper EZ-Roll mini-split 1/4×3/8×50 ft — https://www.rsl.ca/Product/great-lakes-ez-roll-1-4-x-3-8-x-50-mini-split-line-set-with-flared-fitting-ms-406-50-3-8w-lin
  - 1/4×1/2 in 25 and 50 ft with 1/2" insulation.
  - 3/8×3/4×50 ft with 3/8" insulation — https://www.rsl.ca/Product/great-lakes-ez-roll-standard-3-8-x-3-4-x-50-plain-end-line-set-612-50-3-8w-lin
- **Imperial range like the US:** **I**.
- **Master Group:** outdoor units "factory charged for a 15-foot line set" — **C**, https://www.master.ca/media/akeneo_connector/asset_files/P/C/PCG6A240752X1_Specification_510d.pdf
- **Pre-charged quick-connect in Canada:** **U**.

### 5. Units
- Gauges are sold in psi and in dual psi/kPa scales; one CRN-registered Canadian gauge has a kPa range — **S**, https://datasheets.globalspec.com/ds/winters-instruments/pfg1740/a46efa93-4bfa-45ac-ba9a-56c98298f8d1
- What Canadian techs actually use day to day is **U**. Industry practice appears to be psi/°F on gauges and pipe in inches, with metric on paperwork — **I**.
- Suggested app default for CA: psig/°F, with an easy kPa/°C toggle.

---

## PT reference table (for validating equation-of-state tables)

### Sources
| Key | Document | Units | URL |
|---|---|---|---|
| A-PT | Arkema Forane wall chart (REFPROP 10, 2025) | psig | https://forane.arkema.com/files/live/sites/shared_arkema/files/downloads/fluorochemicals/Forane%20Ref%20PT%20Regular%20Chart%20EN |
| A-410 | Arkema 410A PT chart | psig | https://www.Arkema.com/files/live/sites/shared_arkema/files/downloads/fluorochemicals/forane-410a-pressure-temperature-chart.pdf |
| A-404E | Arkema 404A English thermo table | psia | https://www.Arkema.com/files/live/sites/shared_arkema/files/downloads/products/fluorochemicals/Forane-404A-Thermodynamic-properties-English.pdf |
| A-407E | Arkema 407C English thermo table | psia | https://www.Arkema.com/files/live/sites/shared_arkema/files/downloads/products/fluorochemicals/Forane-407C-Thermodynamic-properties-English.pdf |
| A-407S | Arkema 407C SI thermo table | kPa abs | https://www.Arkema.com/files/live/sites/shared_arkema/files/downloads/products/fluorochemicals/Forane-407C-Thermodynamic-properties-Si.pdf |
| F-410S | Chemours Freon 410A SI table | kPa abs | https://www.freon.com/en/-/media/files/freon/freon-410a-si-thermodynamic-properties.pdf |
| F-404S | Chemours Freon 404A SI table | kPa abs | https://www.freon.com/en/-/media/files/freon/freon-404a--thermodynamic-properties-si.pdf |
| O-XL41E | Chemours Opteon XL41 (R454B) English table | psia | https://opteon.com/es/-/media/files/opteon/opteon-xl41-thermo-properties-eng-031522.pdf?rev=-1 |
| O-XP10S | Opteon XP10 (R513A) SI table | kPa abs | https://opteon.com/es/-/media/files/opteon/opteon-xp10-thermo-properties-si.pdf |
| O-XP10PT | Chemours XP10 T-P chart (distributor-hosted) | psig | https://meiersupply.com/customer/docs/skudocs/Document_Links/Vendors/Chemours/R-513A/R-513ATEMPCHART.pdf |
| O-XP40PT | Chemours XP40 (R449A) T-P chart (distributor-hosted) | psig | https://meiersupply.com/customer/docs/skudocs/Document_Links/Vendors/Chemours/R-449A/R-449ADATASHEET.pdf |
| O-XP40S | Opteon XP40 SI bulletin (third-party host) | kPa abs | https://schiessl.pl/Dokumentacja%20techniczna/Oleje%2C%20czynniki%2C%20ch%C5%82odziwa/Czynniki%20III/R449A/W%C5%82a%C5%9Bciwo%C5%9Bci%20termodynamiczne%20R449A%20EN.pdf |
| D-xxx | Daikin Chemicals wet-vapour tables (REFPROP 10) | MPa (abs, by value match) | https://www.daikinchemicals.com/library/pb_common/pdf/solutions/products/refrigerants/wet-vapor-table-r-XXXX_J.pdf, with XXXX = 410a, 404a, 407c or 448a |

### How the values were derived
- **Bubble** is the liquid column and **dew** is the vapour column.
- **C** means the number is printed on the source exactly as shown.
- **CONV** means a confirmed number converted to other units, using 1 atm = 101.325 kPa = 14.696 psi and 1 psi = 6.894757 kPa.
- 0 °C = 32 °F exactly. 40 °C = 104 °F, *not* 100 °F.

### Values
| Refrigerant | Point | Bubble | Dew | Units | Source | Status |
|---|---|---|---|---|---|---|
| R410A | 0 °C | 799.0 | 796.5 | kPa abs | F-410S | C |
| R410A | 0 °C | 0.801 | 0.798 | MPa abs | D-410a | C |
| R410A | 40 °C | 2419.3 | 2411.1 | kPa abs | F-410S | C |
| R410A | 40 °C | 2.426 | 2.419 | MPa abs | D-410a | C |
| R410A | 32 °F | 101.4 | 101.1 | psig | A-410 | C |
| R410A | 100 °F | 318.6 | 317.6 | psig | A-410 | C |
| R454B | 32 °F | 110.22 psia (95.52 psig) | 105.79 psia (91.09 psig) | psia / psig | O-XL41E | psia C; psig CONV |
| R454B | 0 °C | 759.9 | 729.4 | kPa abs | from O-XL41E | CONV |
| R454B | 104 °F = 40 °C | 332.97 psia (2295.7 kPa) | 322.74 psia (2225.2 kPa) | abs | O-XL41E | psia C; kPa CONV |
| R454B | 100 °F | 300.8 | 290.9 | psig | A-PT | C |
| R407C | 0 °C | 567.9 | 460.7 | kPa abs | A-407S (D-407c agrees: 0.568 / 0.461 MPa) | C |
| R407C | 40 °C | 1749.0 | 1541.3 | kPa abs | A-407S (D-407c 1.749 / 1.541) | C |
| R407C | 32 °F | 82.36 psia (67.66 psig) | 66.82 psia (52.12 psig) | psia / psig | A-407E | psia C; psig CONV |
| R407C | 100 °F | 225.5 | 196.1 | psig | A-PT | C |
| R404A | 0 °C | 611.1 | 601.3 | kPa abs | F-404S (D-404a 0.610 / 0.600) | C |
| R404A | 40 °C | 1829.2 | 1814.8 | kPa abs | F-404S (D-404a 1.829 / 1.815) | C |
| R404A | 32 °F | 88.50 psia (73.80 psig) | 87.07 psia (72.37 psig) | psia / psig | A-404E | psia C; psig CONV |
| R404A | 100 °F | 236.8 | 234.6 | psig | A-PT (bubble) / A-404E | bubble C; dew CONV |
| R448A | 0 °C | 0.622 | 0.516 | MPa abs | D-448a | C |
| R448A | 40 °C | 1.880 | 1.672 | MPa abs | D-448a | C |
| R448A | 32 °F | ≈75.5 | ≈60.2 | psig | from D-448a | CONV, ±0.1 psi (3 significant figures) |
| R448A | 100 °F | 243.7 | 214.3 | psig | A-PT | C |
| R449A | 0 °C | 615.942 | 512.986 | kPa abs | O-XP40S | C |
| R449A | 40 °C | 1861.299 | 1659.303 | kPa abs | O-XP40S | C |
| R449A | 32 °F | 74.0 | 59.9 | psig | O-XP40PT | C |
| R449A | 100 °F | 240.1 | 213.1 | psig | O-XP40PT and A-PT | C |
| R513A | 0 °C | 321.926 | 321.680 | kPa abs | O-XP10S | C |
| R513A | 40 °C | 1068.622 | 1068.536 | kPa abs | O-XP10S | C |
| R513A | 32 °F | 32.0 | 32.0 | psig | O-XP10PT | C |
| R513A | 100 °F | 131.5 (A-PT: 132.1) | 131.5 (A-PT: 132.1) | psig | O-XP10PT / A-PT | C |

### Notes
- **Source vintage differs.**
  - Older Chemours SI tables for R410A and R404A use pre-REFPROP fits. For example, R410A at 40 °C is 2419.3 kPa in F-410S vs 2426 kPa in Daikin's REFPROP 10 table.
  - The 2015 Chemours R513A chart is 0.6 psi below Arkema's 2025 chart at 100 °F.
  - A validation tolerance of about ±0.3% covers these differences — **I**.
- **Printed vs converted.**
  - For R454B, no SI table was found (the Chemours SI link returned 403), so its kPa values are converted.
  - For R448A, no printed psig value at 32 °F was found.
- **Single or dual column.** A-PT prints a single column for R410A and R404A, and that column equals the liquid (bubble) value.
- **Hosting.** O-XP10PT, O-XP40PT and O-XP40S are manufacturer documents hosted by third parties. I could not confirm that they are the current revision.

---

## Additional-charge examples (beyond the pre-charged length)

| Brand | Model/series | Refrigerant | Liquid OD | Pre-charged for | Additional charge | Source | Status |
|---|---|---|---|---|---|---|---|
| Mitsubishi Electric AU | MSZ-AP25/35/42/50VGKD | R32 | 6.35 mm | 10 m (AP25/35/42); 15 m (AP50) | 20 g/m | https://www.mitsubishielectric.com.au/wp-content/uploads/2022/02/Installation_Manual-MSZ-AP22-50VGKD_IM_JG79Y335H01_2018.pdf | C |
| Daikin EU | RXM42–60N / ARXM50/60N | R32 | 6.4 mm | 10 m | 20 g/m | https://www.daikin.eu/content/dam/document-library/Installer-reference-guide/ac/split/ARXM-N9,%20RXP-M,%20RXA-B,%20RXF-B,%20RXF-A,%20RXJ-N_4PEN513661-7E_2018_11_installer%20reference%20guide_English.pdf | C |
| Daikin EU | ARXM71N | R32 | 9.5 mm | 10 m | 35 g/m | same URL | C |
| Daikin US | RXP09/12AVJU9 | R32 | 1/4" | 49.25 ft (15 m) | 0.22 oz/ft (20 g/m) | https://daikincomfort.com/docs/default-source/fdma/im-rxp-09-12-avju9.pdf | C |
| Fujitsu US | AOUH12KZAH1 / KZAS family | R32 | 1/4" | 49 ft (15 m) | 0.2 oz/ft (20 g/m) | https://gotductless.com/cdn/shop/files/AOUH12KZAH1_AOUH12KZAS_Install_Manual.pdf | C (manufacturer manual on a dealer site) |
| Panasonic NA | CS/CU-XZ9/Z9 | R32 | 1/4" | 24.6 ft (7.5 m) | 10 g/m (0.1 oz/ft) | https://na.panasonic.com/hubfs/PCI%20-%20Panasonic%20North%20America%20Canada/IAQ/HVAC%20Resources/Installation%20Manual%20-%20HVAC%20-%202-%3F%3F%3F%3F.pdf?hsLang=en | C |
| Panasonic NA | XZ12/XZ15 | R32 | 1/4" | 7.5 m | printed "0.2 oz/ft (15 g/m)" | same URL | C as printed. The two units disagree, since 0.2 oz/ft ≈ 18.6 g/m |
| Mitsubishi Electric AU | PUZ-ZM71VHA-A | R32 | 9.52 mm | 30 m | stepped: +0.4 kg for 31–40 m, +0.8 kg for 41–50 m | https://www.mitsubishielectric.com.au/wp-content/uploads/2022/02/Installation_Manual-PUZ-ZM71VHA-A_IM_BG79U640L07_2019.pdf | C |
| Carrier (Midea-built) | 42QHE ductless | R32 / R410A | 1/4" / 3/8" | 7.5 m (NA); 5 m elsewhere | R32: 12 g/m (1/4"), 24 g/m (3/8"). R410A: 15 g/m (1/4"), 30 g/m (3/8") | https://www.manualslib.com/manual/2628942/Carrier-42qhe.html?page=21 | C on a mirror; the column order is I |
| LG | LS122CE family | R410A | 1/4" | 7.5 m | 20 g/m in the table; the page text says 30 g/m | https://www.manualsdir.com/manuals/167651/lg-ls122ce.html?page=29 | C on a mirror; the conflict is unresolved |
| Carrier | 24ACB3 / 24ACC6 | R410A | 3/8" | 15 ft | ±0.6 oz/ft | https://www.shareddocs.com/hvac/docs/1009/Public/02/24ACB-C-6SI.pdf | C |
| Goodman | TP-107 long line guide | R410A | 3/8" | 15 ft | 0.6 oz/ft (≈56 g/m) | https://jswmi.happyfox.com/kb/article/350-goodman-long-line-set-guide | C on a distributor copy |
| Goodman / Daikin Comfort | GLXS R32 condensers / TP-110 | R32 | 3/8" | 15 ft | 0.53 / 0.55 / 0.58 / 0.64 oz/ft for 5/8, 3/4, 7/8 and 1-1/8" suction. 1/4" liquid: 0.23 oz/ft | https://theacoutlet.com/cdn/shop/files/Goodman_Long_Line-Set.pdf | C |
| Carrier | 146SAN | R454B | 3/8" | 15 ft | ±0.6 oz/ft | https://www.shareddocs.com/hvac/docs/1009/Public/05/II146SAN-02.pdf | C |
| Lennox | SL25KCV | R454B | 3/8" | 15 ft | 0.60 oz/ft (5/16": 0.40; 1/2": 1.00) | https://www.lennox.com/dA/57c99e20fc/508447-01b.pdf | C |
| MrCool | DIY Hybrid MUAH | R454B | 1/4" / 3/8" (I) | 25 ft (7.5 m) | 30 g/m and 65 g/m | https://gotductless.com/cdn/shop/files/DIY-24-HP-MUAH-230D25-O_Installation_Manual.pdf | rates C; the liquid-size mapping is I |

### Patterns and suggested defaults (I)
- **Ductless R32, 1/4" liquid:** 20 g/m, pre-charged for 7.5, 10 or 15 m depending on brand. Some brands use 10–15 g/m.
- **Ductless R410A, 1/4" liquid:** 15–30 g/m, often 20 g/m, beyond 7.5 m.
- **Ductless, 3/8" liquid:** R32 24–35 g/m; R410A 30–65 g/m.
- **US ducted R410A or R454B, 3/8" liquid:** 0.6 oz/ft beyond 15 ft (confirmed for Carrier, Goodman and Lennox).
- **Not confirmed:** Rheem/Trane 0.6 oz/ft and MHI SRC (20 g/m beyond 15 m) are **U**.
- **Not found:** Toshiba, Samsung and Haier rates.
- **App behaviour:** always let the user override the defaults from the unit's nameplate or manual.
