# Google Play preparation tools

This source folder belongs to the App-Projects Android preparation branch and the APPS Google Play stage in the master roadmap. `node --test scripts/play/variants.test.cjs` checks package isolation and configuration regressions for the seven self-contained app overlays. These checks do not compile native code, validate Play Billing, upload a bundle or prove device readiness. Per-app draft listings are in `apps/<app>/store/play-listing.json`; technical release requirements are in `docs/GOOGLE_PLAY.md`.
