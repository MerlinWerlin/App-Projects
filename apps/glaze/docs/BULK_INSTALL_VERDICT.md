# Bulk icon install on iOS: verdict (T154, 25 Oct 2026)

**Owner update, 26 October 2026: bulk install worked on Jared’s iPhone.** The previous uncertainty about whether his phone accepts the profile is resolved. He did not separately confirm every app destination, lack of Safari flash or App Review acceptance. Those are not inferred from the bulk-install report.

The remaining owner-reported issues are widget gradients/colours, missing widget types, finding theme icon selection, and black surrounds on shaped icons. See the latest section of TRIAL.md. The research below is historical evidence, not a request to repeat the completed bulk-install verdict.

---

## 1. Evidence

### (a) Can one install add many Home Screen icons? Yes, through a profile with many web clips.
- Apple's WebClip payload reference lists `com.apple.webClip.managed` with **"Allow manual install: iOS"**,
  **"Requires supervision: N/A"** and **"Allow multiple payloads: iOS"**. So an unsupervised iPhone can
  install a hand-made profile holding many web clips.
  https://developer.apple.com/documentation/devicemanagement/webclip
- Keys (Apple's device-management schema):
  https://raw.githubusercontent.com/apple/device-management/release/mdm/profiles/com.apple.webClip.managed.yaml
  - `URL`: required.
  - `Label`: required.
  - `Icon`: a PNG, square, "up to 400×400" and "under 1 MB". The page says that for iOS the payload must
    include an icon to be valid.
  - `IsRemovable`: defaults to true.
  - `FullScreen`.
  - `Precomposed`.
  - `IgnoreManifestScope`: iOS 14 and later, and only has an effect when `FullScreen` is true.
  - **`TargetApplicationBundleIdentifier`**: iOS 14 and later, "the bundle ID of the app that opens the
    URL", but **it only works when installed through MDM; manual install isn't allowed on iOS**.
    Everything MDM admins say about it is about choosing a browser (Chrome or Edge instead of Safari):
    https://community.jamf.com/general-discussions-2/webclip-target-app-identifier-28927,
    https://medium.com/learning-mem/how-to-make-ios-web-clips-open-in-edge-or-chrome-a49bd9307976.
  - **Conclusion:** Glaze can't use this key. There's no documented way for a manually installed web clip
    to "be" a native app. The only option is a web clip whose `URL` is the app's URL scheme.

### (b) Does a web clip with an app URL scheme (`someapp://`) open the app?
The evidence is mixed. **This needs a device check.**
- In favour:
  - A 2020 news report says a well-known launcher app (label "launcher L") used configuration profiles,
    and its icons "open instantly", unlike Shortcuts:
    https://9to5mac.com/2020/10/19/launch-center-pro-now-lets-you-change-ios-app-icons-without-using-shortcuts/
  - A how-to for a profile-based icon shortcut says the web clips "directly launch apps" for "most apps,
    at least":
    https://allthings.how/how-to-use-icon-themer-icloud-shortcut-ios-14/
- Against:
  - The same how-to says some system apps have no usable URL scheme and some show "a blank page" first.
    It lists Compass, Contacts, FaceTime, Measure, Pages, Numbers and Tips as unsupported.
  - An MDM admin reports that a web clip pointed at `googlechrome://…` "still initially opens Safari which
    then re-directs":
    https://community.jamf.com/general-discussions-2/webclip-target-app-identifier-28927
- What this means:
  - Apps without a public URL scheme (many banking and small apps) can't be in the bulk profile at all.
    Glaze already moves those to the Shortcuts list (`src/core/install.ts`, `planInstall`).
  - **A brief Safari flash on launch is possible** and not ruled out. Apple doesn't document either way.

### (c) Does it pass App Review? Real risk, with live counter-examples.
- **Guideline 5.5 (verbatim, last sentences):**
  > "Mobile Device Management Apps that offer Mobile Device Management (MDM) services must request this
  > capability from Apple. Such apps may only be offered by commercial enterprises, educational
  > institutions, or government agencies, and in limited cases, companies using MDM for parental control
  > services or device security. [...] **Apps offering configuration profiles must also adhere to these
  > requirements.** Apps that do not comply with this guideline will be removed from the App Store [...]"

  https://developer.apple.com/app-store/review/guidelines/ (read 25 Oct 2026). Read literally, Glaze
  (a consumer app) can't meet this.
- A real rejection quoting 5.5: "Your app uses a mobile device management (MDM) profile but does not have
  MDM capability granted." https://developer.apple.com/forums/thread/130314
- Live counter-examples on the App Store today:
  - An icon app (label "icon app S") says "works without needing to use Shortcuts" and "Install all the
    app icons at once". It doesn't name the method, and a reviewer talks about deleting the
    "bookmarks(app icons)", which points to web clips. It was updated in the last few days:
    https://apps.apple.com/app/1533393982
  - A profile-loader utility that installs `.mobileconfig` files kept on the device, offline. It was
    updated July 2025 and is still for sale: https://apps.apple.com/app/id1329252866
- Against: a leading theme app reportedly removed its profile install "under App Store rules"
  (`docs/MARKET.md`).
- **Conclusion:** enforcement is inconsistent. Some apps that offer profiles are live, and at least one
  removed the feature. Whether App Review applies 5.5 to a web-clip-only profile isn't public.

### (d) How the profile must be delivered so it reaches Settings
- Apple Support: download it "from a website or an email message". Then Settings > **Profile
  Downloaded** (below the account name) > Install. "If a profile is not installed within **8 minutes** of
  downloading it, it is automatically deleted." "You can only have **one** profile ready to install at a
  time." https://support.apple.com/en-au/102400
- Apple DTS: there's no API to install a profile. You open a URL to it, Safari "bounce[s] the work to the
  profile ingestion subsystem". Serving it from inside the app is possible, but there are "nasty
  multitasking gotchas". https://developer.apple.com/forums/thread/70696
- Saving to Files doesn't install. The owner's own 24 Oct test confirmed this, and a third-party browser
  bug report says the same: https://orionfeedback.org/d/10346-handle-installation-of-mobileconfig-profiles
- **data: URL:** a developer reports that Safari didn't handle a `data:` profile URL. The working answers
  in that thread all use a local HTTP server that sends `application/x-apple-aspen-config` plus a
  background task. One adds an auto-refresh page that requests the profile straight away:
  https://cloud.tencent.com/developer/ask/93609. So a data: URL isn't an alternative, and Glaze has no
  backend (and adds no paid service).
- **Background lifetime of the in-app server:**
  - Apple: a backgrounded app gets about five seconds, and `beginBackgroundTask` gives "extra time" that
    isn't fixed:
    https://developer.apple.com/documentation/uikit/extending-your-app-s-background-execution-time
  - Apple DTS: the remaining time "can and WILL fluctuate wildly", and the extra time only "shows up
    later": https://developer.apple.com/forums/thread/822839
  - **Conclusion:** the server is only sure to be alive in the first seconds after Glaze opens Safari.

## 2. What Glaze does today (after this task)
- `src/core/mobileconfig.ts` builds one unsigned profile holding a `com.apple.webClip.managed` payload
  per app. Each payload has `URL` (app scheme), `Label`, a 180 px base64 PNG `Icon`, `IsRemovable` true,
  `FullScreen` false and `Precomposed` true. Every payload gets a fresh upper-case `PayloadUUID` and a
  unique `PayloadIdentifier`, plus `PayloadVersion` 1. The profile has `PayloadRemovalDisallowed` false.
- I checked this with Python's `plistlib` on a synthetic 80-icon set with emoji, `&` and `<` in labels
  and URLs. Every file parsed, the UUIDs and identifiers were all unique, and every payload type was a
  web clip.
- A set is split into parts above about 2.5 MB. That limit is our own, and Apple doesn't publish one. With
  typical 180 px icons (10 to 20 KB each), 80 icons fit in one profile. With heavy photo icons (about
  30 KB each), 80 icons become 2 profiles, which means two Safari and Settings rounds.
- `modules/glaze-profile-server` (Swift, `NWListener` on 127.0.0.1, random port) serves:
  - `/` as a landing page;
  - `/glaze.mobileconfig` with `Content-Type: application/x-apple-aspen-config`,
    `Content-Disposition: attachment`, `Cache-Control: no-store` and `Connection: close`.

  It runs under a background task and stops at 90 s, when iOS ends the time, 20 s after a fetch, or when
  you leave the screen.
- `app/install.tsx`: Generate profile draws the icons, saves the profile, starts the server and opens the
  real Safari. "Open in Safari again" is the retry.
- The switch is unchanged. `src/config/install.ts` `PROFILE_INSTALL_ENABLED` is true, so Bulk is offered.
  Set it to false and only Shortcuts is offered.

### Bug fixed in T154
- **Race between the user and iOS.** The landing page only requested the profile when the user tapped
  Install. If they read the page for longer than iOS kept Glaze alive in the background (often about
  30 s, never guaranteed), the server was gone and Safari couldn't connect.
- **Fix:** the page now asks for the profile straight away (`<meta http-equiv="refresh"
  content="0;url=/glaze.mobileconfig">`, the auto-refresh pattern from the thread above), so Safari
  fetches it in the first second. The Install button stays as the manual fallback.
- **Guard test:** `src/core/profileServer.test.ts`, "T154: landing page asks Safari for the profile at
  once".
- **Not yet done:** the page and card wording still says "Tap Install" first. On the phone, the Allow
  prompt may now appear before you tap anything, which is expected.

### Not changed (no evidence of a bug)
- The plist structure: it matches Apple's example.
- `Content-Disposition: attachment`: no source says it blocks the profile prompt. It's still a device
  check item.
- The 180 px icon size: within Apple's 400 px and 1 MB guidance.

## 3. Limits the owner must accept if bulk install stays
1. **Not one tap.** The flow is Safari > Allow > Close > Settings > Profile Downloaded > Install >
   passcode > Install. It's one round for all icons (two if the set is split). The profile must be
   installed within 8 minutes, and only one can wait at a time.
2. **"Not Verified"** shows on the profile because it's unsigned. Signing needs a certificate. It's
   cosmetic, but it may put some users off.
3. **The originals stay.**
   - The real apps keep their icons. The user has to remove each original from the Home Screen by hand
     (long-press > Remove App > Remove from Home Screen). They stay in the App Library.
   - Notification badges show only on the originals, never on the web clips.
4. **Only apps with a public URL scheme.** Others (and some system apps) still need Shortcuts or can't
   be themed.
5. **Possible Safari flash or blank page** when tapping a themed icon. Not ruled out until the device
   test.
6. **App Review 5.5 risk.** The text covers "apps offering configuration profiles". Some similar apps
   are live, and one reportedly removed the feature. Options:
   - submit with the switch off;
   - or submit with it on and accept a possible rejection, then turn it off.
7. **Settings label:** iOS shows it under "VPN & Device Management", which some users find alarming.
8. **Device-dependent:** the in-app server route hasn't been confirmed on any iPhone yet.

## 4. Owner retest (exact steps, TestFlight build with this commit)
1. In Glaze, pick a theme with 20 or more apps. Open Install and tap **Generate profile**.
2. Safari opens on a Glaze page. Within a second or two you should see **"This website is trying to
   download a configuration profile. Do you want to allow this?"**
   - Tap **Allow**, then **Close**.
   - If you see "Safari can't connect to the server", go back to Glaze and tap **Open in Safari again**.
     Note that it happened.
3. Open **Settings**. Look for **Profile Downloaded** at the top (or General > VPN & Device Management).
   Tap it, tap **Install**, enter your passcode, then tap **Install** again.
4. Go to the Home Screen and count the new icons. Do they all appear?
5. Tap 5 different icons (include Music, Maps and one third-party app). For each one, say whether it:
   - opened straight into the app;
   - flashed Safari or a blank page first;
   - or failed.
6. Report the iOS version. Afterwards, remove the profile in Settings > General > VPN & Device
   Management to check the icons disappear.

What happens next depends on the result:
- **Steps 2 to 4 work and step 5 opens directly:** keep Bulk.
- **Steps 2 to 4 work but icons flash Safari:** Bulk works, with the flash as a known limit. The owner
  decides whether to keep it.
- **No prompt, or no "Profile Downloaded" after two tries:** bulk is not workable without a web server.
  Park bulk, or the app.

## For the Workboard
- Glaze bulk icon install: POSSIBLE WITH LIMITS. One iOS profile can add all icons in a single Settings install (Apple docs: web clips allow manual install, many per profile, no supervision).
- No way to make icons open native apps "properly": TargetApplicationBundleIdentifier is MDM-only. Icons are web clips using app URL schemes, and apps without one are left out.
- Limits: Safari > Allow > Settings > passcode flow, "Not Verified" label, originals must be hidden by hand, no badges, a possible Safari flash on tap.
- App Review 5.5 says "apps offering configuration profiles" must meet the MDM rules. Similar apps are live, and one reportedly dropped the feature. Real rejection risk; the switch stays.
- Fixed T154: Safari now fetches the profile within a second (auto-request), not after a tap that could outlast Glaze's background time.
- Owner action: retest on TestFlight (docs/BULK_INSTALL_VERDICT.md section 4). If "Profile Downloaded" still never appears, park bulk install, or the app.
