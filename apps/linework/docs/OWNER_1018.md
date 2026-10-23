# Owner request 18 Oct 2026: market research + iOS redesign (market-1018)

Arrived as a manual fire of the "Linework build" scheduled task on 18 Oct 2026 (Sydney 18:50). The full message is copied below so later runs keep it. Imported in run 53 as backlog tasks tagged `market-1018`.

---

OWNER REQUEST 18 OCT 2026 — MARKET RESEARCH + iOS REDESIGN (one-time import; skip the import if ops/backlog.json already has tasks tagged "market-1018"). This run, do the import and M1 BEFORE any other backlog work. Copy this whole message into docs/OWNER_1018.md so later runs keep it, then add backlog tasks tagged "market-1018" for M2–M5 that outrank everything except trial blockers and open owner-comment tasks.

Why: the owner looked at competing apps on the App Store and wants proper market research before more building, plus a fresher look: "more bubbly and cute and more like iPhone/iOS". He wants our app to offer what the best competitors offer, done better, for a cheaper price (every tracing tool stays free).

M1 MARKET RESEARCH → docs/MARKET.md. Use WebSearch and WebFetch only (public pages; never work around a site that blocks automated access; do not use itunes.apple.com RSS). Split the fetching across parallel Agent workers (general-purpose; each returns compact findings). Find the 8–12 most popular iOS apps for AR drawing, tracing, sketching from a phone camera and "learn to draw" tracing (apps.apple.com listings for au and us, plus recent roundups). For each record: name, developer, rating and rating count, price and EVERY in-app purchase/subscription price, the features they list (e.g. template libraries and categories, lessons/courses, grid, flashlight, freeze frame, record/time-lapse of the drawing, photo-to-sketch styles, layers, favourites), how their store screenshots are composed (number of shots, headline wording style, colours, device framing — from what the page exposes; say plainly when the images themselves could not be viewed), onboarding and paywall pattern, UI patterns, and the recurring complaints in visible reviews (paraphrase; no quote over 15 words). Then write: a comparison table; "Features most of them have that we lack"; "What users love"; "What users hate" (our openings — e.g. paywalled basics, weekly subscriptions, ads); "UI patterns worth adopting"; "Store screenshot playbook" (what the top listings' first 3 shots say and show); and "Pricing proposal" (free tracing tools, any optional extras clearly cheaper than competitors over a year, one-time not weekly, marked "owner decides"). Add a "Market research" section to the build page summarising MARKET.md (table + top 10 takeaways).

RULES FOR USING WHAT YOU LEARN: adopt features, flows and general UI patterns (those are not owned by anyone). Never copy or lightly alter anyone's screenshots, templates, artwork, icons, wording, app name or overall look — a "slightly changed copy" is still a copy and gets apps rejected or taken down. All art, templates and copy stay original. Competitor names appear only in docs/MARKET.md, never in the app or store assets.

M2 FEATURE GAPS: turn the top findings into backlog tasks ranked by (how much users want it) × (how cheap to build), each with a one-line reason citing MARKET.md. If time-lapse recording of the drawing is common, plan it (Expo Go-compatible path first; native recording behind an adapter).

M3 iOS-NATIVE "BUBBLY" REDESIGN: write docs/DESIGN_V2.md first (palette, type scale, corner radii, shadows, materials, component list, before/after per screen), then migrate screen by screen through the shared components so tests stay green: Apple Human Interface Guidelines look — large titles that collapse on scroll, inset-grouped lists, continuous-corner (squircle) cards and pill buttons, big soft rounded shapes, soft layered shadows, translucent blur materials for bars and sheets, system font weights, springy playful press/selection animations from the existing motion tokens, friendly creative accents, haptics. Template browsing: big rounded category bubbles in a horizontal scroller above a large-preview grid. Keep Expo Go compatibility, the camera/trace screen uncluttered, and all i18n/RTL rules.

M4 STORE SCREENSHOTS: a new store screenshot set following the playbook, with our own headlines and original art.

M5 Keep F3 (better outlines) high — competitors' photo-to-sketch quality is a key comparison point; record in MARKET.md how ours compares.

Finish message for this run: lead with "Linework market research done:" then the 5 most important findings, the proposed price, and the top 5 tasks queued. On later runs, if a run changed nothing the owner would notice, keep the finish message to one line.

---

## How this run read it
- Competitor names live only in docs/MARKET.md (the routine's own rule is "never use competitor names"; the research doc is internal). The build page's market summary refers to apps generically (the leading apps / the #1-ranked app) so names stay out of everything else.
- The D65-2 hold (T54–T60 until the owner's retest) is an overseer directive; this owner request outranks it for market-1018 tasks only. T54–T60 stay held.
