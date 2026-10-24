# Try Couch on your iPhone

Open Couch from **TestFlight** (it has the gold d-pad icon). It starts in demo mode with three pretend TVs when no TV is found. Expo Go is only a fallback now: your Expo Go is on SDK 58, so Couch shows under "Recently opened" only once the PC copy runs on SDK 58 too.

Please answer the yes/no questions first (copy them into a comment on the Couch build page); how to open Couch is below them.

## New since your last test (24 Oct, evening): Cast
The current TestFlight build (1.0.0) and Expo Go run the Cast tab in demo mode. Casting to a real TV needs the TestFlight 1.0.1 build, which has not been built yet.
1. There is a new Cast tab next to Remote. "Choose photos and videos" opens your photo library, and the picked items show as a queue. yes / no
2. Cast tab (demo TV): play/pause, next/previous, -10 s / +10 s on a video, and the slideshow with its interval chips all respond. yes / no
3. While something is casting, the Remote tab shows a small "Casting" pill, and Play/Pause on the remote pauses the cast. yes / no
4. "AirPlay / Screen Mirroring" opens the iPhone's AirPlay list (TestFlight build) or a short guide (Expo Go). yes / no
5. TestFlight build, only if you have a TV handy: cast a photo and a video to your TV. Did they show? Which TV was it? yes / no

## New since your last test (24 Oct)
1. Settings > "Send feedback or request a feature": the page opens, and sending starts an email to you with your message filled in. yes / no
2. The remote now opens in the new Charcoal & Gold theme (gold d-pad with dark arrows) and the opening animation fades straight into it, matching the icon. yes / no
3. With a glow colour on (Settings > Remote theme), a soft halo now shows around the edge of the remote. yes / no

## New since your last test (23 Oct)
1. When Couch opens, does the remote-press animation play smoothly and hand over to the remote within about 3 seconds? yes / no
(In Expo Go the home-screen icon is Expo's own; the new gold d-pad icon shows on TestFlight builds.)

## New since your last test (22 Oct)
1. Apps tab: the tiles are now the real apps (Netflix, YouTube, Disney+, Stan, Prime Video, iview, SBS, 7plus, 9Now, 10 Play, BINGE, Kayo and more) with their real icons, even in demo mode. They need an internet connection the first time; offline you see name tiles. Do the right icons show for every app? yes / no
2. Apps tab: popular US, UK and European apps are in the demo list too (Max, Hulu, Peacock, YouTube TV, ESPN, Crunchyroll, TED, BBC iPlayer, ITVX, Channel 4, NOW, CANAL+, ARD, ZDF, RTL+, RaiPlay, Viaplay, DAZN and more). On a real TV, Couch shows the apps that TV has, with official icons for about 60 services. yes / no
3. Apps tab: "Favourites only" hides every app that isn't a favourite (tap again to show all). yes / no
4. Apps tab > Choose apps: switch off the apps you don't want; they disappear from the Apps tab and come back with "Show all apps". Nothing changes on the TV. yes / no
5. Apps tab: every app gets its icon (Stan too). The first visit fills them in over about two minutes, favourites first; after that they show at once. yes / no
6. Remote: press Mute or Volume up. The volume bubble now sits below the Dynamic Island, fully visible. yes / no
7. Settings > Remote theme: the new "Walnut & Brass" wood theme (Plus, with free Try it) looks good. yes / no

## New since your last test (18–19 Oct): 9 quick yes/no questions
Open Couch as described under "How to open Couch" below. Then copy these into a comment and answer each one. The Remote tab itself looks the same as last time on purpose. It changes only after your answers come back.
1. Settings, TVs and Diagnostics have the new iPhone-style look (grouped rounded lists). Do they look right, with nothing cut off? yes / no
2. Settings > Themes: tap a theme and the remote changes at once. "Try it" on a Plus theme works without buying. yes / no
3. Settings > Couch Plus: the page reads clearly and nothing asks you to pay for a TV button. yes / no
4. TVs > Add a TV: the scan sheet scrolls, and "Lost your remote?" opens a help page. yes / no
5. Apps tab > Edit: you can pin apps and drag to reorder them, and the order stays after you close the app. yes / no
6. iPhone Settings > Accessibility > Display & Text Size > Larger Text, turned up high: the remote and sheets still fit, with text wrapping and nothing cut off. yes / no
7. Remote: tap the Sleep timer chip below the buttons, pick 15 minutes, keep Couch open; the demo TV turns off when the time is up (or just check the countdown shows and Cancel works). yes / no
8. Lock the phone for 30 seconds, then unlock it: the remote reconnects by itself with no error. yes / no
9. Hold volume up or fast-forward: it keeps repeating until you let go. yes / no

## Quick yes/no check (copy into your comment)
1. Does the app open? yes / no
2. Remote buttons respond (the demo TV shows what you pressed)? yes / no
3. Arabic (Settings > Language > العربية, Couch restarts): d-pad still points the right way (up is up, left is left)? yes / no
4. German (Settings > Language > Deutsch): text wraps, nothing cut off? yes / no
5. The round OK button in the middle of the d-pad sits exactly centred, a clean circle with an even gap all round? yes / no (a screenshot in the comment helps)

## How to open Couch
Nothing to do on the PC: it picks up each new Couch build by itself, and new builds reach TestFlight automatically.
1. On the iPhone, open **TestFlight** and tap **Open** next to Couch. When TestFlight offers an update, install it first.
2. Couch opens on the Remote tab (demo mode when no TV is found).
3. Answer the questions above in a comment on the Couch build page ("works" is fine too). Comments are read first on every build run.

Fallback: **Expo Go** > Recently opened > Couch. This only works while the PC copy matches your Expo Go version (SDK 58); if Expo Go says the project is incompatible, use TestFlight.

Things to try: the Power / Source / Settings row, the d-pad, volume, the 123 pad, hold-to-talk (in Expo Go it opens the keyboard instead), the source picker, the Apps tab and switching TVs on the TVs tab.

## If something goes wrong
- Couch is missing from TestFlight, or a TestFlight build will not open: say so in a comment (a screenshot helps).
- Expo Go says the project is incompatible: expected while the PC copy is on an older SDK than your Expo Go (58). Use TestFlight.
- Anything looks wrong or a button does nothing: a comment with a screenshot is all the build needs.
