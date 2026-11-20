# App discovery without Google search (started 16 Nov 2026)

Jared, 16 Nov 2026 (main chat, relayed by the MARKETING session): "Yea you take over that and start pushing some of these
autonomously". The three channels he picked, in this order, are: store keywords and subtitles; In-App Events and Play
Promotional Content; AlternativeTo listings. Same rules as the rest of the campaign apply: only claims the store listings
support, no "best", "only" or "#1", and no competitor names in our own posts. AlternativeTo is the one exception, because
the site's whole format is "an alternative to X". Never handle the App Store Connect .p8 key.

## 1. Store keywords and subtitles

### How the research was done
- Apple's own search suggestions (the hints the App Store shows while you type), read on 16 Nov for the Australian
  (143460) and US (143441) storefronts. The raw output is summarised below.
- Competitor titles and subtitles from App Store search results for "trace", "AR drawing" and "TV remote".

What people type, by app:
- **Linework:** "ar drawing" is the dominant phrase, and almost every competitor title carries it. Other common phrases:
  - "trace drawing app", "tracing app", "ar tracing", "trace and draw" and "trace anything".
  - "photo to sketch", "photo to drawing", "lightbox trace", "stencil", "lettering" and "drawing for kids".
  - "Tracing projector" is common, but Linework does not project, so we never use it.
- **Couch:** most searches are a brand plus "remote", such as "roku remote", "samsung remote", "lg remote",
  "fire tv remote" and "google tv remote". The generic ones are "tv remote", "tv remote control", "universal remote",
  "universal tv remote", "smart tv remote", "remote control for tv" and "tv remote app".
  - We leave brand names out of Apple keywords. Guideline 2.3.7 bans trademarked terms there, and the platform names
    stay in the description to describe compatibility.
- **Backspin:** "reverse singing", "reverse singing challenge", "backwards voice recorder", "talk backwards",
  "reverse audio", "backwards singing app" and "voice backwards".

### App Store (applied in the repo; goes live with each app's next submitted version)
Apple only accepts a new subtitle or keyword field with a new version, so no build was submitted for this. The App
Factory store workflow (`scripts/asc/asc.py`) reads both fields from `apps/<app>/store/listing.json` on the next submit.

| App | Field | Before | After |
|---|---|---|---|
| Linework | Subtitle | Trace photos onto real paper | **AR tracing & drawing on paper** (29) |
| Linework | Keywords | tracing,stencil,template,workshop,angle,carpentry,lettering,calligraphy,font,scrapbook,mural,kids | **draw,photo,camera,lightbox,stencil,outline,lettering,calligraphy,template,learn,art,mural,kids** (94) |
| Couch | Subtitle | Universal remote for smart TVs | unchanged: it already matches "universal remote", "universal tv remote" and "smart tv remote" |
| Couch | Keywords | control,streaming,wifi,keyboard,touchpad,apps,television,stick,box,player,channel,volume,power | **control,cast,streaming,wifi,keyboard,touchpad,television,stick,box,player,channel,volume,app,video** (98) |
| Backspin (iOS, not live yet) | Keywords | sing,audio,challenge,friends,family,tongue,twister,rewind,funny,flip,copy,record,group,kids,score | **sing,talk,audio,recorder,challenge,friends,family,tongue,twister,funny,group,kids,effects,score** (95) |

Notes on the changes:
- **Linework:** the subtitle now matches "ar drawing", "ar tracing" and "tracing app", and "trace" and "sketch" are
  already in the name. Keywords never repeat a word from the name or subtitle, and Linework's T58 test enforces this.
  `apps/linework/docs/STORE.md` was updated to match.
  - The subtitle says "AR tracing & drawing", not "AR drawing & tracing", because "AR Drawing" is several competitor
    apps' name and T58 bans it in STORE.md.
  - Apple matches words across the name, subtitle and keyword field, so "ar drawing" searches still match.
  - All 6 Linework store-listing tests pass.
