# Marketing lanes for OpenAI (StarNet / ChatGPT / Codex)

Split, as for every App Factory app: **OpenAI does the content work; Claude only coordinates** (starts the jobs, moves
files, publishes for Jared's review). Jared asked for this on 24 Oct 2026 ("use OpenAI more than yourself").

Runs every night from the Claude scheduled task **"App marketing nightly (OpenAI)"** for every app in
`marketing/apps.json` whose `stage` is `prelaunch`, `launching` or `live`. Nothing is ever posted publicly by a lane:
Jared approves videos and pins in the App launch room hub first.

## Batch layout
`marketing/<slug>/media/<YYYY-MM-DD>/` (one folder per night per app)
- `brief.json`: what the lanes were asked for (written by the coordinator)
- `<id>.storyboard.json`: one per video (format in `marketing/video/render.py`), images under `img/`
- `prompts.json`: `[{"file": "img/<id>-01.png", "prompt": "...", "size": "1024x1536"}]`, one entry per image
- `copy.json`: post captions, hashtags, pin titles/descriptions, Reddit-style drafts
- `img/`: images made by the image lane

Merging to `main` makes GitHub render every new storyboard into `<id>.mp4` + `<id>.jpg` (`.github/workflows/video.yml`,
ffmpeg, no AI cost).

## Lanes

| Lane | Model | Output | Rules |
|---|---|---|---|
| M1 Storyboards | Sol (Luna if Sol busy) | 3 storyboards per app per night: 5-7 shots, 12-20 s total, one hook in the first shot, captions under 7 words, end card | Base everything on the app's `docs/PLAN.md`, `docs/MARKET.md`, `docs/STORE.md` and `marketing/apps.json` entry (lead, avoid). Vary formats: hook-problem-fix, "3 reasons", challenge/tutorial, before/after. Captions never name competitors, songs under copyright, franchises or real people |
| M2 Image prompts | Sol | `prompts.json` for every shot image | Vertical 2:3 (1024x1536). **No text in images** (captions are added by the renderer). Original characters, no logos, no real people or celebrities, no app UI mock-ups that promise features the app lacks. Consistent palette per app (accent in apps.json) |
| M3 Images | GPT Image (gpt-image-2) via Codex `$imagegen` on the PC, else ChatGPT image generation | PNGs at the paths in `prompts.json` | Same rules as M2. Skip and leave the file missing if a prompt is refused; the renderer falls back to a colour card |
| M4 Post copy | Luna | `copy.json`: per video a TikTok/Reels caption (<150 chars) + 3-5 hashtags; 5 pin titles/descriptions; 3 short Reddit-style replies to typical "best app for X" questions | Pre-name-lock apps stay unnamed. No "only", "best", "#1" claims; follow `avoid` |
| M5 Review | Astra | `review.md` in the batch: one paragraph per storyboard, flags anything off-brand, misleading or risky | Comment only; the coordinator drops storyboards Astra marks "reject" |

## Per-app angles (starting points; M1 may add more)
- **Backspin** (reverse-singing party game, pre-launch, name not locked): the viral reverse-singing challenge with a real score; friends/couples/family laughing at mangled results; "10 free goes, then one small unlock"; party mode for up to 8; daily challenge and streaks. Use the app's own original or public-domain challenge lines (`apps/backspin/src/content`), never real song lyrics.
- **Cue** (teleprompter, pre-launch, draft name "Cue: Teleprompter"): "it waits for you" (Voice Pace scrolls only while you talk); eyes on the lens; retake one section; no watermark, no subscription. Audience: creators, small businesses, students presenting, public speaking.
- **Linework** (launching): see the hub's Compared tab; tracing, photo to sketch, lock steady, letters and workshop.

## Feedback loop
Jared approves or rejects videos in the hub (Videos tab) with an optional note. The coordinator copies those notes into
the next night's `brief.json` under `feedback`, and M1 must follow them.

## Image route
Which M3 route the nightly run used (first that worked: a Codex `$imagegen` job, b ChatGPT in the desktop app's
browser, c none / colour cards).
- 2026-10-24: **c (none)**. (a) no Codex image runner on the PC and the StarNet bridge has `tools_allowed: false`;
  (b) chatgpt.com in the built-in browser redirects to its login page (signed out; the run never signs in).
  `prompts.json` is in each batch, so images can be made later and dropped into `img/` (the workflow re-renders).
- 2026-10-25: **c (none)**. (a) bridge still `tools_allowed: false`, no Codex image runner; (b) chatgpt.com in the
  built-in browser redirects to its login page (signed out).
- 2026-10-26: **c (none)**. (a) bridge CONTRACT still `tools_allowed: false`, no Codex image runner; (b) chatgpt.com
  in the built-in browser redirects to its login page (signed out).
