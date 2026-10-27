# Cue store kit

This is the APPS A2 release metadata and screenshot source for Cue. Codex maintains it alongside the release code; GitHub main is authoritative. `listing.json` is applied by `scripts/asc/asc.py` when `ASC_REQUEST.json` changes to apply mode. The workflow never submits App Review. Use status mode for read-only checks after preparation.

Plus is the non-consumable `com.jared797.cue.plus`, Australia A$2.99. The user-started free non-consumable `com.jared797.cue.trial7` is named exactly `7-day Trial`. Keep the Australia price and `src/plus/entitlement.ts` synchronized if changing it. Other stores use their localized prices.

The older `jpg/ios/` and `src/render.mjs` assets are retained historical illustrative mockups. Their old orange palette and trial wording are superseded and must not be reused for this release. The release checklist records the actual native capture workflow and source revision; visually inspect every replacement before uploading.

The current `native/` folders contain inspected simulator captures of build 13 source `d73a869`: three iPhone screenshots, two iPad screenshots and one complete paywall image for both purchase reviews. Capture run 40476615975 succeeded using the compiled app preserved by run 40472424782. The public website uses the same iPhone images. The iPad library capture caught the launch animation and is intentionally excluded. Each folder records its provenance and purpose; the review image's USD $1.99 label is the US storefront, separate from the verified Australian A$2.99 schedule.
