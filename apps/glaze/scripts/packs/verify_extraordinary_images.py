"""Decode selected new-theme sources and every staged output asset; never edits images."""
from pathlib import Path
from PIL import Image
import argparse, hashlib, json

def verify(app, built):
    sources = 0
    selected_hashes = set()
    for options in sorted((app / 'theme-sources').glob('*/widgets/widget-options.json')):
        rows = json.loads(options.read_text())
        art = [r for r in rows if r['kind'] == 'art']
        if len(art) != 5: raise ValueError(f'{options}: expected five separate artwork sources')
        for row in art:
            path = options.parent / row['image']
            data = path.read_bytes(); digest = hashlib.sha256(data).hexdigest()
            if digest in selected_hashes: raise ValueError(f'{path}: repeated selected image')
            selected_hashes.add(digest)
            with Image.open(path) as image:
                image.load()
                if image.format != 'PNG' or image.width != image.height or image.width < 1024 or image.mode != 'RGBA': raise ValueError(f'{path}: expected square transparent original PNG')
                alpha = image.getchannel('A')
                if alpha.getbbox() is None or alpha.getextrema()[0] != 0: raise ValueError(f'{path}: empty artwork or missing transparency')
            sources += 1
        wallpaper = options.parents[1] / 'wallpapers/wallpaper.png'
        with Image.open(wallpaper) as image:
            image.load()
            if image.format != 'PNG' or image.width >= image.height: raise ValueError(f'{wallpaper}: expected portrait wallpaper PNG')
        sources += 1
    outputs = 0
    catalog = json.loads((built / 'catalog.json').read_text())
    for entry in catalog['packs']:
        manifest_path = built / entry['manifest']; manifest = json.loads(manifest_path.read_text())
        for asset in manifest['assets']:
            path = manifest_path.parent / asset['path']; data = path.read_bytes()
            if len(data) != asset['bytes'] or hashlib.sha256(data).hexdigest() != asset['sha256']: raise ValueError(f'{path}: output integrity mismatch')
            with Image.open(path) as image:
                image.load()
                if image.size != (asset['width'], asset['height']) or getattr(image, 'n_frames', 1) != 1: raise ValueError(f'{path}: output dimensions/frame mismatch')
                if asset['role'] == 'widget-art' and image.size != (1024, 1024): raise ValueError(f'{path}: selected artwork must export at1024square')
            outputs += 1
    return {'sourceImagesFullyDecoded': sources, 'outputAssetsFullyDecoded': outputs, 'selectedArtworks': len(selected_hashes), 'allChecksPassed': True}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--built', type=Path, default=Path('dist/extraordinary-packs'))
    args = parser.parse_args()
    app = Path(__file__).resolve().parents[2]
    report = verify(app, args.built.resolve())
    (args.built / 'new-theme-image-verification.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
