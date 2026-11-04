"""Bake repo-authored Linework outlines into colourable Hollowhue vector art.

Run with the dev dependencies in .expo/art-tools; this adds no native app dependency.
SVG curves remain curves. Connected white areas become closed fill regions under that ink.
The imported source and its SHA are preserved, so a later art change cannot silently move saved IDs.
"""
import hashlib
import json
import math
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.expo/art-tools'))
import cv2
import numpy as np
from PIL import Image, ImageDraw
from svgpathtools import Arc, CubicBezier, Line, QuadraticBezier, parse_path

S = 2400
SCALE = S / 400
NATIVE = 1200


def outline(template, size=S):
    image = Image.new('L', (size, size), 255)
    draw = ImageDraw.Draw(image)
    scale = size / 400
    sw = 2.25 if template.get('level', 'beginner') == 'beginner' else 1.65
    for paths, width in [(template['paths'], sw), (template.get('detail', []), sw * .55)]:
        for d in paths:
            for part in parse_path(d).continuous_subpaths():
                pts = []
                for segment in part:
                    count = 1 if isinstance(segment, Line) else max(12, min(160, math.ceil(segment.length() / 2)))
                    if not pts:
                        pts.append((segment.start.real * scale, segment.start.imag * scale))
                    for i in range(1, count + 1):
                        p = segment.point(i / count)
                        pts.append((p.real * scale, p.imag * scale))
                if len(pts) > 1:
                    draw.line(pts, fill=0, width=max(1, round(width * scale)), joint='curve')
                    radius = width * scale / 2
                    for x, y in (pts[0], pts[-1]):
                        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=0)
    return image, sw


def coordinate(p):
    return f'{p.real * 3:.3f} {p.imag * 3:.3f}'


def curves(d):
    parts = []
    for part in parse_path(d).continuous_subpaths():
        parts.append('M' + coordinate(part.start))
        for segment in part:
            segments = segment.as_cubic_curves(max(1, math.ceil(abs(segment.delta) / 45))) if isinstance(segment, Arc) else [segment]
            for item in segments:
                if isinstance(item, Line):
                    parts.append('L' + coordinate(item.end))
                elif isinstance(item, QuadraticBezier):
                    parts.append('Q' + coordinate(item.control) + ' ' + coordinate(item.end))
                elif isinstance(item, CubicBezier):
                    parts.append('C' + coordinate(item.control1) + ' ' + coordinate(item.control2) + ' ' + coordinate(item.end))
                else:
                    raise ValueError(type(item))
        if abs(part.start - part.end) < .001:
            parts.append('Z')
    return ''.join(parts)


def bake(template):
    image, sw = outline(template)
    white = (np.asarray(image) > 127).astype(np.uint8)
    count, labels, stats, centres = cv2.connectedComponentsWithStats(white, connectivity=4)
    regions = [{'id': 'paper', 'd': 'M0 0H1200V1200H0Z', 'outline': False}]
    interiors = []
    for label in range(1, count):
        x, y, w, h, area = map(int, stats[label])
        if area * (NATIVE / S) ** 2 < 45:
            continue
        mask = (labels[y:y+h, x:x+w] == label).astype(np.uint8) * 255
        if label != int(labels[0, 0]):
            distance = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
            _, radius, _, point = cv2.minMaxLoc(distance)
            if radius > 5 * SCALE:
                px, py = (x + point[0]) / SCALE, (y + point[1]) / SCALE
                r = min(14, radius / SCALE * .7)
                interiors.append((math.hypot(px - 200, py - 200) * .2 + abs(r - 12), px, py, r))
        contours, _ = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        paths = []
        for contour in contours:
            poly = cv2.approxPolyDP(contour, .65, True).reshape(-1, 2)
            if len(poly) < 3:
                continue
            xy = [((float(a) + x) * NATIVE / S, (float(b) + y) * NATIVE / S) for a, b in poly]
            paths.append('M' + 'L'.join(f'{a:.2f} {b:.2f}' for a, b in xy) + 'Z')
        if paths:
            regions.append({'id': f'fill{label:03}', 'd': ''.join(paths), 'outline': False})
    for paths, weight in [(template['paths'], 1), (template.get('detail', []), .55)]:
        for d in paths:
            regions.append({'id': f'_ink{len(regions)}', 'd': curves(d), 'line': weight})
    # A natural iris, flower centre, or round ornament is the preferred entrance.
    candidates = []
    windows = []
    for d in template['paths']:
        for part in parse_path(d).continuous_subpaths():
            if template['category'] == 'places' and part and all(isinstance(s, Line) for s in part) and abs(part.start - part.end) < .01:
                left, right, top, bottom = part.bbox()
                w, h = right - left, bottom - top
                if 10 <= min(w, h) <= 65 and .6 < w / h < 1.7:
                    x, y, r = (left + right) / 2, (top + bottom) / 2, min(w, h) * .42
                    windows.append((math.hypot(x - 200, y - 190) + abs(r - 14), x, y, r))
            if part and all(isinstance(s, Arc) for s in part) and abs(part.start - part.end) < .01:
                arc = part[0]
                rx, ry = arc.radius.real, arc.radius.imag
                radius = min(rx, ry)
                cx, cy = arc.center.real, arc.center.imag
                if 4 <= radius <= 35 and .7 < rx / ry < 1.4 and 25 < cx < 375 and 25 < cy < 375:
                    score = abs(radius - 13) * 2 + math.hypot(cx - 200, cy - 200) * .2
                    candidates.append((score, cx, cy, radius * .78))
    if windows:
        _, x, y, r = min(windows)
        focal = {'x': round(x * 3, 3), 'y': round(y * 3, 3), 'r': round(r * 3, 3), 'natural': True, 'round': False}
    elif candidates:
        _, x, y, r = min(candidates)
        focal = {'x': round(x * 3, 3), 'y': round(y * 3, 3), 'r': round(r * 3, 3), 'natural': True}
    elif interiors:
        _, x, y, r = min(interiors)
        focal = {'x': round(x * 3, 3), 'y': round(y * 3, 3), 'r': round(r * 3, 3), 'natural': True}
    else:
        # An illustrated discovery seal goes in empty paper, rather than over the subject.
        distances = cv2.distanceTransform(white, cv2.DIST_L2, 5)
        choices = [(math.hypot(x - 340, y - 340), x, y) for x in range(40, 361, 20) for y in range(40, 361, 20)
                   if distances[round(y * SCALE), round(x * SCALE)] > 24 * SCALE and math.hypot(x - 200, y - 200) > 95]
        _, x, y = min(choices) if choices else (0, 345, 345)
        focal = {'x': x * 3, 'y': y * 3, 'r': 54, 'natural': False}
    return {'name': template['name'], 'stroke': sw * 3, 'regions': regions, 'focal': focal, 'background': f'fill{int(labels[0, 0]):03}'}


