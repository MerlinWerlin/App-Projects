"""Turn reviewed, original colouring-book illustrations into offline tappable vector art.

The source PNGs are preserved with their generation prompts. Ink and enclosed paper are traced
together, so the app displays the illustration itself rather than a geometric approximation of it.
This is an asset build step, with no new app/native dependencies.
"""
import base64
import gzip
import hashlib
import io
import json
import pathlib
import re
import sys
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.expo/art-tools'))
import cv2
import numpy as np
from PIL import Image, ImageDraw
import vtracer

NATIVE = 1200


def smooth_ink(ink, scale):
    data = io.BytesIO()
    Image.fromarray(255 - ink).save(data, format='PNG')
    svg = vtracer.convert_raw_image_to_svg(data.getvalue(), img_format='png', colormode='binary',
        mode='spline', filter_speckle=2, corner_threshold=80, length_threshold=3.5,
        splice_threshold=45, path_precision=2)
    regions = []
    for index, element in enumerate(ET.fromstring(svg)):
        offset = list(map(float, re.findall(r'-?\d+(?:\.\d+)?', element.get('transform', 'translate(0,0)'))))
        tokens = re.findall(r'[A-Za-z]|-?\d+(?:\.\d+)?', element.attrib['d'])
        parts, coordinates = [], []
        for token in tokens + ['Z']:
            if token.isalpha():
                if coordinates:
                    parts.append(' '.join(f'{(value + offset[i % 2]) * scale:.2f}' for i, value in enumerate(coordinates)))
                    coordinates = []
                assert token in 'MCLQZ', token
                parts.append(token)
            else:
                coordinates.append(float(token))
        regions.append({'id': f'_ink{index:04}', 'd': ''.join(parts[:-1]), 'ink': True, 'outline': False})
    return regions


def trace(mask, ox=0, oy=0, scale=1, min_area=0):
    contours, _ = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    paths, largest = [], 0
    for contour in contours:
        # Less than one source pixel of error retains organic hand-inked contours.
        points = cv2.approxPolyDP(contour, .55, True).reshape(-1, 2)
        if len(points) < 3 or abs(cv2.contourArea(contour)) < 1:
            continue
        largest = max(largest, abs(cv2.contourArea(points)) * scale ** 2)
        xy = [((float(x) + ox) * scale, (float(y) + oy) * scale) for x, y in points]
        paths.append('M' + 'L'.join(f'{x:.2f} {y:.2f}' for x, y in xy) + 'Z')
    return ''.join(paths) if largest >= min_area else ''


def bake(item):
    source = ROOT / 'scripts/art/illustrations' / item['file']
    image = Image.open(source).convert('L')
    assert image.width == image.height, f'{item["id"]}: expected square art'
    image.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
    scale = NATIVE / image.width
    ink = (np.asarray(image) < 190).astype(np.uint8) * 255
    # Close sub-pixel breaks before finding colourable enclosures; the same mask draws the ink.
    ink = cv2.morphologyEx(ink, cv2.MORPH_CLOSE, np.ones((2, 2), np.uint8))
    white = (ink == 0).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(white, connectivity=4)
    regions = [{'id': 'paper', 'd': 'M0 0H1200V1200H0Z', 'outline': False}]
    border = np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1]))
    border = border[border > 0]
    background = int(np.bincount(border).argmax()) if len(border) else 1
    candidates = []
    for label in range(1, count):
        x, y, w, h, area = map(int, stats[label])
        if area * scale ** 2 < 28:
            continue
        mask = (labels[y:y+h, x:x+w] == label).astype(np.uint8) * 255
        path = trace(mask, x, y, scale, min_area=30)
        if not path:
            continue
        regions.append({'id': f'fill{label:04}', 'd': path, 'outline': False})
        if label != background:
            distance = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
            _, radius, _, point = cv2.minMaxLoc(distance)
            cx, cy = (x + point[0]) * scale, (y + point[1]) * scale
            r = min(64, radius * scale * .82)
            if 18 <= r and 100 < cx < 1100 and 100 < cy < 1100:
                # Put the next discovery in an actual petal, window or feather, not over a face.
                candidates.append((abs(cx - 650) * .15 + abs(cy - 720) * .18 - r, cx, cy, r))
    assert len(regions) >= 12, f'{item["id"]}: not enough enclosed colour areas'
    fillable = len(regions)
    regions.extend(smooth_ink(ink, scale))
    if candidates:
        _, x, y, r = min(candidates)
    else:
        distance = cv2.distanceTransform(white, cv2.DIST_L2, 5)
        _, radius, _, point = cv2.minMaxLoc(distance)
        x, y = point[0] * scale, point[1] * scale
        r = min(64, radius * scale * .7)
    assert r >= 12
    return {'name': item['name'], 'stroke': 2.5, 'regions': regions,
            'focal': {'x': round(x, 3), 'y': round(y, 3), 'r': round(r, 3), 'natural': True},
            'background': f'fill{background:04}'}, {
                'id': item['id'], 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'fillableRegions': fillable, 'sourceSize': list(Image.open(source).size),
                'inkCoverage': round(float((ink > 0).mean()), 4)}


if __name__ == '__main__':
    items = json.loads((ROOT / 'scripts/art/illustrations.json').read_text())['artworks']
    lookup = {item['id']: item for item in items}
    request = json.loads((ROOT / 'scripts/art/catalog-source.json').read_text())
    ids = list(dict.fromkeys(i for scene in request['scenes'] for i in scene['art']))
    art, receipts = {}, []
    for ident in ids:
        art[ident], receipt = bake(lookup[ident])
        receipts.append(receipt)
        print(ident, receipt['fillableRegions'], flush=True)
    target = ROOT / 'src/scenes/art/catalog-art.ts'
    target.write_text('// Generated from reviewed original illustrations; see scripts/art/README.md.\n'
        'import type { Region } from "../../core/scene.ts";\n'
        'import { unpackArt } from "./unpack.ts";\n'
        'export type Artwork = { name: string; stroke: number; regions: Region[]; background: string; '
        'focal: { x: number; y: number; r: number; natural: boolean; round?: boolean } };\n'
        'export const ARTWORK = unpackArt<Record<string, Artwork>>(' + json.dumps(base64.b64encode(
            gzip.compress(json.dumps(art, separators=(',', ':')).encode(), compresslevel=9, mtime=0)).decode()) + ');\n')
    words = {}
    for scene in request['scenes']:
        words[f"scene.{scene['id']}.title"] = scene['title']
        words[f"scene.{scene['id']}.blurb"] = scene['blurb']
        for index, ident in enumerate(scene['art']):
            words[f"scene.{scene['id']}.level.z{index:02}"] = lookup[ident]['name']
    (ROOT / 'src/i18n/catalog.ts').write_text('// Generated from scripts/art/catalog-source.json.\nexport const catalogWords = ' + json.dumps(words, indent=2, ensure_ascii=False) + ' as const;\n')
    (ROOT / 'src/scenes/catalog-data.ts').write_text('// Curated scene sequences from scripts/art/catalog-source.json.\nexport const catalogData = ' + json.dumps(request['scenes'], indent=2, ensure_ascii=False) + ' as const;\n')
    (ROOT / 'scripts/art/illustration-receipts.json').write_text(json.dumps(receipts, indent=2) + '\n')
    print('Baked', len(art), 'reviewed illustrations;', target.stat().st_size, 'vector bytes')
