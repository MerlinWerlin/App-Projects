# Roamlings (working title)

Collect-and-raise pet app for Jared's App Factory. Walking, focus and care earn Spark; Spark fills eggs; eggs hatch
pets in colourway and part variants (Common to Mythic); pets grow through 3 stages into a form shaped by what you did.

- Concept doc (the full design): https://claude.ai/artifact/RhrtGb8BAep9D3UCJGDnBa
- Plan and phases: docs/PLAN.md · backlog: ops/backlog.json · run log: ops/RUNLOG.md
- Built by the "Roamlings build" scheduled task, committing straight to this folder (repo-direct app).
  The hourly "App Factory auto-ship" task ships it to TestFlight once the App Store Connect record exists.
- Tests run offline: `npm test` (node --test) and `npm run typecheck:ui` (strict tsc against scripts/tsc-stubs).