- **Couch:** adds cast, app and video ("tv remote app", casting). Drops power and apps.
- **Backspin:** adds talk and recorder ("talk backwards", "backwards voice recorder") and effects. Drops rewind, flip
  and copy.

Later idea, not done yet: add a second English locale for more keyword room. The Australian storefront also indexes
en-GB. `asc.py` would need per-locale keywords for this; today `alsoLocales` copies the same keywords.

### Google Play (saved in Play Console 16 Nov; not yet sent for review)
Play indexes the title, the short description and the full description, and listing edits don't need a new build.
Both edits below are saved in Play Console under **Publishing overview → "Changes not yet submitted for review" (2
changes each)**.
- I could not send them for review myself: the click was blocked by this PC's permission check.
- Jared sends them with two clicks: **Submit 2 changes for review**, then **Send changes for review**.
- Google says review takes up to 7 days.

**Backspin: Reverse Your Voice**
- Short description:
  - Before: "Record a line, hear it backwards, copy it and reveal the result."
  - After: "Reverse singing game: say a line, hear it backwards, copy it and get a score" (76).
- Full description: rewritten (1,263 characters) to use the phrases people search for: "reverse singing", "talk-backwards",
  "backwards sound", "in reverse", "backwards audio" and "party game". Every claim comes from `docs/backspin/facts.txt`:
  950+ lines, party mode for up to 8 players, 10 free scored rounds, lifetime Plus, no ads or subscription, and on-device
  recording.

**Linework: Trace & Sketch**
- Short description:
  - Before: "Use a camera overlay or lightbox to practise drawing from your own images."
  - After: "AR drawing & tracing app: trace photos onto real paper with your phone camera" (77).
- Full description: only two sentences changed. Everything else, including "it does not project an image onto your
  paper", is untouched.
  - The opening now reads "Linework is an AR drawing and tracing app: trace photos, sketches and templates onto real
    paper…".
  - "Turn it into an outline" became "Turn the photo into a sketch outline".

The AI-asset declaration on both listings was left exactly as it was already filed.

## 2. In-App Events (App Store) and Promotional Content (Google Play): drafts, not submitted

**Lead time:** Apple reviews events like an app update (allow about a week), and an event card can appear up to 14
days before it starts.
- The Linework card needs to be **submitted by about 22 Nov** to show from 1 Dec.
- Each Apple event needs a 1920×1080 event image (or a 16:9 video). I'll render it from the real store screenshots once
  the text is approved.
- Both Apple events are submitted in App Store Connect → the app → In-App Events. App Store Connect keeps signing out of
  Chrome, so Jared signs in.

### Linework: "Trace your own Christmas cards" (App Store In-App Event)
- Hook: seasonal. Card-making is already a use the listing names ("cards, crafts, signs and lettering").
- Badge: Special Event. Dates: 1 Dec to 24 Dec 2026. Event card published 17 Nov or as soon as approved.
- Purchase required: **No**, because tracing your own photos with every tool is free.
- Event name (30): `Trace your own Christmas cards`
- Short description (50): `Trace a photo onto card for a hand-drawn greeting` (49)
- Long description (120): `Pick a family photo or template, stand your phone over the card and draw it in pencil. Tracing your photos is free.` (115)
- Deep link: none, so it opens the app.

### Couch: "Holiday TV nights, one remote" (App Store In-App Event)
- Hook: seasonal. Visitors, several TVs, and kids and grandparents on the couch. The features are real: multi-TV, the
  phone keyboard and Simple mode.
- **Risk:** Apple may decide it isn't a real in-app event, because nothing time-limited happens in the app. If it's
  rejected, hold Couch's event until a real update, e.g. a new platform leaving beta.
- Badge: Special Event. Dates: 20 Dec 2026 to 5 Jan 2027.
- Purchase required: **Yes**. The trial is free, but the remote needs Couch Plus after 7 days.
- Event name (30): `Holiday TV nights, one remote` (29)
- Short description (50): `Switch TVs in one tap when family visits` (40)
- Long description (120): `Add every TV in the house, type searches on your phone, and use Simple mode's big buttons for kids and grandparents.` (116)

