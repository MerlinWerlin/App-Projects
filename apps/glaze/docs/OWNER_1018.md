# Owner request 18 Oct 2026: market research + iOS redesign

Imported in run 50 (2026-10-18) from a manual run of the "Glaze build" scheduled task. Backlog tasks are tagged `market-1018`. The message is copied here unchanged:

---

OWNER REQUEST 18 OCT 2026 — MARKET RESEARCH + iOS REDESIGN (one-time import; skip the import if ops/backlog.json already has tasks tagged "market-1018"). This run, do the import and M1 BEFORE any other backlog work. Copy this whole message into docs/OWNER_1018.md so later runs keep it, then add backlog tasks tagged "market-1018" for M2–M5 that outrank everything except trial blockers and open owner-comment tasks.

Why: the owner looked at competing theme apps on the App Store and wants proper market research before more building, plus a fresher look: "more bubbly and cute and more like iPhone/iOS". He wants our app to offer what the best competitors offer, done better, for a cheaper price.

M1 MARKET RESEARCH → docs/MARKET.md. Use WebSearch and WebFetch only (public pages; never work around a site that blocks automated access; do not use itunes.apple.com RSS). Split the fetching across parallel Agent workers (general-purpose; each returns compact findings). Find the 8–12 most popular iOS apps for icon themes, widget themes, aesthetic home screens and live/animated wallpapers (apps.apple.com listings for au and us, plus recent "best widget/theme app" roundups). For each record: name, developer, rating and rating count, price and EVERY in-app purchase/subscription price, the features they list, how their store screenshots are composed (number of shots, headline wording style, colours, device framing — from what the page exposes; say plainly when the images themselves could not be viewed), onboarding and paywall pattern, UI patterns (how categories are browsed, card styles, widgets, how themes are previewed and applied), and the recurring complaints in visible reviews (paraphrase; no quote over 15 words). Then write: a comparison table; "Features most of them have that we lack"; "What users love"; "What users hate" (our openings); "UI patterns worth adopting"; "Store screenshot playbook" (what the top listings' first 3 shots say and show); and "Pricing proposal" — clearly cheaper than the main competitors over a year, keeping one-time Glaze Plus rather than weekly subscriptions, marked "owner decides". Add a "Market research" section to the build page summarising MARKET.md (table + top 10 takeaways).

RULES FOR USING WHAT YOU LEARN: adopt features, flows and general UI patterns (those are not owned by anyone). Never copy or lightly alter anyone's screenshots, theme artwork, icons, wallpapers, wording, app name or overall look — a "slightly changed copy" is still a copy and gets apps rejected or taken down. All art and copy stay original. Competitor names appear only in docs/MARKET.md, never in the app or store assets.

M2 FEATURE GAPS: turn the top findings into backlog tasks ranked by (how much users want it) × (how cheap to build), each with a one-line reason citing MARKET.md.

M3 iOS-NATIVE "BUBBLY" REDESIGN: write docs/DESIGN_V2.md first (palette, type scale, corner radii, shadows, materials, component list, before/after per screen), then migrate screen by screen through the shared components so tests stay green: Apple Human Interface Guidelines look — large titles that collapse on scroll, inset-grouped lists, continuous-corner (squircle) cards and pill buttons, big soft rounded shapes, soft layered shadows, translucent blur materials for bars and sheets, system font weights, springy playful press/selection animations from the existing motion tokens, cheerful pastel-forward accents, haptics. Keep Expo Go compatibility and all i18n/RTL rules.

M4 GLAZE BROWSING + WIDGETS (owner's specific asks): (a) Theme home: a horizontally scrolling row of BIG, cute category bubbles (large rounded tiles with original artwork + label, snap scrolling, the selected bubble grows and glows); choosing a category re-flows a showcase grid of large theme previews below with a smooth animated transition; swipe back and forth between categories. (b) Matching widgets: every theme gets a matching widget set (clock, date/calendar, photo, quote/countdown, battery-style) in small/medium/large, auto-generated from the theme's tokens, plus a Widget Studio where the user can tweak text, photo and colours. The in-app widget preview must work in Expo Go; real iOS widgets come from the existing WidgetKit target through the app group in a TestFlight build — never claim device testing.

M5 STORE SCREENSHOTS: a new store screenshot set following the playbook, with our own headlines and original art.

Finish message for this run: lead with "Glaze market research done:" then the 5 most important findings, the proposed price, and the top 5 tasks queued. On later runs, if a run changed nothing the owner would notice, keep the finish message to one line.

---

## Build-run notes
- Competitor names appear only in `docs/MARKET.md`. The build page summary labels apps by segment (for example "Widget app A"), following the routine's hard rule never to use competitor names elsewhere.
- Not tested on a real device.
