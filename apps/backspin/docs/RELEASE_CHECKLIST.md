# Backspin release evidence — 26 October 2026

This records verification against the shared `docs/RELEASE_STANDARD.md`; the master roadmap remains the plan.

- New owner-supplied mascot is packaged as opaque app icon, padded adaptive foreground, launch image and public-site icon. Source artwork retained; runtime files are in the repository.
- Native release requested, version 1.0.0 with remote build-number increment. Existing ASC app 6826553963, bundle and A$1.99 lifetime price retained.
- Microphone explanation covers both hold and tap recording. Review notes no longer claim an unverified video was supplied and disclose EAS Update.
- Purchase library pinned to 6.2.0. Purchase adapter handles transaction events and direct results, reconciles a failed/empty request with owned transactions, cleans subscriptions, bounds the wait and preserves Restore.
- Existing test-store guard prevents the Expo Go fake unlock in a native store build. First-language hint and Settings language picker already exist. Pack level filter starts off and the empty state offers Show all.
- First 10 rounds are a usage-limited free tier, not an automatically started time-based trial; no trial product is added.

Local verification: 33/33 Node tests passed (including four new transaction-event/recovery regressions), TypeScript passed, iOS and Android release exports passed. PNG audit: opaque RGB 1254x1254 main icon; transparent 1254x1254 launch/adaptive images with the visible mascot centered inside the safe area; all eight store JPEGs are 1320x2868. PR108 merged as 26bab64 after GitHub check40292738007 passed. Expo quota refused the cloud build; existing GitHub Mac fallback40293135600 is building. Apple sync40292972610 accepted listing text and attached previous build5; the new build is not yet uploaded. No physical-device success or Apple approval is claimed.

Remaining first-submission evidence: real iPhone gameplay/recording/sharing, sandbox Plus purchase and Restore, physical-device screen recording; published App Privacy; complete App Review contact; processed intended build attached; Plus metadata ready; iPad screenshots if the enabled tablet support requires them. First Submit for Review remains Jared's action. Existing account-level paid agreement/bank/tax completion is recorded by the factory; recheck any new warning in Apple.

Implementation reference: [OpenIAP purchase lifecycle](https://www.openiap.dev/docs/features/purchase), checked 26 October 2026; request completion alone is not the purchase result.

Apple follow-up: current Plus state is MISSING_METADATA and review contact is incomplete. Store setup can fill only missing review contact fields from a complete Linework contact (values remain private in Apple requests), and opt in to initialize missing Plus availability without changing an existing territory selection. Seven offline tests cover preservation, partial data, creation and failure boundaries.

Tablet evidence: native supportsTablet remains enabled, so 13-inch iPad screenshots are required ([Apple specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)). The dedicated manual capture workflow builds this commit on an iPad simulator with OTA disabled, then saves actual first-launch and route screenshots for inspection. It does not claim a physical-device test.
