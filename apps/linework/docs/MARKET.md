# Linework market research — iOS AR tracing / drawing apps (18 Oct 2026)

Internal research doc (task M1, `market-1018`). **Competitor names appear only in this file** — never in the app, store listing, screenshots or build page.

**Method.** Five parallel research workers fetched public apps.apple.com listings (US + AU storefronts), two Adobe tracing-app roundups (2026), aggregator pages (similarweb, appshunter, mwm.ai, justuseapp, TapSmart) with WebSearch/WebFetch only. No RSS/lookup APIs; sites that refused automated access (appfollow, a Reddit-only search) were not retried or routed around.

**Limits — read before trusting the numbers.**
- **Screenshots could not be viewed.** Every listing exposed only blank image placeholders (no captions/alt text). One aggregator page (mwm.ai) exposed caption text for one small app. The screenshot playbook below is therefore built from category conventions + published ASO guidance, not from looking at competitors' images.
- Each storefront page shows only ~3–4 reviews; complaint frequencies are rough, cross-checked with roundups and a review-analysis site.
- AU prices are shown as "$" with no currency label (assumed AUD). IAP lists contain many duplicate SKUs (price testing); ranges are shown.
- Chart ranks = Top Free, Graphics & Design, as shown on the listing on 18 Oct 2026.

## 1. The apps (most popular first)

| # | App (developer) | US rating (count) | AU rating (count) | Rank US / AU | Model | US IAP range | AU IAP range |
|---|---|---|---|---|---|---|---|
| 1 | AR Drawing: Sketch & Paint (Digital Solutions Technologies) | 4.5 (94K) | 4.4 (3.3K) | #7 / #9 | ads + weekly/yearly subs, trial | weekly $5–11 (7 SKUs); premium $9/$29; 1-yr Pro $35 | weekly $8–19; premium $14/$49; 1-yr $59 |
| 2 | Artrace: AR Drawing & Sketch (Braly) | 4.7 (74K) | 4.6 (3.3K) | #16 / #24 | ads + subs | weekly $3.99–9.99; yearly $29.99–39.99 | weekly $5.99–14.99; yearly $39.99–59.99 |
| 3 | PicTrace: AR Drawing & Sketch (AvnTech) | 4.6 (59K) | 4.4 (2.9K) | #49 / #74 | ads (ad to enter) + subs | weekly $6.99–24.99; monthly $4.99/$35.99; premium $24.99/$55.99 | weekly $9.99–39.99; monthly $7.99/$59.99; premium $39.99/$89.99 |
| 4 | AR Drawing How to Draw Sketch (Onelight Apps) | 4.7 (~25K) | 4.4 (685) | #106 / – | "Pro" tiers; reviewers say free use isn't limited | $4.99–49.99 (10 SKUs) | $7.99–99.99 |
| 5 | Sketchar (SketchAR UAB) — veteran, lessons + social | 4.2 (9.8K) | 4.1 (519) | #162 / #137 | subs + upsells mid-flow, 3-day trial | weekly $7.99; monthly $14.99–17.99; yearly $29.99–79.99; lifetime $149.99 | weekly $7.99; monthly $27.49; yearly $34.99–129.99; lifetime $229.99 |
| 6 | AR Projector Tracing & Drawing (Aesthetic Apps & Widgets) | 4.3 (6.7K) | 4.2 (511) | #86 / #102 | ads + weekly/yearly; remove-ads $8.99 | weekly $3.99–5.99; yearly $9.99–49.99 | weekly $5.99–9.99; yearly $14.99–79.99 |
| 7 | How to Draw – Drawing Guide (Gorasiya) — learn-to-draw, no AR | 4.4 (4.5K) | 4.2 (173) | – | ads + subs | weekly $4.99; monthly $9.99; yearly $14.99–24.99; lifetime $44.99 | weekly $7.99 … lifetime $69.99 |
| 8 | AR Tracing: Drawing (Tayasui) — Editor's Choice | 4.3 (2.8K) | 4.2 (124) | – (#202 in Mar) | paywall after 1 drawing, $2.99 trial | weekly $2.99–4.99; yearly $49.99–69.99 | weekly $4.99–7.99; yearly $79.99–99.99 |
| 9 | Learn How to Draw Tutorials (L. Veugen) — lessons + AR | 4.4 (1.5K) | 4.3 (87) | – | one-time PRO (listed $39.99; SKUs $6.99–39.99) | $6.99–39.99 | $4.99–34.99 |
| 10 | AR Drawing Sketch: Trace Draw (K. Khokhani) | 4.6 (1.3K) | 4.2 (45) | #206 | ads + subs + coin packs | weekly $5.99; yearly $29.99; premium $5.99/$24.99; coins $1.99–9.99 | weekly $7.99; yearly $49.99 |
| 11 | AR Drawing – Tracing Projector (AppLiks) | 4.6 (1.2K) | 4.4 (28) | – | 3 overlapping sub groups, trials | weekly $2.99–5.99; monthly $11.99; yearly $19.99–39.99 | weekly $4.99–9.99; yearly $29.99–59.99 |
| 12 | Da Vinci Eye (Da Vinci Eye LLC) — artist tool | – (US hidden) | 4.4 (793) | – / #29 | monthly $1.99–9.99; yearly $9.99–39.99 | — | monthly $2.99–14.99; yearly $14.99–79.99 |
| – | Also seen: AR Drawing: Trace to Sketch (Creative Space, 4.5/966, hard paywall $4.99/wk), sketch.AR (new, $0.99/mo, lifetime $6.99–14.99, 1 own photo/day free), Tracely (new, $0.99/wk, $6.99/yr), Adobe's kids app (free) | | | | | | |

