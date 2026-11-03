# Linework Google Play assets

Upload assets for the APPS Google Play Android variants roadmap row. This folder contains only the Android listing's owned graphics and actual application captures; Apple listings are separate. The existing `../play-listing.json` holds copy, product details and the current submission status.

`feature.svg` combines the app's original sunflower template with the existing brand palette; `feature.png` is the required1024x500 RGB export. `icon.png` is the512x512 RGBA export of `assets/brand/icon.svg`. Rebuild using `scripts/play/build-linework-store.cjs` with the pinned renderer named in that script, then convert the feature export to RGB. Screenshots are unretouched Android UI captures converted losslessly to RGB; source identities and hashes are retained in `assets.json`. They meet the minimum320px screenshot rule; no higher-resolution promotional eligibility is claimed.

No third-party photos, phone mockups, store badges, ratings, price promotions or fabricated app screens are included. This folder contains no testing-availability statement for reviewers. Release still depends on the current owner row in the master roadmap, not this folder's presence.
