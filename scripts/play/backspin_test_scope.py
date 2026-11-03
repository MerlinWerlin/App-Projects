"""Allow production-package replay only inside the fresh CI Android emulator."""
import os
from pathlib import Path
import subprocess
import sys


def production_replay_enabled(env=None):
    env = os.environ if env is None else env
    return env.get('CI') == '1' and env.get('BACKSPIN_PRODUCTION_REPLAY') == '1'


def assert_backspin_test_package(package, device=False, env=None):
    if package == 'com.jared797.backspin.playtest':
        return
    assert package == 'com.jared797.backspin' and production_replay_enabled(env), 'Production replay is CI-only'
    if device:
        assert subprocess.check_output(['adb', 'shell', 'getprop', 'ro.kernel.qemu'], timeout=20).decode().strip() == '1'
        avd = Path(os.environ['ANDROID_AVD_HOME']).resolve()
        temp = Path(os.environ['RUNNER_TEMP']).resolve()
        assert avd != temp and avd.is_relative_to(temp), 'Fresh CI AVD must be under the runner temporary directory'


if __name__ == '__main__':
    if sys.argv[1:] == ['--self-test']:
        assert production_replay_enabled({'CI':'1','BACKSPIN_PRODUCTION_REPLAY':'1'})
        for env in [{}, {'CI':'1'}, {'BACKSPIN_PRODUCTION_REPLAY':'1'}, {'CI':'0','BACKSPIN_PRODUCTION_REPLAY':'1'}]:
            assert not production_replay_enabled(env)
        assert_backspin_test_package('com.jared797.backspin.playtest')
        assert_backspin_test_package('com.jared797.backspin', env={'CI':'1','BACKSPIN_PRODUCTION_REPLAY':'1'})
        for package in ['com.jared797.backspin', 'com.someone.else']:
            try:
                assert_backspin_test_package(package, env={})
            except AssertionError:
                pass
            else:
                raise AssertionError('Unsafe package accepted')
        print('CI production replay scope guards PASS')
    else:
        assert_backspin_test_package(sys.argv[1], device=True)
