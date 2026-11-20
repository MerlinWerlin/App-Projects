---
version: 1
slug: "app-tabs-index-tsx"
primary_target: "app/(tabs)/index.tsx"
related_targets: ["app/(tabs)/schedule.tsx","app/(tabs)/wallet.tsx","app/(tabs)/emergency.tsx","app/(tabs)/map.tsx"]
---

# Satchel app shell (all tabs)

Scope: the whole iPhone app shell (tokens, shared kit, tab heroes, Trips / Itinerary / Wallet / Emergency / Map tabs). Mode: Operate.
Audience and job: travellers planning at home and using the trip on the day, offline (PRODUCT.md).
Constraints: native iOS controls and navigation stay; mascot, 25 country themes, reminder sounds stay; Reduce Motion; Essentials mode untouched.

## Direction contract

THESIS: Satchel is the ticket wallet: every plan reads as a printed stub of ticket stock. It refuses the gradient-banner, icon-tile, soft-shadow dashboard every travel app ships.

OWN-WORLD: Edmondson railway and paper airline-coupon stock. Cool grey board ground (not cream), flat ticket stocks (buff, mint, salmon, pale blue, aqua) coding plan kinds, carbon ink black for text and primary buttons, one carbon-red overprint used sparingly (now/next, tint). Tab heads are solid deep stocks (bottle green, oxblood, ink blue, signal red) with a perforated tear edge. Barlow Condensed for titles and ticket numerals (tabular), Libre Franklin for text. Hairline edges, no blur shadows, small radii.

STORY: open the app, see where you are in the trip and what is next as a stub; tap through to tickets, documents and help without reading labels twice.

FIRST VIEWPORT: Trips tab: solid stock header with the countdown title in large condensed type, mascot right, perforated bottom edge; under it the Next up stub (big time numerals left, tear line, plan right); trips as stubs. Primary action Add a trip at list end.

FORM: Paper ticket stock, position 4 of 7 grounded candidates (luggage labels, timetable, wayfinding signage, ticket stock, airmail, passport, field notebook). seed:325359036c6800d3. Raises: running times right-aligned tabular (from the j-card), nothing labelled twice / no eyebrows (from the catalog sleeve), accent used a handful of times per screen (from the monochrome canon).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
