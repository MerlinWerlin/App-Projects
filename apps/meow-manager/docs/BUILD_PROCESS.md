# Build process and evidence — 4 November 2026

This is a record of what was done and verified. The single project roadmap is `C:/BTB/_ATLAS/MASTER_ROADMAP.md`, APPS / Meow Manager. Codex performed this build solo, without agents or new scheduled workers.

## Source and setup

1. Read the owner roadmap, atlas/folder descriptions, current App Factory guide, repository shipping/release standard and newer app conventions. A Pages search for app infrastructure returned no relevant additional app guide. The local atlas identified App-Projects as the source authority.
2. Confirmed that the existing App-Projects checkout was on a Glaze branch with uncommitted theme changes. Created the separate owned `Apps/meow-manager` worktree on `codex/meow-manager-20261104` from GitHub main `4444889`.
3. Added the owner direction and new app row to the master roadmap after a timestamped backup and fresh-byte comparison. Recorded the source authority in the librarian handoff.
4. Created `apps/meow-manager` using the existing SDK 57 package pins, Router entry, strict TypeScript, EAS profile structure and test pattern. Added calendar, local notifications, speech and web support at SDK-matched versions; installed a reproducible app-specific lockfile.

## Implementation record

5. Built the versioned task/ritual/chat store, strict backup validation, English/Japanese local capture, calendar-aware day planner, explicit overflow/collision handling and reminder eligibility.
6. Drew the original cat and room as SVG code. Added the day view, capture/editor sheets, assistant conversation, small-step checklists, daily rituals, focus timer, editable message draft, explicit search and settings.
7. Added native calendar/notification/speech adapters with honest outcome messages. Kept cloud AI credentials and connected external execution out of this first build.
8. Checked focus and input lifecycle: moved modal sheets outside the root component so typing does not remount fields. Preserved checklist progress by disabling regeneration after steps exist. Separated flexible deadlines from fixed appointment times in task editing.

## Verification record

- TypeScript strict check: passed.
- `expo install --check`: dependencies aligned with SDK 57.
- Node core checks: 26 tests covering English/Japanese capture, date validity, midnight rollover, explicit/relative reminders, scheduling around appointments, collisions, priority, overflow, completion, snooze, backup validation and translation placeholders.
- Final iOS, Android and web exports: all passed. Expo doctor: 21/21 checks passed. Mobile bundles were produced; this does not establish native device behaviour.
- Browser UI check used the exported real app at `http://127.0.0.1:8102/`, not a separate mockup. `localhost` initially resolved to an unavailable interface; the IPv4 URL worked.
- Entered two clearly labelled `Preview:` tasks, edited a proposed title, saved and reloaded. Both persisted. Completed the grocery task; progress and completion changed. Opened the assignment and generated its four-step checklist.
- Switched the complete interface to Japanese and inspected it at 390 × 844. The bottom navigation, text wrapping, cat and task cards rendered. The browser cannot verify calendar permissions or phone notifications.
- GitHub checks and the final commit/PR are recorded in `ops/RUNLOG.md` and `ops/status.json` when available.

## Items still requiring evidence

Real iPhone/Android reminder delivery, deny/revoke permission paths, notification taps, native calendar behaviour and on-device speech remain unverified. A first native TestFlight build additionally needs the Meow Manager Expo project, signing/ASC setup and native app icon/splash assets. The app has not been submitted to an app store. Japanese market demand and fluent-copy review remain open. All further work is tracked in the master roadmap rather than a second plan file.
