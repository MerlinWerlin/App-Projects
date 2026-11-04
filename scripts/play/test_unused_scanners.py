import unittest
from unused_scanners import MARKER, verify_scanner_archive, verify_scanner_manifest


class ScannerGates(unittest.TestCase):
    def test_marker_is_reported_and_never_erases_real_provider(self):
        marker = '<meta-data android:name="' + MARKER + '" android:value="barcode_ui"/>'
        self.assertTrue(verify_scanner_manifest(marker)['barcodeDownloadMarkerRetained'])
        for name in ['com.google.mlkit.common.internal.MlKitInitProvider',
                     'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity',
                     'com.google.mlkit.vision.documentscanner.internal.GmsDocumentScanningDelegateActivity']:
            with self.subTest(name=name), self.assertRaises(AssertionError):
                verify_scanner_manifest(marker + '<provider android:name="' + name + '"/>')

    def test_runtime_sdk_is_rejected_even_without_a_provider(self):
        for name in ['lib/arm64-v8a/libbarhopper_v3.so', 'base/lib/x86_64/libbarhopper_v3.so',
                     'base/root/play-services-mlkit-barcode-scanning.properties',
                     'play-services-code-scanner.properties', 'play-services-mlkit-document-scanner.properties',
                     'assets/mlkit_barcode_model.tflite']:
            with self.subTest(name=name), self.assertRaises(AssertionError):
                verify_scanner_archive(['classes.dex', name])
        verify_scanner_archive(['classes.dex', 'billing.properties', 'lib/arm64-v8a/libexpo-modules-core.so'])
