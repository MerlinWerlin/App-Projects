# Country essentials: sources and sample check (T55, 2026-10-31)

Data: `src/content/country_essentials.json`, one row for each of the 244 codes in `emergency_numbers.json`
(test-enforced). Each row lists three https sources and `checked: 2026-10-31`:

- Plugs, voltage, frequency: IEC World Plugs, https://www.iec.ch/world-plugs
- Driving side: the public left- and right-hand traffic list, https://en.wikipedia.org/wiki/Left-_and_right-hand_traffic
- Calling codes: ITU-T E.164 assigned country codes, https://www.itu.int/pub/T-SP-E.164D

**How it was checked.** The build box cannot reach iec.ch, wikipedia.org or itu.int (the proxy refuses them), so the
values come from well-established reference knowledge, not a live read of those pages on 31 Oct. A value went
in only where the build was confident; anything doubtful is `null` and the card says "Not sure — check locally".
The card always says "Verify locally". A live re-check against the three pages is worth a future lane run.

**Nulls (deliberate):**
- Plug types (28): BQ BT EH ET GS KN KP LB MF MG MM MO MS MV NE PF PN RW SB SH SN SO SR TD TL VC WF YE.
  These countries list many mixed socket types, or the build wasn't sure of the full list.
- Voltage (13): BQ EH GS IM MF MS NG PF PN SH TV WF ZW (nominal 230 vs 240 uncertain, or no grid data).
- Frequency (10): BQ EH GS KN MF MS PF PN SH WF.
- Driving side (3): GS, PN, TK (few or no public roads).
- Calling code (1): EH (Western Sahara; Moroccan +212 is in use, but the territory is disputed).

**Rules and caveats in the data:**
- Plug letters are IEC A–N only. Thailand's own type O socket is left out (the row note says so); TH lists A, B, C, F.
- Voltage and frequency are arrays: Brazil is 127 / 220 V (by state and city); Japan is 50 / 60 Hz (east / west);
  Belize and Cuba list 110 / 220 V.
- Vatican City uses +39 (its own +379 is assigned but not in use). Åland +358, Jersey / Guernsey / Isle of Man +44,
  Cocos and Christmas Islands +61, Pitcairn +64, Svalbard +47. All NANP territories are +1.

## Hand-checked sample (19 countries, pinned by `src/core/essentials.test.ts`)

| Code | Plugs | Voltage | Hz | Drives | Code | Note |
| --- | --- | --- | --- | --- | --- | --- |
| AU | I | 230 | 50 | left | +61 | |
| JP | A, B | 100 | 50 / 60 | left | +81 | 50 Hz east (Tokyo), 60 Hz west (Osaka) |
| US | A, B | 120 | 60 | right | +1 | |
| GB | G | 230 | 50 | left | +44 | |
| IN | C, D, M | 230 | 50 | left | +91 | |
| BR | C, N | 127 / 220 | 60 | right | +55 | Voltage varies by state |
| ZA | C, D, M, N | 230 | 50 | left | +27 | N is the newer standard; M is still common |
| TH | A, B, C, F | 230 | 50 | left | +66 | Type O left out (outside A–N) |
| DE | C, F | 230 | 50 | right | +49 | |
| FR | C, E | 230 | 50 | right | +33 | |
| IT | C, F, L | 230 | 50 | right | +39 | |
| CN | A, C, I | 220 | 50 | right | +86 | |
| KR | C, F | 220 | 60 | right | +82 | |
| ID | C, F | 230 | 50 | left | +62 | |
| AE | C, D, G | 230 | 50 | right | +971 | G is most common |
| NZ | I | 230 | 50 | left | +64 | |
| MX | A, B | 127 | 60 | right | +52 | |
| SG | G | 230 | 50 | left | +65 | |
| CH | C, J | 230 | 50 | right | +41 | |

All 19 match the build's reference knowledge. No sample value needed a correction.

## "Bring an adapter?"

The app had no home country, so the card now lets the traveller set one (`satchel.homeCountry.v1`, this phone only,
via `usePersisted`). The verdict compares plug types with two well-known one-way fits: type A plugs fit B sockets,
and the type C Europlug fits C, E, F, J, K, L and N sockets. The verdicts are: fits, some fit (bring one to be safe),
adapter needed, or not sure. A separate line warns when the voltages are in different bands (100–127 V vs
220–240 V): check that each charger accepts both, or bring a converter. Every verdict still sits under "Verify locally".
