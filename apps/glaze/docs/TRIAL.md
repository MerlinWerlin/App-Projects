# Try Glaze on your iPhone (no Apple developer account needed)

The app runs inside **Expo Go**, a free app that loads development builds from your PC.

1. **iPhone:** install **Expo Go** from the App Store (once).
2. **PC (automatic since 23 Oct):** your PC's auto-start (`Desktop\Apps\_auto`) installs each new build, runs the type check by itself and restarts Expo. You don't download kits or run any .cmd files.
3. **iPhone:** open Glaze from **Expo Go > Recently opened**, about 10 minutes after a new build.

## 26 October owner feedback: widgets and icon selection

Jared confirmed **bulk install worked**. Do not ask him to repeat the old install verdict or suggest parking Glaze for it. He reported that colour/gradient edits never reached widgets, month progress dots were missing from Add Widget, theme icon selection was hard to find, and blob/small-symbol exports had black surrounds. Audit covers the whole catalogue, not only month progress.

The repair branch connects saved editor designs to WidgetKit, registers month/year progress, analog clock, month calendar and countdown, and makes unsupported widget/size combinations explicit. Themes now has **Choose icons**; Install first loads the theme being viewed. Old icon sets without a backdrop use an opaque colour from the icon style. iOS still applies its rounded-square outer mask: blob/circle are artwork inside it, not transparent replacement shapes.

**A new native TestFlight build is required.** An OTA cannot add WidgetKit registrations or the v2 bridge reader. Once that build is available, a short device check is month dots in Add Widget, one edited gradient on the Home Screen, and Themes > Choose icons > bulk install. No successful phone retest of this repair is claimed. Battery, photo album and habit accessory sizes remain preview-only; drafts are retained.

## Earlier checklist: 25 Oct night (bulk install now confirmed)
These ride in the **next TestFlight build** together with the fb-1025 fixes below. Your phone still has the older build: none of the 25 Oct fixes reach it until the newest Glaze ship PR in App-Projects is merged and auto-ship builds it. Answer yes / no on the Workboard.

- **1. Bounce:** scroll any list past its end, open the Plus sheet, apply a theme, crop a photo. Anything still bounce or spring back? yes / no
- **2. Buy Glaze Plus:** first do the App Store Connect steps in `docs/IAP_SANDBOX.md` (Workboard item glaze-iap-product). Then Plus sheet › **Unlock for A$2.99**: does Apple's sheet appear marked as a test purchase (nothing charged), and does Plus unlock? yes / no. Delete and reinstall, then **Restore purchases**: does Plus come back? yes / no
- **3. Bulk install:** Icons › Install › Bulk install. Safari should now ask to download the profile straight away (no extra tap). Does **Profile Downloaded** appear in Settings? yes / no. After installing it, are all the icons on your Home Screen? yes / no. Tap three of them: does the right app open, and is there a Safari flash first? yes / no. The honest verdict is in `docs/BULK_INSTALL_VERDICT.md`: possible on iOS, with limits.
- **4. Live Photo wallpaper:** Live › Save as Live Photo, then Photos › Share › Use as Wallpaper. Is the Live Photo button available (not "Motion not available"), and does it move when you wake the phone? yes / no