### Features per app (✓ = listed in description, release notes or reviews)

| Feature | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | **Linework** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Template library + categories | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (500+) | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ 130, 11 categories (Cute added in T65), levels |
| Anime / cute / chibi category | ✓ | ✓ | ✓ | ✓ | ✓ | (asked for) | ✓ | – | ✓ | – | (asked for) | – | ✓ 20 original (T65) |
| Step-by-step lessons / courses | ✓ (daily) | ✓ 3 levels + video | ✓ | ✓ | ✓ 550+ | ✓ | ✓ | ✓ | ✓ | ✓ 2,500+ | ✓ | ✓ | partial (sketch steps per image) |
| Own photo import | premium | ✓ | premium | ✓ | ✓ | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ free |
| Photo → sketch | ✓ | ✓ | ✓ | – | ✓ | – | – | – | – | – | – | value layers | ✓ 3 styles free |
| Opacity / transparency | – | ✓ | – | – | ✓ | ✓ | – | – | – | – | – | – | ✓ |
| Flashlight | ✓ | ✓ | – | (not at 0.5×) | – | – | – | – | – | – | – | – | ✓ |
| Lock / anchor | – | – | (asked for) | – | – | screen lock | – | ✓ anchor | (asked for) | – | – | card anchor | ✓ lock + touch-lock |
| Grid | – | – | – | – | – | – | – | – | – | – | – | – | ✓ |
| Mirror / flip | – | – | – | ✓ | – | – | – | – | – | – | – | – | ✓ |
| Record / time-lapse | – | ✓ | ✓ | ✓ | ✓ | – | – | – | – | – | – | ✓ | ✓ (10 min, to Photos) |
| Lightbox (screen as light table) | – | – | – | – | – | ✓ | – | – | – | – | ✓ | – | ✓ |
| Favourites | – | – | – | – | – | – | ✓ | – | ✓ | – | – | – | ✓ |
| Portfolio / gallery of finished drawings | – | stats | save | – | ✓ (Pro to reopen) | ✓ | save | save | – | – | journal | – | ✓ My drawings, free (T67) |
| Progress / streak / goals | – | ✓ stats | – | – | ✓ | ✓ | – | – | – | ✓ | – | prompts | ✓ local stats + streak (T69) |
| Before/after compare | – | ✓ | – | – | – | – | – | – | – | – | – | – | ✓ paper check |
| Community / challenges | – | – | – | – | ✓ | – | – | – | – | multiplayer | ✓ feed | ✓ | ✗ (out of scope: no server) |
| Languages | | | | | | | | | | | | | ✓ 11 |
| Ads | yes | yes | yes | ? | upsells | yes | yes | – | – | yes | – | – | **none** |

