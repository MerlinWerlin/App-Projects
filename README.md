# App-Projects

Jared's App Factory apps: **Linework** (AR tracing), **Glaze** (lock screens, icons, widgets) and **Couch** (TV remote),
in `apps/`, plus **Backspin** (reverse-singing party game, started 24 Oct 2026, Expo Go stage) and **Rowlight**
(crochet companion, `apps/crochet`, Expo Go preview stage). They are built by Claude's scheduled build runs; this repo
is where releases are approved. Apps with an `EXPO_GO_PREVIEW` file publish an Expo Go preview on every push
(`.github/workflows/preview.yml`; links in `apps/<app>/ops/PREVIEW.md`).

**To ship:** merge the "Ship …" pull request in the GitHub app. See [docs/SHIPPING.md](docs/SHIPPING.md)
(including the one-time setup).

Meow Manager's current build uses original 2D facial frames over a fixed body: quiet doze/watch arrivals, slow blinks and a small ear reaction. Jared rejected the first 3D acting; that source and evidence remain at `/rig-reference`, with the earlier planner at `/planner-reference`. Start with `apps/meow-manager/docs/FRAME_ANIMATION_BUILD.md` for the current artwork, actual playback evidence and limitations. Physical iPhone testing and final animation approval remain outstanding. This checkout is the owned development copy for `codex/meow-manager-20261104`; GitHub main remains the release authority.
