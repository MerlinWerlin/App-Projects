"""Distinguish Expo Camera's manifest download marker from packaged scanner SDKs."""
MARKER = 'com.google.mlkit.vision.DEPENDENCIES'


def verify_scanner_manifest(text):
    # Camera's own AndroidManifest contains barcode_ui even when both scanner
    # libraries are compileOnly. Do not mistake that marker for an initializer.
    assert 'com.google.mlkit' not in text.replace(MARKER, ''), 'Scanner component/provider remains'
    return {'barcodeDownloadMarkerRetained': MARKER in text,
            'scope': 'A retained barcode_ui marker is recorded, not proof of SDK initialization or no platform download'}


def verify_scanner_archive(names):
    forbidden = [n for n in names if any(p in n.lower() for p in
                 ['barhopper', 'mlkit', 'code-scanner', 'document-scanner'])]
    assert not forbidden, 'Scanner runtime library/model/metadata remains: ' + ', '.join(forbidden)
