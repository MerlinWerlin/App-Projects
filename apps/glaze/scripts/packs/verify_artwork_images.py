#!/usr/bin/env python3
"""Decode every new artwork file, including its full pixel payload (not just the header)."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image


def verify(root, bundled=None):
    rows, seen = [], {}
    option_files = [(p, p.parents[1].name, False) for p in sorted(root.glob('*/widgets/widget-options.json'))]
    if bundled:
        option_files += [(p, p.parent.name, True) for p in sorted(bundled.glob('*/artwork-options.json'))]
    for options_file, theme, is_bundled in option_files:
        for option in json.loads(options_file.read_text(encoding='utf-8-sig')):
            image_path = options_file.parent / option['image']
            data = image_path.read_bytes()
            sha = hashlib.sha256(data).hexdigest()
            if sha in seen:
                raise ValueError(f'{theme}/{option["id"]}: duplicate bytes with {seen[sha]}')
            seen[sha] = f'{theme}/{option["id"]}'
            if not image_path.name.endswith(f'.{sha[:8]}.webp'):
                raise ValueError(f'{image_path}: filename hash mismatch')
            with Image.open(image_path) as image:
                if image.format != 'WEBP' or image.size != (1024, 1024) or getattr(image, 'n_frames', 1) != 1:
                    raise ValueError(f'{image_path}: expected one 1024 x 1024 WebP image')
                image.verify()
            with Image.open(image_path) as image:
                image.load()
                rgba = image.convert('RGBA')
                if rgba.getchannel('A').getbbox() is None:
                    raise ValueError(f'{image_path}: completely transparent artwork')
                if all(low == high for low, high in rgba.getextrema()):
                    raise ValueError(f'{image_path}: blank single-colour artwork')
                if is_bundled and rgba.getchannel('A').getextrema()[0] > 8:
                    raise ValueError(f'{image_path}: bundled artwork lost its requested transparency')
            provenance_file = options_file.parent / 'artwork-provenance.json' if is_bundled else options_file.parents[1] / 'provenance.json'
            provenance = json.loads(provenance_file.read_text(encoding='utf-8-sig'))
            record = next((a for a in provenance['artworks'] if a['id'] == option['id']), None)
            if not record or record.get('sha256') != sha or not record.get('prompt') or not (record.get('original') or record.get('sourceImage')):
                raise ValueError(f'{image_path}: missing matching hash, original reference or exact prompt')
            rows.append({'theme': theme, 'id': option['id'], 'sha256': sha, 'dimensions': [1024, 1024], 'decoded': True})
    return {'images': len(rows), 'rows': rows}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--art-dir', type=Path, default=Path(__file__).resolve().parents[2] / 'pack-artwork')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--bundled-dir', type=Path, default=Path(__file__).resolve().parents[2] / 'themes')
    args = parser.parse_args()
    result = verify(args.art_dir, args.bundled_dir)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(f'Decoded and verified {result["images"]} distinct 1024 x 1024 WebP artworks')
