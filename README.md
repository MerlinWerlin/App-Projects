# App-Projects

Jared's App Factory apps: **Linework** (AR tracing), **Glaze** (lock screens, icons, widgets) and **Couch** (TV remote),
in `apps/`, plus **Backspin** (reverse-singing party game, started 24 Oct 2026, Expo Go stage) and **Rowlight**
(crochet companion, `apps/crochet`, Expo Go preview stage). They are built by Claude's scheduled build runs; this repo
is where releases are approved. Apps with an `EXPO_GO_PREVIEW` file publish an Expo Go preview on every push
(`.github/workflows/preview.yml`; links in `apps/<app>/ops/PREVIEW.md`).

**To ship:** merge the "Ship …" pull request in the GitHub app. See [docs/SHIPPING.md](docs/SHIPPING.md)
(including the one-time setup).
