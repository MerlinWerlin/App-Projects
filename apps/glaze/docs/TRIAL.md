# Try Glaze on your iPhone (no Apple developer account needed)

The app runs inside **Expo Go**, a free app that loads development builds from your PC.

1. **iPhone:** install **Expo Go** from the App Store (once).
2. **PC:** install **Node.js LTS** from https://nodejs.org if `node -v` in PowerShell doesn't print a version (once).
3. **PC:** open the **Glaze Build** page in a browser, tap **Download trial kit (.zip)**, unzip it, open the `glaze` folder and double-click **START_TRIAL.cmd**. The first run installs packages for a few minutes, then shows a QR code. (The overseer may also keep a copy in `Desktop\Apps\glaze\code`.)
4. **iPhone:** scan the QR code with the Camera app. It opens Glaze in Expo Go. Keep the PC window open while you test.

## New since your last test (22 Oct evening, run 77): calm category bubbles
Download the new trial kit (the page's button; an older copy on the PC still has the bounce), run START_TRIAL.cmd and answer yes / no in a page comment. **Check the copy first:** START_TRIAL.cmd now prints "Built from commit: ..." before anything else; that code must match the "Trial kit: commit ..." line on the Glaze Build page. If it shows a different code, or prints no commit at all, it is the older copy: download the kit again.

- **Bounce removed:** tap between category bubbles quickly. The bubble no longer grows or springs: the chosen one just gets a soft tint ring and glow that fades in (about 0.15 s), the old one fades back, and the row slides the chosen bubble into view. Does it feel calm, with no lag? yes / no
- **Grid cross-fade:** when the category changes, does the grid simply fade to the new themes (no slide, no zoom, no cards popping in one by one)? yes / no
- **Rest of Themes:** pressing a theme card or a pill now eases down gently (no springy rebound), cards no longer stagger in when the screen opens, and nothing "pops" when you stop scrolling. Anything still bouncy on the Themes screen? Tell us where. yes / no

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
**First**, double-click **TSC_REPORT.cmd** in the `glaze` folder and paste `tsc-report.txt` into a page comment: the 18 Oct screens were only type-checked in the cloud. Then start the trial as above and answer yes / no in a comment (add a word on anything odd):

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
- First trial build: it was written and unit-tested in the cloud (317 core tests) but the full install, typecheck and bundle run on your PC for the first time. **If anything is red, paste `trial-log.txt` (it sits next to START_TRIAL.cmd) into a page comment.** If the error appears after the QR step, copy the window text too.
- Things only your phone can prove: the profile install path from Expo Go, icon PNGs coming out sharp (not blank), and Photos album creation with "Limited" photo access.
- Live Lock Screen, Live Photo export and widgets need the full build later.

## Sending feedback
Leave a comment on the **Glaze Build** page (any device). The next build run turns each comment into a task, replies, and resolves it when fixed. Screenshots help — say which tab and what you tapped.

## If it doesn't work
- QR scans but Expo Go says the SDK is unsupported: run START_TRIAL.cmd again (it moves the project to the newest Expo SDK) and update Expo Go.
- "tunnel" errors: press Ctrl+C, run `npx expo start` (same Wi-Fi as the phone) instead.
- Anything else: paste `trial-log.txt` (next to START_TRIAL.cmd) and the PC window's messages into a build page comment.
