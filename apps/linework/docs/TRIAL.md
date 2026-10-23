# Try Linework on your iPhone (no Apple developer account needed)

The app runs inside **Expo Go**, a free app that loads development builds from your PC.

1. **iPhone:** install **Expo Go** from the App Store (once).
2. **PC:** install **Node.js LTS** from https://nodejs.org if `node -v` in PowerShell doesn't print a version (once).
3. **PC:** on the **Linework Build** page tap **Download trial kit (.zip)**, unzip it, then double-click **START_TRIAL.cmd** inside the `linework` folder. The first run installs packages for a few minutes, updates Expo to the version your Expo Go supports, then shows a QR code. Everything the install prints is also saved to **trial-log.txt** in the same folder. (Alternative once the App Factory overseer can reach your PC: the copy it keeps in `Desktop\Apps\tracing\code`.)
4. **iPhone:** scan the QR code with the Camera app. It opens Linework in Expo Go. Keep the PC window open while you test.

## Re-test questions (please answer each with yes / no in a page comment)
1. **Does the app open?** After scanning the QR code, does Linework open to its Home screen in Expo Go (no red error screen)? **Yes / no** (if no, or if START_TRIAL said *The code check found errors*, paste `trial-log.txt` into a page comment)
2. **Black screen fixed?** Turn on **Touch lock** on the trace screen: does the camera and your image stay visible (no black screen) the whole time, and does press-and-hold for 1 second unlock it? **Yes / no**
3. **Outline speed:** after you move *Detail* or *Line thickness*, does a preview appear within about half a second, and the sharp version within a few seconds? **Yes / no** (roughly how long?)
4. **Outline quality:** on a selfie, a pet and a flower, are the lines clean enough to trace? **Yes / no** (which looked worst?)
5. **Templates:** can you find something you'd like to trace within a minute using search or the collections? **Yes / no**
6. **Focus mode:** on the trace screen, do the buttons fade away after about 3 seconds untouched and come back with one tap (without that tap pressing anything)? **Yes / no**
7. **Opacity bubble:** while you drag the opacity slider, does a % bubble follow your thumb with a light tick at 25 / 50 / 75 / 100 %? **Yes / no**
8. **Lock morph:** when you tap Lock, does the padlock snap shut with a buzz and a quick frame flash around the image (and open again on unlock)? **Yes / no**
9. **Sketch reveal:** on Prepare in Outline, does a soft shimmer show while it works and the line art then sweep in left to right? **Yes / no**

## New tonight: premium polish (please tell us how it feels)
- **Trace focus mode:** leave the trace screen untouched for 3 seconds — the buttons fade away so only the camera and your image show; tap once anywhere to bring them back (that tap never presses a button).
- **Opacity slider:** drag it and a % bubble follows your thumb, with a light tick at 25 / 50 / 75 / 100 %.
- **Lock:** the padlock snaps shut with a success buzz and a quick white frame flashes around the image.
- **Outline:** while it works you see a soft shimmer; the finished line art then sweeps in left to right like a pencil sketch, and changing a style cross-fades instead of popping.
- **Templates:** cards ease in, shrink slightly when pressed, the heart pops, and the category underline slides to the chip you pick.
- **Home:** subtle paper texture and softly lit main buttons; screens slide in, Trace fades in through dark grey.
- Turn on **Reduce Motion** (Settings → Accessibility → Motion) to check everything still works with simple fades. None of this has been tried on a real phone yet — tell us anything that feels slow, jumpy or gets in the way.

## New: languages (16 Oct)

Linework now speaks 11 languages and follows your iPhone's language. To try it: Settings (gear on Home) → Language at the top → pick one. Spanish, French, German, Italian, Portuguese (Brazil), Japanese, Korean, Chinese, Hindi and Arabic are machine translations waiting for a native speaker's check.
- Does switching to another language change every screen right away (yes / no)?
- Arabic: after picking it, does the app restart (or ask you to reopen it) and lay out right-to-left, while the camera view and your image stay the right way round (yes / no)? In Expo Go the restart may need you to close and reopen the app.
- Does any text get cut off with "…" in German or French (yes / no — if yes, which screen)?

## New 22 Oct, release set-up (yes / no each)
1. Settings → Linework Plus: it says "Free trial: 14 days left", lists what stays free, and "Unlock for A$2.99" (in Expo Go the button says purchases work in the App Store version).
2. Tap "End trial now (test build)": Templates now show a small lock "Plus" badge on all but 24 starters, tapping one opens Linework Plus; Prepare → Outline opens Linework Plus; tracing your own photo still works with every tool.
3. Tap "Restart trial (test build)" to undo.

