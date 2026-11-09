# Answer-page research (10 Nov 2026)

These are internal notes behind `answers.json`, so competitor names appear here only. The published pages name no competitors: their prices came from roundups and trackers rather than from their own store pages, and Linework's `avoid` list bans competitor names. Re-check this file before changing any "typical app" claim.

Method: about 30 web searches and page fetches on 10 Nov 2026. No Reddit or Google "People also ask" data came back, so the question lists come from FAQ blocks in roundups, store copy and search-result titles.

## Our own listings (checked 10 Nov 2026)
- **Linework, App Store:** free with in-app purchases ("14-day Trial" A$0.00, Linework Plus A$2.99). Data Not Collected. Graphics & Design, 4+. iPhone on iOS 16.4 or later, plus Macs with M1 or later. **Not iPad.**
- **Linework, Google Play (developer Astro Labs AU):** Art & Design, rated 7+, A$2.99 per item, no ads. The trial is optional and started from the Plus screen. Its Data safety section lists device IDs, diagnostics and purchase history.
- **Cue, Google Play:** Productivity, rated 3+, A$2.99 per item.
  - Free: unlimited scripts, steady scroll, mirror and flip, countdown, recording with no watermark.
  - Plus: Voice Pace, Voice Follow, caption export, colours, Word import, stats.
  - 7-day trial that doesn't charge automatically. Data safety lists diagnostics and purchase history.
- **Backspin, Google Play:** Casual, A$1.99 per item.
  - The first 10 scored rounds are free with everything on; Plus is a lifetime unlock.
  - No ads; recordings are processed on the phone.
  - Party mode allows up to 8 players (`MAX_PLAYERS` in `src/core/game.ts`; 4 without Plus after the free rounds).
  - Data safety lists diagnostics and purchase history.

## AR tracing (Linework)
- **Searches:**
  - AR drawing app no subscription / free
  - how do AR drawing apps work
  - do I need a tripod
  - trace on paper with phone
  - why does the image keep moving
  - Da Vinci Eye alternatives
  - AR drawing one-time purchase
  - AR projector app
  - tracing app for murals
- **Apps that keep coming up:**
  - Da Vinci Eye: pricing unclear across sources.
  - SketchAR: about $14.99/mo or $69.99/yr, according to roundups.
  - Many "AR Drawing: Sketch & Paint" clones: about $9 a week, and $6.99–9.99 weekly tiers on iOS.
  - ArtEasy: $9.99/wk.
  - sketch.AR: has a $6.99 lifetime option.
  - Source: fingerlakes1.com/2026/01/08/best-ar-drawing-apps/
- **Complaints:**
  - weekly subscriptions and paywalls on basic tracing
  - overlay drift and flicker
  - ads
  - no refund after a trial converts
- **AlternativeTo:** Da Vinci Eye has 5 alternatives and SketchAR has 2, so both pages are thin.

## Teleprompter (Cue)
- **Searches** (from teleprompter.com's Android FAQ):
  - free teleprompter for Android
  - record video while reading a script
  - works offline
  - hands-free control
  - also: teleprompter that follows your voice; no watermark; floating window; PromptSmart alternative
- **Apps that keep coming up:**
  - Teleprompter.com: free tier watermarked, Pro about $7.50/mo.
  - PromptSmart: about $9.99/mo.
  - BIGVU: free tier watermarked, about $15/mo.
  - Nano Teleprompter: Android, $4.49 one-time.
  - Elegant Teleprompter: ads.
- **Complaints:**
  - watermarks on free tiers
  - unreliable voice scroll
  - free versions capping recording length or script count
  - monthly subscriptions
- **Directories:**
  - lilachbullock.com/feature-your-tool/: a request form; it may be paid.
  - SourceForge's Android teleprompter category.
  - AlternativeTo's PromptSmart page, which has 50 alternatives.

## Reverse singing (Backspin)
- **Searches:**
  - reverse singing app android
  - reverse audio challenge app
  - how to do the reverse singing challenge
  - sing it backwards game
  - reverse singing app without ads
  - reverse audio on Android
  - reverse singing with friends
- **Apps that keep coming up:** Reverse Audio: Reverse Play (about 2.6M installs, ads plus IAP) and several clones with ads or weekly plans (see `apps/backspin/docs/MARKET.md`).
- **Complaints:**
  - ads before every recording
  - weekly subscriptions of $30–40
  - having to watch an ad to reverse a clip
- **AlternativeTo:** its reverse-singing page lists 14 "alternatives", none of them games, so that is an opening for a listing.
