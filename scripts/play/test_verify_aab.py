"""Regression cases for production-only manifest and 64-bit alignment gates."""
import struct
import unittest
import urllib.request
from verify_aab import inspect_manifest, inspect_elf, StripAuthorizationRedirect

MANIFEST = '''<manifest xmlns:android="http://schemas.android.com/apk/res/android"
package="com.jared797.cue" android:versionName="1.0.0" android:versionCode="3">
<uses-sdk android:targetSdkVersion="36"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32"/>
<application><meta-data android:name="expo.modules.updates.ENABLED" android:value="false"/></application>
</manifest>'''


class ProductionGates(unittest.TestCase):
    def test_expo_auth_not_forwarded_to_artifact_host(self):
        request = urllib.request.Request('https://expo.dev/artifacts/eas/test.aab')
        request.add_unredirected_header('Authorization', 'Bearer synthetic-test-value')
        redirected = StripAuthorizationRedirect().redirect_request(
            request, None, 302, 'Found', {}, 'https://storage.googleapis.com/test.aab')
        self.assertIsNone(redirected.get_header('Authorization'))

    def test_expected_manifest(self):
        self.assertEqual(inspect_manifest(MANIFEST)[0], 36)

    def test_superseded_version_and_unused_scanner_rejected(self):
        for text in (MANIFEST.replace('versionCode="3"', 'versionCode="2"'),
                     MANIFEST.replace('<application>', '<application><provider android:name="com.google.mlkit.common.internal.MlKitInitProvider"/>')):
            with self.subTest(text=text), self.assertRaises(AssertionError):
                inspect_manifest(text)

    def test_preview_package_rejected(self):
        with self.assertRaises(AssertionError):
            inspect_manifest(MANIFEST.replace('com.jared797.cue"', 'com.jared797.cue.playtest"'))

    def test_actual_forbidden_declaration_rejected(self):
        for tag in ('uses-permission', 'uses-permission-sdk-23'):
            with self.subTest(tag=tag), self.assertRaises(AssertionError):
                inspect_manifest(MANIFEST.replace('<application>', f'<{tag} android:name="android.permission.READ_EXTERNAL_STORAGE"/><application>'))

    def test_uncapped_storage_rejected(self):
        with self.assertRaises(AssertionError):
            inspect_manifest(MANIFEST.replace(' android:maxSdkVersion="32"', ''))

    def test_debug_or_ota_rejected(self):
        for text in (MANIFEST.replace('<application>', '<application android:debuggable="true">'),
                     MANIFEST.replace('android:value="false"', 'android:value="true"')):
            with self.assertRaises(AssertionError):
                inspect_manifest(text)

    def test_64bit_alignment(self):
        data = bytearray(128)
        data[:6] = b'\x7fELF\x02\x01'
        struct.pack_into('<Q', data, 32, 64)
        struct.pack_into('<HH', data, 54, 56, 1)
        struct.pack_into('<I', data, 64, 1)
        struct.pack_into('<Q', data, 112, 16384)
        self.assertEqual(inspect_elf('base/lib/arm64-v8a/libtest.so', data)['bits'], 64)
        struct.pack_into('<Q', data, 112, 4096)
        with self.assertRaises(AssertionError):
            inspect_elf('base/lib/arm64-v8a/libtest.so', data)

    def test_32bit_4096_recorded_separately(self):
        data = bytearray(100)
        data[:6] = b'\x7fELF\x01\x01'
        struct.pack_into('<I', data, 28, 52)
        struct.pack_into('<HH', data, 42, 32, 1)
        struct.pack_into('<I', data, 52, 1)
        struct.pack_into('<I', data, 80, 4096)
        self.assertEqual(inspect_elf('base/lib/armeabi-v7a/libtest.so', data)['bits'], 32)


if __name__ == '__main__':
    unittest.main()
