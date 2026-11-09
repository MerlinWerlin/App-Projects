# Marketing analytics register

This is the one place for every marketing number from every channel (Pinterest, Instagram/Facebook, TikTok, Reddit, web,
App Store, Google Play, Etsy and directories), so results can be compared and analysed together. Claude keeps it up to date; Jared
asked for it on 10 Nov 2026. It's plain CSV that only gets added to, with no spreadsheets or dashboards needed. `python analyze.py` reads it.

| File | One row per | Who writes it, and when |
|---|---|---|
| `channels.csv` | channel/account | whoever adds a new channel |
| `posts.csv` | thing published (pin, reel, TikTok, Reddit reply, directory listing, web page) | whoever posts it, as soon as it goes live |
| `snapshots.csv` | **one number** at one time (long format) | whoever reads the stats, at least weekly |

## Rules
- **Only add rows; never edit old ones.** A new reading is a new row with a new `captured_at`, so trends stay visible.
  To fix a mistake, add a corrected row with `source` = `correction: <why>`.
- `post_id` = `<channel-prefix>-<platform id>`: `pin-…`, `ig-…`, `tt-…`, `rd-…`, `web-<path>` or `dir-<site>`. It must match a row in `posts.csv`.
- `scope` is one of:
  - `post` (needs a `post_id`)
  - `account` (a whole channel account)
  - `app` (one app on a store, e.g. Play installs for Cue)
  - `page` (one web page)
- `line` = `apps` or `etsy`. `app` = `linework`, `cue`, `backspin`, … or the Etsy product slug (`four-board-bench`). Leave it blank for account-wide rows.
- `period` says what the number covers: `lifetime`, `now`, `today`, `last_7d`, `last_30d`, or a range such as `2026-11-10..2026-11-16`.
  For posts use `lifetime` (the latest reading counts). For accounts and stores use `last_7d` or `last_30d`.
- `ai_label` in `posts.csv` says whether the post was marked as AI-made. App posts are `no`; woodwork-plan photos are `yes`.
- Dates are ISO `YYYY-MM-DD` (or a full ISO time). Numbers are plain, with no commas and no `k`.

## Metric names (use these so the channels line up)
| metric | meaning | where it exists |
|---|---|---|
| `impressions` | times shown | Pinterest, Instagram, TikTok, App Store, Search Console |
| `engagements` | all interactions | Pinterest, Instagram |
| `saves` | saves and bookmarks | Pinterest, Instagram, TikTok (favourites) |
| `outbound_clicks` | clicks from the platform to our link | Pinterest, Instagram link clicks, TikTok link clicks |
| `video_views` | video plays | Instagram Reels, TikTok, Pinterest video |
| `likes`, `comments`, `shares` | as named | most social channels |
| `profile_visits`, `followers` | account totals | social channels |
| `monthly_views` | Pinterest's own monthly views figure | Pinterest |
| `clicks`, `ctr`, `avg_position` | search results | Search Console (`scope=page`) |
| `store_page_views` | views of the app's store page | App Store, Play |
| `installs` | first-time downloads | App Store (first-time downloads), Play (store listing acquisitions) |
| `iap_purchases`, `proceeds_aud` | Plus purchases and money received | App Store, Play |
| `visits`, `orders`, `sales_total`, `revenue_aud`, `active_listings` | shop numbers | Etsy |
| `score`, `upvotes` | community votes | Reddit, Product Hunt, AlternativeTo |
| `total_audience`, `engaged_audience` | people reached / who interacted | Pinterest |
| `listing_views`, `favourites`, `conversion_rate_pct` | shop listing numbers | Etsy |
| `visits_from_<source>` | visits a channel sent (`pinterest`, `facebook`, `instagram`, `social`, `tiktok` …) | Etsy traffic sources, Play/App Store by UTM |

Only add a new metric when none of these fit, and then add it to this table.

## Tracking links (so the store stats show which channel sent people)
- **Google Play:** add a referrer, for example
  `https://play.google.com/store/apps/details?id=com.jared797.cue&referrer=utm_source%3Dpinterest%26utm_medium%3Dpin%26utm_campaign%3Dlive-2026-11`.
  Play Console > Store listing acquisition can then split visitors by `utm_source` and `utm_campaign`.
- **App Store:** add a campaign token `ct`, plus the provider token `pt` from App Store Connect > Analytics > Campaigns once it's known, for example
  `https://apps.apple.com/au/app/id6826041969?pt=<provider>&ct=pinterest-live-2026-11`.
- **Etsy:** Etsy already splits traffic by source, so no tagging is needed.
- Record the exact link used in the `link_target` column of `posts.csv`. The first three pins (10 Nov) used links without tracking.

## Analyse
```
python analyze.py              # summary tables in the terminal
python analyze.py --json       # the same data as JSON (for an artifact or another tool)
python analyze.py --stale 7    # posts with no reading for 7+ days (7 is the default)
```
It shows:
- posts per channel and app
- the latest totals per post and per channel/app
- rates: save rate (saves / impressions) and click rate (outbound_clicks / impressions)
- account and store trends from the first reading to the latest
- posts that need a fresh reading
