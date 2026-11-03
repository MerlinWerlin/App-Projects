"""Verify the actual upload bundle and bind it to the expected public certificate."""
import hashlib
import json
from pathlib import Path
import re
import struct
import sys
import xml.etree.ElementTree as ET
import zipfile

output = Path(sys.argv[1])
expected_certificate = sys.argv[2].replace(':', '').upper()
bundle = output / 'linework-production.aab'
android = '{http://schemas.android.com/apk/res/android}'
manifest = ET.parse(output / 'bundle-manifest.xml').getroot()
config = json.loads((output / 'config.json').read_text())
assert manifest.attrib['package'] == config['android']['package'] == 'com.jared797.linework'
assert config['extra']['playVariant'] == 'production' and config['updates']['enabled'] is False
assert manifest.find('application').get(android + 'debuggable', 'false') == 'false'
target = int(manifest.find('uses-sdk').get(android + 'targetSdkVersion'))
assert target >= 36
permissions = sorted(n.get(android + 'name') for n in manifest.findall('uses-permission'))
forbidden = {'android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.RECORD_AUDIO',
             'android.permission.READ_MEDIA_AUDIO', 'android.permission.READ_MEDIA_IMAGES',
             'android.permission.READ_MEDIA_VIDEO', 'android.permission.READ_MEDIA_VISUAL_USER_SELECTED'}
assert not forbidden.intersection(permissions), forbidden.intersection(permissions)
certificate = (output / 'certificate.txt').read_text()
match = re.search(r'SHA256:\s*([A-Fa-f0-9:]+)', certificate)
assert match and match.group(1).replace(':', '').upper() == expected_certificate, 'Wrong upload certificate'
assert 'jar verified.' in (output / 'signature.txt').read_text(), 'AAB signature not verified'
libraries = []
with zipfile.ZipFile(bundle) as archive:
    assert archive.getinfo('base/assets/index.android.bundle').file_size > 100_000
    assert 'base/dex/classes.dex' in archive.namelist()
    for name in archive.namelist():
        if not name.startswith('base/lib/') or not name.endswith('.so'):
            continue
        data = archive.read(name)
        assert data[:6] == b'\x7fELF\x02\x01', name
        offset = struct.unpack_from('<Q', data, 32)[0]
        size, count = struct.unpack_from('<HH', data, 54)
        aligns = [struct.unpack_from('<Q', data, offset + size*i + 48)[0]
                  for i in range(count) if struct.unpack_from('<I', data, offset + size*i)[0] == 1]
        assert aligns and min(aligns) >= 16384, (name, aligns)
        libraries.append({'name': name, 'loadAlignments': aligns})
assert any('/arm64-v8a/' in n['name'] for n in libraries)
assert any('/x86_64/' in n['name'] for n in libraries)
receipt = {'status': 'SIGNED_AAB_STATIC_PASS', 'package': 'com.jared797.linework', 'targetSdk': target,
           'versionCode': manifest.get(android + 'versionCode'),
           'sourceCommit': (output / 'source-commit.txt').read_text().strip(),
           'certificateSha256': expected_certificate, 'permissions': permissions,
           'nativeLibraries': libraries, 'sha256': hashlib.sha256(bundle.read_bytes()).hexdigest(),
           'bytes': bundle.stat().st_size,
           'boundary': 'Upload-key signed candidate; no Google registration/upload, Play Billing or store approval implied.'}
(output / 'bundle-verification.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({k: v for k, v in receipt.items() if k != 'nativeLibraries'}))
