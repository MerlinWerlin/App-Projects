# App campaign: automated posting for the live apps

Jared handed marketing to Claude on 10 Nov 2026 (roadmap Decision log): Claude posts without asking each time, **only
on the business accounts**. This file is the campaign system. The Claude scheduled task **"App marketing daily
(posting)"** (task id `app-marketing-daily`, 18:20 Sydney, needs the PC and Chrome with Claude in Chrome) follows it.
Created 10 Nov 2026 with Jared's go-ahead; a copy of its prompt is in `marketing/campaign/DAILY_TASK.md`.

Apps in rotation (from `apps.json`, stage `live`):
| App | Where | Link to use |
|---|---|---|
| Linework: Trace & Sketch | iPhone + Android | https://apps.apple.com/au/app/id6826041969 or https://play.google.com/store/apps/details?id=com.jared797.linework |
| Cue: Teleprompter | **Android only** | https://play.google.com/store/apps/details?id=com.jared797.cue |
| Backspin: Reverse Your Voice | **Android only** | https://play.google.com/store/apps/details?id=com.jared797.backspin |

Cue and Backspin posts always say "on Android" / "Google Play" until `appStoreUrl` is set in `apps.json`.

## Channels (checked 10 Nov 2026 in Jared's Chrome)
| Channel | Account | State | Use |
|---|---|---|---|
| Pinterest | Fern & Fable business (`fernandfableau`), board **Fun & Useful iPhone Apps** | signed in, working | 1 app pin a day at 19:00 (woodwork plan pins own 12:00) |
| TikTok | Fern & Fable (`fernandfableau`, 358 followers, bio "DIY woodworking plans"), not Jared's personal | signed in, working | 3 app videos a week |
| Instagram | Fern & Fable business (`fernandfableau`). **Never `jaredbradley7`** | signed in, working | Same videos as Reels, 3 a week |
| Facebook | none linked to the Instagram account (Edit profile shows "Facebook: Connect") | needs Jared | Cross-post Reels once a Fern & Fable Page is linked |
| Threads | signed out | needs Jared | Uses the Instagram login; Jared signs in once as `fernandfableau` |
| YouTube Shorts | only a personal channel "Jared Bradley" | needs Jared | Don't post there; Jared adds a Fern & Fable / Astro Labs brand channel if wanted |
| X | signed out, no account | needs Jared | optional |
| Reddit | blocked for Claude in Chrome by the extension's safety list | drafts only | Weekly run drafts answers in the hub; Jared posts them |
| Product Hunt, AlternativeTo | signed out | needs Jared | One-off launch listings (see below) |

### Other free places worth using (Jared creates the accounts, Claude does the rest)
1. **AlternativeTo**: free account, then add each app as an alternative under "teleprompter", "tracing / lightbox"
   and "voice reverse" categories. Lasting search traffic. Claude can fill the listings once signed in.
2. **Product Hunt**: one launch per app (Cue and Linework fit best). Needs a maker account; launches go best on a
   weekday with a gallery of the store screenshots (ready in `apps/<slug>/store/jpg`).
3. **Threads**: log in with the Instagram account once; then the daily run posts the same reel or a screenshot + one
   line, two or three times a week.
