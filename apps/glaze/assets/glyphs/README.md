# In-house glyphs

Glaze's own generic glyphs live as path data in `src/render/inhouse.ts` (24×24 grid, stroke 2,
round caps/joins, Feather-compatible style) so they render inside the icon's SVG without a file
loader. Names are listed in `src/core/glyphnames.ts` (`INHOUSE_GLYPHS`); a core test keeps the two
in sync and checks that every catalogue glyph resolves.

Rules: original drawings only, generic subjects, no brand logos or trade dress. Record additions
in `docs/LICENSES.md`.
