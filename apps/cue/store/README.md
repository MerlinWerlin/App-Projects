# Cue store kit

This is the APPS A2 release metadata and screenshot source for Cue. Codex maintains it alongside the release code; GitHub main is authoritative. `listing.json` is applied by `scripts/asc/asc.py` when `ASC_REQUEST.json` changes to apply mode. The workflow never submits App Review. Use status mode for read-only checks after preparation.

Plus is the non-consumable `com.jared797.cue.plus`, Australia A$2.99. The user-started free non-consumable `com.jared797.cue.trial7` is named exactly `7-day Trial`. Keep the Australia price and `src/plus/entitlement.ts` synchronized if changing it. Other stores use their localized prices.

The older `jpg/ios/` and `src/render.mjs` assets are retained historical illustrative mockups. Their old orange palette and trial wording are superseded and must not be reused for this release. The release checklist records the actual native capture workflow and source revision; visually inspect every replacement before uploading.