4. **Facebook Page** for Fern & Fable linked to the Instagram account: Reels cross-post automatically.
5. **YouTube Shorts**: the reels are already 1080x1920 and under 20 s. Needs a brand channel, not the personal one.
6. **Reddit** (Jared's own account): answer real questions first, say "I made this" once, follow each sub's promo
   rules (read the sidebar rules each time; not yet checked from this PC because the extension blocks Reddit).
   Candidate subs: creator/YouTube-beginner subs (Cue), r/AndroidApps (Cue, Backspin), drawing-help subs (Linework),
   party-game subs (Backspin). The weekly run keeps the draft replies in the hub.
7. Free app directories (to check, not yet verified): AppAgg, AppAdvice for Linework on iOS, Uptodown/Softonic for
   the Android apps.

## Cadence
- **Pinterest**: one app pin a day at 19:00 Sydney, scheduled up to 7 days ahead with "Publish at a later date".
  Rotate apps; never the same app two days running when another app has unused items.
- **TikTok + Instagram**: Mon, Wed and Fri. Post the next `queued` reel in `marketing/campaign/queue.json` to both.
- **Weekly stats (Sunday run)**: append readings to `marketing/analytics/snapshots.csv` (see Logging), run
  `analyze.py`, and adjust: the app or format with the best save/click rate gets the next extra slot; formats with no
  views after 2 weeks stop.
- New material: when the queue has fewer than 3 reels or 5 pins left, make more from the **real store screenshots**
  (`apps/<slug>/store/jpg/...`): reels with `marketing/video/render.py` and `"fit": "contain"` shots (see
  `marketing/*/media/2026-11-10/*.storyboard.json`), pins with `marketing/pins/render_pins.py` (`PYTHONUTF8=1`).
  The older OpenAI storyboards (2026-10-24..26) are colour cards saying "Coming soon to iPhone": don't post them.

## Claims bank (only these; from the store listings)
- Linework: trace photos/templates onto real paper with a camera overlay or lightbox; lock, touch lock, focus lock;
  photo to outline on the device (Plus after the 14-day trial); 1,900+ templates, letters in 16 styles, Workshop;
  no ads, no subscription, no account; own-photo tracing stays free; Plus is one A$2.99 purchase.
- Cue: script near the camera; unlimited scripts, steady scroll, mirror/flip, countdown, recording with no watermark
  (all free); Cue Plus is optional, one-time, adds Voice Pace (scrolls while you talk, waits when you pause), Voice
  Follow, caption export, Word import; 7-day trial that doesn't auto-charge.
- Backspin: say a line, hear it backwards, copy it, it flips your copy forwards and scores sound, rhythm and length;
  first 10 scored rounds free; party mode for 2 to 8 players; daily challenge; no account, no ads.
- Never: "best", "only", "#1", "never drifts", competitor or franchise names, song lyrics, plain "free" without the
  trial/Plus wording. App content is not marked AI-made (it's real screenshots). On TikTok tick "Disclose post
  content > Your brand".

## How-to (what has tripped runs before)
- **Pinterest** (pin builder https://au.pinterest.com/pin-creation-tool/): upload with the file input, then **find the
  form fields again** (they re-render after each upload): title, description (a contenteditable), link, board (should
  already say Fun & Useful iPhone Apps), tick "Publish at a later date", pick the day in the calendar and 07:00 PM in
  the time menu. Click **Schedule** (or Publish), then click **Schedule/Publish again in the confirmation dialog**:
  two clicks. Leave "Mark as AI-modified" off. Check https://au.pinterest.com/fernandfableau/scheduled-pins/ afterwards.
  Leave the two old drafts in the drafts list alone.
- **TikTok** (https://www.tiktok.com/tiktokstudio/upload): upload, dismiss the "automatic checks" prompt with Cancel,
  focus the description editor (`.public-DraftEditor-content`), select all, type the caption, then type each hashtag,
  wait 2 s, then a space (the first hashtag sometimes gets swallowed: re-check the text). Settings > Show more >
  Disclose post content > Your brand. Schedule it (Jared OK'd scheduling and its one-time consent on 11 Nov): pick a Mon/Wed/Fri at 19:30, one reel a day, never several at once.
  The new post's URL is the first `/video/` link on https://www.tiktok.com/tiktokstudio/content.
- **Instagram** (instagram.com, check the profile says `fernandfableau` first): Create > Post > file input > OK on the
  "shared as reels" notice > Select crop > 9:16 > Next > Next > caption > Share, then wait about 30 s for "Your reel has
  been shared". **Leave "Share to Facebook (Georgia Molden)" OFF**: that's a personal profile. Never press Escape in
  the dialog (it asks to discard the post). Reels links aren't clickable: write "on Google Play" /
  "on the App Store and Google Play" and keep the link in the profile.
- Chrome screenshots time out on this PC; work from `find`, `read_page`, `get_page_text` and small JS reads instead.

## Downloads watch
Every daily run reads Play Console (signed in) and App Store Connect (signed in on 10 Nov but it signs itself out
often; when it has, the run skips it and says so) and sends Jared a phone notification the first time each app shows a download, then at 10,
50 and 100. State: `marketing/analytics/first_downloads.json`. The first 1-2 Linework iPhone downloads are probably Jared
and his partner.

First reading, 10 Nov: Linework on iPhone had **8 first-time downloads** (plus 1 redownload, 64 impressions, 10 product
page views) in the 30 days to 8 Nov UTC. Running totals on the page: 5 by 6 Nov, 6 by 7 Nov, 8 by 8 Nov. Play Console
still showed no acquisitions for any app.

## Logging (source of truth: `marketing/analytics/`)
- `marketing/analytics/posts.csv`: add a row the moment anything goes live (pin, reel, TikTok, Reddit reply, directory listing), `post_id` = `pin-<id>`, `ig-<id>`, `tt-<id>`, `rd-<id>`, `dir-<site>`. Scheduled pins get their row when they go live.
- `marketing/analytics/snapshots.csv`: append only, one number per row, metric names from `marketing/analytics/README.md`. The Sunday run appends per-post and account readings for every channel, plus Etsy traffic sources (`visits_from_pinterest` etc.) and Play/App Store installs and store page views.
- Decide cadence and mix with `python marketing/analytics/analyze.py` (`--json` for data, `--stale 7` for posts needing a reading).
- `marketing/POSTED.md` stays as the human-readable log.
- Use tracking links for every new post (record the exact link in `link_target`): Google Play `https://play.google.com/store/apps/details?id=com.jared797.<app>&referrer=utm_source%3D<channel>%26utm_medium%3D<format>%26utm_campaign%3Dlive-2026-11`, App Store `https://apps.apple.com/au/app/id6826041969?ct=<channel>-live-2026-11`. Pins scheduled on 10 Nov use plain links (they were queued before the register existed).

Commit log changes straight to `main` (see the task).
