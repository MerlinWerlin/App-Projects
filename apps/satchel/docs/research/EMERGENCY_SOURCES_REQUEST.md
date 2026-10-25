# Emergency numbers: official-source request (T25, for the OpenAI lane)

Written 2026-10-24 by the T25 build worker. Someone needs to run this request in the StarNet OpenAI lane (on the PC)
and bring the result back for import. This file only describes the request. It contains no new numbers.

## Why

`src/content/emergency_numbers.json` has 244 rows. **0 rows are sourced.** 28 rows have a URL (the EU 112 page,
`digital-strategy.ec.europa.eu/en/policies/112`) but no checked date. That page also does not cover national police,
ambulance or fire numbers. A second-model review (GUARD, 2026-10-24) doubted at least one field in **39 rows**. Until
official sources come back, the app shows every row as "Verify locally · source pending", shows the import's confidence
rating, and puts "Number doubted — check locally" on each number the review doubted.

The app counts a row as sourced only when it has **both** an `https://` official URL **and** a `checked_date` in ISO
`YYYY-MM-DD` form that is a real calendar date (`src/core/emergency.ts`: `sourceOf`, `sourceProblems`,
`auditSources`). A row that has one without the other stays "source pending".

## What to ask for

For each country or territory, find the **official national page** that lists its emergency numbers: a government
ministry, the national police, ambulance or fire service, the national telecom regulator, or the official emergency
service. Do not use Wikipedia, travel blogs, embassy pages of *other* countries, or aggregator sites. The EU 112 page is
not enough on its own, because it covers 112 and not the national service numbers. A foreign-government travel advice
page (for example a UK, US or Australian advisory page about that country) may be given only as `secondary_url`. It
never replaces `source_url`.

If no official page can be found, return `source_url: null` and say why in `notes`. **Never guess a number.** If a
field cannot be confirmed from the source, return `null` for it and explain in `notes`.

## Expected JSON shape (one object per country)

```json
{
  "iso2": "JP",
  "country": "Japan",
  "general": null,
  "police": "110",
  "ambulance": "119",
  "fire": "119",
  "tourist_police": null,
  "source_url": "https://www.npa.go.jp/...",
  "source_publisher": "National Police Agency",
  "secondary_url": null,
  "checked_date": "2026-10-25",
  "field_sources": { "police": "https://...", "ambulance": "https://...", "fire": "https://..." },
  "confirms_guard_flags": [],
  "notes": "119 serves both ambulance and fire."
}
```

Rules for each field:

- `iso2`: ISO 3166-1 alpha-2, upper case, matching the existing row.
- `general`, `police`, `ambulance`, `fire`, `tourist_police`: the number as dialled locally (digits only, no spaces),
  or `null` when the source does not confirm it.
- `source_url`: an `https://` URL of the official national page that lists the numbers. Use one URL per row. If
  different services are listed on different official pages, put the main one here and the others in `field_sources`.
- `source_publisher`: the body that publishes the page, in plain words.
- `checked_date`: the date the page was opened and read, as `YYYY-MM-DD`. Required whenever `source_url` is set.
- `field_sources`: optional, an official URL for each service whose number is not on `source_url`.
- `confirms_guard_flags`: for the 39 flagged rows only. Give one entry per flagged field:
  `{ "field": "police", "given": "919", "official": "911" | null, "verdict": "confirmed" | "corrected" | "unconfirmed" }`.
- `notes`: short and factual (shared numbers, coverage limits, mobile-only numbers). No advice.

Return one JSON array of these objects. Put the 39 rows below first, then every other row in the table, in the same
order as `src/content/emergency_numbers.json`.

## Priority 1: the 39 GUARD-flagged rows

Numbers below are copied from the bundled table, in the order general / police / ambulance / fire ("-" = blank).
They are what the lane has to confirm or correct. They are not corrections.

