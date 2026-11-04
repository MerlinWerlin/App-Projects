# Hollowhue art sources

The new catalogue uses 57 original vector illustrations authored in this same repository for Linework.
The source SVG commands are saved in `linework-source.json`; they are not fetched from an external art service.
`catalog-source.json` defines seven worlds: six regular worlds with seven pictures (six actual zoom transitions),
and one Mega world with 21 distinct pictures (twenty transitions). Every world has an explicit difficulty.

`../import-linework-art.py` retains the original smooth ink curves and computes closed colourable regions
under them. Region IDs are baked once and committed. A natural iris, flower centre or window is used as
an entrance; Mega portals use a 0.28 scale to retain precision through twenty levels. Root art is 1200 square.
New scenes have new IDs; all previously shipped artwork remains unchanged and appears in My colouring
when it has saved work.

Rebuild from the preserved source snapshot (no Linework runtime import and no native dependency):

    python -m pip install --target .expo/art-tools -r scripts/art/requirements.txt
    python scripts/import-linework-art.py
    npm test
    npm run typecheck
    npm run typecheck:ui

The importer also rewrites the catalogue data and English artwork names. An optional development export
at `.expo/linework-catalog.json` can supply additional repo-authored templates; the committed snapshot is
the fallback for clean checkouts. Change an already shipped scene's art deliberately and bump its version;
never silently rebake its region IDs. `docs/art-direction-20261104.png` is the initial art direction preview.
Native iPhone validation and publication status are in `ops/status.json`.
