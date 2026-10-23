# Market research: iOS icon themes, widget themes and live wallpapers

M1 of the owner's 18 Oct request (docs/OWNER_1018.md). Researched 2026-10-18 by four parallel workers using WebSearch/WebFetch on public pages only: apps.apple.com listings (us and au) and nine roundups from 2025–26, plus one from 2024. Sites that blocked or failed a fetch were skipped, not worked around. The itunes RSS/lookup APIs were not used.

> **Competitor names stay in this file only.** Never put them in the app, the store listing, screenshots or the build page. Adopt features, flows and general UI patterns. Never copy or lightly alter anyone's screenshots, artwork, icons, wallpapers, wording, name or overall look. All Glaze art and copy stay original.

## What could not be verified
- **No store screenshot images could be viewed.** On every listing, screenshots came through as blank placeholder slots with no captions or alt text. Shot counts below are placeholder counts (usually 5–6). Headline wording, colours and device framing of competitors' shots are **not verified**.
- Onboarding and paywall patterns come from description text, roundups and visible reviews, not from screens we saw.
- Most in-app purchase rows are labelled only "Premium" or "Pro" without a period. Where a period isn't stated, the price is shown as a range.
- AU prices are listed without a currency symbol (presumably AUD). Duplicate product names at different prices look like A/B tests or regional tiers.
- Not tested on a real device (nothing in this research needed it).

## Comparison table
US storefront unless marked. Ratings were read on 2026-10-18.

| App (developer) | Segment | Rating (count) | Model | Prices seen (US; AU in brackets) |
|---|---|---|---|---|
| Widgetsmith (Cross Forward Consulting) | Widgets + wallpapers | 4.6 (776K); AU 4.5 (47K) | Free + Premium subscription (monthly/annual), ads | $1.99 / $3.99 / $19.99 / $29.99 (AU 3.49–49.99); $1.99/month per one roundup |
| Color Widgets (Digital Charms) | Widgets + themes + icon packs | 4.6 (527K); AU 4.5 (41K) | Free + Pro subscription, 3-day trial, ads | Pro $4.99–$49.99 (AU 5.99–79.99); yearly works out at about $2.50/month |
| Themify (AIBY) | 3-in-1 themes (icons + widgets + wallpaper) | 4.6 (345K); AU 4.5 (18K) | Free + **weekly** or annual membership, ads | 10 "Premium" rows, $4.99–$29.99 (AU 7.49–31.99) |
| MyScreen (VSP Technologies) | Live / 4K wallpapers + widgets + icons | 4.5 (311K); AU 4.4 (21K) | Weekly / annual with trial, ads + rewarded video | $4.99–$34.99 (AU 6.99–40.99) |
| Brass (Brass) | Icon themes + widgets | 4.6 (188K) | Weekly / annual; ad unlocks | $1.49–$39.99, periods unlabelled |
| Wallcraft (VOLKRAFT) | Wallpapers incl. live and "double" lock + home pairs | 4.6 (164K); AU 4.4 (4.2K) | Cheap PRO; ads and coins earned by watching ads | Description: $4.99/year or **$12.99 forever** (AU 1.49–39.99) |
| Aesthetic Kit | Themes | (126K) | Not fetched | Not verified |
| intoLive (ImgBase) | Video/GIF to live wallpaper editor | 4.6 (114K); AU 4.5 (4.9K) | Subscription with trial | Weekly $3.99, monthly $9.99, annual $29.99, lifetime $69.99 (AU 5.99 / 14.99 / 49.99 / 99.99) |
| ScreenKit (Twinstar Creatives, AU) | Icon changer + widgets | 3.9 (55K) | Mix of one-time unlocks and subscriptions | Unlock Everything $14.99; All Icons & Widgets $9.99; ScreenKit+ monthly $9.99; offers $4.99–$49.99 |
| WallPics (IgKnight) | Live wallpapers 4K | 4.7 (52K); AU 4.6 (2.6K) | 3-day trial into weekly / yearly, ads, watermark | Weekly $3.99–$7.99, yearly $24.99–$34.99 (AU yearly up to 59.99) |
| Widgy (Woodbury Ltd) | Pro widget builder | 4.6 (26K) | One-time slot packs, no subscription | $7.99 per slot pack, $0.99 XL, tips |
| Icon Themer (FLOWMATIC) | Icon themes + icon maker | 4.2 (14K) | Weekly / monthly / yearly + lifetime; ad unlocks | Weekly $3.99–$4.99, monthly $6.99–$8.99, yearly $9.99–$19.99, lifetime $15.99–$19.99 |
| Themes 15 (Cardiio / Atlant) | Icon packs | 4.5 (15K) | Mostly one-time unlocks + $9.99/month | Unlock All Themes $11.99–$19.99; single theme $4.99–$7.99 |
| WidgetClub (Liume) | Cute themes + widgets | 4.7 (2.6K US; volume likely in another storefront) | Weekly / monthly / yearly + per-theme + "Forever" | Week $4.99, month $9.99, year $24.49; packs $29.99–$34.99; forever $59.99–$124.99 |

