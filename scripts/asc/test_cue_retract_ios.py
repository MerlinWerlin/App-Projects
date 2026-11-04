import unittest
from copy import deepcopy
from cue_retract_ios import validate_target

class RetractionTarget(unittest.TestCase):
    def setUp(self):
        self.app = {"id": "6826554677", "attributes": {"bundleId": "com.jared797.cue"}}
        self.build = {"attributes": {"version": "14", "uploadedDate": "2026-11-03T17:40:00-08:00"}}
        self.pre = {"attributes": {"version": "1.0.0", "platform": "IOS"}}

    def test_apple_offset_date_uses_utc_day(self):
        validate_target(self.build, self.pre, self.app)

    def test_wrong_app_version_platform_or_date_rejected(self):
        for section, key, value in [('app', 'bundleId', 'com.other.app'), ('build', 'version', '13'),
                                    ('build', 'uploadedDate', '2026-11-02T17:40:00-08:00'),
                                    ('pre', 'version', '2.0.0'), ('pre', 'platform', 'MAC_OS')]:
            items = {name: deepcopy(getattr(self, name)) for name in ['app', 'build', 'pre']}
            items[section]['attributes'][key] = value
            with self.subTest(section=section, key=key), self.assertRaises(AssertionError):
                validate_target(items['build'], items['pre'], items['app'])

if __name__ == '__main__':
    unittest.main()
