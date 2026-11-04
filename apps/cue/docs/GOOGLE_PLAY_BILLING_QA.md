# Cue licensed billing rehearsal — not yet executed

Run after account verification enables the Cue app record and its one-time Plus
product. Use the production package `com.jared797.cue`, a signed test-track
build, and a Google account configured for license testing. The preview package
does not establish real-store results.

Confirm the purchase sheet offers Google's test payment instrument before
proceeding. Test-track membership alone does not prevent real charges. Google's
non-consumable test guidance covers approval, decline, delayed payment and
refund/revocation for repeated tests. [Official billing test instructions](https://developer.android.com/google/play/billing/test).

## Cue acceptance cases

Begin paid-purchase cases with the local trial inactive, so trial access cannot
hide a missing paid entitlement. Record the build/source, OS/page size, selected
test instrument, UI result and pass/fail; keep credentials and purchase tokens
out of shared evidence. Every row below remains **NOT RUN**.

| Case | Action | Required Cue result |
| --- | --- | --- |
| Local price | Open Plus with a configured product | Google's localized price appears; Android does not replace it with the iOS currency workaround |
| Cancel/decline | Cancel the sheet, then use a declining test instrument | Paid Plus stays off; scripts and recording remain available |
| Approve | Use an approving test instrument | Plus unlocks once; restarting and Restore retain verified ownership |
| Delayed approval | Start a delayed-approval test purchase; restart while pending | Pending does not grant paid Plus; refresh/Restore grants it after store confirmation |
| Delayed decline | Start a delayed-decline test purchase; restart | No paid unlock or acknowledgement of the pending item |
| Acknowledgement recovery | Interrupt connectivity after store confirmation, then reconnect and refresh/Restore | Confirmed ownership remains available; failed acknowledgement is retried and completes |
| Revocation | Revoke only the recorded test order in Console, then refresh/Restore | Paid Plus is removed; any independently valid local trial keeps its original end date |
| Existing ownership | Attempt purchase again after success | No duplicate charge request; existing ownership is recognized |

For license-test purchases, Google documents a short acknowledgement/refund
window of three minutes. Check Console order state promptly when testing
recovery; a successful UI alone is insufficient. [Official acknowledgement test guidance](https://developer.android.com/google/play/billing/test#test-one-time-products).

## Separate device-local trial

Cue's Android trial is not a Google subscription trial. Google's accelerated
subscription-trial settings do not change it. Start it explicitly, restart,
and verify the earliest date persists. Paid purchase/restore must not renew
that date or convert the trial into permanent ownership. Clearing data or
reinstalling can remove its device-local record; this limitation is disclosed
in the draft listing.

Source-level retry and pending-state tests already exist in purchases.test.ts.
They complement this licensed rehearsal and do not fill in its result rows.
