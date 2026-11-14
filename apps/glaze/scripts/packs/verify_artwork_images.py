#!/usr/bin/env python3
"""Decode every new artwork file, including its full pixel payload (not just the header)."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image


def verify(root):
    rows, seen = [], {}
    for options_file in sorted(root.glob('*/widgets/widget-options.json')):
        theme = options_file.parents[1].name
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
            rows.append({'theme': theme, 'id': option['id'], 'sha256': sha, 'dimensions': [1024, 1024], 'decoded': True})
    return {'images': len(rows), 'rows': rows}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--art-dir', type=Path, default=Path(__file__).resolve().parents[2] / 'pack-artwork')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = verify(args.art_dir)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(f'Decoded and verified {result["images"]} distinct 1024 x 1024 WebP artworks')