How often each app appears across nine roundups: Widgetsmith 7, Widgy 4, ScreenKit 3, a home-screen launcher app 3, Themify 2 (+1 from 2024), Color Widgets 2. In live wallpapers, each app appeared in only one list, so **no app clearly leads live wallpapers**.

## Per-app notes (features · paywall · UI · complaints · praise)
- **Widgetsmith:**
  - Features: one widget at a time (photo, clock, countdown, sun/moon, weather), schedule-based widgets, Lock Screen widgets, wallpaper matching, a newer "Inspo" ideas tab.
  - Paywall: weather and tides are Premium.
  - Complaints: features moved to a monthly plan, blank widgets, random photos, a label under every widget, taps open the app instead of the target.
  - Praise: deep customisation, a usable free tier.
- **Color Widgets:**
  - Features: many widget kinds (music, calendar, quote, battery, health), "15,000+ themes" with one-tap packs, icon packs through Shortcuts.
  - Paywall: trial-led, plus ads to unlock items.
  - Complaints: "free" themes contain Pro-only icons, the same ad repeats, own-photo icons are locked, no font colour.
  - Wanted: video widgets and dynamic wallpapers.
- **Themify:**
  - Features: "3-in-1" Home + Lock themes applied in one tap, browsed by mood categories (kawaii, neon, anime), a widget maker and theme maker, StandBy widgets, live wallpapers, a Liquid Glass redesign and an iOS 27 collection.
  - Paywall: shown at once, with a close X that is hard to see; premium items are hard to tell apart.
  - **A reviewer reports that configuration-profile icon install was removed under App Store rules, so icons are now set one by one in Shortcuts.** Other complaints: slow launches, the wrong app opening, items that were free becoming paid.
  - Praise: matching Home and Lock, frequent drops, step-by-step guides.
- **MyScreen:**
  - Features: 4K and live wallpapers, an AI generator, apply to Lock / Home / both, widgets, icon packs, Watch faces, StandBy, charging animations, keyboards, seasonal packs.
  - Complaints: long, frequent ads; price; glitches; saving an icon set saves only the wallpaper, so icons must be saved one by one; only one holiday pack is free.
- **Wallcraft:**
  - Features: about 30 categories, "double" matched lock + home wallpapers, parallax and per-device crops, live wallpapers, new content hourly.
  - Paywall: a cheap one-time PRO that reviewers call fair and worth it.
  - Complaints: older 30-second ads, crashes in big collections, no search by designer.
- **intoLive:**
  - Features: a full 9:16 video editor (clips, effects, text, stickers, music) exporting to Live Photo.
  - Complaints: quality loss, breakage after iOS updates, features removed, privacy worries.
  - Praise: easy to use; the free kit is often enough.
- **WallPics:**
  - Features: matched lock + home sets, a DIY studio, charging animations, photo widgets.
  - Complaints: AI filler, NSFW and offensive items, ad close buttons that don't work, charges after cancelling a trial, watermarks, lag.
