# E2E pass (T160, release prep R5)

Static end-to-end pass over every screen in `app/` and the shared controls in `src/ui/`, run 111 (1 Nov 2026).
Nothing here was run on a device: the right-hand column lists what the owner should look at on the TestFlight build.

## What is now automated (`node ops/ui-check.mjs`, ~3 s, 0 problems on this tree)

| Check | Rule | Since |
|---|---|---|
| A11Y touchables | Pressable / PressableScale / Touchable* have accessibilityLabel + accessibilityRole; tab / radio / switch / checkbox roles have accessibilityState | T59 |
| A11Y inputs | every `TextInput` and `Switch` has accessibilityLabel | T160 |
| A11Y images | every `Image` / `Svg` has a label or is hidden (accessibilityElementsHidden + importantForAccessibility), or sits inside an element in the same file that labels/hides it or inside a touchable | T160 |
| TOUCH | raw Pressable / Touchable* need hitSlop, minHeight or flex: 1; PressableScale (minHeight 48 + hitSlop 8) must not set a literal height / minHeight under 48 | T160 |
| TYPE | a `Text` with accessibilityRole="header" and numberOfLines must use adjustsFontSizeToFit (headers never clip under Dynamic Type) | T160 |
| COLOUR | no raw hex / rgb() / 'white' / 'black' in app/ or src/ui (tokens only, light + dark) | T59 |
| COPY | no developer wording (Expo Go, full / dev / test build, this build, TODO, FIXME, simulator, debug, lorem ipsum) in English catalogue values | T160 |
| MOTION | any .tsx that animates (Animated.timing / sequence / parallel / loop, timed / fadeIn / fadeOut, LayoutAnimation, withTiming…) reads Reduce Motion; springs / bounce are banned by `src/theme/motion.test.ts` | T160 (+T91) |

Not automated (reviewed by hand, see table): truncation of non-header text (`numberOfLines` appears ~100 times, almost all
secondary lines inside a labelled row that opens the full text; VoiceOver always reads the whole string), permission-denied
/ offline / empty states (behaviour, not syntax).

## Findings and fixes

- Developer wording in UI copy: `toiletplus.noMapBody` and `paste.clipboardUnavailable` said “This build can’t…”;
  `dayplan.map.noMapBody` said “not available in this version of the app”. Reworded in place; spec catalogues re-synced.
- Permission dead ends: Gifts “Here” (location refused for good, or Location Services off) and Help card edit (Contacts
  refused) told the user to go to Settings without a way there. Both now offer Open Settings.
- Dynamic Type: three headers clipped at two lines (trip cover title, SmartPack hero trip name, bag card name). Cover title
  now shrinks to fit (fixed 16:9 frame); the other two wrap.
- StartupMark brand glyph SVG is now hidden from VoiceOver on the element itself.
- Motion: no springs or bounce anywhere (motion.test.ts); every animating file honours Reduce Motion (new MOTION check).
- Colours, touchable labels / roles / states, TextInput / Switch labels, image labelling: no problems found.
- Show-to-staff texts (signs, help card, lost-child card, phrase card, menu card, numbers, address card, step-free card)
  cap at `maxFontSizeMultiplier={1.6}` on purpose: they are already 24–44 pt. Owner to confirm this is acceptable at AX5.

## Owned by another worker (not edited, listed here)

`app/(tabs)/map.tsx`, `app/(tabs)/toilets.tsx`, `src/ui/MapLayersSheet.tsx`, `src/ui/stepfree*.tsx`, `app/stepfree.tsx`,
`app/phrase-card.tsx`: all pass every ui-check rule above. Notes for that worker: MapLayersSheet swatches are 32 pt
discs but decorative (hidden) inside 48 pt rows, fine; toilets uses `toiletplus.noMapBody`, whose wording changed in the
catalogue only; stepfree / phrase-card big text caps at 1.6× like the other show-to-staff cards.

## Per screen

