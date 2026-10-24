# Owner request, 24 Oct 2026: default theme matches the logo

Owner (after the first TestFlight build): "first impressions are important - the main theme for the remote app
needs to match the start up animation and the logo remote."

Done in the shipping repo (App-Projects, apps/couch):
- New free remote theme **Charcoal & Gold** (`charcoal`), now `DEFAULT_REMOTE_THEME`: matte charcoal body and keys,
  brushed-gold d-pad face and OK key with dark arrows (new optional `ringInk` token), the intro's background
  `#0E0E0F` so the opening animation fades straight into the remote. All WCAG pairs pass.
- Old saved prefs that say `midnight` were the old default written on every save, so they now read as the new
  default; saves carry `themeV: 2`, after which a picked Midnight is kept (`src/core/prefs.ts`).
- Midnight stays free. Store screenshot 01 now uses Charcoal & Gold. Name translated in all 11 languages.
- Prototype mirror updated (arrow colour on the gold pad not mirrored there; `ringInk` is app-only).
