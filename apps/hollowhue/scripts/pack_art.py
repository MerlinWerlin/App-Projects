"""Pack each illustration independently so opening a gallery does not decode the whole library."""
import base64
import gzip
import json
import pathlib
import re


def pack_art(root: pathlib.Path, art):
    info = {}
    packed = {}
    for ident, item in art.items():
        sizes = []
        for region in item['regions']:
            if region['id'] == 'paper':
                sizes.append(1200)
                continue
            coords = list(map(float, re.findall(r'-?\d+(?:\.\d+)?', region['d'])))
            x, y = coords[::2], coords[1::2]
            sizes.append(round(max(max(x) - min(x), max(y) - min(y)), 2) if x and y else 0)
        info[ident] = {k: v for k, v in item.items() if k != 'regions'} | {
            'fillIds': [r['id'] for r in item['regions'] if not r.get('ink') and not r.get('line')],
            'regionSizeHints': sizes,
        }
        packed[ident] = base64.b64encode(gzip.compress(json.dumps(item, separators=(',', ':')).encode(), compresslevel=9, mtime=0)).decode()
    (root / 'src/scenes/art/catalog-art.ts').write_text(
        '// Generated per-illustration data. Geometry and saved IDs are unchanged.\n'
        'import type { Region } from "../../core/scene.ts";\n'
        'import { lazyArtwork } from "./lazy.ts";\n'
        'export type Artwork = { name: string; stroke: number; regions: Region[]; background: string; '
        'focal: { x: number; y: number; r: number; natural: boolean; round?: boolean } };\n'
        'export type ArtworkInfo = Omit<Artwork, "regions"> & { fillIds: string[]; regionSizeHints: number[] };\n'
        'export const ARTWORK_INFO: Record<string, ArtworkInfo> = ' + json.dumps(info, separators=(',', ':')) + ';\n'
        'const packed: Record<string, string> = ' + json.dumps(packed, separators=(',', ':')) + ';\n'
        'export const ARTWORK = lazyArtwork<Artwork>(packed);\n', encoding='utf-8')

