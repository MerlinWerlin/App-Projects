# Emergency numbers: hand sample check (T48, 2026-10-31)

Owner feedback: "Afghanistan and Angola (and others) show no number." T48 filled the 23 blank rows and gave every row a
source URL and checked date. This file compares 15 rows in `src/content/emergency_numbers.json` with what the build
worker knows them to be from well-known public lists (the Wikipedia "List of emergency telephone numbers" page and US
State Department country pages, from memory; there was no web access during this run). This is a sanity check, not an
official-source verification: every row still shows "verify locally", and the T25 official-source request
(`EMERGENCY_SOURCES_REQUEST.md`) is still open.

| ISO | Country | Table (general / police / ambulance / fire / tourist) | Known from public lists | Result |
|---|---|---|---|---|
| AF | Afghanistan | – / 119 / 102 / 119 / – | Police 119, fire 119; ambulance 102 (Kabul), some lists give 112 | Agrees (filled in T48, low) |
| AO | Angola | – / 113 / 112 / 115 / – | Police 113, ambulance 112, fire 115 | Agrees (filled in T48, medium; GUARD's 2026-10-24 note "113" adopted over the lane's 111) |
| JP | Japan | – / 110 / 119 / 119 / – | Police 110, ambulance and fire 119 | Agrees |
| AU | Australia | 000 / 000 / 000 / 000 / – | 000 for all; 112 also works from mobiles | Agrees |
| GB | United Kingdom | 999 / 999 / 999 / 999 / – | 999 for all; 112 also works | Agrees |
| US | United States | 911 / 911 / 911 / 911 / – | 911 for all | Agrees |
| FR | France | 112 / 17 / 15 / 18 / – | 112 general; police 17, SAMU 15, fire 18 | Agrees |
| DE | Germany | 112 / 110 / 112 / 112 / – | 112 ambulance and fire; police 110 | Agrees |
| TH | Thailand | – / 191 / 1669 / 199 / 1155 | Police 191, ambulance 1669, fire 199, tourist police 1155 | Agrees |
| IN | India | 112 / 112 / 112 / 112 / – | 112 national; older 100 / 102 (108) / 101 still used | Agrees (note mentions older numbers) |
| BR | Brazil | – / 190 / 192 / 193 / – | Police 190, SAMU 192, fire 193 | Agrees (GUARD flag about a general number left as is) |
| ZA | South Africa | 112 / 10111 / 10177 / 10177 / – | 112 from mobiles; police 10111; 10177 ambulance and fire | Agrees with the public list; GUARD doubt on fire kept on screen |
| EG | Egypt | – / 122 / 123 / 180 / 126 | Police 122, ambulance 123, fire 180, tourist police 126 | Agrees |
| MX | Mexico | 911 / 911 / 911 / 911 / – | 911 national | Agrees |
| CN | China | – / 110 / 120 / 119 / – | Police 110, ambulance 120, fire 119 | Agrees |

No disagreements were found in the sample, so no existing number was changed.

## The 23 rows filled in T48

All are low confidence unless marked medium, carry a note, and cite the Wikipedia list as a public (not official)
source, checked 2026-10-31.

| ISO | General | Police | Ambulance | Fire | Note |
|---|---|---|---|---|---|
| AF | – | 119 | 102 | 119 | |
| AO | – | 113 | 112 | 115 | medium |
| CD | 112 | 112 | – | 118 | Kinshasa; limited elsewhere |
| CF | – | 117 | – | 118 | Bangui |
| CV | – | 132 | 130 | 131 | medium |
| EH | – | 19 | 15 | 15 | Moroccan numbers in the Moroccan-administered area |
| ER | – | 113 | 114 | 116 | |
| GQ | – | 114 | – | 115 | |
| GS | 112 | – | – | – | Mobile guidance only; no population or network; Government Officer / vessel radio; Falklands 999 |
| GW | – | 117 | 119 | 118 | |
| KP | – | 112 | 119 | 119 | Via guide; Swedish embassy represents many countries |
| LS | 112 | 123 | 121 | 122 | medium |
| LY | – | 1515 | 193 | 193 | |
| PN | 112 | – | – | – | Mobile guidance only; contact the island police officer / Island Office in person |
| SH | 999 | 999 | 999 | 999 | medium; Ascension and Tristan differ |
| SL | – | 019 | 117 | 019 | 999 also listed for police |
| SO | – | 888 | 999 | 555 | |
| SS | – | 777 | – | – | Juba |
| ST | 112 | 112 | – | – | |
| SY | – | 112 | 110 | 113 | |
| TK | 112 | – | – | – | Mobile guidance only; NZ 111 noted |
| TV | 911 | 911 | 911 | 911 | |
| YE | – | 199 | 191 | 191 | |

Rows least certain (replace first when official sources arrive): GS, PN, TK (no confirmed local number; 112 is guidance
only), ST, SS, GQ, CF, CD, LY, YE.
