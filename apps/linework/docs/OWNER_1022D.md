# Owner decisions, 22 Oct 2026 night (release)

Asked in the owner's chat; answers verbatim where short.

- **Price:** "free 2 week trial then $2.99 purchase". After the trial, **basic tracing stays free**: tracing your own photos with every tracing tool, plus the 24 starter templates (src/plus/access.ts starterIds). The rest of the template library and outline mode need **Linework Plus, A$2.99 one-time** (non-consumable `com.jared797.linework.plus`). No subscription, no ads.
- **Name:** "Linework: Trace & Sketch" in the App Store; the phone shows "Linework". Subtitle: "Trace photos onto real paper".
- **Support email:** "Jared Bradley for now" → jaredbradley272@gmail.com, to be changed later.
- **Store screenshots:** style (a) serif on pastel.

This replaces the earlier rule "every tracing tool is free / Plus never gates a tracing tool": the camera tracing tools stay free for everyone; outline mode (photo-to-outline in Prepare) and the full library move behind Plus after the trial. The Trace screen still never reads the entitlement.

Implemented live 22 Oct (T120–T122): src/plus/access.ts (14-day trial from first launch, locks), src/plus/iapStore.ts (expo-iap, guarded require; Expo Go falls back to the mock store), usePlus access/price/canBuy, Plus screen (trial status, real Buy button, test links), Plus badge and Plus redirect on locked templates (Templates, Home), outline mode redirect in Prepare, STORE.md and RELEASE_CHECKLIST.md owner steps. Only a TestFlight sandbox purchase proves the store path.