| iso2 | Country | Doubted field: given | Table now |
| --- | --- | --- | --- |
| AW | Aruba | general: 911 | 911 / 100 / 911 / 911 |
| BO | Bolivia | ambulance: 118 | - / 110 / 118 / 119 |
| BQ | Bonaire, Sint Eustatius and Saba | general, police, ambulance, fire: 911 | 911 / 911 / 911 / 911 |
| BS | Bahamas | police: 919; ambulance: 919 | 911 / 919 / 919 / 919 |
| CI | Côte d’Ivoire | police: 110 | - / 110 / 185 / 180 |
| DZ | Algeria | police: 1548 | - / 1548 / 14 / 14 |
| GL | Greenland | general: 112 | 112 / 112 / 112 / 112 |
| GS | South Georgia and the South Sandwich Islands | whole entry (no public emergency service) | - / - / - / - |
| GY | Guyana | police: 911; ambulance: 913; fire: 912 | - / 911 / 913 / 912 |
| HT | Haiti | police: 114; fire: 115 | - / 114 / - / 115 |
| JM | Jamaica | ambulance: 110; fire: 110 | - / 119 / 110 / 110 |
| LB | Lebanon | fire: 175 | - / 112 / 140 / 175 |
| LC | Saint Lucia | general, police, ambulance, fire: 999 | 999 / 999 / 999 / 999 |
| MA | Morocco | ambulance: 15; fire: 15 | - / 19 / 15 / 15 |
| MR | Mauritania | police: 117 | - / 117 / - / - |
| MU | Mauritius | ambulance: 114 | - / 999 / 114 / 115 |
| MW | Malawi | police: 997 | - / 997 / - / - |
| MZ | Mozambique | police: 119; ambulance: 117; fire: 198 | - / 119 / 117 / 198 |
| NA | Namibia | police: 10111 | - / 10111 / - / - |
| PA | Panama | police: 104 | 911 / 104 / 911 / 103 |
| PF | French Polynesia | police: 17; ambulance: 15 | 112 / 17 / 15 / 18 |
| PG | Papua New Guinea | police: 112 | - / 112 / - / - |
| PK | Pakistan | fire: 1122 | - / 15 / 1122 / 1122 |
| PM | Saint Pierre and Miquelon | general: 112; police: 17; ambulance: 15; fire: 18 | 112 / 17 / 15 / 18 |
| PY | Paraguay | ambulance: 141 | - / 911 / 141 / 132 |
| RE | Réunion | notes ("European emergency numbers are used") | 112 / 17 / 15 / 18 |
| RW | Rwanda | police: 112 | 112 / 112 / - / - |
| SB | Solomon Islands | ambulance: blank; fire: blank | 999 / 999 / - / - |
| SM | San Marino | police: 113 | 112 / 113 / 118 / 115 |
| SR | Suriname | police: 115; ambulance: 113; fire: 110 | - / 115 / 113 / 110 |
| SV | El Salvador | fire: 913 | 911 / 911 / 911 / 913 |
| SX | Sint Maarten | ambulance: 912; fire: 919 | 911 / 911 / 912 / 919 |
| TT | Trinidad and Tobago | ambulance: 811 | - / 999 / 811 / 990 |
| UY | Uruguay | ambulance: 105 | - / 911 / 105 / 104 |
| VA | Vatican City | police, ambulance, fire: 112 | 112 / 112 / 112 / 112 |
| VU | Vanuatu | general, police, ambulance, fire: 112 | 112 / 112 / 112 / 112 |
| YT | Mayotte | notes ("European emergency numbers are used") | 112 / 17 / 15 / 18 |
| ZA | South Africa | fire: 10177 | 112 / 10111 / 10177 / 10177 |
| ZW | Zimbabwe | police: 995; ambulance: 994; fire: 993 | - / 995 / 994 / 993 |

The GUARD review's reasons and second opinions are in each row's `guard_flags` in
`src/content/emergency_numbers.json`. Pass them to the lane as leads to check, not as answers.

## Priority 2: every other row

The remaining 205 rows, including the 28 that link only to the EU 112 page. For EU and EEA countries, return the
national page (interior ministry, national police or emergency service) that lists police, ambulance and fire. Keep
112 as `general` only if that national page confirms it.

## How the result is imported (build run, later)

1. Save the lane output under `docs/research/` as received, before changing anything.
2. Import a row's `source_url` and `checked_date` (as `source_checked`) only when both pass `sourceProblems()`.
3. A number changes only when an official `source_url` or `field_sources` entry confirms the new value. The owner
   reviews every changed number before it ships. A row whose flags are all `confirmed` or `corrected` from an official
   source loses its `guard_flags`. `unconfirmed` flags stay, so the app keeps the "Number doubted" line.
4. Every row keeps "Verify locally", sourced or not.
5. `npm test` checks the whole table: each sourced row has an https URL and an ISO checked date, and every other row
   shows "source pending".
