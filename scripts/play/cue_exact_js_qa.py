"""Keep the original APK's resources/Dex/native files; use only Expo's fresh JS export."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

base, exported, target, output = map(Path, sys.argv[1:])
assert hashlib.sha256(base.read_bytes()).hexdigest() == '0ef1a79d368be05878b122ea9f8a3571764f5ef1611b92fffe6a3b789dc78a56'
with zipfile.ZipFile(base) as original, zipfile.ZipFile(exported) as fresh:
    assert original.testzip() is None and fresh.testzip() is None
    name = 'assets/index.android.bundle'
    bundle = fresh.read(name)
    assert len(bundle) > 100_000 and bundle != original.read(name)
    with zipfile.ZipFile(target, 'w') as result:
        for info in original.infolist():
            if info.filename.startswith('META-INF/') and (info.filename.endswith(('.SF', '.RSA', '.DSA', '.EC')) or info.filename == 'META-INF/MANIFEST.MF'):
                continue
            result.writestr(info, bundle if info.filename == name else original.read(info.filename))
receipt = {'scope': 'QA only; production uses a full signed build',
           'method': 'Use Expo repack fresh JS only; retain all original resource, Dex, manifest and native payloads',
           'reason': 'Official repack recompiled resources despite js-bundle-only; original archive equality gate rejected that intermediate',
           'originalSha256': hashlib.sha256(base.read_bytes()).hexdigest(),
           'officialRepackIntermediateSha256': hashlib.sha256(exported.read_bytes()).hexdigest(),
           'newJsSha256': hashlib.sha256(bundle).hexdigest()}
(output / 'exact-js-export-provenance.json').write_text(json.dumps(receipt, indent=2) + '\n')