**What changed, in plain words:** no list or sheet bounces any more. Glaze Plus can now really be bought in TestFlight (Apple's sandbox, free) once the product exists in App Store Connect. Bulk install asks Safari for the profile instantly, so iPhone no longer closes Glaze's mini server before the download. Live Photos are now made in the wallpaper format other developers found iPhone accepts (1080x1920, HEVC, HEIC photo); one camera-only piece can't be copied, so it may still say Motion not available.

## Earlier: 25 Oct evening, fb-1025 (still in the next build): your retest answers A-G
Everything below is in the **next TestFlight build**. It does not have to wait for 1 Nov: once you merge App-Projects PR #96 (Workboard item appfactory-merge-94-96), auto-ship builds it, using GitHub's Mac when Expo's free iOS builds are spent. Install it, open Glaze once, then answer yes / no on the Workboard or in a page comment.

- **A. Widgets follow your theme:** Widgets tab › tap a different theme chip. Under the chips there is now a small **link check** line. What does it say: "Home Screen widgets linked", "App Group missing", or "Add a Glaze widget to your Home Screen"? (This tells us exactly where the fault is.) Then long-press the Home Screen › + › Glaze: do the widgets show that theme's colours? yes / no. Do widgets already on the Home Screen change within a few seconds? yes / no
- **B. Bulk install is the only method:** Icons › Install. Is **Bulk install** the only method (no Shortcuts card)? yes / no. Tap it: does Safari open, does **Profile Downloaded** appear in Settings › General › VPN & Device Management, and do the icons land on the Home Screen? yes / no. If not, say where it stopped.
- **C. Live Photo, honest copy:** the Live tab now says plainly that it saves a Live Photo that moves when you press it in Photos, and that iPhone often keeps app-made Live Photos still as a wallpaper ("Motion not available" is an Apple limit). Is that clear and fine to ship as an extra? yes / no
- **E. No bounce anywhere:** Plus sheet, theme apply, photo crop, shapes, toasts, the Live tab list and trim handles. Any bounce or overshoot left? yes / no
- **F. Price:** does the Plus sheet say **One-time A$2.99**? yes / no
- **G. Prism icon:** the app icon, splash and opening animation are now the Prism (a faceted crystal splitting light into a colour fan). Your Prism picture wasn't in the build files, so it was redrawn from the name: does it match what you picked, or close enough? yes / no
- New themes stay held until A and B work (your 25 Oct call).

**What changed, in plain words:** widgets now re-theme when you pick a theme on the Widgets tab, and the app shows whether the widgets can actually see Glaze. Bulk install is the only install method. The Live Photo part no longer promises a moving Lock Screen. No bounce animations remain. Plus shows A$2.99. The app icon is now Prism.

## Earlier: fb-1024e (24 Oct night, run 104): fb-1024e, "good enough to ship"
These need the **new TestFlight build** (you merged PR #74 on 25 Oct). The cloud can't see whether that build finished: App-Projects records that Expo's free iOS builds ran out on 25 Oct (they reset on 1 Nov), so if it isn't in TestFlight yet it is waiting for the GitHub Mac-runner build or the 1 Nov reset. Your #91 language-line fix rides along with it. When it shows in TestFlight, install it, open Glaze once, then answer yes / no in a page comment.

- **A. Widgets in your theme:** open any theme and tap Apply this look (or save its wallpaper). Then long-press the Home Screen › + › Glaze. Do **all** the Glaze widgets in the gallery (Clock, Date, Little Line, Photo, habits) show that theme's colours, not white? yes / no. Add one to the Home Screen: same colours there? yes / no. Is the theme name gone from above the time? yes / no
- **B. Icons, Shortcuts way (now the default):** Icons › Install. Is **Shortcuts** first and marked Recommended? yes / no. Follow the steps for two apps: does the "Next: <app>" line and progress bar guide you, and do both icons end up on the Home Screen? yes / no. Optional: try **Bulk install (beta)** — does Safari open and does **Profile Downloaded** appear in Settings? yes / no
- **C. Live tab = Make a Live Photo:** open a clip on Live, tap **Save as Live Photo**, then in Photos › Share › **Use as Wallpaper** (Live Photo button on) › Add. Does it move when you wake or press the Lock Screen? yes / no. If iOS says "Motion not available", tell me. Is there no "Start on Lock Screen" / player anywhere any more? yes / no
- **D. Art themes and seamless widget (themes-1024):** Art row with Starry night, Sunset dunes and Deep sea: creative enough? Starry night › Seamless widget: do the edges line up on your Home Screen? yes / no
- Still open: **icon or mascot** (keep the glaze-drip icon, or mascot 1, 2 or 3) and the Glaze Plus price.

**What changed, in plain words:** Glaze is now about themes, matching icons, themed widgets and wallpaper packs. The always-looping Lock Screen is gone: iPhone has no way to do it without a music player on your Lock Screen, so it's parked until Apple opens a real live-wallpaper API (the plan is ready in `docs/future/live-wallpaper/`). The Live tab makes Live Photos instead, which move when you wake the phone. Icons install the Shortcuts way by default because the profile never showed up in Settings on your phone; the profile way is still there as a beta to try.

## Earlier: fb-1024 (24 Oct, run 97)
Open Glaze (Expo Go > Recently opened, or the TestFlight app once the new build lands) and answer yes / no in a page comment.

- **A. Opening:** close Glaze fully and open it. After the glaze-pour animation, does Themes appear straight away, with no "index" (or any other word) flashing at the top and no white or blank flash in between? yes / no
- **B. Moving around:** switch between all five tabs a few times and scroll Themes, Wallpapers and Widgets. Does it feel smooth now (no hitch when a tab opens or while scrolling)? yes / no. If one spot still stutters, say which.
- **C. Save to Photos:** open any theme, tap Apply this look › Wallpaper › **Save wallpaper to Photos**. Does it say Saved, and is the wallpaper in Photos? yes / no. If it still fails, what does the message under the button say (there's now a plain reason, a Try again button, and Open Settings when it's a permission problem)?
- Still open from last time: **icon or mascot** (keep the glaze-drip icon, or mascot 1, 2 or 3) and the Glaze Plus price.

## Earlier: fb-1023 (23 Oct evening, run 90)
Open Glaze from Expo Go > Recently opened (about 10 minutes after this build) and answer yes / no in a page comment.

- **A. Calm chip fade:** on Themes, tap the search chips (Games / Movie night / Storybook), switch sub-tabs and open a collection. Do the results just fade in softly (no slide, no zoom, no bounce), and does it feel calm? yes / no. Same on Wallpapers when you switch the sub-tab or All / New / Picks / Liked? yes / no
- **B. 2×2 pills:** on Wallpapers, do All / New / Picks / Liked sit as a neat 2×2 block of equal pills (two on top, two below), and does "Picks" read well in your language? yes / no
- **C. Widget pictures:** on Widgets, do the size tabs (Small / Medium / Large / Lock), the look row (theme / clear glass / tinted glass / glow) and the theme chips now show small pictures? Are they big and clear enough to tell apart at a glance (the clear-glass one can be faint on light themes)? yes / no
- **D. Icon or mascot:** keep the new glaze-drip app icon, or use mascot 1, 2 or 3 (Tessel, Latchling, Vitri on the Glaze Build page; details in docs/MASCOT.md)? The icon is a proposal until you pick.
- **E. Opening animation:** when Glaze starts, does the glaze-pour opening feel calm and hand over to the app within about 3 seconds? yes / no

### Earlier: calm category bubbles (22 Oct evening, run 77) — you said "It looks good again"
- Bounce removed, grid cross-fade, rest of Themes calm: answered yes (owner retest 23 Oct).

## New 22 Oct: your G1–G5 changes (about 5 minutes)
Answer yes / no in a page comment:

0. **Bubble lag:** replaced by the calm bubbles above (fb-1022c). In a theme, tap **Apply this look** twice: does the icon ripple replay smoothly? yes / no
1. **G1 first screen:** when Glaze opens, are the tip cards gone, so the Themes screen starts straight with the gallery? Open any theme: does at most one one-line hint show at the top (tap "Got it" for the next), and does the "?" at the top of Themes still open the tips? yes / no
2. **G2 shapes:** are the shape choices gone from the Themes screen (the "Your look" card)? In a theme, does the "Shape" row show the current shape and open the picker when tapped? yes / no
3. **G3 bubbles:** are the category bubbles the first thing under the big "Themes" title? yes / no
4. **G4 sub-tabs:** do All / New / Our picks / Liked sit as neat pills on one line (no clipped or broken "Our picks")? With a long language (Settings > Language > Deutsch), do they still fit or scroll sideways cleanly? yes / no
5. **G5 new themes:** scroll down Themes: do you see the free **Space · real Webb photos** section, and the new free themes (Pixel Party, Little Acre, Midnight Munchers, Cape & Bolt, Storybook Castle, Woodland Friends) marked New, plus the "Story & Play" Plus pack? Open a Space theme and tap **Download photo**: does the real telescope photo appear in the preview with the credit line under it? yes / no (if the download fails, say what it says)
6. **Free + chips:** do Space and the six free Story & Play themes show a small green **Free** pill? Under the search field, do **Games / Movie night / Storybook** show just those themes (tap again to clear)? yes / no
7. **Space photo end to end:** with a Space theme downloaded, does Apply › Wallpaper save the real Webb photo (credit shown under the step and in "Saved")? Turn on Aeroplane Mode and tap Download on another Space theme: do you get a friendly "offline" message with **Try again** (no half photo)? Settings › Storage: are downloaded Space photos listed with size and Remove? yes / no

## New 18 Oct: quick yes/no (about 10 minutes)
Open Glaze as above and answer yes / no in a comment (add a word on anything odd):

1. **Tab bar:** five tabs at the bottom (Themes / Widgets / Icons / Wallpapers / Live), and the gear at the top of Themes opens Settings? yes / no
2. **Category bubbles:** on Themes, do the round category bubbles scroll sideways and filter the grid below? yes / no
3. **Apply this look:** on a theme page, does the checklist show three steps (Wallpaper > Icons > Widgets), tick them as you go and end with a success moment? yes / no
4. **Widget Studio:** on the Widgets tab, open a widget: does the preview on top change as you pick background, colour circles, font pills and the size slider? yes / no
5. **Lock + Home pair:** on Wallpapers > Pairs, does saving a pair put two matching images in Photos (one for the Lock Screen, one for the Home Screen)? yes / no
6. **Liked heart:** tap the heart on a theme card and on a wallpaper tile: do they show up under **Liked** on their tab, and still after you close and reopen Glaze? yes / no
7. **New look:** do sheets (for example Settings > Language) slide up with rounded glass tops, and does the Live tab and loop editor look like the rest of the app? yes / no
8. **Log a habit:** on the Widgets tab, tap "Today: …" under a water, sleep, steps or mood card: does the value go up (mood changes face) with a little buzz, and stay after you reopen Glaze? Then touch and hold the same button: does it take one step off? yes / no
9. **Photo collage:** on Wallpapers > Still, tap "Make a photo collage", pick 2 to 6 photos and try a few layouts: does the top stay clear for the clock, and does Save put the collage in Photos, and when you leave and reopen the collage screen, are your photos and layout still there? yes / no
10. **Anything red or blank?** Any red error screen, blank tab or button that does nothing? Say where.

## What to try (TRIAL2, about 25 minutes)
This round tests the whole flow together (owner review §10E). Tick each one off and note anything odd.

1. **Themes tab, top to bottom:** the "Make a moving lock screen" card at the top opens the **Live Lock** tab with the video picker. Below it, **Your look** shows your applied theme (or the first starter theme): try the icon shape picker, the "How it looks on iPhone" switch, and the **Background**, **Override an icon** and **Missing an app?** buttons. Read the tip cards (the **?** button at the top brings them back), then open a theme card. **Send feedback** sits at the bottom.
2. **Theme page:** pick an icon shape, flip "How it looks on iPhone" (iOS always rounds web-clip icons, so circles and blobs come out as rounded squares on the real Home Screen), tap **Use my photo** to put your own photo behind the icons, then **Apply this look**: save the wallpaper (step 1), **Use this icon style** (step 2). The Icons tab should show your chosen shape with the theme's artwork.
3. **Override one icon:** on the theme page tap **Override an icon**, pick an app, upload your own image. Only that app changes, only in that theme. Try **Use in all themes**, then **Restore theme artwork** to go back.
4. **Missing an app?** (Themes > Your look, or Icons tab > search): add an app Glaze doesn't list, copy the prompt, save the theme sample, make an icon in any image tool, upload it. The icon should show as customised.
5. **Install icons → Bulk (one profile):** check the uploaded icon from steps 3–4 is in the profile. Choose **Save to Files**, open the file, then Settings > "Profile Downloaded" > **Install**. iOS says "Not Verified" because the profile isn't signed; it only adds Home Screen shortcuts. Check the new icons open the right apps. With about 60 apps, report the "Drew 60 icons in … s" line and your iPhone model.
6. **Install icons → Photos + Shortcuts:** try an app without a link (for example one you added in step 4 without a URL scheme). Glaze saves its icon to the "Glaze icons" album and lists the Shortcuts steps.
7. **Wallpaper** (Themes > Make a wallpaper): switch between the theme design and **My photo**, crop and tint, save to Photos.
8. **Live Lock tab:** make a loop from a video or GIF, trim and crop it, **Save to Photos** (a still wallpaper plus the clip), read the steps for your iOS version. In Expo Go a moving Lock Screen can't be switched on: "Set on Lock Screen" explains that it needs the full build.
9. **Things that should fail gracefully:** deny Photos access once (Glaze should explain and offer Open Settings), pick a tiny image (a sharpness warning), and remove an uploaded image from My images (the icon goes back to the theme artwork).
10. **Settings:** Tips, haptics, dark mode (switch your phone's appearance).

### Premium polish: quick yes/no (answer in a comment or feedback email)
- **Gallery parallax:** on the Themes tab, does the artwork on each theme card drift slightly as you scroll, and do the little icons pop in when a card stops in the middle? yes / no
- **Shape morph:** when you change icon shape, do the preview icons morph smoothly into the new shape, with the ring sliding to your choice? yes / no
- **Apply ripple:** on a theme page, after **Apply this look**, do the icons ripple onto the mock Home Screen one by one, then a shine sweeps across **Install icons**? yes / no
- **Crop:** with **Use my photo**, does pinch and drag feel smooth, glide after you let go, and stretch then spring back at the edges? yes / no
- **Live Lock frame:** does the loop preview sit in a phone frame with a Lock Screen clock over it? yes / no
- **Overall:** do buttons press in slightly, sheets spring up, and tab switches fade, without anything feeling slow? yes / no (Settings › Reduce motion should turn the movement into simple fades.)

Expo Go limits: no Live Lock Screen, Live Photo export or widgets, and the profile install path has never run on a device before this trial.

Send feedback from Settings or paste trial-log.txt into a page comment.

To remove the icons later: Settings > General > VPN & Device Management > Glaze icons > Remove Profile.

## Known limits of this trial
- The code is written and unit-tested in the cloud; your PC's auto-start does the full install, type check and Expo restart. Type-check results reach the build through Claude in your chat, so you don't paste reports.
- Things only your phone can prove: the profile install path from Expo Go, icon PNGs coming out sharp (not blank), and Photos album creation with "Limited" photo access.
- Live Lock Screen, Live Photo export and widgets need the full build later.

## Sending feedback
Leave a comment on the **Glaze Build** page (any device). The next build run turns each comment into a task, replies, and resolves it when fixed. Screenshots help — say which tab and what you tapped.

## If it doesn't work
- Glaze isn't in Expo Go > Recently opened, or still looks like the old build: wait 10 more minutes (the PC may still be installing), then say so in a page comment. If the PC copy is ever started by hand, START_TRIAL.cmd prints "Built from commit: ..." first; it should match the kit commit under "Build files" on the Glaze Build page.
- Expo Go says the SDK is unsupported: update Expo Go from the App Store.
- Anything else: leave a page comment saying which tab and what you tapped.
