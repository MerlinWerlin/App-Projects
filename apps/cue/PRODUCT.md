# Product

<!-- impeccable:product-schema 1 -->

> Inferred from `apps/cue/README.md`, `docs/STORE.md` and the 21 Nov 2026 design-pass brief (Jared, relayed by the App Factory master session). No interview round was run; every line below is from those sources.

## Platform

ios

## Users

People who read to camera on their own phone: creators filming short videos, founders recording updates, teachers, speakers rehearsing a talk. They prop the phone up (on a stand, a tripod, sometimes behind a beam-splitter glass), stand back from it, and read while they talk. They open the app, pick or paste a script, and either rehearse or record. Most sessions are short and repeated.

## Product Purpose

Cue is a teleprompter that waits for you. It shows a script large enough to read from a distance, scrolls it at a pace you set or at the pace of your voice, and records you with the words near the lens. Success is a take where nobody can tell you were reading.

## Positioning

The prompter follows the reader instead of the reader chasing the prompter: Voice Pace moves the words only while you talk and holds when you stop (mic level only, nothing recorded or uploaded); Voice Follow tracks the words on-device. The editor shows exactly what the prompter will. A one-time purchase, no subscription, no account.

## Operating Context

- The phone is usually at arm's length or further, often in landscape on a stand, sometimes mirrored for a beam splitter.
- The reader's eyes must stay near the lens; anything that pulls them away (bright chrome, motion, badges) costs the take.
- Recording happens in rooms of every light level; the prompter must read in a dark room and in daylight.
- Script markup: `# section`, `*emphasis*`, `[pause]`, `[[private note]]`, `---`.

## Capabilities and Constraints

- Screens: Script library, Editor (write / preview, read time, WPM, fit to time, captions export), Prompter (countdown, steady / Voice Pace / Voice Follow, speed nudges, mirror and flip, sections, timer), Record (camera with the script near the lens, take per section), Settings, Cue Plus paywall, Android access code.
- Plus is one payment (A$2.99) with a seven-day free trial started explicitly. Purchase, trial and restore logic, Voice Pace / Follow behaviour and store metadata are not design surfaces.
- Cue 1.0 and its in-app purchases were in Apple review on 21 Nov 2026: no release or store changes from design work.
- Prompter colour presets (Classic, Paper, Night, High contrast) are a Plus feature and keep their identities.

## Brand Commitments

- Name: Cue. Tagline in README: "teleprompter that waits for you".
- Fonts already shipped and loaded: Atkinson Hyperlegible (prompter and body text, chosen for distance legibility) and Bricolage Grotesque.
- Plain-English copy in `src/i18n/en.ts`; all user-facing text lives there.

## Evidence on Hand

- The bundled welcome script teaches the markup. No testimonials, user counts or ratings exist; never invent them.

## Product Principles

1. The words are the interface: everything else gets out of their way.
2. Nothing moves that the reader did not ask to move.
3. Standard iPhone behaviour beats invention: people use Cue in a hurry, just before they film.
4. Honest money: one price, what stays free is said first, restore and close always visible.

## Accessibility & Inclusion

Dynamic Type where layouts allow, 44 pt targets, 4.5:1 text contrast in both appearances, VoiceOver labels from i18n, Reduce Motion honoured (system setting and in-app switch).