## New 22 Oct night (yes / no each)
1. Opening: the pencil slowly draws the blue line, stops at the end, then a soft light runs along the line with little sparkles until the app is ready, then it fades into Home?
2. Templates → Level: All / Beginner on the top row, Intermediate / Advanced underneath, each word fully readable?

## New 22 Oct late: 529 templates, faster Templates (yes / no each)
1. Templates opens instantly, even the first time after launch (the art is now pre-baked; before it could pause for seconds)?
2. **Animals & pets** now has 41 (cats, dogs, horse, farm and safari animals, fox, wolf, hedgehog…). Any that look off?
3. **Faces & figures** 30 (portraits, profiles, eyes/lips/nose/ear studies, hands, simple poses) and **Still life** 24 (teapot, camera, radio, typewriter, kettle…)?
4. **Buildings & landscapes** 28 (windmill, canal houses, treehouse, station, skyline…) and **Fantasy** 24 (crystal ball, spell book, sleeping dragon, floating island…)?
5. **Shapes** 20 drawing-practice forms (cube in perspective, torus, isometric cubes…) and **Frames & patterns** 25 incl. 16 tattoo-flash pieces (anchor, compass rose, heart and key…)?
6. **Game world** 31 and **Heroes** 26 — meet the new original hero team (Starbright, Volt Fox, Tidewave, Iron Acorn, Gearbit; docs/CAST.md). Do they feel like characters worth tracing?
7. The **New** bubble now also shows Sea life and the kawaii pieces?

## New 22 Oct evening: template library x1.7 (yes / no each)
1. Templates → **Sea life**: the whale, koi, nautilus and fish are there now (not in Birds & insects), plus 31 new sea creatures?
2. **Cute & chibi** has 80 pieces (60 new kawaii: food with faces, sweets, plants, weather, animals, stationery, chibi kids)? Do they look charming at each level?
3. **Movie night** and **Fairy tales** each have 40: sci-fi, monsters, detectives, cowboys, pirates; knights, castles, witches' cottages, giants, mermaids, talking animals?
4. Meet the **Linework cast** (docs/CAST.md): Pip the pencil sprite (Cute), Nova, Inspector Quill, Captain Ottoline, Sheriff Sage (Movie night), Bramble, Fern, Mossy (Fairy tales). Which one should be the app's mascot?
5. Does the Templates screen still open quickly with 354 templates? (A speed-up that pre-bakes the art is next run.)
6. Monetisation: read docs/MARKET.md §10 and pick yearly fee, one-time Plus or ads.

## New 22 Oct: 83 new templates (yes / no each)
1. Templates tab: do the bubbles start All, New, Heroes, Game world, Movie night, Fairy tales, Kids, and does New show only the new sets?
2. Heroes (13): do the caped heroes, ninja and knight look good enough to trace, and do they feel like their own characters?
3. Game world (15): do the pixel pieces (heart, sword, knight) trace cleanly at Thin and Thick line?
4. Movie night (14), Fairy tales (16), Kids (25): open a Beginner, an Intermediate and an Advanced piece in each; any that look off?
5. Home: is the new Heroes quick link there, and does it open the Heroes bubble?
6. Is the tip card about tracing any picture you own still at the top of Templates?
7. Switch to another language: are the new category and template names translated?

## New 18 Oct: bubbly redesign + release assets (yes / no each)
1. Home and Settings have the new rounded "bubbly" look (big cards, grouped settings) and everything still works.
2. Templates: category bubbles across the top (All, New, Animals, Flowers, Cute & chibi…), tall cards below, Favourites still work.
3. Bars and sheets look frosted (blurred) on iPhone; nothing looks broken if you turn on Settings > Accessibility > Reduce Transparency.
4. Prepare shows "Pick image → Outline → Trace" steps at the top; sliders show a big value bubble while you drag.
5. Settings > Outline style at start: pick Sketch, Line art or Bold — the step-by-step guide on the trace screen follows it.
6. Paper check > Finished shows a "Finished!" moment with sparkles; My drawings when empty shows a friendly card with one button.
7. The new pencil-loop app icon and splash (in a dev/TestFlight build; Expo Go shows its own icon).
8. A tab bar at the bottom (Trace, Templates, My drawings, Settings) switches screens; Prepare, Trace, Lightbox and Plus open full screen over it.
9. Templates: tapping a card opens a big preview sheet (heart, line thickness, one "Start tracing" button); long-press still starts tracing straight away.
10. Prepare, Plus and Lightbox have the new rounded look (pill buttons, white cards, frosted bottom bar on Prepare) and every control still works.
11. Trace screen: the buttons, lock badge, opacity slider, record button, touch-lock sheet and toasts look frosted (blurred) on iPhone; the camera picture itself is unchanged and every button still works.
12. Templates: no back arrow at the top any more; the tab bar hides while you type in the search box, and there is no extra empty gap above the tab bar on Home, Templates and Settings.
13. Look at the store mockups in the kit (store/contact-sheet.png): which style do you prefer — (a) serif on pastel or (b) bold on ink blue?

