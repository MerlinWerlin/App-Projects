"""Inspect or expire only Cue 1.0.0 build14, uploaded by accidental PR206."""
import json
import os
from pathlib import Path
import sys

import asc

APP_ID = "6826554677"


def validate_target(build, prerelease, app):
    a = build["attributes"]
    assert app["id"] == APP_ID and app["attributes"]["bundleId"] == "com.jared797.cue"
    assert a["version"] == "14" and a["uploadedDate"].startswith("2026-11-04"), "Unexpected upload"
    assert prerelease["attributes"]["version"] == "1.0.0"
    assert prerelease["attributes"]["platform"] == "IOS"


def main():
    output = Path(os.environ.get("OUTPUT_DIR", "cue-ios-retraction-output"))
    output.mkdir(parents=True, exist_ok=True)
    try:
        app = asc.get(f"/v1/apps/{APP_ID}")["data"]
    except RuntimeError as error:
        if "401" not in str(error):
            raise
        asc.KEY_KIND = "individual"
        app = asc.get(f"/v1/apps/{APP_ID}")["data"]
    builds = asc.get("/v1/builds", **{"filter[app]": APP_ID, "filter[version]": "14", "limit": 20})["data"]
    assert len(builds) == 1, "Expected exactly one Cue build14"
    build = builds[0]
    build_id = build["id"]
    prerelease = asc.get(f"/v1/builds/{build_id}/preReleaseVersion")["data"]
    validate_target(build, prerelease, app)
    versions = asc.get(f"/v1/apps/{APP_ID}/appStoreVersions", **{"filter[platform]": "IOS", "limit": 50})
    assert not versions.get("links", {}).get("next"), "Inspect version pagination before mutation"
    version_states = []
    for version in versions["data"]:
        attached = asc.get(f"/v1/appStoreVersions/{version['id']}/build").get("data")
        version_states.append({"id": version["id"], "version": version["attributes"].get("versionString"),
                               "state": version["attributes"].get("appStoreState"),
                               "buildId": attached["id"] if attached else None})
    reviews = asc.get(f"/v1/apps/{APP_ID}/reviewSubmissions", limit=50)
    assert not reviews.get("links", {}).get("next"), "Inspect review pagination before mutation"
    report = {"appId": APP_ID, "bundleId": "com.jared797.cue", "version": "1.0.0", "buildNumber": "14",
              "buildId": build_id, "uploadedDate": build["attributes"]["uploadedDate"],
              "beforeExpired": build["attributes"].get("expired"), "mutation": "none_read_only",
              "appStoreVersions": version_states,
              "reviewSubmissions": [{"id": r["id"], "state": r["attributes"].get("state"),
                                      "platform": r["attributes"].get("platform")} for r in reviews["data"]]}
    (output / "before.json").write_text(json.dumps(report, indent=2) + "\n")
    if os.environ.get("EXPIRE_BUILD") == "true":
        assert os.environ.get("EXPECTED_BUILD_ID") == build_id, "Read-only inspection UUID must match"
        if not build["attributes"].get("expired"):
            asc.call("PATCH", f"/v1/builds/{build_id}", {"data": {"type": "builds", "id": build_id,
                     "attributes": {"expired": True}}}, ok=(200,))
        report["mutation"] = "expired_only_target_build"
    current = asc.get(f"/v1/builds/{build_id}")["data"]
    detail = asc.get(f"/v1/builds/{build_id}/buildBetaDetail").get("data")
    report["afterExpired"] = current["attributes"].get("expired")
    report["betaState"] = detail.get("attributes", {}) if detail else None
    (output / "result.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    if os.environ.get("EXPIRE_BUILD") == "true":
        assert report["afterExpired"] is True, "Expiry not confirmed by Apple readback"


if __name__ == "__main__":
    main()