## 2. Features most of them have that we lack
1. **Anime / cute / chibi / kawaii templates** — in 8 of 12 apps, and its absence is a top complaint where missing. We have zero. (Original art only.)
2. **Guided lessons ("learn to draw" courses)** — in 11 of 12. We have per-image sketch steps but no structured beginner course (shapes → simple objects → animals → faces).
3. **A gallery / portfolio of finished drawings** (snap a photo of your paper, keep it with the template, before/after). In ~6 apps; users are angry when it is locked.
4. **Progress & motivation** — streak, time drawn, lessons done, a 14-day plan. In ~5 apps.
5. **More templates overall and seasonal packs** — leaders advertise 300–2,500+; we have 110.
6. **Tattoo, cars/vehicles, food and lettering-heavy categories** are standard category names across the top apps (we have 4 lettering, no vehicles/food/tattoo).

## 3. What users love
- Easy and quick; beginners feel capable and see themselves improve (very common).
- Tracing **their own photos** (common; requested wherever missing or paywalled).
- Step-by-step lessons; a free tier that is actually usable — the one top app praised for "nothing locked" is rated 4.7.
- Screen lock while drawing, light-table mode, transparency control, portfolio of finished drawings.
- Fast developer replies / steady updates.

## 4. What users hate — our openings
1. **Paywalled basics** (~40% of complaints; in nearly every app): paywall at first launch or after one drawing, own-photo import and the camera tracing itself behind a subscription, trial required, kids/students shut out. → **Linework: every tracing tool free, no trial, no paywall screen.**
2. **Weekly subscriptions and confusing price ladders** (weekly up to US$24.99 / A$39.99; 10+ duplicate SKUs; AU ~1.5–2× US). → **one-time optional extra only.**
3. **Ads** — ad to enter, ads stacked in the photo-to-sketch flow, ads mid-drawing losing progress. → **no ads ever.**
4. **Unstable overlay** (~30–35%): drift, jitter, autofocus hunting when a hand enters frame, losing the paper. → our fixed overlay + lock already avoids "AR drift"; add **focus/exposure lock** and a **freeze frame** (no listing names a true freeze).
5. **Awkward physical setup** — phone height, eye strain, reversed directions, no flashlight at 0.5× zoom. → setup guide, 0.5× lens with torch, dim/contrast mode.
6. **Confusing first use / unlabeled icons / no help** (common). → our captioned controls + 3-card tips; add a 20-second guided first trace.
7. **Lost progress** — saved drawings locked behind Pro, ~50 drawings lost. → local, free, never locked.
8. **Poor photo-to-sketch output** (occasional but loud). → our free 3-style engine (see §8).

## 5. UI patterns worth adopting (patterns, not looks)
- **Category bubbles/chips across the top, big preview grid below** with a level filter (Easy / Medium / Hard) — universal.
- **Before/After view** of the source vs. the outline (one leader); we have the paper check — surface it more.
- **Daily lesson / "today's drawing" card** on Home as a reason to come back.
- **Profile stats** (time drawn, drawings finished) — local only.
- **Tripod / glass / books setup illustration** in onboarding (every app teaches this).
- **Double-tap to refocus** — users discover it themselves; make it explicit (tap-to-focus + focus lock).
- **Watermark-free time-lapse that hides the guide layer** — praised; ours records the camera only, so the overlay is never in the clip.
- **Clear labeled controls** — the opposite of the icon-only bars users complain about.

