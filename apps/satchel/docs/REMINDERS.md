# Trip reminders

Optional local notifications before each plan, with Satchel's own sounds and the mascot as the thumbnail.
Off by default; the traveller turns them on in **Settings > Reminders > Trip reminders** (or from the one-time
"Remind me before each plan" card on the Itinerary tab).

## What fires when

| Plan | Reminder | Sound |
| --- | --- | --- |
| Flight | 3 h before departure: "Your flight to Kyoto leaves at 09:40." | `satchel_depart.wav` |
| Train, ferry, bus | 1 h before departure | `satchel_depart.wav` |
| Hotel | 2 h before check-in ("Check in at Hotel Gion from 15:00."), and 1 h before check-out when the stay has an end time | `satchel_checkin.wav` |
| Car hire | 1 h before pick-up | `satchel_checkin.wav` |
| Activity | 30 min before ("Tea ceremony in 30 minutes.") | `satchel_chime.wav` |
| Note | none | |

Times are the plan's own wall clock (what the ticket says), converted with `toUtc`. Skipped: demo trips, times already
past, plans with an unreadable time or zone, and anything more than 14 days ahead. At most 60 are scheduled (iOS keeps
64 pending per app), soonest first. Ids are `satchel-<itemId>-<slot>`, so a re-plan replaces them in place and we only
ever cancel our own.

**Tweaking lead times:** `LEAD_MINUTES` and `CHECKOUT_LEAD_MINUTES` in `src/core/reminders.ts` (also `HORIZON_DAYS`,
`MAX_REMINDERS`). Update the matching numbers in `src/core/reminders.test.ts` and this table. The activity wording
takes the minutes from the lead time; the transport and hotel wording quotes the plan's time, so it never goes stale.
Strings are in `src/i18n/en/reminders.ts`.

## How it works

- `src/core/reminders.ts` (pure, tested) plans the list.
- `src/state/reminders.ts` `useTripReminders` is mounted once in `app/_layout.tsx` and re-plans, debounced, whenever
  trips or the setting change, when the permission answer comes back, and each time Satchel comes to the front.
  Tapping a reminder opens that plan (`/item/<id>`).
- `src/native/notifications.ts` asks for permission only when reminders are turned on (alerts and sounds, no badge),
  shows a banner with sound while Satchel is open, cancels our pending reminders and schedules the new plan. Each
  carries its custom sound and, on iOS, a fresh cache copy of `assets/mascot/notify.png` as an attachment (iOS moves
  the file into its own store); if attaching fails it is scheduled without the picture. Android gets one channel per
  sound.
- If notifications are refused, the setting stays on and Settings shows a notice with **Open Settings**; allowing
  them there starts reminders the next time Satchel comes to the front.
- Screenshot builds (`EXPO_PUBLIC_SATCHEL_CAPTURE=1`) never ask and never schedule.

## Sounds

Original, synthesised by `tools/sounds/make_sounds.py` (CC0, see `assets/sounds/README.md`) and bundled by the
`expo-notifications` plugin `sounds` option in `app.json`. They are ordinary notification sounds: no critical alerts,
no time-sensitive entitlement. So they follow the silent switch, Focus, Scheduled Summary and the traveller's
notification settings for Satchel automatically. Changing a sound needs a new native build.

## Local only, no push

`app.json` sets `enableRemoteNotifications: false` on the expo-notifications plugin (it would otherwise add the
`aps-environment` entitlement), and `plugins/with-local-notifications-only.js` strips `aps-environment` and the
`remote-notification` background mode anyway. It is listed **before** `expo-notifications` because Expo runs the
callbacks of later-listed plugins first. No push token is ever requested. `src/core/reminders.config.test.ts` checks
all of this.

## Privacy

Reminders are scheduled on the phone by the phone's own notification system; nothing is sent anywhere. App Privacy
answers are unchanged: **Data Not Collected**. The public privacy page (`docs/satchel/privacy.html` at the repo root)
says so under "What stays on your phone".
