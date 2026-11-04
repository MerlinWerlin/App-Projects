# App-Projects

Jared's App Factory apps: **Linework** (AR tracing), **Glaze** (lock screens, icons, widgets) and **Couch** (TV remote),
in `apps/`, plus **Backspin** (reverse-singing party game, started 24 Oct 2026, Expo Go stage) and **Rowlight**
(crochet companion, `apps/crochet`, Expo Go preview stage). They are built by Claude's scheduled build runs; this repo
is where releases are approved. Apps with an `EXPO_GO_PREVIEW` file publish an Expo Go preview on every push
(`.github/workflows/preview.yml`; links in `apps/<app>/ops/PREVIEW.md`).

**To ship:** merge the "Ship …" pull request in the GitHub app. See [docs/SHIPPING.md](docs/SHIPPING.md)
(including the one-time setup).

Meow Manager now has its first iOS-targeted character motion build: an articulated professional kitty with nap/chips openings, idle, greeting, listening and speaking. The dashboard prototype is parked at `/planner-reference`. Start with `apps/meow-manager/docs/ANIMATION_BUILD.md` for the running prototype, review clips and editable GLB/Blender assets; the experience brief and original concept remain the art target. Physical iPhone testing and final character art remain outstanding. This checkout is the owned development copy for `codex/meow-manager-20261104`; GitHub main remains the release authority.