## 6. Store screenshot playbook
(Competitor images could not be viewed — see Limits. Built from category conventions in descriptions/roundups and published ASO guidance.)
- The first 3 shots carry the listing: they show in search at ~40% size and most visitors never scroll past them.
- **Order:** (1) the outcome — a phone over paper with a hand tracing and the finished drawing; (2) the differentiator — for us "Every tool free. No ads. No subscription."; (3) the top feature — photo → sketch in one tap (before/after). Then templates, lock/steady, time-lapse, languages, lightbox.
- **Captions:** 3–5 words (max 8), benefit-led, verb-first, bold in the top third, ≥4.5:1 contrast, ~72 px+ at 1320 px wide.
- **Colour:** a saturated brand colour or soft gradient (not pure white/black, which melt into the store chrome); differ from neighbouring apps.
- **Framing:** full-bleed camera/lifestyle shots work for AR; use a current device frame for UI shots. 1320×2868 portrait, up to 10 per locale; localise captions (we already ship 11 languages).
- Keep keywords in metadata fields (caption indexing isn't confirmed).
- Never reuse or imitate anyone's screenshot art, wording or layout — our own headlines and original art only.

## 7. Pricing proposal — **owner decides**
Category reality (US): weekly $2.99–9.99 (outliers $24.99), yearly $29.99–39.99 typical (up to $69.99), lifetime rare ($6.99–149.99). A typical leader costs **US$30–40 / A$50–60 per year**, or **US$260–520 / year** on a weekly plan.

Proposal:
- **Free forever:** every tracing tool — camera overlay, own photos, photo → sketch (all styles), lock, grid, flashlight, mirror, lightbox, time-lapse (no watermark), all 130 templates, favourites, languages. No ads, no trial, no account.
- **Linework Plus — one-time US$4.99 / A$7.99** (as in PLAN): extra original template packs (e.g. Cute & Chibi pack, Seasonal), app themes/icons, supporter badge. Never gates a tracing tool. That is ~85% cheaper than one year of a typical leader, and it's paid once.
- **Optional tip jar** US$1.99 / 4.99 / 9.99.
- Alternative for the owner to weigh: keep the first Cute pack free (it fixes the #1 content complaint) and sell only later packs.

## 8. How our photo-to-sketch compares (M5)
- Competitors: photo-to-sketch is listed by ~5 of 12 apps, usually premium or behind ads; reviews of the #3 app call the output poor; none advertise multiple styles or adjustable detail.
- Linework (F3, run 47 metrics on synthetic fixtures, recall within 2 px): Line art R 1.00 shapes / .93 portrait / 1.00 text with 0 specks at ~95 ms (1024×768, desktop Node); Sketch (XDoG) and Bold styles; Detail + Line weight sliders; dark-paper invert; all free.
- We cannot run competitors' engines, so no head-to-head metric exists. The honest claim is: "three free styles with adjustable detail" vs. "one premium filter". F3 stays high: next steps are the owner's style pick (T55) and a real-photo fixture test (T16). True subject cut-out needs a native module (T53).

### Outline metrics 19 Oct (T78)
Real-photo-like synthetic fixtures (`src/core/photoFixtures.ts`, 160–192 px, generated in code): fine hair strands over a gradient, fur texture on a cat silhouette, a dim low-contrast portrait with sensor noise, a backlit silhouette with rim light, and JPEG-style 8×8 block artefacts. Locked by `src/core/photoMetrics.test.ts`. R = edge recall, P = precision (within 2 px; Bold 4 px), sp = specks (< 12 px blobs), cov = inked share; runtime is desktop Node per 160–192 px image (phones ~3–5× slower).

| fixture | classic (Best match) | Line art | Sketch (XDoG) | Bold lines |
|---|---|---|---|---|
| hair | R 1.00 P 1.00 sp 0 · 6.6% | R 1.00 P 1.00 sp 2 · 12.1% | R .99 P 1.00 sp 5 · 9.7% | R 1.00 P 1.00 sp 1 · 12.1% |
| fur | R .89 P .80 sp 28 · 2.2% | R .99 P .60 sp 3 · 3.8% | R .95 P .83 sp 47 · 2.6% | R 1.00 P .90 sp 1 · 2.8% |
| low light | R .29 P 1.00 sp 4 · 0.6% | R .82 P 1.00 sp 1 · 2.6% | R .76 P .94 sp 9 · 4.3% | R .82 P 1.00 sp 0 · 2.6% |
| backlit | R .78 P .88 sp 2 · 1.7% | R .81 P .88 sp 0 · 1.8% | R .85 P .92 sp 2 · 3.4% | R .81 P .95 sp 0 · 1.7% |
| JPEG blocks | R .99 P 1.00 sp 0 · 1.9% | R 1.00 P 1.00 sp 0 · 2.2% | R .94 P 1.00 sp 3 · 2.8% | R 1.00 P 1.00 sp 0 · 2.2% |
| runtime | ~35–95 ms | ~7–35 ms | ~4–11 ms | ~6–15 ms |

- **Tuning made:** Sketch now widens its XDoG sigma (up to 2×) when grain is large next to the picture's contrast (dim, flat photos). Low light before → after: R .85 → .76, P .73 → .94, specks 76 → 9 (F1 .78 → .84); at 3× size R .71 → .85, P .99 → 1.00. All other fixtures are unchanged (normal and heavy-grain photos sit below the trigger).
- **Weak spots, locked so they can only improve:** the classic v2 engine loses most of a dim portrait (R .29; its smoothing and floors are absolute, so 30-grey-level edges are treated as grain; a contrast-stretch try raised recall but tripled noise specks at 3× size, so it was not shipped). Line art draws fur texture (P .60). No style finds the eyes inside a silhouetted face.
- **For T55 (owner's style pick):** Line art and Bold are the steadiest across these hard cases (no fixture below R .81, ≤ 3 specks); Sketch is best on backlit and soft subjects; classic is clearly behind in low light. **The default style is NOT changed yet**: it stays as is until the owner's T55 retest picks one.

## 9. Top 10 takeaways
1. The leaders win with **cute/anime templates + lessons + own-photo tracing**; we have photos and outline styles but no cute category and no course.
2. **Paywalls are the #1 complaint** in almost every app — "free, no ads, no subscription" is our headline differentiator.
3. Typical cost is **US$30–40/yr** (A$50–60), weekly plans up to US$9.99+/wk; a **one-time US$4.99 Plus** is ~85% cheaper.
4. **Overlay drift / refocus** is the #2 complaint → focus lock + freeze frame are cheap wins.
5. **Grid, mirror and favourites** are almost absent from listings — we already have them; say so in screenshots.
6. **Time-lapse recording is common** (≥5 apps); ours exists — make it watermark-free and visible in the store.
7. Users lose work → a **free local gallery** of finished drawings (photo + template) is wanted.
8. **Confusing first use / icon-only controls** recur → keep captions, add a guided first trace.
9. Store pages lead with the outcome (drawing on paper) — our first 3 shots: outcome, "free, no ads", photo → sketch.
10. AU prices run 1.5–2× US in this category; our A$7.99 one-time price is a strong local message.

## Sources
- App Store listings (us/au): id6448484908, id6475700817, id6504559449, id6451340162, id1221482822, id6450824634, id1428780100, id6451083449, id6444159896, id6450619018, id6450997517, id1120304868, id6478019368, id6740991994, id6475957106, id6474591968, id6752279880, id6782813809 (https://apps.apple.com/{us,au}/app/id<ID>)
- https://aqua.adobe.com/learn/ar-drawing-apps · https://aqua.adobe.com/learn/tracing-apps
- https://www.tapsmart.com/apps/ar-apps/review-sketchar-learn-draw-ar
- https://justuseapp.com/en/app/1221482822/sketchar-create-art-draw-paint/reviews
- https://similarweb.com/app/apple/6450619018 · https://www.similarweb.com/app/apple/6450824634/chile/ · https://appshunter.io/ios/app/ar-drawing-tracing-projector/id6450997517/similar
- https://mwm.ai/apps/tracely-ar-draw-sketch/6782813809 · https://mwm.ai/apps/lifetime-ar-draw/6782957175
- https://www.techmagnate.com/blog/app-store-screenshots-optimization/ · https://trysonar.app/blog/app-store-screenshot-captions

## Status after run 53
Built from this research the same day: T64 focus lock while locked (§4.4), T65 Cute & chibi category (§2.1), T66 4-step setup guide (§4.5–4.6), T67 My drawings gallery (§2.3), T69 local progress (§2.4). Queued: T68 beginner course, T70 time-lapse adapter, T71 more categories, T74–T77 redesign + store screenshots, T78 outline quality.

## Design reference 18 Oct
One-time import from the owner's own look at the App Store listings of the top theme-widget and TV-remote apps (18 Oct 2026, task prompt). He wants Linework spruced up with the same level of polish. These are patterns, not looks: nothing is copied; all art, headlines and layouts stay original, no competitor names, no download badges or ranking claims until they are real.

### 1. Store screenshots (folded into T77)
- One feature per shot, short bold headline at the top.
- Two styles worth testing: **(a)** big serif headline on a soft pastel gradient, tilted phone, elements "bursting" out of the frame (floating cut-out cards, sparkles); **(b)** bold rounded sans headline with one strong brand colour across the whole set.
- Devices they use: a real hand/finger on the screen, concentric ripple rings on touch, enlarged pop-ups (a control blown up beside the phone), hand-drawn curved arrows linking the phone to the result.
- For Linework: a hand holding a pencil tracing on paper under the phone; the outline "Before → After" photo-to-sketch; templates grid; "Every tool free"; lessons/steps; the opacity slider blown up with its % bubble; languages.

### 2. In-app (folded into T74–T76, new ref-1018 tasks)
- Bottom tab bar with clear icons (Trace / Templates / My drawings / Settings) in the bubbly iOS look → **T81**.
- Category bubbles or sub-tabs (New, Animals, Flowers, Cute & chibi (our original anime-style set), Letters, Seasonal…) above a 2-column grid of tall rounded preview cards with soft shadows → T75.
- A large preview/detail sheet with one big primary button ("Start tracing") → **T82**.
- A designed "nothing here yet" empty state with one clear action → **T86**.
- Pill chips; big rounded primary buttons in one brand colour; soft pastel section backgrounds behind white cards; generous spacing; springy press feedback → T74–T76 (DESIGN_V2 §6 components already cover these).

### 3. Premium detail touches
- Ripple on tap; enlarged control pop-ups while dragging sliders → **T84**.
- Step indicator with ticks for multi-step flows (Pick image → Outline → Trace) → **T83**.
- A success moment when a drawing is finished (optional time-lapse save later) → **T85**.

## 10. Monetisation options for the owner (fb-1022b B5, 22 Oct) — **owner decides**

Every tracing tool stays free in all three options (camera overlay, opacity, lock, grid, mirror, outline mode, own photos, lightbox, timelapse basics) — that is Linework's hook and a hard rule. Only extra template packs and cosmetic extras can sit behind a purchase.

| | Yearly ~A$3–4 (≈ US$1.99–2.49) | One-time "Linework Plus" A$7.99 (US$4.99) | Ads |
|---|---|---|---|
| Fits the pitch "no weekly subscription, ever" | Weak: still a subscription, and the store shows it next to the competitors' A$40–60/yr plans | **Strong**: "pay once" is the opposite of what reviewers hate | Poor: "ads that are hard to close" is a top complaint; also kills the "Data Not Collected" label (ad SDKs collect identifiers) |
| App Store rules | Auto-renewing subscriptions must give ongoing value (3.1.2): we'd need new packs on a schedule; Apple keeps 15 % (Small Business Program) | Non-consumable IAP, simple; restore purchases required; 15 % | Allowed, but needs ATT prompt + privacy label changes; kids-oriented content limits ad networks (Kids category rules if we ever list there) |
| Expected conversion (rough, category norms) | 1–3 % of active users; low price → ~A$2.60/yr net each; churn ~50 %/yr | 2–5 % of active users; ~A$6.80 net once | Low eCPM for a tool app used offline on a stand; ~A$0.50–2 per 1 000 sessions |
| Revenue per 10 000 active users (illustration only) | ≈ A$500–800/yr | ≈ A$1 400–3 400 once, plus new users each year | ≈ A$100–400/yr |
| Work needed | IAP + subscription status, a pack release cadence | IAP + restore (task T60, needs App Store Connect) | Ad SDK (not Expo Go compatible), consent flows |

**What could sit behind Plus:** the fb-1022b expansion packs — e.g. half of the Kawaii batches, the Linework cast pieces (Pip, Nova, Quill, Ottoline, Sage, Bramble, Fern, Mossy), advanced scenes in Movie night / Fairy tales / Sea life — plus themes and app icons. Keep a generous free set (~200+ templates incl. beginner pieces in every category) so the free app already beats competitors' paywalled libraries.

**Recommendation (owner decides): one-time Linework Plus at A$7.99 / US$4.99 with an optional tip jar, no ads, no subscription.** It matches the brand promise, keeps "Data Not Collected", needs the least ongoing obligation, and a growing pack library gives people a reason to buy without a renewal. A yearly fee only makes sense later if we commit to monthly new packs.
