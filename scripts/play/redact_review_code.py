"""Redact the complimentary code from public CI text reports, retaining a hash receipt."""
import hashlib
import json
import os
from pathlib import Path
import sys

root = Path(sys.argv[1])
code = os.environ.get('REVIEW_CODE', '').strip()
receipts = []
if code:
    for path in root.rglob('*'):
        if not path.is_file() or path.suffix.lower() not in {'.json', '.xml', '.txt', '.log', '.html', '.yaml', '.yml'}:
            continue
        before = path.read_bytes()
        after = before.replace(code.encode(), b'[REDACTED_COMPLIMENTARY_ACCESS_CODE]')
        if before != after:
            path.write_bytes(after)
            receipts.append({'file': str(path.relative_to(root)), 'originalSha256': hashlib.sha256(before).hexdigest(), 'redactedSha256': hashlib.sha256(after).hexdigest()})
(root / 'review-code-redaction.json').write_text(json.dumps({'scope': 'Text reports only; code field is masked in the UI. Assertions and failures are preserved.', 'files': receipts}, indent=2))
