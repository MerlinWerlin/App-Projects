# Trammel icon: a radius arm pivoting on a pin and scribing a quarter-circle arc over tape-measure ticks, on blade
# yellow. Concept generated with ChatGPT (23 Nov 2026, chat "Generate an image: an original iOS app icon"), redrawn
# here as clean geometry so it is exact (#FFC21A, #111111) and sharp at every size. Run: python make_icon.py
import math, sys
from PIL import Image, ImageDraw

Y, K = (255, 194, 26), (17, 17, 17)

def draw(size, bg=True, mark_scale=1.0, ticks=True):
    S = 4 * size  # supersample
    im = Image.new('RGBA', (S, S), Y + (255,) if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    u = S / 1024
    cx, cy = 512 + (305 - 512) * mark_scale, 512 + (705 - 512) * mark_scale  # pivot
    cx, cy = cx * u, cy * u
    r = 420 * u * mark_scale
    w_arc = 58 * u * mark_scale
    # quarter arc from straight up to straight right, butt ends
    steps = 400
    pts_out = [(cx + (r + w_arc / 2) * math.cos(a), cy - (r + w_arc / 2) * math.sin(a)) for a in [math.pi / 2 - i * (math.pi / 2) / steps for i in range(steps + 1)]]
    pts_in = [(cx + (r - w_arc / 2) * math.cos(a), cy - (r - w_arc / 2) * math.sin(a)) for a in [i * (math.pi / 2) / steps for i in range(steps + 1)]]
    d.polygon(pts_out + pts_in, fill=K)
    # arm at 45 degrees, ending in a scribing point that touches the arc
    a = math.pi / 4
    dx, dy = math.cos(a), -math.sin(a)
    nx, ny = -dy, dx
    w_arm = 48 * u * mark_scale
    tip = (cx + (r - w_arc / 2 - 6 * u) * dx, cy + (r - w_arc / 2 - 6 * u) * dy)
    head_len = 92 * u * mark_scale
    head_w = 58 * u * mark_scale
    base = (tip[0] - head_len * dx, tip[1] - head_len * dy)
    d.polygon([(cx + nx * w_arm / 2, cy + ny * w_arm / 2), (base[0] + nx * w_arm / 2, base[1] + ny * w_arm / 2), (base[0] - nx * w_arm / 2, base[1] - ny * w_arm / 2), (cx - nx * w_arm / 2, cy - ny * w_arm / 2)], fill=K)
    d.polygon([(base[0] + nx * head_w, base[1] + ny * head_w), tip, (base[0] - nx * head_w, base[1] - ny * head_w)], fill=K)
    pr = 64 * u * mark_scale
    d.ellipse([cx - pr, cy - pr, cx + pr, cy + pr], fill=K)
    pr2 = 20 * u * mark_scale
    d.ellipse([cx - pr2, cy - pr2, cx + pr2, cy + pr2], fill=Y)
    if ticks:
        # tape ticks along the bottom edge: every 32 px, taller every 5th
        for i, x in enumerate(range(16, 1024, 32)):
            h = 64 if i % 5 == 0 else 36
            d.rectangle([(x - 4) * u, (1024 - h) * u, (x + 4) * u, 1024 * u], fill=K)
    return im.resize((size, size), Image.LANCZOS)

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    draw(1024).convert('RGB').save(f'{out}/icon.png')
    draw(1024).convert('RGB').save(f'{out}/adaptive-icon.png')
    # Splash: the icon as a rounded tile, so it reads on both the light and the dark launch background.
    tile = draw(1024).convert('RGBA')
    mask = Image.new('L', (4096, 4096), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 4095, 4095], radius=920, fill=255)
    tile.putalpha(mask.resize((1024, 1024), Image.LANCZOS))
    tile.save(f'{out}/splash-icon.png')