| Screen | Checked statically | Fixed | Needs a TestFlight check by the owner |
|---|---|---|---|
| `app/(tabs)/_layout.tsx` | Tab bar: labels/roles from Expo Router tabs; icon glyphs | – | Tab labels read by VoiceOver at AX5; tab bar does not clip at the largest text size |
| `app/(tabs)/emergency.tsx` | Emergency card, hotel shortcut (truncated line; full name in hint), contacts call | – | Call button on iPhone; hotel shortcut at AX5 |
| `app/(tabs)/index.tsx` | Trips list: empty state, TripPass rows (one-line title / stubs inside labelled rows) | – | Trip pass rows at AX5; both themes |
| `app/(tabs)/map.tsx` | Checked by ui-check only (owned by another worker): labels, targets, colours, images, motion all pass | Not edited (owned elsewhere) | Location denied/blocked/off + offline city-pack states; layer sheet swatches are 32 pt but decorative inside 48 pt rows |
| `app/(tabs)/toilets.tsx` | Checked by ui-check only (owned elsewhere): pass. Its no-map body string was reworded in the catalogue (toiletplus.noMapBody: “This build can’t…” → “The map can’t be shown right now…”) | String reworded in src/i18n only; screen file untouched | Location denied + offline list; no-map fallback wording |
| `app/(tabs)/wallet.tsx` | Wallet list rows (numberOfLines on secondary lines inside labelled rows); Face ID vault slot uses PermissionNotice kind=faceid | – | Vault with Face ID off / not enrolled / failed: notice + passcode fallback |
| `app/+native-intent.tsx` | No UI (routing only) | – | – |
| `app/+not-found.tsx` | Empty state + way home | – | – |
| `app/_layout.tsx` | Root stack, StartupMark + PrivacyCover overlays; startup fade skipped with Reduce Motion | StartupMark glyph SVG now hidden from VoiceOver on its own (was hidden only by its callers) | Cold start with Reduce Motion on: no fade; app switcher shows the privacy cover on vault/stay screens |
| `app/address/[id].tsx` | AddressCardView big local text (maxFontSizeMultiplier 1.6 by design), selectable | – | Address card at AX5, full brightness |
| `app/backup.tsx` | Export/import buttons, status text | – | Files picker cancelled / iCloud Drive offline |
| `app/callhome.tsx` | Time-zone overlap bar (decorative bars, text summary) | – | – |
| `app/cash/[tripId].tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/comehome/[tripId].tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/convert.tsx` | Big amounts use adjustsFontSizeToFit; swap spin respects Reduce Motion | – | Swap animation with Reduce Motion on |
| `app/crop/[id].tsx` | CropEditor: image inside labelled container; handles labelled | – | Crop handles drag with VoiceOver (adjustable actions) |
| `app/customs/[iso2].tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/dayplan/[tripId].tsx` | Location PermissionNotice; no-map fallback list | No-map string reworded (dayplan.map.noMapBody: “not available in this version of the app” → “The map can’t be shown right now”) | Location denied; map fallback |
| `app/doc-crop/[id].tsx` | Same CropEditor behind vault lock | – | As crop; Face ID failure keeps it locked |
| `app/doc-edit.tsx` | Photos/Files pickers with PermissionNotice (photos); attachment names truncate to one line (file names, also in the open sheet) | – | Photos access denied → Open Settings; Limited Photos |
| `app/doc/[id].tsx` | Vault doc viewer, PDF fallback to share sheet | – | Open in… when no PDF viewer |
| `app/driving/[iso2].tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/emergency-edit.tsx` | Contacts PermissionNotice with type-by-hand fallback | – | Contacts denied/limited |
| `app/essentials.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/games/bingo.tsx` | Line flash skipped with Reduce Motion; tiles labelled | – | Bingo tiles at AX5 (tile text shrinks to 0.8, two lines) |
| `app/games/index.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/games/questions.tsx` | Fades respect Reduce Motion | – | – |
| `app/games/scores.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/games/spy.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/getaround/[country].tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/gifts/[tripId].tsx` | “Here” location button: denied note; gift bag cards (bags.tsx header) | Location refusal that only Settings can undo (blocked, or Location Services off) now shows an Open Settings button under the note; bag names wrap instead of clipping | Deny location for Satchel, tap Here → note + Open Settings; Services off |
| `app/help.tsx` | Nearest help: location PermissionNotice, offline-no-pack, network failure, none-found empty state; fade respects Reduce Motion | – | Flight mode with and without a downloaded city; location denied |
| `app/helpcard-edit.tsx` | Contacts picker + photo picker refusals | Contacts refused (blocked) now raises an alert with Open Settings, like the photo errors on the same screen; before, only a warning at the bottom of the form | Deny Contacts → alert + Open Settings; Limited contacts still opens picker |
| `app/helpcard.tsx` | Show-to-staff card text capped at 1.6× by design; fades respect Reduce Motion | – | Card at AX5; Reduce Motion |
| `app/helpcards.tsx` | List with empty state; row subtitle truncates to two lines (row label carries it) | – | – |
| `app/holidays/[tripId].tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/idea-edit.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/ideas/[tripId].tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/inflight/[itemId].tsx` | InflightCard plane moves only without Reduce Motion; map SVG hidden | – | – |
| `app/item-edit.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/item/[id].tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/jetlag.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/journal-edit.tsx` | Library/camera pickers: denied/unavailable/storage problems with Settings | – | Camera denied, Photos denied, Limited Photos |
| `app/journal/[tripId].tsx` | Entries: note truncates to 6 lines inside a labelled row that opens the full entry; photo thumbs labelled | – | Long note at AX5 (open the entry to read all) |
| `app/kids/[tripId].tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/kids/lost.tsx` | Lost-child card text capped at 1.6× by design; fade respects Reduce Motion | – | Card at AX5 |
| `app/leavehome/[tripId].tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/licences.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/lostbag/[tripId].tsx` | Bag photos: denied → alert with Open Settings; image thumbs inside labelled rows | – | Camera denied; camera unavailable → from Photos |
| `app/lostbag/index.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/loyalty-edit.tsx` | Card photo via journal pickers; cardPhotoProblem with Settings | – | Camera/Photos denied |
| `app/loyalty/[id].tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/meds.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/menu-card.tsx` | Show-to-staff text capped at 1.6× by design | – | – |
| `app/menu.tsx` | Fade respects Reduce Motion | – | – |
| `app/numbers.tsx` | Quiz timer bar hidden from VoiceOver; timer animation off with Reduce Motion | – | Quiz with Reduce Motion on |
| `app/openin/add.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/openin/index.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/outfits/[tripId].tsx` | Garment labels two lines under glyphs (labels are short catalogue words) | – | Garment labels at AX5 |
| `app/packing/[tripId].tsx` | SmartPack hero (header clipping), bags | SmartPack hero trip name and bag-card names no longer clip at two lines (headers wrap; hero height is flexible) | Long trip / bag names at AX5 |
| `app/passport.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/paste-booking.tsx` | TextInput labelled; clipboard-unavailable notice | Clipboard notice reworded (paste.clipboardUnavailable: “This build can’t…” → “Satchel can’t read the clipboard here…”) | Paste permission prompt (iOS) allowed / denied |
| `app/phrase-card.tsx` | Checked by ui-check only (owned elsewhere): pass; fades respect Reduce Motion | Not edited (owned elsewhere) | Swiping cards with Reduce Motion on |
| `app/phrases.tsx` | Fade respects Reduce Motion | – | – |
| `app/postcards/[tripId].tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/postcards/address.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/recap/[tripId].tsx` | TripCoverHero header; hero stats count up only without Reduce Motion | Cover title shrinks to fit instead of clipping | Long trip name at AX5 |
| `app/rental/[itemId].tsx` | Rental photos: denied → alert with Open Settings | – | Camera denied |
| `app/safe.tsx` | Safe check-in: contacts + location PermissionNotice | – | Location denied; Contacts denied |
| `app/settings.tsx` | Toggle rows (ToggleRow: switch role + state); home country picker | – | Every switch at AX5; VoiceOver announces on/off |
| `app/signs.tsx` | Sign text capped at 1.6× by design; fade respects Reduce Motion | – | – |
| `app/spending/[tripId].tsx` | Receipt photos: denied → alert with Open Settings; insights bars labelled as images | – | Camera denied; CSV share |
| `app/stay/[itemId].tsx` | Door codes behind Face ID; failure announced, cannot-lock reasons | – | Face ID failed / not enrolled / passcode only |
| `app/stepfree.tsx` | Checked by ui-check only (owned elsewhere): pass. Big card text caps at maxFontSizeMultiplier 1.6 on purpose (show-to-staff text) | Not edited (owned elsewhere) | Card lines at AX5 (capped by design); both themes |
| `app/ticket/[id].tsx` | Ticket image/PDF, full brightness, Open in… | – | Brightness restores on leave; PDF viewer missing |
| `app/tipping.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/todos/[tripId].tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/travels.tsx` | Stamps fade respects Reduce Motion; empty state | – | – |
| `app/trip-again/[tripId].tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/trip-edit.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/trip/[id].tsx` | Trip hub; TripCoverHero header (clipping); entrance fades respect Reduce Motion | Cover title now shrinks to fit (adjustsFontSizeToFit, min 0.6) instead of clipping long names in the 16:9 cover | Long trip name at AX3+ in the cover: shrinks, stays readable; both themes |
| `app/trouble/[id].tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/trouble/index.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/trouble/numbers.tsx` | Labels/roles, 48 pt targets, tokens only, images/SVGs, headers, motion (ui-check); empty states reviewed | – | Normal VoiceOver + AX5 + dark mode walk-through |
| `app/units.tsx` | Big values adjustsFontSizeToFit; swap respects Reduce Motion | – | – |
| `app/vault.tsx` | Vault behind Face ID; PermissionNotice faceid; empty state | – | Face ID off for Satchel; device without passcode |
| `app/wayback.tsx` | Compass + location PermissionNotice; rotation respects Reduce Motion; empty target/pin states | – | Compass with location denied; Reduce Motion |

