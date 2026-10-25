# Feature map (from the 2026-10-24 competitor scan)

Apps checked: PromptSmart, Teleprompter Pro / Video Teleprompter, Teleprompter.com, BIGVU, Speakflow, Elegant Teleprompter, Voice Teleprompter PRO, CuePrompter, Nano Teleprompter, Jupitrr.

## What people complain about (and Cue's answer)
| Complaint | Cue |
|---|---|
| Subscriptions US$60–90/yr, trial traps, upsell nags | Free core, one-time Plus, no trial auto-charge, paywall only when you tap a Plus thing |
| Voice tracking loses its place / jumps on ad-libs / volume apps "scroll at any noise" | Voice Pace adapts to the room's noise floor with hysteresis; Voice Follow matches 4-word phrases in a forward window and ignores ad-libs (tested) |
| Watermarks on free recordings | None, ever |
| Editor doesn't show what the prompter will | Live preview with the prompter's colours, size and alignment |
| All takes in one long clip; no per-section retakes | Record one section at a time, each take saved separately |
| Cue points unreliable, no per-section control | Sections with jump-to, `[pause]` cues, private notes |
| Crashes / takes not saved | Takes saved to Photos the moment you stop; errors shown in plain words |

## Built (Expo Go)
Steady scroll, Voice Pace, countdown, speed, mirror/flip, reading line, sections, resume, timer, landscape, keep awake, library, search, pin, duplicate, share, import txt/md/docx, fit-to-time, read time, record with overlay, per-section takes, captions export, prompter colours, rehearsal stats, dark mode, haptics, reduce motion.

## Plus and trial (owner decisions 2026-10-25)
- Cue Plus: A$2.99 one-time. The real price comes from StoreKit; `PLUS_FALLBACK_PRICE` in `src/plus/entitlement.ts` is only the label when the store returns none.
- Trial: every Plus feature free for 7 days from the first launch, then locked unless bought (replaces the old 3 free Voice Pace reads). The first-launch stamp is stored in kv and in the iOS Keychain (`expo-secure-store`, survives delete-and-reinstall); the earliest wins (`src/plus/trial.ts`, tested). Calm "Plus trial: N days left" line in Settings and on the Plus screen, no popups.
- Launch intro: ~1.3 s, "Cue" rolls up onto a reading line with a light sweep; tap to skip, skipped with Reduce Motion (`src/ui/LaunchIntro.tsx`).

## Next (needs a dev/TestFlight build)
1. Voice Follow: `expo-speech-recognition`, on-device, multilingual (engine already done).
2. Bluetooth page-turner / pedal and keyboard arrows (hardware key events).
3. Real StoreKit/Play purchase provider for Plus (A$2.99 one-time, decided 2026-10-25).
4. Remote control from a second phone or Apple Watch.
5. Share-sheet "Open in Cue" for scripts.

## Not doing (v1)
AI rewriting (server cost vs one-time price), background removal, AirPlay/external display.
