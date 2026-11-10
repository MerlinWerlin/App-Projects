# Cue store kit

This is the APPS A2 release metadata and screenshot source for Cue. Codex maintains it alongside the release code; GitHub main is authoritative. `listing.json` is applied by `scripts/asc/asc.py` when `ASC_REQUEST.json` changes to apply mode. The workflow never submits App Review. Use status mode for read-only checks after preparation.

Plus is the non-consumable `com.jared797.cue.plus`, Australia A$2.99. The user-started free non-consumable `com.jared797.cue.trial7` is named exactly `7-day Trial`. Keep the Australia price and `src/plus/entitlement.ts` synchronized if changing it. Other stores use their localized prices.

The older `jpg/ios/` and `src/render.mjs` assets are retained historical illustrative mockups. Their old orange palette and trial wording are superseded and must not be reused for this release. The release checklist records the actual native capture workflow and source revision; visually inspect every replacement before uploading.

The current `native/` folders contain inspected simulator captures of build 13 source `d73a869`: three iPhone screenshots, two iPad screenshots and one complete paywall image for both purchase reviews. Capture run 40476615975 succeeded using the compiled app preserved by run 40472424782. The public website uses the same iPhone images. The iPad library capture caught the launch animation and is intentionally excluded. Each folder records its provenance and purpose; the review image's USD $1.99 label is the US storefront, separate from the verified Australian A$2.99 schedule.

## Android Google Play listing preparation

Codex maintains these drafts for APPS / Cue Android simulation and release.
play-listing.json is the proposed English listing. assets contains exported
graphics and actual Android UI captures, with hashes and source provenance.
These Android drafts do not publish or submit an app.
Android's trial is device-local; do not configure Apple's free trial SKU in Play.

To reproduce the graphics, install @resvg/resvg-js@2.6.2, opentype.js@2.0.0 and
pngjs@7.0.0 in an external tool folder. Run generate-play-assets.cjs with that
folder's node_modules path, the downloaded store-capture artifact folder and
its GitHub run ID. App dependencies and original branding files are unchanged.
The generator exports the existing icon, outlines the app's own fonts in SVG,
and losslessly converts opaque UI captures to RGB PNG.

Sizes and formats follow [Google's preview-asset guidance](https://support.google.com/googleplay/android-developer/answer/9866151)
and [icon specifications](https://developer.android.com/distribute/google-play/resources/icon-design-specifications).

**No-OTA build (10 Nov 2026):** build 13 was withdrawn from review before a decision, so that the binary cannot change after review (Guideline 5.6, as in the Backspin rejection). The new 1.0.0 build removes expo-updates completely. Before resubmitting, apply `APP_PRIVACY_NO_OTA.md` (App Privacy: Data Not Collected; privacy page edits). `listing.json` already holds the updated review notes.
