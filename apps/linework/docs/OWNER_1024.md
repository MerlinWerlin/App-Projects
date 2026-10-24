# The free trial now follows Apple's rule (24 Oct 2026)

**What changed, in plain words:** the 14-day free trial no longer starts by itself the first time Linework opens.
People now tap **Start free trial** after the app has told them exactly what they are getting. Your pricing is the
same: 14 days of everything, then Linework Plus A$2.99 one-time keeps the full template library and outline mode;
tracing your own photos with every tool and the 24 starter templates are free forever. No ads, no subscription.

## Why

Apple's App Store Review Guideline 3.1.1 allows a free trial in an app that sells a one-time unlock only if:

1. the trial is a **free in-app purchase** (a "Non-Consumable" at price Free) named like "14-day Trial", and
2. **before it starts**, the app clearly says how long it lasts, what stops working when it ends, and what the
   person would have to pay to keep it.

The old trial (counting from the first launch, with no in-app purchase) would most likely have been rejected at the
first App Store review.

## What people see now

- **First open:** the free tier (own photos with every tracing tool + 24 starter templates). After the setup tips,
  Home shows one card, once:

  > **Try everything free for 14 days**
  > Free forever: tracing your own photos with every tool, and 24 starter templates.
  > When the trial ends, the rest of the template library and outline mode lock.
  > To keep them: Linework Plus, A$2.99 one-time. No subscription. Nothing is charged automatically.
  > [Start free trial] [Not now]

  "Not now" hides it for good. Tracing is never blocked.
- **Plus screen:** the same text and a **Start free trial** button above **Unlock for A$2.99** (the App Store's own
  price in the person's currency once the store answers).
- **Tapping a locked template or Outline** still opens the Plus screen, where the offer is.
- Tapping **Start free trial** shows Apple's normal purchase sheet at price Free. When it goes through, everything
  unlocks for 14 days from that moment.
- **Reinstalling does not restart the trial:** the start date comes from Apple's record of the free purchase, so
  Restore (or tapping Start free trial again) brings back the original date. Someone whose trial already ended is
  told so, and keeps the free tier.
- **Testers who already had the old automatic trial keep their days** (their start date is honoured as before).

## What you need to do (in docs/RELEASE_CHECKLIST.md, step 2)

In App Store Connect, add a second in-app purchase next to Linework Plus:

| Field | Value |
|---|---|
| Type | Non-Consumable |
| Reference name | 14-day Trial |
| Product ID | com.jared797.linework.trial14 |
| Price | Free |
| Display name | 14-day Trial |
| Description | Try every template and outline mode free for 14 days |

Add this to App Review notes: "The 14-day trial is a free non-consumable per guideline 3.1.1; Plus is the A$2.99
non-consumable". Tick both purchases when you submit version 1.0.

## Testing

- **TestFlight (sandbox):** Plus → Start free trial → everything unlocks with "14 days left". Delete and reinstall
  → Restore purchases → the same date comes back. Then Unlock for A$2.99.
- **Expo Go:** there is no App Store there, so Start free trial explains that. Use the test links on the Plus screen
  instead: "Start trial", "End trial now", "Restart trial", "Forget trial" (shows the offer again) and
  "Simulate purchase".

Only a TestFlight sandbox run proves the real store path; the code was checked with tests and a fake store.
