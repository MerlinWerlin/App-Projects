# Backspin release evidence — 26 October 2026

This records verification against the shared `docs/RELEASE_STANDARD.md`; the master roadmap remains the plan.

- New owner-supplied mascot is packaged as opaque app icon, padded adaptive foreground, launch image and public-site icon. Source artwork retained; runtime files are in the repository.
- Native release requested, version 1.0.0 with remote build-number increment. Existing ASC app 6826553963, bundle and A$1.99 lifetime price retained.
- Microphone explanation covers both hold and tap recording. Review notes no longer claim an unverified video was supplied and disclose EAS Update.
- Purchase library pinned to 6.2.0. Purchase adapter handles transaction events and direct results, reconciles a failed/empty request with owned transactions, cleans subscriptions, bounds the wait and preserves Restore.
- Existing test-store guard prevents the Expo Go fake unlock in a native store build. First-language hint and Settings language picker already exist. Pack level filter starts off and the empty state offers Show all.
- First 10 rounds are a usage-limited free tier, not an automatically started time-based trial; no trial product is added.

Local verification: 33/33 Node tests passed (including four new transaction-event/recovery regressions), TypeScript passed, iOS and Android release exports passed. PNG audit: opaque RGB 1254x1254 main icon; transparent 1254x1254 launch/adaptive images with the visible mascot centered inside the safe area; all eight store JPEGs are 1320x2868. Upload and Apple processing pending. No physical-device success or Apple approval is claimed.

Remaining first-submission evidence: real iPhone gameplay/recording/sharing, sandbox Plus purchase and Restore, physical-device screen recording; published App Privacy; complete App Review contact; processed intended build attached; Plus metadata ready; iPad screenshots if the enabled tablet support requires them. First Submit for Review remains Jared's action. Existing account-level paid agreement/bank/tax completion is recorded by the factory; recheck any new warning in Apple.

Implementation reference: [OpenIAP purchase lifecycle](https://www.openiap.dev/docs/features/purchase), checked 26 October 2026; request completion alone is not the purchase result.
