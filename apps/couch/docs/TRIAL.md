# Try Couch on your iPhone (demo mode)

Couch runs inside **Expo Go** for this trial. It starts in demo mode with three pretend TVs, so nothing is sent to a real TV yet. Finding and controlling your own TVs needs a full app build later.

Please answer the yes/no questions first (copy them into a comment on the Couch build page); how to open Couch is below them.

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
Your PC now copies each new Couch build into `Desktop\Apps\couch` by itself (hourly refresh).
1. Double-click **UPDATE_AND_START.cmd** in `Desktop\Apps`.
2. On the iPhone, open **Expo Go** and tap Couch under **Recently opened** (first time only: scan the QR code shown in the window with the iPhone Camera).
3. Couch opens on the Remote tab in demo mode. Answer the questions above in a comment on the Couch build page: "works", or paste trial-log.txt if anything is red. Comments are read first on every build run.

You need Expo Go from the App Store (free) and Node.js LTS from https://nodejs.org on the PC (free; accept the defaults).

**Fallback (if Desktop\Apps\couch is missing):** use **Download trial kit** on the Couch build page, unzip it anywhere and double-click **START_TRIAL.cmd**. The first run takes a few minutes; it updates Expo to the version Expo Go needs, checks the code compiles (into trial-log.txt; red lines there don't stop the app), then shows a QR code to scan with the iPhone Camera.

Things to try: the Power / Source / Settings row, the d-pad, volume, the 123 pad, hold-to-talk (in Expo Go it opens the keyboard instead), the source picker, the Apps tab and switching TVs on the TVs tab.

**About the Apps tab:** in demo mode the app tiles (Cinema, Sports, Music, News, Kids, Photos) are made-up placeholders with simple artwork. Once Couch is connected to your own TV, the tiles show the real app logos, which come from the TV itself. If a TV doesn't give a logo, the tile shows the app's name instead.

PC and iPhone do not need to be on the same Wi-Fi (the script uses a tunnel).

## If something goes wrong
- The script writes **trial-log.txt** next to START_TRIAL.cmd. If anything is red, paste trial-log.txt (and a photo of the window) into a comment on the Couch build page; the next build run reads comments first.
- "Project is incompatible with this version of Expo Go": close the window and run START_TRIAL.cmd again (it updates Expo each time).
- Windows asks about firewall access for Node: allow it.
- To stop, press Ctrl+C in the window or just close it.

## One more click: VERIFY.cmd (helps the build, 5 minutes)
Couch's builder runs in the cloud and can't install the full toolchain, so the last full check has to happen on your PC. Double-click **VERIFY.cmd** in the Couch folder (`Desktop\Apps\couch`, or the unzipped kit). It installs, typechecks, runs every test and builds the iPhone bundle, then writes **verify-report.txt** (each step's result and the first error lines). Open it, copy everything and paste it into a comment on the Couch build page. Nothing on your phone is needed, and it never changes your code. If an earlier copy only said "Node.js is not installed" even though Node is installed, that was a bug in VERIFY.cmd (fixed 17 Oct, run 37): download the trial kit again and rerun it.
