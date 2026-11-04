import unittest
from verify_cue_logcat import inspect, PACKAGE


class RuntimeLogTest(unittest.TestCase):
    def test_google_service_crash_is_retained_without_blaming_cue(self):
        r = inspect('11-03 22:11:33.366  1189  1406 F libc : Fatal signal 11 in pid 1189 (.gms.persistent)', ['5000'])
        self.assertFalse(r['cueFailures'])
        self.assertEqual(len(r['externalFatalEvents']), 1)

    def test_native_crash_in_live_cue_process_fails(self):
        r = inspect('11-03 22:11:33.366  5000  5001 F libc : Fatal signal 11', ['5000'])
        self.assertEqual(len(r['cueFailures']), 1)

    def test_earlier_cue_process_error_survives_restart(self):
        r = inspect(f'11-03 22:00:00.000  550  551 I ActivityManager: Start proc 4000:{PACKAGE}/u0a1\n'
                    '11-03 22:00:01.000  4000  4001 E ReactNativeJS: Error: script failed', ['5000'])
        self.assertEqual(len(r['cueFailures']), 1)

    def test_java_process_attribution_fails_even_without_start_record(self):
        r = inspect('11-03 22:00:00.000  4000  4001 E AndroidRuntime: FATAL EXCEPTION: main\n'
                    f'11-03 22:00:00.001  4000  4001 E AndroidRuntime: Process: {PACKAGE}, PID: 4000', ['5000'])
        self.assertEqual(len(r['cueFailures']), 1)

    def test_anr_or_native_tombstone_fails(self):
        for line in [f'ANR in {PACKAGE}', f'pid: 4000 >>> {PACKAGE} <<<']:
            with self.subTest(line=line):
                self.assertTrue(inspect(line, ['5000'])['cueFailures'])

    def test_missing_live_app_does_not_pass(self):
        with self.assertRaises(AssertionError):
            inspect('', [])


if __name__ == '__main__':
    unittest.main()
