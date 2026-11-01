"""Dev tool: rasterise scenes dumped by dump-scenes.ts so line art can be checked without a phone.
Usage: python3 scripts/preview.py scenes.json outdir [--fill]   (--fill gives every region a random colour)."""
import json, random, sys, os
from PIL import Image, ImageDraw, ImageChops

data = json.load(open(sys.argv[1]))
out = sys.argv[2]
fill = '--fill' in sys.argv
os.makedirs(out, exist_ok=True)
S = 1.0

def pts(ring, s=S):
    return [(ring[i] * s, ring[i + 1] * s) for i in range(0, len(ring), 2)]

def render(level, s=S):
    W, H = int(level['w'] * s), int(level['h'] * s)
    img = Image.new('RGB', (W, H), 'white')
    rnd = random.Random(level['id'])
    sw = max(1, int(round(level['stroke'] * s)))
    for r in level['regions']:
        if r['line']:
            d = ImageDraw.Draw(img)
            for ring in r['rings']:
                p = pts(ring, s)
                if len(p) > 1:
                    d.line(p, fill=(43, 38, 34), width=max(1, int(round(sw * r['line']))), joint='curve')
            continue
        mask = Image.new('1', (W, H), 0)
        for ring in r['rings']:
            m = Image.new('1', (W, H), 0)
            p = pts(ring, s)
            if len(p) >= 3:
                ImageDraw.Draw(m).polygon(p, fill=1)
            mask = ImageChops.logical_xor(mask, m)
        col = tuple(rnd.randint(120, 245) for _ in range(3)) if fill else (255, 255, 255)
        img.paste(Image.new('RGB', (W, H), col), (0, 0), mask)
        d = ImageDraw.Draw(img)
        for ring in r['rings']:
            p = pts(ring, s)
            if len(p) >= 3:
                d.line(p + [p[0]], fill=(43, 38, 34), width=sw, joint='curve')
    return img

for sc in data:
    imgs = {}
    for lv in sc['levels']:
        imgs[lv['id']] = render(lv)
        imgs[lv['id']].save(f"{out}/{sc['id']}-{lv['id']}.png")
    # Composite: each child pasted into its parent's portal (shows the reveal seams).
    by = {l['id']: l for l in sc['levels']}
    for lv in reversed(sc['levels']):
        if lv['parent']:
            p = lv['portal']; par = imgs[lv['parent']]
            child = imgs[lv['id']].resize((int(p['w']), int(p['h'])))
            if lv['round']:
                m = Image.new('L', child.size, 0); ImageDraw.Draw(m).ellipse([0, 0, child.size[0]-1, child.size[1]-1], fill=255)
                par.paste(child, (int(p['x']), int(p['y'])), m)
            else:
                par.paste(child, (int(p['x']), int(p['y'])))
    root = [l for l in sc['levels'] if not l['parent']][0]
    imgs[root['id']].save(f"{out}/{sc['id']}-composite.png")
    print(sc['id'], [ (l['id'], sum(1 for r in l['regions'] if not r['line'])) for l in sc['levels']])
