# Owner brief owner-1101g (1 Nov 2026 16:01 Sydney, after testing TestFlight 1.0.1 (18))

Imported in run 218 as T236-T243 (ops/backlog.json, tag owner-1101g). Outranks the backlog. Order: 1, 2, 6, 4, 5, 3.

**Good, keep:** applying a new theme's profile REPLACED the old Home Screen icons ("that makes this a major player in the market"). Guarded by a test (T242).

1. **Widget art fills the widget** (T236). No grey/light frame ever; the subject is never cut. Where the art's shape differs, the art's own edges are extended and softly blurred, so dark themes stay dark. Per-widget Fit / Fill in Edit Widget, default Fill.
2. **Widgets that look functional work** (T237). Clock, date, countdown and battery art show the live value. Focus is a working 25-minute timer with a start/pause button. Pure pictures are labelled "Art".
3. **My widget art doesn't pile up** (T238). Manage art (select, delete, Clear all). A new theme's art replaces the previous theme's auto-added art; your own photos stay. A one-time clean-up removes old auto-added art.
4. **Automatic app detection: 50 apps** (T239), the Apple limit.
5. **Icon style picker always visible** (T240): Themed / Tinted / Glass / Dark with previews of your apps. Glass is darker and tinted with the theme.
6. **Textured icons** (T241): each theme's icon background carries its motif (stars, grain, gradient) behind the glyph, as the default style.

Status: all six done in run 218 (T236-T242), see the RUNLOG. Limits: live values over art show in the Fill layout; the two countdown pieces stay Art until a target day can be set (T245); 18 of the 50 app checks use unverified public schemes (they fail safely, T247); pre-sized pack images wait on repo space (T244). Questions: docs/TRIAL.md "New since your last test (1 Nov, evening: owner-1101g brief)".