- **ScreenKit:**
  - Features: claims bulk icon install without Shortcuts (method not stated), a widget maker, editable templates.
  - Complaints: duplicate icons beside the real apps, a roughly $10 prompt when trying a second theme, freezes and battery drain, no developer replies.
  - Praise: a full restyle in about 15 minutes.
- **Icon Themer:**
  - Features: an icon maker (shape, colour, background) with an instant Home Screen preview.
  - Paywall: about 3 free creations, ad unlocks that sometimes fail.
  - Complaints: some icons don't launch their app; the messages icon opens a new chat.
  - Praise: the roughly $16 lifetime unlock is called fair.
- **Themes 15:**
  - Flow: pick a theme, download it, then build one Shortcut per app.
  - Complaints: launch delay, no notification badges, can't make or request icons, banking apps missing, setup is tedious.
  - Praise: hand-made, attractive icons.
- **WidgetClub:**
  - Features: cute designs, 16+ widget types (GIF, video, memo), a video-to-live wallpaper maker, charging animations.
  - Complaints: couldn't cancel the trial inside the app, own live wallpapers play only about 0.5 s on the Lock Screen, blank search, lag, about $25/year felt steep.
- **Widgy:**
  - Features: a pro widget builder with community layouts and a Liquid Glass look plus a "real transparency" toggle (Nov 2025).
  - Reviewers praise that it has no subscription.

## Features most of them have that we lack
1. **Matching widget sets per theme** (clock, date/calendar, photo, quote/countdown, battery) for Home, Lock and StandBy. Every 3-in-1 app has them; we have only a WidgetKit target and no theme-matched set. This is M4b.
2. **One-tap "3-in-1" apply** (icons + widgets + wallpaper for Home and Lock together). We apply icons and the wallpaper but not widgets, and we don't treat lock + home as one set.
3. **Matched Lock + Home wallpaper pairs** ("double" wallpapers): a blurred or shifted home version made from the lock version.
4. **A large, frequently refreshed catalogue with mood categories** (kawaii/cute, neon, anime-style, dark, minimal, seasonal). We have categories and seasonal collections; our catalogue is small and theme packs are not hosted yet.
5. **Charging animations, StandBy screens, Watch faces and keyboards** (MyScreen, Themify, WallPics, WidgetClub). These are lower priority; charging animations need Shortcuts automations.
6. **A Theme Maker / DIY studio** for making and saving your own full theme (WallPics, Themify). Our Icon Studio covers icons; a full theme maker builds on it.
7. **An inspiration feed** of ready-made home screen setups ("Inspo", community layouts).
8. **Liquid Glass-style themes and transparent widgets** for iOS 26 (Widgy, Themify, Mico).
9. **A video-to-live-wallpaper editor with text and stickers.** intoLive owns this niche; our Live tab does trim and crop only. This is a nice-to-have.

## What users love
- Coordinated packs where icons, widgets and wallpaper all match on Home and Lock.
- A fast makeover ("restyled in about 15 minutes").
- Cute, kawaii, anime-style and seasonal content with frequent new drops.
- Clear step-by-step guides and tutorials.
- A real free tier, and **one-time or cheap unlocks** called fair (Wallcraft forever, Icon Themer lifetime, Widgy, Widget Wizard). One reviewer said outright they would rather pay once.
- Deep customisation for those who want it, and good quality, fast-loading content.

## What users hate (our openings)
1. **Weekly subscriptions and a maze of about 10 unnamed price tiers.** Glaze has one clear one-time price.
2. **Ads, above all one ad per icon or item**, ads that fail, and close buttons that don't work. Glaze has no ads, ever.
3. **Paywall dark patterns:** a hidden close X, paywalls at launch, unclear premium badges, "free" themes with paid parts, being charged after cancelling a trial, content re-locked on a new phone. Glaze: the paywall is always easy to dismiss, Plus items are labelled before you tap, free means fully free, and restore purchases is always available.
4. **Icon install friction:** one Shortcut per app, slow launches, the wrong app opening, no badges, duplicate icons, hard to undo. Glaze has bulk install plus an honest guide and a clear "how to undo". See the profile risk below.
5. **Missing icons for niche apps** (banking and others) and no way to request icons. Glaze has a catalogue, the unsupported-app workflow, own-photo icons and a generic glyph or monogram fallback.
6. **Live wallpapers that break or play only briefly**, quality loss, and battery drain. Glaze is honest about iOS limits, has Live Lock Screen on iOS 26 and an off switch.
7. **AI filler and NSFW or offensive content**, in apps that children use. Glaze has a curated, original, family-safe library.
8. Widgets that go blank or open the wrong app, and dated interfaces that ignore iOS 26.