## What to try (about 15 minutes)
1. **First run:** swipe through the 3 tips cards.
2. **Trace a photo (new outline engine):** tap *Trace a photo* and pick a selfie or portrait first, then a pet, a flower and a busy street photo. On Prepare switch to **Outline**. Under *Style* try each preset — *Best match*, *Fine line art*, *Detailed portrait*, *Clean outline*, *Bold outline*, *Simplified*, *Detailed illustration* — they change the result, not just a label. The line under the styles says what it found (e.g. "portrait, 1 face"). Then move *Detail* (0–100 %) and *Line thickness* (0.5–8 px), switch *Background* between *Subject only*, *Soft* and *Everything*, and try a *Photo type* chip. After each change a quick, slightly soft preview appears almost at once with a small *Refining…* badge, then the sharp version replaces it; tell us how long each step feels on your phone. Try *White lines* and *Rotate 90°*, then *Start tracing*.
3. **Trace screen:** allow the camera. Pinch to size, two fingers to rotate, drag to move. Every button has a word under it. Try each one: **Lock** (a message says the image is now fixed in place; tap again to unlock), the opacity slider (right edge), **Torch**, **Grid** (tap to cycle 3×3 / 4×4 / off), **Mirror**, **Reset**, and **Touch lock**: the first time it explains itself; after *Start touch lock* the camera and image stay visible, the buttons fade, and a banner at the top says how to exit: press and hold anywhere for 1 second (a ring fills under your finger). Then try **Lightbox** (top right) and leave it with **Exit** (top left).
4. **Templates (about 130 now):** from Home pick a collection chip (Birthday, Christmas, Wedding & love, Botanical…) or *See all*. On the Templates screen try the search box (e.g. "rose", "owl", "xmas"), the Beginner / Intermediate / Advanced filter, categories and collections, and tap the heart to favourite one. Tap a drawing — a preview sheet opens; tap *Start tracing* (or long-press the card to skip the preview); it then shows under *Recently traced templates* on Home.
5. **Lightbox:** turn brightness up, lay thin paper on the phone, lock the image and trace.
6. **Settings:** change starting opacity, grid at start, haptics, keep awake; go back and start tracing to see them applied.
7. **Recent:** your traced photos appear on Home; long-press one to remove it.
8. **The real test:** prop the phone on a glass or stand ~25 cm above paper and trace something for a few minutes. Does the image stay put? Are the outlines clear?
9. **Timelapse:** on the trace screen tap the record button (film icon), draw for a minute, tap it again. Check the clip length and speed-up tip, then *Save to Photos* (allow add-only access). The overlay is not in the video. Expo Go should not ask for the microphone.
10. **Check your drawing:** tap the aperture button; compare the snapshot of your paper with the reference using the slider and side-by-side toggle, then close.
11. **Sketch steps:** tap the steps button (rising line) and step from big shapes to fine lines with the arrows (photos and templates).
12. Try dark mode (Control Centre) and denying camera access once (Settings → Expo Go → Camera off) to see the fallback.

## Sending feedback
Leave a comment on the **Linework Build** page (any device). The next build run turns each comment into a task, replies, and resolves it when fixed. Screenshots help.

## If it doesn't work
- START_TRIAL also runs a quick code check (`npx tsc --noEmit`) before starting. If it prints *The code check found errors*, the app may still open — test anyway, but paste `trial-log.txt` into a page comment so the build can fix it.
- **If anything is red, paste `trial-log.txt` (in the `linework` folder, next to START_TRIAL.cmd) into a comment on the Linework Build page**, plus whatever the PC window shows after the QR code (that part isn't in the log).
- QR scans but Expo Go says the project's SDK is unsupported: START_TRIAL already runs `npx expo install expo@latest` and `npx expo install --fix`, so update Expo Go from the App Store and run START_TRIAL.cmd again. If it still fails, paste trial-log.txt into a comment.
- "tunnel" errors: press Ctrl+C, run `npx expo start --go` (phone on the same Wi-Fi as the PC) instead.
- Anything else: paste trial-log.txt and the PC window's messages into a build page comment.

## PC check (VERIFY.cmd)

Before TestFlight, double-click **VERIFY.cmd** in the `linework` folder (or your PC copy). It installs packages, checks the code, runs the tests and builds an iOS export, then writes **verify-report.txt** next to it. Paste that report into a comment on the Linework Build page. It only touches that folder.
