"""Read in-flight uploads as well as processed builds, using existing ASC CI credentials.

https://developer.apple.com/documentation/appstoreconnectapi/get-v1-apps-_id_-builduploads
Only selected build/status fields are emitted; no file upload URLs, tokens or credentials.
Run from the repository root: python apps/hollowhue/scripts/upload-status.py
"""
import json
import pathlib
import runpy

root = pathlib.Path(__file__).resolve().parents[3]
asc = runpy.run_path(str(root / 'scripts/asc/asc.py'))
get = asc['get']
result = get('/v1/apps/6829399355/buildUploads', **{
    'limit': 10,
    'fields[buildUploads]': 'cfBundleShortVersionString,cfBundleVersion,createdDate,uploadedDate,state,build',
    'fields[builds]': 'version,processingState,uploadedDate',
    'include': 'build',
})
uploads = []
for item in result.get('data', []):
    attrs = item.get('attributes', {})
    uploads.append({'id': item['id'], **{k: attrs.get(k) for k in (
        'cfBundleShortVersionString', 'cfBundleVersion', 'createdDate', 'uploadedDate', 'state')},
        'build': item.get('relationships', {}).get('build', {}).get('data')})
builds = []
for item in result.get('included', []):
    if item.get('type') != 'builds':
        continue
    attrs = item.get('attributes', {})
    detail = get(f"/v1/builds/{item['id']}/buildBetaDetail").get('data') or {}
    builds.append({'id': item['id'], 'version': attrs.get('version'),
                   'processingState': attrs.get('processingState'),
                   'uploadedDate': attrs.get('uploadedDate'),
                   'internalBuildState': detail.get('attributes', {}).get('internalBuildState')})
print(json.dumps({'appStoreConnectAppId': '6829399355', 'uploads': uploads, 'builds': builds}, indent=2))
