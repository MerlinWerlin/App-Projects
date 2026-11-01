# Shipping notes

- Bundle id com.jared797.roamlings; widget extension com.jared797.roamlings.widget; App Group group.com.jared797.roamlings.
- First TestFlight build: RELEASE.json {"mode": "build", "note": "First Roamlings build", "ascAppId": "<from Jared>", "ascKeyAuth": true} with the default `production` profile (no widget), to prove the pipeline.
- Second build: add "profile": "production-native" to RELEASE.json (keep every other field) to include the home-screen widget. If Expo's capability sync can't register the App Group, read the ship comment; Glaze needed "skipCapabilitySync": true plus the App Group registered once on developer.apple.com.