### Backspin: "Christmas party: reverse singing" (Google Play Promotional Content, type Event)
- Hook: seasonal party use of the existing party mode. There is no new content pack, so the card doesn't claim one.
- Dates: 20 Dec 2026 to 2 Jan 2027.
- Title: `Christmas party: reverse singing`
- Description: `Pass one phone round: party mode for up to 8 players, tongue twisters and a daily challenge.`
- Note: Play only offers Promotional Content (Play Console → Grow users → Promotional content) to some apps. If Backspin
  isn't eligible yet, skip it. When Backspin is live on iPhone, the same card can become an Apple event.

## 3. AlternativeTo listings: drafts (account needs Jared's yes)

**Account:** creating an AlternativeTo account is Jared's job and needs his own yes.
- It would use the Astro Labs AU support address on the docs site. Jared confirms which email to use.
- Jared sets the password and does any verification. The account is not created yet.
- Once it exists, Claude can add both apps from his signed-in Chrome.

**What AlternativeTo needs:** name, short description, long description, platforms, license/pricing, website, store
links, tags and "alternative to" links.
- Our compare pages describe the "typical app" and deliberately name no competitor.
- So the "alternative to" picks below are the apps AlternativeTo itself lists most in each category (checked 16 Nov).

### Linework
- **Name:** Linework: Trace & Sketch
- **Tagline:** Trace photos and templates onto real paper with your phone's camera.
- **Description:** Linework is an AR drawing and tracing app. Stand your phone over paper, pick a photo or one of 1,900+
  templates, and draw along the lines with your own pencil. It turns photos into clean outlines on the phone, and you
  can lock the picture and the screen so they don't drift. Lightbox mode works without the camera. Tracing your own
  photos with every tool is free. Linework Plus is a one-time purchase for the full template library and
  photo-to-outline. No ads, no subscription, no account.
- **Platforms:** iPhone, Android.
- **License:** Freemium, with a one-time purchase.
- **Website:** https://merlinwerlin.github.io/App-Projects/linework/
- **Tags:** ar-drawing, tracing, sketching, drawing, lightbox, stencil, lettering.
- **Alternative to:** SketchAR, Da Vinci Eye, AR Drawing: Sketch & Paint, Lucida Camera.

### Couch
- **Name:** Couch: TV Remote
- **Tagline:** One iPhone remote for every TV and streaming player on your Wi-Fi.
- **Description:** Couch is a universal TV remote for iPhone. It works over Wi-Fi with TVs and players running Roku,
  Samsung Tizen, LG webOS and Google TV / Android TV, with Fire TV in beta. It has power, d-pad, touchpad, phone
  keyboard, volume, channels and an app launcher. You can cast photos and videos, and switch between TVs in one tap.
  Simple mode gives big buttons. Free for 7 days, then Couch Plus is a one-time purchase with Family Sharing. No ads, no
  subscription, no account, no data collected.
- **Platforms:** iPhone.
- **License:** Commercial (free trial, one-time purchase).
- **Website:** https://merlinwerlin.github.io/App-Projects/couch/
- **Tags:** remote-control, tv-remote, universal-remote, smart-tv, casting.
- **Alternative to:** The Roku Mobile App, SmartThings (TV remote), LG ThinQ, Google TV, Amazon Fire TV app.
- **Note:** brand names appear only as compatibility facts, the same as on the App Store listing. Couch isn't affiliated
  with any of them.

Product Hunt: not needed for now.

## 4. Extras
- **llms.txt:** already live at https://merlinwerlin.github.io/App-Projects/llms.txt, with one per app. Nothing to do.
- **Compare-page links on app pins:** from 17 Nov, every third 19:00 app pin links to the app's compare page instead of
  the store, with `?utm_source=pinterest&utm_medium=pin&utm_campaign=compare-2026-11`.
  - The compare pages carry the store buttons, so a pinner who isn't sure yet sees the price and no-subscription facts
    first.
  - This is written into the daily posting task.
