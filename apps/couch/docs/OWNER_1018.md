# Owner request 18 Oct 2026 — market research + iOS redesign (market-1018)

Arrived as the payload of a manual fire of the build task (run 40, parked in `ops/inbox/pending/`), then
confirmed by the owner live in the build session the same evening: "You need to be autonomous - set that
up - look at other apps on the App Store, take screenshots if required from their main pictures. If it
looks better than ours, or that you see things that are worthwhile, steal it. Do this all autonomously."

How "steal it" is applied (build decision, run 41): adopt features, flows and general UI patterns, which
nobody owns. Never copy or lightly alter anyone's screenshots, artwork, icons, wording, app name or overall
look; a slightly changed copy is still a copy and gets apps rejected or taken down. Competitor names appear
only in docs/MARKET.md. Competitor store images are looked at for analysis only, never stored in the repo or
published. (Run 41: the cloud browser could not reach apps.apple.com, so the images were not viewed.)

Standing rule from the owner (18 Oct): owner briefs that arrive in a manual-fire payload are imported
directly (no waiting for a confirmation), unless they break a hard rule.

## The brief (as received)

OWNER REQUEST 18 OCT 2026 — MARKET RESEARCH + iOS REDESIGN (one-time import; skip the import if ops/backlog.json already has tasks tagged "market-1018"). This run: finish any in-progress fb-1017b work first (H1–H3), then do the import and M1 before other backlog work. Copy this whole message into docs/OWNER_1018.md so later runs keep it, then add backlog tasks tagged "market-1018" for M2–M5 that outrank everything except trial blockers, fb-1017b and open owner-comment tasks.

Why: the owner looked at competing apps on the App Store and wants proper market research before more building, plus a fresher, more iOS-native look. He wants our app to offer what the best competitors offer, done better, for a cheaper price (every TV control stays free).

M1 MARKET RESEARCH → docs/MARKET.md. Use WebSearch and WebFetch only (public pages; never work around a site that blocks automated access; do not use itunes.apple.com RSS). Split the fetching across parallel Agent workers (general-purpose; each returns compact findings). Find the 8–12 most popular iOS universal TV remote apps (apps.apple.com listings for au and us, plus recent roundups). For each record: name, developer, rating and rating count, price and EVERY in-app purchase/subscription price, ads, the features they list (TV brands supported, discovery, keyboard, touchpad, voice, app launcher, screen mirroring/casting, widgets, Apple Watch, themes), how their store screenshots are composed (number of shots, headline wording style, colours, device framing — from what the page exposes; say plainly when the images themselves could not be viewed), onboarding and paywall pattern, UI patterns, and recurring complaints in visible reviews (paraphrase; no quote over 15 words). Then write: a comparison table; "Features most of them have that we lack"; "What users love"; "What users hate" (our openings — e.g. paywalled buttons, weekly subscriptions, ads, failed connections); "UI patterns worth adopting"; "Store screenshot playbook"; and "Pricing proposal" (all controls free; Couch Plus one-time and clearly cheaper than competitors over a year; marked "owner decides"). Note in MARKET.md whether competitors show streaming-service logos in their store screenshots and how. Add a "Market research" section to the build page summarising MARKET.md (table + top 10 takeaways).

RULES FOR USING WHAT YOU LEARN: adopt features, flows and general UI patterns (those are not owned by anyone). Never copy or lightly alter anyone's screenshots, artwork, icons, wording, app name or overall look — a "slightly changed copy" is still a copy and gets apps rejected or taken down. All art and copy stay original. Competitor names appear only in docs/MARKET.md, never in the app or store assets.

M2 FEATURE GAPS: turn the top findings into backlog tasks ranked by (how much users want it) × (how cheap to build), each with a one-line reason citing MARKET.md.

M3 iOS-NATIVE REDESIGN: write docs/DESIGN_V2.md first (palette, type scale, radii, shadows, materials, component list, before/after per screen), then migrate screen by screen through the shared components so tests stay green: Apple Human Interface Guidelines look — large titles that collapse on scroll, inset-grouped lists, continuous-corner cards and pill buttons, soft rounded shapes, layered shadows, translucent blur materials, system font weights, springy press animations, haptics; keeps the themes from section F working. Keep Expo Go compatibility and all i18n/RTL rules (d-pad never mirrored).

M4 APP TILES WITH THE REAL LOGOS (owner insists the tiles show "the picture of the company", e.g. Netflix): this is delivered by H3 — when connected, each tile shows the real app icon image the TV itself supplies. Make sure that path covers every platform we drive (Roku, LG webOS, Samsung Tizen where its API exposes icons, Android/Google TV, Fire TV), test it against fixtures, cache icons, show them full-bleed and crisp, and put a short note on the build page explaining that real logos appear as soon as a TV is connected. Bundling or drawing the logos ourselves stays off-limits (App Review and trademark risk).

M5 STORE SCREENSHOTS: refresh the section F screenshot kit using the playbook, with our own headlines and original art.

Finish message for this run: lead with "Couch market research done:" then the 5 most important findings, the proposed price, H1–H3 status, and the top 5 tasks queued. On later runs, if a run changed nothing the owner would notice, keep the finish message to one line.