if __name__ == '__main__':
    source_path = ROOT / '.expo/linework-catalog.json'
    if not source_path.exists(): source_path = ROOT / 'scripts/art/linework-source.json'
    catalog = json.loads(source_path.read_text())
    lookup = {t['id']: t for t in catalog}
    previews = ROOT / '.expo/art-candidates'
    previews.mkdir(exist_ok=True)
    if '--preview' in sys.argv:
        ids = ['bot-peony-arrangement', 'wild-owl', 'scn-cottage-garden', 'sea-sea-turtle', 'mandala-layered-floral', 'ani3-red-panda', 'flor2-hibiscus', 'flor2-frangipani']
        for ident in ids:
            image, _ = outline(lookup[ident], 1200)
            image.save(previews / f'{ident}.png')
        sheet = Image.new('RGB', (1600, 860), '#F4EDE1')
        draw = ImageDraw.Draw(sheet)
        for index, ident in enumerate(ids):
            image = Image.open(previews / f'{ident}.png').resize((380, 380))
            x, y = index % 4 * 400 + 10, index // 4 * 430 + 10
            sheet.paste(image, (x, y))
            draw.text((x, y + 385), lookup[ident]['name'], fill='#2B2622')
        sheet.save(previews / 'candidates.png')
        print(previews / 'candidates.png')
    else:
        request = json.loads((ROOT / 'scripts/art/catalog-source.json').read_text())
        ids = list(dict.fromkeys(i for scene in request['scenes'] for i in scene['art']))
        source = [lookup[i] for i in ids]
        (ROOT / 'scripts/art/linework-source.json').write_text(json.dumps(source, separators=(',', ':')) + '\n')
        art = {}
        for ident in ids:
            art[ident] = bake(lookup[ident])
            print(ident, sum(not r.get('line') for r in art[ident]['regions']), flush=True)
        target = ROOT / 'src/scenes/art/catalog-art.ts'
        target.parent.mkdir(exist_ok=True)
        target.write_text('// Generated from original repo-authored Linework art; see scripts/art/README.md.\nimport type { Region } from "../../core/scene.ts";\nexport type Artwork = { name: string; stroke: number; regions: Region[]; background: string; focal: { x: number; y: number; r: number; natural: boolean; round?: boolean } };\nexport const ARTWORK: Record<string, Artwork> = ' + json.dumps(art, separators=(',', ':')) + ';\n')
        words = {}
        for scene in request['scenes']:
            words[f"scene.{scene['id']}.title"] = scene['title']
            words[f"scene.{scene['id']}.blurb"] = scene['blurb']
            for index, ident in enumerate(scene['art']): words[f"scene.{scene['id']}.level.z{index:02}"] = lookup[ident]['name']
        (ROOT / 'src/i18n/catalog.ts').write_text('// Generated from scripts/art/catalog-source.json.\nexport const catalogWords = ' + json.dumps(words, indent=2, ensure_ascii=False) + ' as const;\n')
        (ROOT / 'src/scenes/catalog-data.ts').write_text('// Curated scene sequences from scripts/art/catalog-source.json.\nexport const catalogData = ' + json.dumps(request['scenes'], indent=2, ensure_ascii=False) + ' as const;\n')
        print('Baked', len(art), 'artworks; source SHA256', hashlib.sha256(json.dumps(source, sort_keys=True).encode()).hexdigest())
