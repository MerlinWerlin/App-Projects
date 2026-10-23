# Owner test 23 Oct 2026 evening (fb-1023)

The owner tested the calm-bubbles build in Expo Go: "It looks good again." That answers the T109 retest (calm category transition) and closes the wait on T105's iPhone check as far as the owner has reported. fb-1023 tasks outrank everything except trial blockers.

| Task | What | Status (run 90) |
|---|---|---|
| T112 · A | Calm transition when a search chip (Games / Movie night / Storybook), sub-tab or collection swaps the Themes results, and when the Wallpapers sub-tab or All / New / Picks / Liked changes. Opacity-only fade with the fb-1022c GRID_FADE timing; no slide, scale, spring or stagger. Applied exactly from the owner's live diff. | done |
| T113 · B | Wallpapers: All / New / Picks / Liked as a 2×2 block of equal pills; "Our picks" shortened to "Picks" in every locale (ja/ko unchanged). Applied exactly from the owner's live diff. | done |
| T114 · C | Widgets tab "looks good"; add small preview pictures for each widget type/option (size tabs, look row, theme chips) so it is visual, not just text. | done (cloud-checked only) |
| T115 · D | Mascot idea ("maybe"): three fully original animated companion concepts (mascot, maybe app icon, animated widget, a few variants). Concepts only: Tessel, Latchling, Vitri in docs/MASCOT.md with previews. Owner question: "Which mascot (1, 2, 3 or none)?" The real app icon is unchanged until he picks. | done (concepts) |
| T52 | Real PC tsc (23 Oct 18:30 Sydney): 410 errors, zero in app/ or src/ code; all Node built-in typings in *.test.ts, ops/*.ts and app.config.ts (TS2591/TS2304) plus 2× TS7006 for `f` in app.config.ts. Fix: app tsconfig excludes Node-side files; tsconfig.node.json checks them with types ["node"]; `f: string`. | done; 0 errors to be confirmed by the PC's next unattended TSC_REPORT run |

A and B were made live in the owner's chat and on his PC copy first; the build applied the same diff with its guard test `src/core/fb1023.test.ts`.

PC side (23 Oct): the owner's PC auto-start (`Desktop\Apps\_auto`) installs each new build, runs TSC_REPORT.cmd unattended and restarts Expo. The build page and docs/TRIAL.md no longer ask him to download kits or run .cmd files; he opens Glaze from Expo Go > Recently opened about 10 minutes after a new build.
