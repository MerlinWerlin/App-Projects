# Backspin run log (one line per run)
- 2026-10-24 Claude (Jared's chat): app started. Competitor research (12 apps), pure-JS audio core (WAV, reverse, DTW score, effects, share clip), 7 packs / 986 lines + verdicts + store draft + 13 translations from StarNet Luna (16 bridge calls), GUARD pass removed 27 song lines; all screens; 20 node tests pass. Put on PC for Expo Go (port 8097) and merged to App-Projects main (no RELEASE.json yet, so nothing ships).
- 2026-10-24 Claude: PC check found expo-asset 58 hoisted (expo-audio's peer is "*"), breaking the iOS bundle; pinned expo-asset ~57.0.20.
- 2026-10-24 Claude: added @expo/ngrok dev dependency (Expo Go tunnel needs it, as in Couch).
- 2026-10-24 Claude: moved to Expo SDK 58 (Jared's Expo Go is on 58; same pins as Couch's working PC copy). Exact versions are finalised by expo install --fix on the PC and committed back.
- 2026-10-24 Claude: money model changed per Jared: 10 free goes with everything, then a lifetime unlock at A$1.99 (OutOfGoes screen, home counter, Plus copy); paywall strings re-translated by Luna.
- 2026-10-24 Claude: premium 'Look' skins (same layout): skin system (fonts, radii, card finish, gradients, glow, disc colours), 6 skins designed by StarNet Luna, contrast-checked by skins.test.ts; picker in Settings > Look. Booth's coral darkened for AA contrast.
- 2026-10-24 Claude: added 3 skins designed by gpt-6.1-sol (Walnut Room, Night Glass, Electric Sorbet); 10 looks in total.