## Shared controls (src/ui)

| Control | Checked statically | Fixed | TestFlight |
|---|---|---|---|
| `src/ui/kit.tsx` | PressableScale gives minHeight 48 + hitSlop 8 and skips scale with Reduce Motion; Button/Chip/ToggleRow/TextField set label + role (+ state) | – | – |
| `src/ui/PermissionNotice.tsx` | One notice for location / photos / faceid / contacts / files with Settings / Try again / fallback; alert role + live region | – | Each kind once on device |
| `src/ui/TripCover.tsx` | Cover title (header) | Title shrinks to fit (no clipping) | Long titles at AX5 |
| `src/ui/SmartPack.tsx` | Hero header | numberOfLines removed from the header | – |
| `src/ui/bags.tsx` | Bag card header | numberOfLines removed from the header | – |
| `src/ui/StartupMark.tsx` | Brand glyph SVG | SVG hidden from VoiceOver itself | – |
| `src/ui/DateTimeField.tsx, AddToCalendar.tsx, SharePlan.tsx` | Modal scrims: labelled cancel, flex: 1 / minHeight target, accessibilityViewIsModal | – | Picker sheets with VoiceOver |
| `src/ui/ZonePicker.tsx` | Search TextInput labelled | – | – |
| `src/ui/MapLayersSheet.tsx, src/ui/stepfree*.tsx` | ui-check only (owned elsewhere): pass | Not edited | – |

## Owner TestFlight checklist (short)

1. VoiceOver on: walk the four tabs, a ticket, the vault, Settings; every control says what it is and its state.
2. Text size AX5 (Settings > Accessibility > Display & Text Size > Larger Text): trip hub cover, packing hero, bag cards (packing, gifts, lost bag),
   wallet rows, emergency tab; nothing important cut off.
3. Dark mode: the same screens.
4. Reduce Motion on: cold start (no fade), convert/units swap, phrase/help cards, bingo, recap, inflight plane.
5. Deny each permission once and check the screen offers a way on: Location (Map, Help, Gifts Here, Day plan, Way back,
   Safe), Photos (doc copy, journal, cover, receipts, lost bag, rental, help card photo), Camera (journal, receipts),
   Contacts (emergency edit, help card edit), Face ID (vault, stay door codes).
6. Flight mode: Help (with and without a city pack), Map, weather card, city-map download.
