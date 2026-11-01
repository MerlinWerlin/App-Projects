# Hollowhue (working title)

iPad-first colouring app for Jared's App Factory (iPhone too). Every scene hides more to colour inside it: pinch
into the bookshop window and you are inside the bookshop, then the reading nook, then a cat asleep on a cushion.
Colour by tapping a shape (fill) or freehand with finger / Apple Pencil (pencil, marker, rubber).

- Plan, phases and the money plan for later: docs/PLAN.md · what to try on TestFlight: docs/TRIAL.md
- Ops: ops/backlog.json, ops/RUNLOG.md, ops/DECISIONS.md, ops/CONVENTIONS.md, ops/SHIP_NOTES.md
- Tests run offline: `npm test` (node --test) and `npm run typecheck:ui` (strict tsc against scripts/tsc-stubs).
- Art check without a phone: `node scripts/dump-scenes.ts > /tmp/s.json && python3 scripts/preview.py /tmp/s.json /tmp/out`
  renders every level (and a composite with children pasted into their portals) to PNG.
