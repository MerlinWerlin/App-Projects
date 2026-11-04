"""Require exact original native payloads; this is not a production signing route."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

base, repacked, output = map(Path, sys.argv[1:])
assert hashlib.sha256(base.read_bytes()).hexdigest() == '0ef1a79d368be05878b122ea9f8a3571764f5ef1611b92fffe6a3b789dc78a56'
def payloads(path):
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
        return {n: hashlib.sha256(archive.read(n)).hexdigest() for n in archive.namelist()
                if not n.endswith('/') and not (n.startswith('META-INF/') and (n.endswith(('.SF', '.RSA', '.DSA', '.EC')) or n == 'META-INF/MANIFEST.MF'))}
before, after = payloads(base), payloads(repacked)
assert before.keys() == after.keys(), 'Archive payload names changed'
changed = [n for n in before if before[n] != after[n]]
assert changed == ['assets/index.android.bundle'], 'Unexpected payload changes: ' + repr(changed)
receipt = {'status': 'native_payloads_identical_new_JS_QA_only', 'baseApkSha256': hashlib.sha256(base.read_bytes()).hexdigest(),
           'repackedApkSha256': hashlib.sha256(repacked.read_bytes()).hexdigest(), 'changedPayloads': changed,
           'unchangedPayloads': len(before) - 1, 'nativeSourceCommit': '49c8992756fd505ce14710c81c3e719ae5d99d0c',
           'signingScope': 'Payload identity only; apksigner verifies the separately signed CI artifact',
           'javascriptSourceCommit': '1290bdf42acaf5f2bd216f5443b4a83e31001d5f', 'productionUse': 'Prohibited; the production AAB uses the complete signed build pipeline'}
(output / 'repack-provenance.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('Verified exact native payload identity; signing is checked separately by apksigner.')
