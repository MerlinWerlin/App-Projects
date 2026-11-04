"""Read-only production AAB inspection; never retrieves signing credentials."""
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import subprocess
import sys
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile

from apk_permissions import FORBIDDEN

BUILD_ID = "637caa56-f5d2-46d0-801e-6d644f26c359"
SOURCE = "2a16e7fe1e5bf70a320ca44c8ae5549d51e140fd"
BUNDLETOOL_URL = "https://github.com/google/bundletool/releases/download/1.18.3/bundletool-all-1.18.3.jar"
BUNDLETOOL_SHA = "a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29"
ANDROID = "{http://schemas.android.com/apk/res/android}"


def inspect_manifest(text):
    root = ET.fromstring(text)
    assert root.attrib["package"] == "com.jared797.cue"
    assert root.attrib[ANDROID + "versionName"] == "1.0.0"
    assert root.attrib[ANDROID + "versionCode"] == "2"
    target = int(root.find("uses-sdk").attrib[ANDROID + "targetSdkVersion"])
    assert target >= 36
    app = root.find("application")
    assert app.attrib.get(ANDROID + "debuggable", "false") == "false"
    metadata = {m.attrib[ANDROID + "name"]: m.attrib.get(ANDROID + "value")
                for m in app.findall("meta-data")}
    assert metadata["expo.modules.updates.ENABLED"] == "false"
    permissions = []
    for node in root:
        if node.tag not in ("uses-permission", "uses-permission-sdk-23"):
            continue
        name = node.attrib[ANDROID + "name"]
        assert name not in {"android.permission." + p for p in FORBIDDEN}, name
        if name == "android.permission.WRITE_EXTERNAL_STORAGE":
            assert node.attrib.get(ANDROID + "maxSdkVersion") == "32"
        permissions.append(dict(node.attrib))
    assert any(p[ANDROID + "name"] == "android.permission.CAMERA" for p in permissions)
    return target, permissions


def inspect_elf(name, data):
    assert data[:4] == b"\x7fELF" and data[5] == 1, name
    bits = {1: 32, 2: 64}[data[4]]
    abi = name.split("/")[2]
    assert bits == (64 if abi in ("arm64-v8a", "x86_64") else 32), name
    if bits == 64:
        offset = struct.unpack_from("<Q", data, 32)[0]
        size, count = struct.unpack_from("<HH", data, 54)
    else:
        offset = struct.unpack_from("<I", data, 28)[0]
        size, count = struct.unpack_from("<HH", data, 42)
    aligns = []
    for index in range(count):
        header = offset + size * index
        if struct.unpack_from("<I", data, header)[0] == 1:
            alignment = struct.unpack_from("<Q" if bits == 64 else "<I", data,
                                           header + (48 if bits == 64 else 28))[0]
            if bits == 64:
                assert alignment >= 16384, f"4 KB-only segment: {name}"
            aligns.append(alignment)
    assert aligns, name
    return {"name": name, "abi": abi, "bits": bits, "loadAlignments": aligns}


class StripAuthorizationRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        result = super().redirect_request(req, fp, code, msg, headers, newurl)
        if result is not None:
            result.remove_header("Authorization")
            assert urllib.parse.urlparse(newurl).scheme == "https", "HTTPS redirect required"
        return result


def download(url, path, expo_auth=False):
    assert url.startswith("https://"), "Expected HTTPS artifact"
    request = urllib.request.Request(url)
    if expo_auth:
        origin = urllib.parse.urlparse(url)
        assert origin.netloc == "expo.dev" and origin.path.startswith("/artifacts/eas/"), "Unexpected Expo artifact origin"
        token = os.environ.get("EXPO_TOKEN")
        assert token, "Existing Expo authentication required"
        request.add_unredirected_header("Authorization", "Bearer " + token)
    opener = urllib.request.build_opener(StripAuthorizationRedirect())
    with opener.open(request, timeout=120) as response, path.open("wb") as out:
        while chunk := response.read(1024 * 1024):
            out.write(chunk)


def main(output):
    state = json.loads((output / "build.json").read_text())
    assert state["id"] == BUILD_ID and state["gitCommitHash"] == SOURCE
    assert state["platform"] == "ANDROID" and state["buildProfile"] == "play-production"
    assert state["distribution"] == "STORE"
    if state["status"] != "FINISHED":
        print("Production build status: " + state["status"] + "; no binary validation claimed")
        assert state["status"] not in ("ERRORED", "CANCELED"), state.get("error", {}).get("message", "Build failed")
        return
    assert state["appVersion"] == "1.0.0" and str(state["appBuildVersion"]) == "2"
    bundle = output / "cue-production.aab"
    download(state["artifacts"]["buildUrl"], bundle, expo_auth=True)
    tool = output / "bundletool.jar"
    download(BUNDLETOOL_URL, tool)
    assert hashlib.sha256(tool.read_bytes()).hexdigest() == BUNDLETOOL_SHA

    def run(name, args):
        result = subprocess.run(args, capture_output=True, text=True)
        (output / name).write_text(result.stdout + result.stderr)
        assert result.returncode == 0, name + " failed; inspect archived output"
        return result.stdout

    java = ["java", "-jar", str(tool)]
    run("bundle-validation.txt", java + ["validate", "--bundle=" + str(bundle)])
    manifest = run("production-manifest.xml", java + ["dump", "manifest", "--bundle=" + str(bundle), "--module=base"])
    target, permissions = inspect_manifest(manifest)
    config = run("bundle-config.json", java + ["dump", "config", "--bundle=" + str(bundle)])
    assert "PAGE_ALIGNMENT_16K" in config, "Bundle does not request 16 KB APK alignment"
    signature = run("production-signature.txt", ["jarsigner", "-J-Duser.language=en", "-verify", "-verbose", "-certs", str(bundle)])
    assert "jar verified." in signature and "unsigned entries" not in signature
    cert = run("production-certificate.txt", ["keytool", "-J-Duser.language=en", "-printcert", "-jarfile", str(bundle)])
    assert not re.search(r"CN\s*=\s*Android Debug", cert, re.I), "Debug key is not a production upload key"
    fingerprints = re.findall(r"SHA256:\s*([0-9A-F:]+)", cert)
    assert fingerprints, "Missing signing certificate fingerprint"
    libs = []
    with zipfile.ZipFile(bundle) as archive:
        assert archive.testzip() is None
        assert archive.getinfo("base/assets/index.android.bundle").file_size > 100_000
        assert "base/dex/classes.dex" in archive.namelist()
        for name in archive.namelist():
            if name.startswith("base/lib/") and name.endswith(".so"):
                libs.append(inspect_elf(name, archive.read(name)))
    assert any(lib["abi"] == "arm64-v8a" for lib in libs)
    receipt = {"status": "static_production_bundle_checks_passed_not_submitted",
               "buildId": BUILD_ID, "sourceCommit": SOURCE, "package": "com.jared797.cue",
               "version": "1.0.0", "versionCode": 2, "targetSdk": target,
               "sha256": hashlib.sha256(bundle.read_bytes()).hexdigest(), "bytes": bundle.stat().st_size,
               "certificateSha256": fingerprints, "bundletoolVersion": "1.18.3",
               "permissions": permissions, "nativeLibraries": libs,
               "runtimeEvidence": "Separate preview APK full 4 KB/16 KB flows; this AAB not yet installed or submitted"}
    (output / "production-verification.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(f"Validated signed production AAB: {len(libs)} libraries; SHA256 {receipt['sha256']}")
    tool.unlink()  # Published tool is reproducible; retain the app and receipts.


if __name__ == "__main__":
    main(Path(sys.argv[1]).resolve())
