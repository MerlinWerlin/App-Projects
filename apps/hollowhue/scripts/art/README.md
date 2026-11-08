# Hollowhue illustrated catalogue

**Current model, corrected 5 November:** the 42 approved pictures are separate Single artworks. Six new
Zoom editions each reveal six illustrated details within their own scene. Mega Rose Engraving has twenty
new inner tiers within the same engraving. `nested-source.json` records every semantic parent/detail
relationship and portal location. `nested-generation.json` records the full prompts and actual reference
images for 47 new drawings made with the built-in image generation tool. All final sources are preserved
losslessly beside the original 42 images. The cottage follows window → book illustration → bee → wing →
pollen → pore; other editions follow feather/dew/leaf details, shell/barnacle/mineral details and botanical
microtextures. The illustrated wing/pollen plates are shared between the two bee journeys.

`catalog-source.json` now describes **legacy shipped chains only**. They misinterpreted six zooms as a chain
of unrelated complete pictures. Their exact paths, IDs, versions and saves remain available through My
colouring. `released-geometry.json` guards all 42 original compiled images and those seven chains. Painted
occurrences are copied into a new Single edition only if that edition has never been saved; original
chains are never modified. The six earlier authored legacy scenes also retain their exact geometry.

The canonical rebuild is now `python scripts/build-art-library.py`. It reuses the v1 raster compiler below
and packs each illustration independently. Gallery layout, progress restoration and counts use generated
metadata without unpacking path data. A six-entry art cache decodes only viewed illustrations; hit geometry
is released on leaving a canvas. Unpainted disjoint white cells use the paper already beneath them, while
coloured paper, borrowed paint and clipped strokes retain their masking cells. This avoids thousands of
unnecessary SVG views. Native modules and runtime 0.1.0 remain unchanged.

The remainder of this document records the 4 November source provenance and superseded sequence model.

The final replacement catalogue uses **42 original illustrations** created for Hollowhue with the
built-in `image_gen` tool on 4 November 2026. The owner rejected the earlier geometric Linework preview
and explicitly requested more realistic, detailed artwork. That draft was not published.

`illustrations/` preserves the selected source pixels as lossless WebP files. `illustrations.json`
records names, subjects, difficulty and prompt groups; `generation-prompts.json` contains the prompt
templates used with those subjects. These source files are development assets, not app image downloads.

`catalog-source.json` defines six regular worlds with seven pictures (six actual zoom transitions),
and one Mega world with 21 distinct illustrations (twenty transitions). Garden Blooms has seven simpler
beginner pictures; botanical and sea worlds are intermediate; detailed places, wildlife and ornaments
are advanced. Topic categories and difficulty filters can be combined.

`../import-illustrated-art.py` finds enclosed paper areas and traces the actual illustrated ink with
cubic curves. The closed fills and non-colourable ink silhouettes are baked together. Tiny areas are
excluded from tapping; original ink remains visible above coloured regions. Receipts preserve source
hashes and region counts. Root art is 1200 square. Natural interior shapes hold the regular portals;
Mega portals use a 0.28 scale to retain precision through twenty levels.

The generated vector data is gzip-packed in the JS bundle and decoded locally with pinned pure-JS
`fflate`. It works offline and adds no native module or native dependency change. Runtime stays 0.1.0.
Empty gallery cards use generated PNG covers; painted opening pictures retain their live vector preview.
This avoids constructing thousands of native SVG paths just to open the gallery. The canvas stays editable.
All earlier shipped scene geometry, versions and region IDs remain unchanged and accessible through
My colouring when saved work exists.

Rebuild from the preserved source snapshot:

    python -m pip install --target .expo/art-tools -r scripts/art/requirements.txt
    python scripts/build-art-library.py
    npm test
    npm run typecheck
    npm run typecheck:ui

The importer also rewrites catalogue data and English artwork names. Change a shipped scene's region
IDs only deliberately with a version bump. `docs/art-direction-realistic-20261104.png` shows the selected
direction; native screenshots and reviewed-source receipts belong in `docs/qa-art-20261104`.

Curve tracing: [VTracer](https://github.com/visioncortex/vtracer).
Bundle decompression: [fflate](https://github.com/101arrowz/fflate).
