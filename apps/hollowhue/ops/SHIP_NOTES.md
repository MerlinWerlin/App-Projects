# Shipping notes

- Bundle id com.jared797.hollowhue; Expo project @jared797/hollowhue (linked by the ship workflow's `eas init`).
- First TestFlight build: RELEASE.json {"mode": "build", "note": "...", "ascAppId": "<ASC app id>", "ascKeyAuth": true}
  with the default `production` profile, as Roamlings did.
- A new app's first non-interactive build fails with "Distribution Certificate is not validated"; run the
  `ios-credentials` workflow (inputs app=hollowhue, reference=backspin, build=true), which makes the provisioning
  profile with the App Store Connect API, links it on Expo and starts `ship-mac`.
- No native modules: every later change can go out as an over-the-air update (RELEASE.json mode "update").
