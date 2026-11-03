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
config = json.loads((output / 'config.json').read_text())
android = '{http://schemas.android.com/apk/res/android}'
tools_namespace = '{http://schemas.android.com/tools}'
manifest_input = ET.parse(output / 'android-manifest-input.xml').getroot()
scanner_hints = [n for n in manifest_input.find('application').findall('meta-data')
                 if n.get(android+'name') == 'com.google.mlkit.vision.DEPENDENCIES']
assert len(scanner_hints) == 1 and scanner_hints[0].get(tools_namespace+'node') == 'remove', 'Unused barcode model-download hint not removed'
camera_plugin = next(p for p in config['plugins'] if isinstance(p, list) and p[0] == 'expo-camera')
assert camera_plugin[1]['barcodeScannerEnabled'] is False, 'Unused barcode SDK not disabled'
gradle_properties = (output / 'gradle-properties.txt').read_text()
assert re.search(r'^expo\.camera\.barcode-scanner-enabled=false\s*$', gradle_properties, re.M), 'Native barcode flag missing'
autolinking = json.loads((output / 'autolinking-android.json').read_text())
assert 'expo-camera' in autolinking['configuration']['buildFromSource'], 'Camera must use source instead of the default-option AAR'
runtime_dependencies = (output / 'runtime-dependencies.txt').read_text()
assert 'project :expo-camera' in runtime_dependencies, 'Camera source project not selected'
assert 'com.google.mlkit:' not in runtime_dependencies, 'ML Kit runtime dependency remains'
assert 'play-services-code-scanner' not in runtime_dependencies, 'Code-scanner runtime dependency remains'
if sys.argv[2] == '--dependencies-only':
    (output / 'dependencies-verification.json').write_text(json.dumps({
        'status': 'RUNTIME_DEPENDENCIES_PREFLIGHT_PASS', 'cameraBuildFromSource': True,
        'barcodeScannerEnabled': False, 'mlkitRuntimeAbsent': True,
    }, indent=2) + '\n')
    print('Runtime dependency preflight PASS; signed-bundle and native tests still required')
    sys.exit(0)
expected_certificate = sys.argv[2].replace(':', '').upper()
bundle = output / 'linework-production.aab'
manifest = ET.parse(output / 'bundle-manifest.xml').getroot()
assert manifest.attrib['package'] == config['android']['package'] == 'com.jared797.linework'
assert config['extra']['playVariant'] == 'production' and config['updates']['enabled'] is False
assert manifest.get(android + 'versionCode') == str(config['android']['versionCode'])
assert manifest.find('application').get(android + 'debuggable', 'false') == 'false'
target = int(manifest.find('uses-sdk').get(android + 'targetSdkVersion'))
assert target >= 36
permissions = sorted(n.get(android + 'name') for n in manifest.findall('uses-permission'))
forbidden = {'android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.RECORD_AUDIO',
             'android.permission.READ_MEDIA_AUDIO', 'android.permission.READ_MEDIA_IMAGES',
             'android.permission.READ_MEDIA_VIDEO', 'android.permission.READ_MEDIA_VISUAL_USER_SELECTED'}
assert not forbidden.intersection(permissions), forbidden.intersection(permissions)
providers = [n.get(android + 'name') for n in manifest.find('application').findall('provider')]
assert 'com.google.mlkit.common.internal.MlKitInitProvider' not in providers, 'ML Kit initializer still packaged'
assert not any(n.get(android+'name') == 'com.google.mlkit.vision.DEPENDENCIES'
               for n in manifest.find('application').findall('meta-data')), 'Unused barcode model-download hint still packaged'
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
assert not any('barhopper' in n['name'].lower() for n in libraries), 'Barcode native runtime remains'
receipt = {'status': 'SIGNED_AAB_STATIC_PASS', 'package': 'com.jared797.linework', 'targetSdk': target,
           'versionCode': manifest.get(android + 'versionCode'),
           'sourceCommit': (output / 'source-commit.txt').read_text().strip(),
           'certificateSha256': expected_certificate, 'permissions': permissions,
           'barcodeRuntimeExcluded': True, 'providers': providers,
           'nativeLibraries': libraries, 'sha256': hashlib.sha256(bundle.read_bytes()).hexdigest(),
           'bytes': bundle.stat().st_size,
           'boundary': 'Upload-key signed candidate; no Google registration/upload, Play Billing or store approval implied.'}
(output / 'bundle-verification.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({k: v for k, v in receipt.items() if k != 'nativeLibraries'}))
