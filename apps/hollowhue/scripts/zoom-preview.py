"""Dev tool: render zoom-frames.ts output to PNGs plus a contact sheet, and report the biggest change
between neighbouring frames (after undoing the zoom), which is where a pop would show.
Usage: python3 scripts/zoom-preview.py frames.json outdir"""
import json, sys, os
from PIL import Image, ImageDraw, ImageChops, ImageStat

frames = json.load(open(sys.argv[1])); out = sys.argv[2]
os.makedirs(out, exist_ok=True)
W, H = int(os.environ.get('SC_W', 1024)), int(os.environ.get('SC_H', 768))
def render(fr):
    img = Image.new('RGB', (W, H), (233, 225, 211))
    for lv in fr['levels']:
        layer = Image.new('RGB', (W, H), 'white'); d = ImageDraw.Draw(layer)
        x0, y0, x1, y1 = lv['clip']
        mask = Image.new('L', (W, H), 0); md = ImageDraw.Draw(mask)
        (md.ellipse if lv['round'] else md.rectangle)([x0, y0, x1, y1], fill=255)
        if lv.get('edge', 1) < 1 or lv.get('blend', 1) < 1:
            # The app's soft edge and fade: radial falloff from the middle (see SoftEdge in SceneArt.tsx).
            e, b = lv.get('edge', 1), lv.get('blend', 1)
            cx, cy, half = (x0 + x1) / 2, (y0 + y1) / 2, max(x1 - x0, y1 - y0)
            r = half * (0.5 + 0.22 * e); inner = 0.5 + 0.48 * e
            soft = Image.new('L', (W, H), 0); px = soft.load()
            for yy in range(max(0, int(y0)), min(H, int(y1) + 1)):
                for xx in range(max(0, int(x0)), min(W, int(x1) + 1)):
                    d = ((xx - cx) ** 2 + (yy - cy) ** 2) ** .5 / r if e < 1 else 0
                    k = 1 if d <= inner else max(0, 1 - (d - inner) / (1 - inner))
                    px[xx, yy] = int(255 * k * b)
            mask = ImageChops.multiply(mask, soft)
        sw = max(1, round(lv['stroke']))
        canvas = img.copy(); cd = ImageDraw.Draw(canvas, 'RGBA')
        for s in lv['shapes']:
            a = int(255 * s['op'])
            pts = [[(r[i], r[i + 1]) for i in range(0, len(r), 2)] for r in s['rings']]
            if s['line']:
                for p in pts:
                    if len(p) > 1: cd.line(p, fill=(43, 38, 34, a), width=max(1, round(lv['stroke'] * s['line'])))
                continue
            for p in pts:
                if len(p) >= 3:
                    cd.polygon(p, fill=(255, 255, 255, a))
                    if not s.get('seam'): cd.line(p + [p[0]], fill=(43, 38, 34, a), width=sw)
        img.paste(canvas, (0, 0), mask)
    return img
imgs = [render(f) for f in frames]
for i, im in enumerate(imgs): im.save(f'{out}/f{i:02d}.png')
# Pop check: scale frame i up to frame i+1's zoom around the centre and diff.
for i in range(len(imgs) - 1):
    k = frames[i + 1]['z'] / frames[i]['z']
    a = imgs[i].resize((int(W * k), int(H * k)))
    cx, cy = a.size[0] // 2, a.size[1] // 2
    a = a.crop((cx - W // 2, cy - H // 2, cx + W // 2, cy + H // 2))
    diff = ImageStat.Stat(ImageChops.difference(a.convert('L'), imgs[i + 1].convert('L'))).mean[0]
    print(f'{i:02d}->{i+1:02d} zoom x{frames[i+1]["z"]:.3g} levels {[l["id"] for l in frames[i+1]["levels"]]} diff {diff:.1f}')
cols = 6; th = (256, 192)
sheet = Image.new('RGB', (cols * th[0], ((len(imgs) + cols - 1) // cols) * th[1]), 'white')
for i, im in enumerate(imgs): sheet.paste(im.resize(th), ((i % cols) * th[0], (i // cols) * th[1]))
sheet.save(f'{out}/sheet.png')
