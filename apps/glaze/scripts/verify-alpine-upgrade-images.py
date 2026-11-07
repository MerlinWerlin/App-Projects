"""Compare the production-composed Alpine originals across an in-place simulator upgrade."""
from pathlib import Path
import hashlib
import json
import sys

root = Path(sys.argv[1])
receipt_file = root / 'link-receipt.json'
receipt = json.loads(receipt_file.read_text()) if receipt_file.is_file() else {}
authored = receipt.get('authoredSizeUpgradeVerified', False)
rows = []
for art in ['copper-eclipse', 'jupiter-polar', 'saturn-rings', 'silver-moon', 'spiral-galaxy']:
    for size in ['small', 'medium', 'large']:
        name = f't-alpine-starlight-{art}-{size}.jpg'
        before = root / 'upgrade/base/composed-art' / name
        after = root / 'shared-group/composed-art' / name
        old = before.read_bytes() if before.is_file() else None
        new = after.read_bytes() if after.is_file() else None
        rows.append({
            'art': art, 'size': size,
            'beforeSHA256': hashlib.sha256(old).hexdigest() if old else None,
            'afterSHA256': hashlib.sha256(new).hexdigest() if new else None,
            'byteIdentical': old is not None and new is not None and old == new,
            'expectedPresent': not authored or size != 'medium',
            'expectedAbsentVerified': authored and size == 'medium' and new is None,
        })
if authored:
    name = 't-alpine-starlight-hero-medium-medium.jpg'
    before = root / 'upgrade/base/composed-art' / name
    after = root / 'shared-group/composed-art' / name
    old = before.read_bytes() if before.is_file() else None
    new = after.read_bytes() if after.is_file() else None
    rows.append({'art': 'hero-medium', 'size': 'medium', 'expectedPresent': True,
        'beforeSHA256': hashlib.sha256(old).hexdigest() if old else None,
        'afterSHA256': hashlib.sha256(new).hexdigest() if new else None,
        'byteIdentical': old is not None and new is not None and old == new})
passed = all(row['byteIdentical'] if row['expectedPresent'] else row['expectedAbsentVerified'] for row in rows)
(root / 'alpine-image-comparison.json').write_text(json.dumps({
    'passed': passed, 'inheritedAuthoredSizePolicy': authored, 'images': rows}, indent=2))
if receipt_file.is_file():
    receipt['originalAlpineImagesIdenticalTo106'] = passed
    home_verified = receipt.get('copperRenderedOnHomeScreenAllFamilies')
    if authored:
        text = (root.parent / 'glaze-link-test.log').read_text()
        receipt['copperRenderedOnAuthoredFamilies'] = all('GLAZE_COPPER_HOME_RENDER_VERIFIED ' + size in text for size in ['small', 'large'])
        home_verified = bool(receipt['copperRenderedOnAuthoredFamilies'] and receipt.get('authoredMediumHeroSelected')
            and receipt.get('auroraUpgradeAllFamilies'))
    receipt['releaseQualified'] = bool(passed and receipt.get('upgradeAlpineAllFamilies')
        and home_verified
        and (not receipt.get('themeSwapCheckRequested') or receipt.get('nativeHomeThemeSwapABA'))
        and (not receipt.get('recoveredPredecessorRun') or receipt.get('alreadyRecoveredPredecessorVerified'))
        and not receipt.get('diagnosticExtensionRebuilt'))
    receipt_file.write_text(json.dumps(receipt, indent=2))
print('GLAZE_ALPINE_ORIGINAL_IMAGES_IDENTICAL', sum(row['byteIdentical'] for row in rows), 'of', len(rows))
if not passed:
    raise SystemExit('Original Alpine art changed or is missing after upgrade')
