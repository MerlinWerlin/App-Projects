"""Compare the production-composed Alpine originals across an in-place simulator upgrade."""
from pathlib import Path
import hashlib
import json
import sys

root = Path(sys.argv[1])
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
        })
passed = all(row['byteIdentical'] for row in rows)
(root / 'alpine-image-comparison.json').write_text(json.dumps({'passed': passed, 'images': rows}, indent=2))
print('GLAZE_ALPINE_ORIGINAL_IMAGES_IDENTICAL', sum(row['byteIdentical'] for row in rows), 'of', len(rows))
if not passed:
    raise SystemExit('Original Alpine art changed or is missing after upgrade')
