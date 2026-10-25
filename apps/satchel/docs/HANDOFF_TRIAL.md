# Trial hand-off (T23): what the App Factory overseer adds when Satchel reaches trial

The Satchel build run only writes the Satchel Build artifact, `Desktop\Apps\satchel` on the PC and the `_refresh_tmp\auto\satchel_*` files. The steps below touch shared App Factory machinery, so the overseer (or a PC2-linked chat) does them. Nothing here needs a paid service or an account sign-up, except the App Store Connect app record, which is the owner's step.

## 1. PC Expo Go auto-start (needed for the trial)
- Add `satchel` to `C:\Users\jared\Desktop\Apps\_auto\auto_start.ps1` the same way as Backspin: folder `Desktop\Apps\satchel`, **port 8098**, restart when `BUILD_VERSION.txt`'s commit changes, run the install + `npx expo install --fix` + `tsc --noEmit` + `npm test` + iOS export report (`tsc-report.txt`).
- Satchel is on **Expo SDK 58** (moved 25 Oct, run 6). The first PC install is the first real `npm install` this code has had: the cloud runs could only type-check against stubs. Report any errors back through an oversight directive.
- Until the auto-start serves it, the owner can double-click `START_TRIAL.cmd` in that folder.

## 2. Auto-ship and PC refresh (after the owner's first try)
- Satchel lives as a git bundle on its build artifact, not in GitHub App-Projects. Onboarding means: copy `main` into `apps/satchel` in App-Projects, then add Satchel to the "App Factory auto-ship" and "PC refresh" scheduled-task prompts.
- TestFlight needs an **App Store Connect app record** (bundle id `com.jared797.satchel`, see `app.json`/`eas.json`) and its `ascAppId`. That is the owner's step; nothing ships to TestFlight before it.
- Once onboarded, the build task's rule "never touch App-Projects (until Satchel is onboarded there)" changes; update the Satchel build prompt at the same time.

## 3. Marketing entry
- Add Satchel to `marketing/apps.json` in App-Projects **without the name** (working title until the owner locks it): stage `trial`, keywords such as offline travel wallet, flight mode tickets, emergency card, packing list; claims to avoid: battery figures, "works with every airline", anything about offline maps until T12 ships, emergency numbers being verified.

## 4. Master roadmap
- Satchel row on PC2: stage `trial` from 25 Oct (run 6), with the task and test counts from `ops/status.json`.
