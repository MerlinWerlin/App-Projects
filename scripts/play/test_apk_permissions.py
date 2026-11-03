import unittest
from apk_permissions import verify_permissions

MANIFEST = '''  E: manifest (line=2)
    E: uses-permission (line=16)
      A: android:name(0x01010003)="android.permission.WRITE_EXTERNAL_STORAGE"
      A: android:maxSdkVersion(0x01010271)=(type 0x10)0x20
'''
BADGING = '''uses-permission: name='android.permission.WRITE_EXTERNAL_STORAGE' maxSdkVersion='32'
uses-permission: name='android.permission.READ_EXTERNAL_STORAGE' maxSdkVersion='32'
uses-implied-permission: name='android.permission.READ_EXTERNAL_STORAGE' maxSdkVersion='32' reason='requested WRITE_EXTERNAL_STORAGE'
'''


class PermissionsTest(unittest.TestCase):
    def test_capped_implied_read(self):
        verify_permissions(MANIFEST, BADGING)

    def test_explicit_read_including_sdk23_is_rejected(self):
        for tag in ['uses-permission', 'uses-permission-sdk-23']:
            with self.subTest(tag=tag), self.assertRaises(AssertionError):
                verify_permissions(MANIFEST + f'    E: {tag} (line=20)\n      A: android:name(0x01010003)="android.permission.READ_EXTERNAL_STORAGE"', BADGING)

    def test_uncapped_implied_read_is_rejected(self):
        with self.assertRaises(AssertionError):
            verify_permissions(MANIFEST, BADGING.replace(" maxSdkVersion='32'", ''))

    def test_modern_media_read_is_rejected(self):
        with self.assertRaises(AssertionError):
            verify_permissions(MANIFEST, BADGING + "uses-permission: name='android.permission.READ_MEDIA_VIDEO'")

    def test_uncapped_write_is_rejected(self):
        with self.assertRaises(AssertionError):
            verify_permissions(MANIFEST.replace('0x20', '0x21'), BADGING)


if __name__ == '__main__':
    unittest.main()
