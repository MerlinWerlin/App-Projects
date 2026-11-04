"""Copy actual passing emulator captures into the Play listing; never create mock screenshots."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('evidence', type=Path)
parser.add_argument('--run', required=True, type=int)
parser.add_argument('--output', type=Path, default=Path('apps/backspin/store/play/screenshots'))
a = parser.parse_args()
result = json.loads((a.evidence / 'backspin-gameplay.json').read_text())
assert result['status'] == 'PASS' and result['package'] == 'com.jared797.backspin.playtest'
source = (a.evidence / 'source-commit.txt').read_text().strip()
assert len(source) == 40 and all(c in '0123456789abcdef' for c in source)
files = ['03-home.png', '04-record-original.png', '05-reversed-playback.png', '06-score.png', '09-persisted-takes.png']
assert not a.output.exists(), 'Refusing to overwrite existing listing screenshots'
records = []
for name in files:
    p = a.evidence / name
    with Image.open(p) as im:
        assert im.format == 'PNG' and im.mode in ('RGB', 'RGBA')
        assert min(im.size) >= 320 and max(im.size) <= 3840
        assert max(im.size) / min(im.size) <= 2
        records.append({'file': name, 'dimensions': list(im.size), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()})
a.output.mkdir(parents=True)
for name in files:
    shutil.copy2(a.evidence / name, a.output / name)
(a.output / 'receipt.json').write_text(json.dumps({'source_run': a.run, 'source_commit': source, 'package': result['package'], 'capture': 'Unmodified actual emulator screenshots, synthetic microphone', 'files': records}, indent=2) + '\n')
print('Prepared', len(files), 'unmodified screenshots from passing gameplay')
