# Screenshots (release 1.0.0)

Six App Store shots, 6.9" iPhone, captured from a Release simulator build of the commit being submitted by
`.github/workflows/satchel-store-capture.yml` (Maestro), then captioned by `store/capture/compose.py`. The sample
trip is a realistic, invented Japan trip restored from a backup file the workflow writes (`store/capture/seed.ts`),
not the in-app sample trip (which says "demo" on screen). No real carrier, hotel, person or document number.
Captions match store/LISTING.md word for word and in order (`npm test` checks it). Full pipeline notes:
`store/screenshots/README.md`.

## Sizes

| Store | Device class | Portrait size (px) | Notes |
|---|---|---|---|
| App Store | 6.9" iPhone | 1320 x 2868 | Required set. Simulator: the current largest Pro Max model. |

iPhone only (`supportsTablet: false`), so no iPad shots.

## The six shots

| # | Screen | State | Caption |
|---|---|---|---|
| 1 | Itinerary tab | Day 2 of the trip, Today with the day strip (raw 01-itinerary-light) | Your itinerary, day by day |
| 2 | Add your itinerary > Check and save | Five pasted plans found and ticked (raw 08c-paste-scrolled-light) | Paste your plans, check, save |
| 3 | Ticket full screen | SK 21 boarding pass, code big (raw 03-ticket-dark) | Tickets ready at the gate |
| 4 | Show a local | Phrase languages, Japanese picked from the trip (raw 07-phrases-dark) | Show a local, in 12 languages |
| 5 | Emergency tab | Japan, "verify locally" in view (raw 05-emergency-light) | Help, one tap away |
| 6 | Map tab | Trip pins in Tokyo (raw 06-map-light) | Your trip on the map |

## Rules

- Every screen shown exists in the 1.0.0 build. No mock-ups, no retouched numbers, times or labels.
- Reject a capture with an empty state, a tip banner, placeholder or "demo" data, or cut-off text.
- Original backgrounds only, in the app's palette; no phone maker's device frames, logos or wordmarks.
