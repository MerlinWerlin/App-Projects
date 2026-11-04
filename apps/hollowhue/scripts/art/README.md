# Hollowhue illustrated catalogue

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
All earlier shipped scene geometry, versions and region IDs remain unchanged and accessible through
My colouring when saved work exists.

Rebuild from the preserved source snapshot:

    python -m pip install --target .expo/art-tools -r scripts/art/requirements.txt
    python scripts/import-illustrated-art.py
    npm test
    npm run typecheck
    npm run typecheck:ui

The importer also rewrites catalogue data and English artwork names. Change a shipped scene's region
IDs only deliberately with a version bump. `docs/art-direction-realistic-20261104.png` shows the selected
direction; native screenshots and reviewed-source receipts belong in `docs/qa-art-20261104`.

Curve tracing: [VTracer](https://github.com/visioncortex/vtracer).
Bundle decompression: [fflate](https://github.com/101arrowz/fflate).
