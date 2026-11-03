"""Check compiled declarations separately from aapt's synthesized permissions."""
import re

FORBIDDEN = [
    "READ_MEDIA_IMAGES", "READ_MEDIA_VIDEO", "READ_MEDIA_AUDIO",
    "READ_MEDIA_VISUAL_USER_SELECTED", "READ_EXTERNAL_STORAGE",
    "ACCESS_MEDIA_LOCATION", "SYSTEM_ALERT_WINDOW", "FOREGROUND_SERVICE",
    "FOREGROUND_SERVICE_MEDIA_PLAYBACK", "FOREGROUND_SERVICE_MICROPHONE",
]


def verify_permissions(manifest, badging):
    # aapt xmltree records actual nodes, including uses-permission-sdk-23.
    assert "E: manifest " in manifest and "E: uses-permission " in manifest
    for permission in FORBIDDEN:
        assert f'="android.permission.{permission}"' not in manifest, permission
        if f"name='android.permission.{permission}'" in badging:
            # aapt synthesizes READ from legacy WRITE even when READ is absent
            # from the binary manifest. Require the exact capped compatibility
            # pair; never exempt an actual read declaration or modern media read.
            assert permission == "READ_EXTERNAL_STORAGE", permission
            assert "uses-permission: name='android.permission.WRITE_EXTERNAL_STORAGE' maxSdkVersion='32'" in badging
            assert "uses-implied-permission: name='android.permission.READ_EXTERNAL_STORAGE' maxSdkVersion='32' reason='requested WRITE_EXTERNAL_STORAGE'" in badging
            read_lines = [line for line in badging.splitlines() if "name='android.permission.READ_EXTERNAL_STORAGE'" in line]
            assert len(read_lines) == 2 and all("maxSdkVersion='32'" in line for line in read_lines)
    # Ensure no uncapped legacy write declaration was silently introduced.
    for block in re.split(r"(?=    E: )", manifest):
        if '="android.permission.WRITE_EXTERNAL_STORAGE"' in block:
            assert 'android:maxSdkVersion' in block and '0x20' in block, "Legacy write must stop at API32"
