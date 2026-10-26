# App-Projects

Jared's App Factory apps: **Linework** (AR tracing), **Glaze** (lock screens, icons, widgets) and **Couch** (TV remote),
in `apps/`, plus **Backspin** (reverse-singing party game, started 24 Oct 2026, Expo Go stage) and **Rowlight**
(crochet companion, `apps/crochet`, Expo Go preview stage). They are built by Claude's scheduled build runs; this repo
is where releases are approved. Apps with an `EXPO_GO_PREVIEW` file publish an Expo Go preview on every push
(`.github/workflows/preview.yml`; links in `apps/<app>/ops/PREVIEW.md`).

**To ship:** merge the "Ship …" pull request in the GitHub app. See [docs/SHIPPING.md](docs/SHIPPING.md)
(including the one-time setup).

**Google Play preparation (26 Oct):** the isolated `codex/google-play-prep` branch adds Android test APK and
store AAB profiles for all seven apps, with draft Android listings. The active preparation checkout is
`C:\Users\jared\Documents\ChatGPT\Apps\android-prep`; main remains the release source. See
[docs/GOOGLE_PLAY.md](docs/GOOGLE_PLAY.md) for profile use, platform gaps and the verification boundary.
This branch does not change RELEASE.json or submit anything to either store.
