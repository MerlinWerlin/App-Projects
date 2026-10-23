# Couch roadmap

Last updated: 18 Oct 2026 (run 41). The task-by-task backlog lives in `ops/backlog.json`; this page
is the plan above it, so nothing agreed gets lost. Keep it current: every run that adds, finishes or
re-orders a phase updates this file and tells the librarians (see "Where this is filed").

**Where we are:** stage **owner-tested**. 64 of 77 tasks done, 1269 tests green, core typecheck
clean. Drivers are tested against recorded fixtures only; nothing has been tried on a real TV yet.

## Phase 1 — Market upgrades (now, cloud runs)
Source: owner request 18 Oct (`docs/OWNER_1018.md`), research in `docs/MARKET.md`.

| Done | Task | What | Why |
|---|---|---|---|
| ✅ | T66 | App tiles show the real app icons the TV supplies (Roku, LG, Samsung, Sony). Never bundled. | Owner wants real logos |
| ✅ | T67 | iOS-style design spec + shared components (`docs/DESIGN_V2.md`, `src/ui/v2`) | Fresher, iOS-native look |
| ✅ | T70 | Silent fast reconnect on wake/foreground, keep-alive | Top functional complaint about rivals |
| ✅ | T71 | "Lost your remote?" help + TV Allow-prompt explainer | Main reason people download remotes |
| ✅ | T72 | Hold-to-repeat on rockers/transport/arrows + free sleep timer | Cheap wins rivals have |
| ☐ | T68 | Move every screen to the new iOS design (large titles, grouped lists, pills, blur) | Redesign, part 2 |
| ☑ | T69 | New store screenshots from the playbook (price promise first, no logos; 7 shots, run 45) | Conversion |
| ☐ | T73 | Edit app shortcuts (long-press to reorder/remove) | Users hate fixed shortcuts |
| ☐ | T74 | Larger Text audit (nothing overlaps at the biggest sizes) | Rivals break here; selling point |
| ☐ | T75 | Polite rating prompt (once, after a good week) | Rivals nag |
| ☐ | — | Monthly refresh of `docs/MARKET.md` | Keep pricing/feature view current |

## Phase 2 — Release prep for TestFlight (needs the owner's PC + accounts)
| Done | Item | Who |
|---|---|---|
| ☐ | Owner retest in Expo Go (OK button, icons, sleep timer, reconnect after lock/unlock) | Owner |
| ☐ | T18 PC verification: double-click `VERIFY.cmd`, paste `verify-report.txt` as a page comment | Owner, then build fixes |
| ☐ | T19 RTL render tests (after T18 installs the UI test stack) | Build |
| ☐ | Decide Couch Plus price (proposal US$4.99 / A$7.99 one-time, Family Sharing) | **Owner** |
| ☐ | Request Apple's multicast networking entitlement (steps in `docs/RELEASING.md` §d) | **Owner** |
| ☐ | Pick the final app name ("Couch" is a working title; check App Store + trademark) | **Owner** |
| ☐ | R1 app icon + splash (original art) · R2 demo mode for App Review · R3 privacy + support pages · R4 store listing copy · R5 end-to-end pass | Build |
| ☐ | First TestFlight build via EAS from the PC (`docs/RELEASING.md`) | Owner |
| ☐ | Real-TV smoke tests: list the TVs/streamers at home (brand, model, year) | Owner |

## Phase 3 — Development-build features (after the first TestFlight build)
These need native code, so they can't run in Expo Go; each sits behind an adapter that never crashes it.
- T29 on-device speech-to-text for voice search.
- T31 Google TV native pairing; T34 Vizio, Philips and Fire TV in the add-TV flow; T33 webOS pairing signature check.
- T76 cast photos and videos to the TV (DLNA/UPnP) — the most common feature rivals have that we don't. Core done (run 43); native part T80 needs a dev build.
- Couch Plus: T77 Home Screen widget (core done run 44; native part T82 needs a dev build), then Lock Screen/Control Center controls, Live Activity volume, Apple Watch, macros ("Movie night").
- Real blur materials (`expo-blur`) for the new design.

## Phase 4 — Launch and after
- App Store + Play submission (owner's accounts), localised screenshots for the 11 languages.
- A plain comparison page (Couch vs typical weekly-subscription remotes: price, ads, data) so people and AI assistants can recommend it — owner idea.
- Foldable iPhone layouts when Apple ships one (owner wants to be ready on launch day).
- Keep the promise: every TV control free forever, no ads, no tracking, no subscriptions.

## Owner decisions waiting
1. Couch Plus price. 2. Final app name. 3. Multicast entitlement request. 4. List of real TVs to test.

## Where this is filed
- Repo: `docs/ROADMAP.md` (this file), backlog `ops/backlog.json`, status page "Couch build".
- Project library: `claude/tvremote-roadmap.md` (copy of this file), catalogued in `claude/INDEX.md`,
  summary line in `claude/app-factory.md`. Market research: `claude/tvremote-market-research.md`.
