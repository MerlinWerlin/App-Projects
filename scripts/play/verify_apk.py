"""Inspect the actual test APK; no credentials or production signing involved."""
import hashlib
import json
from pathlib import Path
import re
import struct
import sys
import zipfile

apk, output = Path(sys.argv[1]), Path(sys.argv[2])
config = json.loads((output / "config.json").read_text())
badging = (output / "badging.txt").read_text()
package = re.search(r"package: name='([^']+)'", badging).group(1)
assert package == config["android"]["package"] and package.endswith(".playtest"), package
assert "application-debuggable" not in badging, "Release build must not require Metro"
target = int(re.search(r"targetSdkVersion:'(\d+)'", badging).group(1))
assert target >= 36, target
assert config["updates"]["enabled"] is False
libraries = []
with zipfile.ZipFile(apk) as archive:
    assert archive.getinfo("assets/index.android.bundle").file_size > 100_000, "Missing embedded JS"
    assert "classes.dex" in archive.namelist()
    for name in archive.namelist():
        if not name.startswith("lib/") or not name.endswith(".so"):
            continue
        data = archive.read(name)
        assert data[:6] == b"\x7fELF\x02\x01", f"Expected 64-bit little endian ELF: {name}"
        offset = struct.unpack_from("<Q", data, 32)[0]
        size, count = struct.unpack_from("<HH", data, 54)
        aligns = []
        for index in range(count):
            header = offset + size * index
            if struct.unpack_from("<I", data, header)[0] == 1:  # PT_LOAD
                alignment = struct.unpack_from("<Q", data, header + 48)[0]
                aligns.append(alignment)
                assert alignment >= 16384, f"4 KB-only native segment: {name} ({alignment})"
        assert aligns, name
        libraries.append({"name": name, "loadAlignments": aligns})
    assert any(x["name"].startswith("lib/arm64-v8a/") for x in libraries)
    assert any(x["name"].startswith("lib/x86_64/") for x in libraries)
receipt = {
    "package": package,
    "targetSdk": target,
    "sha256": hashlib.sha256(apk.read_bytes()).hexdigest(),
    "bytes": apk.stat().st_size,
    "sourceCommit": (output / "source-commit.txt").read_text().strip(),
    "signing": "Expo generated Android test key; not a Google Play upload key",
    "embeddedBundle": True,
    "nativeLibraries": libraries,
    "deviceTest": "Recorded separately by smoke-apk.sh; static checks alone do not prove runtime behavior",
}
(output / "verification.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(f"Verified {package}: {len(libraries)} native libraries, target {target}, {receipt['sha256']}")
