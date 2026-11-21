"""Satchel capture proof (1.0 feedback, offline map zoom): install the published city packs on the simulator.

python3 maps.py --data <app data container> [--cities tokyo,kyoto,sydney]

Downloads each pack from the satchel-maps-v1 release and unpacks it the way the app does (src/native/cityMaps.ts):
<Documents>/maps/<id>/ with meta.json, pois.json and tiles/{z}/{x}/{y}.png only, '.complete' written last. Only for
the simulator proof run after the store shots; never shipped in the app.
"""
import argparse
import io
import json
import re
import tarfile
import urllib.request
from pathlib import Path

BASE = 'https://github.com/MerlinWerlin/App-Projects/releases/download/satchel-maps-v1/'
ENTRY = re.compile(r'^(meta\.json|pois\.json|tiles/\d{1,2}/\d{1,7}/\d{1,7}\.png)$')


def install(data: Path, city: str, catalog: dict) -> int:
    raw = urllib.request.urlopen(f'{BASE}{city}.tar', timeout=300).read()
    out = data / 'Documents' / 'maps' / city
    n = 0
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as tar:
        for m in tar.getmembers():
            name = m.name[2:] if m.name.startswith('./') else m.name
            if not m.isfile() or not ENTRY.match(name):
                continue
            dest = out / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(tar.extractfile(m).read())
            n += 1
    # Like the app (src/core/citymaps.ts packMetaToSave): meta.json takes bytes and sha256 from the catalog entry,
    # without them the city doesn't count as installed.
    entry = next(c for c in catalog['cities'] if c['id'] == city)
    meta = json.loads((out / 'meta.json').read_text(encoding='utf-8'))
    meta['bytes'] = entry['bytes']
    if entry.get('sha256'):
        meta['sha256'] = entry['sha256']
    (out / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False), encoding='utf-8')
    (out / '.complete').write_text('')
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--cities', default='tokyo,kyoto,sydney')
    a = ap.parse_args()
    catalog = json.loads(urllib.request.urlopen(f'{BASE}catalog.json', timeout=60).read())
    for city in a.cities.split(','):
        print(f'{city}: {install(Path(a.data), city, catalog)} files')


if __name__ == '__main__':
    main()