## Risk found: bulk install through a configuration profile
**T60 check, 2026-10-18 (WebSearch/WebFetch, public pages only). Verdict: real but unconfirmed risk. Ship the profile method behind the switch `PROFILE_INSTALL_ENABLED` in `src/config/install.ts`.**

What prompted it: a Themify reviewer, and the developer's reply, say its profile-based icon install was removed "under App Store rules". ScreenKit still claims bulk install "without Shortcuts" but doesn't say how.

**What the current App Review Guidelines say** ([developer.apple.com/app-store/review/guidelines](https://developer.apple.com/app-store/review/guidelines/), read 2026-10-18):
- **5.5 Mobile Device Management** is the only guideline that names configuration profiles. It says apps that **offer configuration profiles must also meet the MDM requirements**. Those are: the MDM capability is requested from Apple; it is limited to businesses, schools and government, with narrow parental-control and security exceptions; plus data-use disclosure and a privacy policy. Glaze is a consumer app and cannot meet the eligibility part. Read literally, an app that offers a `.mobileconfig` (even one that holds only web clips) falls under 5.5. This is the most likely rule behind the reported removal.
- **2.5.2** (no downloading or installing code that adds features or other apps). A web-clip profile is configuration, not code. But a recent forum case shows reviewers can read the word "install" broadly. In that case (May 2026) a 2.5.2 rejection was triggered by user "templates" the app let people "install" ([forum thread 826166](https://developer.apple.com/forums/thread/826166)). Low to medium risk, mostly about wording.
- **2.5.8** (alternate home screen environments are rejected) and **2.5.9** (apps must not alter native UI elements or behaviours). Web clips sit on the real Home Screen and don't replace it, so they probably don't apply. A reviewer could still read "theme the whole Home Screen" that way. Low risk.
- **2.4.4** (don't ask people to change system settings unrelated to the app's core function). The profile flow sends people to Settings > General > VPN & Device Management. It's arguably core to the feature, but reviewers may see it as a settings change. Low to medium risk.
- **4.2.2** mentions "web clippings", but it means apps that are mainly wrappers around a website. It doesn't cover Home Screen web clips. Not relevant.
- Not found anywhere in the guidelines: the words "web clip", "mobileconfig", or any rule naming icon or theme apps.

**Public precedent:**
- Launch Center Pro added custom Home Screen icons "without Shortcuts" through configuration profiles in Oct 2020 and stayed on the store ([9to5Mac, 2020-10-19](https://9to5mac.com/2020/10/19/launch-center-pro-now-lets-you-change-ios-app-icons-without-using-shortcuts/)). That is **old precedent**: it predates the current 5.5 wording we read today, so it is not a guarantee.
- We found **no public App Review rejection notice or Apple statement** about a theme or icon app and profiles. The only public evidence of enforcement is the Themify review reply above, which is one second-hand line.
- The MDM forums show managed web clips can get stuck on the Home Screen after the profile is removed, and on some devices the stuck icons come back on restore from backup ([forum thread 722832](https://developer.apple.com/forums/thread/722832)). That case was a profile marked non-removable and pushed by an MDM server. Glaze's profile sets `IsRemovable` true and `PayloadRemovalDisallowed` false, so it should not hit this. Not verified on a device.

**Uncertain:**
- Whether App Review applies 5.5 to an on-device, unsigned profile that holds web clips only. Not stated publicly.
- Whether the competitor's removal came from a rejection, a warning, or caution on their side.
- Whether TestFlight external beta review flags it. That review is lighter than full App Review, but it uses the same guidelines.

**Decision and recommendation:**
- Keep `PROFILE_INSTALL_ENABLED = true` for TestFlight, so the owner can compare both methods.
- **Set it to `false` for the first App Store submission.** Turn it back on in an update only after asking App Review directly (App Store Connect > Contact Us, or a note on a resubmission), or if the owner accepts the risk of rejection.
- With the switch off, /install offers only the guided Shortcuts method. It keeps its step-by-step guide, the Photos album, per-app link copy, a checklist and a "To undo later" card. The profile-only tips are hidden. No data migration is needed.
- Review notes are in `docs/REVIEW_NOTES.md`.

## UI patterns worth adopting (patterns, not looks)
- **Browse by mood or category** with big tappable category tiles, then large previews of whole themes. This is the owner's M4a "bubbles".
- **Full-screen theme preview** with Home and Lock mocks before applying, plus one clear "Apply" that walks through the steps.
- **3-in-1 apply checklist:** wallpaper, icons, widgets, each with a tick.
- **A widget gallery by size** (small / medium / large) with a live preview on a mock Home Screen.
- **"Choose which icons to update"** before installing.
- **Premium badges visible on cards**, never discovered only after tapping.
- **Seasonal and holiday rows** that appear around the event (we have the logic).
- **An "Inspo" row** of complete ready-made setups.
- **Liquid Glass-friendly options:** transparent widget style and contrast-aware wallpaper pairing.

## Store screenshot playbook
**The top listings' screenshot images could not be viewed** (blank placeholders, no captions), so this playbook does **not** say what their first 3 shots show. It is built from what was exposed (5–6 shot slots per top listing, store subtitles) and from what reviews praise and resent.
- Subtitles lead with outcome nouns: "widgets + themes + wallpapers", "aesthetic custom home screen", "custom icon themes".
- Use 6 portrait shots. Every shot shows a full original Home or Lock Screen inside a device frame, with one short headline of 3–7 words on top and a pastel background matching the theme in the shot.
- **Shot 1, the hook:** the owner's line "Themes, icons and live lock screens. One price. No weekly subscription." over a hero Home Screen in our most striking original theme.
- **Shot 2, matching sets:** Home + Lock side by side with matching icons, widgets and wallpaper ("Everything matches").
- **Shot 3, the moving Lock Screen:** a Live Lock Screen frame with a playful motion cue ("Your lock screen, alive").
- Shots 4–6: make your own icons from your photos; install them all at once; cute, seasonal and mood categories, with "No ads. Pay once." repeated in small type.
- All headlines and art are original (M5); no competitor wording; no Apple logos or icons.

## Pricing proposal (owner decides)
Competitors over a year (US): weekly plans at $3.99–$7.99 add up to **$200–$400 a year**; annual plans run **$19.99–$49.99**; the few lifetime prices are $12.99 (Wallcraft), $15.99–$19.99 (Icon Themer), $14.99 (ScreenKit "Unlock Everything") and $69.99 (intoLive).

**Proposal: keep the plan's one-time Glaze Plus at US$4.99 / A$7.99**, with a ceiling of US$7.99 / A$12.99 if the owner wants more margin. Even the ceiling is below the cheapest lifetime price found and below one month of most competitors. There are no weekly, monthly or annual plans, no ads, and no "special offer" tiers. A tip jar is optional.

The free tier stays generous, which is what reviewers reward: make-your-own icons, bulk install, the starter themes, Live Lock Screen with your own video, and one matching widget set per free theme. Plus adds all theme packs (downloadable), every widget style, extra glyph sets, Live Lock playlists and future seasonal packs at no extra cost.

**Owner decides:** the final price, whether seasonal packs stay included in Plus, and whether to run a launch discount.

## Top 10 takeaways
1. Weekly subscriptions dominate; one clear one-time price is our sharpest point of difference.
2. Ads, especially per-item ad unlocks, are the most hated thing in the category; Glaze ships no ads.
3. Paywall dark patterns are named in reviews; a dismissible paywall with honest labels earns trust.
4. Icon install friction is the biggest pain; our bulk install and guided flow are the core advantage.
5. Profile-based icon install may face App Review rules (one leader dropped it), so check it before release.
6. Matching widget sets are table stakes for 3-in-1 apps, and we lack them (M4b).
7. Users browse by mood (cute, neon, anime-style, dark, seasonal) and want big previews (M4a).
8. Live wallpapers are fragile on iOS and no app leads them; Live Lock Screen on iOS 26 is an opening if we're honest about the limits.
9. Liquid Glass / iOS 26 looks are now a selling point, and several leaders look dated (M3).
10. Curated, original, family-safe content stands out against AI filler and NSFW items.

## Owner screenshots 18 Oct

The owner sent 20 App Store screenshots of four top competing theme/widget apps on 18 Oct 2026. The build run could not see the images; this section is the owner's own description of them, recorded as given, plus the lessons the build takes from it. The owner identified the apps by icon, not by name, so they are labelled App A–D here. This closes the earlier gap "No store screenshot images could be viewed" for these four apps (the gap still applies to the rest of the comparison table). Ratings and ranks below are what the owner saw on the screenshots/listings, not re-verified by this run.

### What the owner saw
- **App A** (pink calendar-style icon; about 22K ratings, 4.6 stars, #16 Graphics & Design, 16+). Store shots: big serif headline at the top on a soft pastel gradient (pink, lavender, sky blue, butter yellow, peach); a tilted phone mock with icons and widgets bursting out of the frame as floating cut-outs, with sparkles and bubbles; a laurel badge with a download count. Headlines cover thousands of themes, live and still wallpapers, custom live wallpaper, serene themes, cartoon themes. In-app: bottom tab bar Themes / Widgets / Icons / Wallpapers; Wallpapers screen with sub-tabs (dynamic cover, live, ...) and a 2-column grid of tall tiles with a small "LIVE" badge; an iPhone vs Watch toggle; Themes screen with sub-tabs (new, packs, cute, ...) and a 2-column grid of full home-screen previews; theme detail = large phone-shaped preview + download button; a "selected themes" apply flow with three ticked steps Wallpaper > Icons > Widgets and one button; a custom live wallpaper editor with a "Customize" pill (photo-collage lock screen with a big clock).
- **App B** (colourful widget-grid icon; 4.5 stars, #132 Utilities, 9+). Store shots are full-bleed home screens with no headline on top and a bold rounded caption at the bottom on a coloured highlight box (countdowns, nostalgic themes, custom widgets, lock screen wallpapers, very large theme counts). Widget types: hourly weather strip, photo, anniversary countdown ("7 days left"), a music-player look, analog clock, month calendar, a year-progress dot grid (e.g. 203/365), huge time + day + battery %, lock-screen QR/photo widgets. Widget editor: live preview card at top; background (change photo / photo album); theme colour swatches as circles; fonts as pill chips each drawn in its own font; font size slider with %; a "change widget" picker; one big set-widget button. Discover / Liked tabs; theme cards show like counts and a rank number.
- **App C** (pink calendar icon; about 800 ratings, 4.2 stars, #50, 4+). Dark, high-contrast shots: theme-count headline with laurel badges, hashtag rows, a neon glowing digital clock widget, a synthwave lock screen with moon-phase lock widgets, an angled collage of colourful widgets, lock screen widgets (weather, clock, battery/wifi status, quote), "regularly updated". It relies on famous game/film/sports-team art. **We never do that: all Glaze art stays original.**
- **App D** ("27" pink icon; about 18K ratings, 4.5 stars, #6 Graphics & Design, 4+). Clean straight-on phone frame, serif headline on a soft solid pastel. Shots: interactive widgets (water tracker with a "+150 ml" button, step counter, exercise minutes, sleep with "+1 hr", buttons work inside the widget), live wallpapers, abstract 3D wallpapers, a neon-glow icon set, StandBy widgets (battery ring, weather, photo, calendar, big-numeral clock on a phone in StandBy), gradient icon set, themes with music/quote/calendar widgets (pink bow theme, green leaf theme).

### Lessons for Glaze (our own wording, original art only)
- **L1 Navigation.** Bottom tab bar Themes / Widgets / Icons / Wallpapers, with Live (our Live Lock Screen) kept as its own tab and Settings moved behind a header button; bubbly iOS look. Each tab opens with sub-tabs or big category bubbles, then a 2-column grid of tall rounded preview cards. → T57 (themes), new T70 (tab bar + Widgets tab), T71 (Wallpapers tab).
- **L2 A theme is a bundle** of wallpaper + icon set + matching widgets. Theme detail = large phone-shaped preview with a Home / Lock toggle and one primary button; apply flow shows three tickable steps (Wallpaper > Icons > Widgets) with progress, then a success moment. → T55, T61.
- **L3 Widget catalogue** (small / medium / large, plus lock-screen accessory where it fits, all themeable): digital clock, analog clock, date, month calendar, countdown to a date, year/month progress dots, photo (single + rotating album), quote/text, battery-style, habit trackers with interactive buttons (water, manual steps counter, sleep, mood) through iOS 17+ interactive widgets (App Intents in the WidgetKit target, behind adapters; Expo Go shows previews only), StandBy layouts. Weather is a later task: it needs location permission and a weather source (Apple WeatherKit needs a paid Apple Developer membership and has a request quota; free third-party sources need a network call, which our no-network rule currently forbids), so it is planned, not built (T75). We never fake a "now playing" widget that reads other apps. → T72, T73, T74.
- **L4 Widget Studio** like App B's editor: live preview on top; background (photo, album, colour, gradient, theme art); colour swatches as circles; fonts as pill chips drawn in their own font; size slider; widget type picker; one big "Add widget" button; saved to the app group for the widget extension. → T59.
- **L5 Wallpapers:** still + live, a "LIVE" badge on tiles; photo-collage lock screen maker later. → T71, T76.
- **L6 Discovery:** New / Popular / Liked tabs and a favourites heart. Counts only from real data: never invented download numbers, ranks, likes or badges, in the app or the store. With no accounts or network, "Popular" is our editors' order and says so; "Liked" is the user's own hearts on this device. → T77.
- **L7 Store screenshots:** make two original styles and keep the stronger: (a) serif headline on top, soft pastel gradient, tilted phone with floating cut-out widgets/icons and sparkles; (b) full-bleed themed home screen with a bold rounded caption on a highlight box at the bottom. 6–8 shots: the theme count we really ship, matching widgets, Widget Studio, interactive widgets, live wallpapers, Live Lock Screen (unique), "one price, no weekly subscription", seasonal collections. No laurel badges or download claims until true. → T67.
- **L8 Price edge:** all four are free downloads with in-app purchases. Their exact IAP prices were not re-checked this run (the apps are unnamed in the owner's notes, so they can't be matched to listings with certainty); the M1 table's range stands (weekly US$3.99–7.99, annual US$19.99–49.99, lifetime US$12.99–69.99). Glaze Plus stays one-time and clearly cheaper over a year (proposal US$4.99 / A$7.99). → T63 copy, T67 shot.

## Sources
- Roundups:
  - iGeeksBlog (best widgets, Jan 2026; live wallpaper apps, Feb 2026)
  - RefurbMe (Sep 2026)
  - iOSHacker (May 2025)
  - iScreen blog (Jun 2026, vendor)
  - Pretty Progress blog (May 2026, vendor)
  - Technographx (May 2026)
  - AppStoreTracker (May 2026)
  - TechCrunch iOS 26 home screen guide (Sep 2025)
  - AppsHunter live wallpaper apps (Aug 2026)
  - SlashGear (Jun 2024)
  - marlvel.ai (May 2026)
- apps.apple.com us/au listings: id1523682319, id1531594277, id1534126062, id1580284904, id1537362606, id1533393982, id1533025495, id1533047121, id1539905300, id1533792234, id1524540481, id1533158013, id1039845801, id1348676585, id1061859052, id6446832902.
- Failed or blocked fetches, which were skipped: the US listing of id1533025495, and the screensdesign.com showcase for Themify.
