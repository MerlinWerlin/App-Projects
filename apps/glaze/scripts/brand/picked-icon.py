"""T216 (1 Nov 2026): the Glaze app icon is the Prism image Jared picked on 25 Oct (docs/mascot/picked-1025/).

Writes from docs/mascot/picked-1025/glaze-prism.jpg (1024 x 1024, made by Codex's image tool for the owner):
- assets/brand/icon.png and icon-dark.png: the picture as is, opaque RGB, no alpha (App Store rule). The picture is
  already dark, so the iOS dark-mode icon is the same file.
- assets/brand/adaptive-foreground.png: Android adaptive icons mask the inner ~66 %, so the figure is scaled to fit
  that safe zone and the ring around it is a soft blurred extension of the picture's own violet-to-teal ground (RGBA,
  fully opaque).
- assets/brand/adaptive-monochrome.png is left as the 25 Oct diamond silhouette (see below).

The splash and the in-app light-beam intro stay the 25 Oct Prism diamond (owner-1101d #2 kept that intro); see
docs/MASCOT.md. Run from the repo root: python3 scripts/brand/picked-icon.py
"""
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

root = Path('.')
src = root / 'docs' / 'mascot' / 'picked-1025' / 'glaze-prism.jpg'
brand = root / 'assets' / 'brand'
SIZE = 1024
SAFE = 0.64  # share of the canvas the figure's picture takes in the Android foreground (safe zone ~0.66)

pic = Image.open(src).convert('RGB')
if pic.size != (SIZE, SIZE):
    pic = ImageOps.fit(pic, (SIZE, SIZE), Image.Resampling.LANCZOS)

for name in ('icon.png', 'icon-dark.png'):
    pic.save(brand / name, optimize=True, compress_level=9)

# Android foreground: the picture scaled into the safe zone, its edge pixels stretched outwards (numpy edge padding)
# and blurred so the violet-to-teal ground runs on to full bleed without a visible square.
import numpy as np

inner = int(SIZE * SAFE)
off = (SIZE - inner) // 2
small = np.asarray(pic.resize((inner, inner), Image.Resampling.LANCZOS))
padded = Image.fromarray(np.pad(small, ((off, SIZE - inner - off), (off, SIZE - inner - off), (0, 0)), mode='edge'))
ground = padded.filter(ImageFilter.GaussianBlur(28))
feather = Image.new('L', (SIZE, SIZE), 0)
pad = inner // 10
feather.paste(255, (off + pad, off + pad, off + inner - pad, off + inner - pad))
feather = feather.filter(ImageFilter.GaussianBlur(pad / 2))
fg = Image.composite(padded, ground, feather)
fg.convert('RGBA').save(brand / 'adaptive-foreground.png', optimize=True, compress_level=9)

# Android monochrome (themed icons) stays the 25 Oct diamond silhouette: a clean cut-out of the glass figure from this
# picture isn't possible by brightness alone (its glow and floor reflections join the shape).

for name in ('icon.png', 'icon-dark.png', 'adaptive-foreground.png'):
    p = brand / name
    im = Image.open(p)
    print(name, im.mode, im.size, p.stat().st_size // 1024, 'KB')

# ---------------------------------------------------------------- T220: the figure cut out (owner-1101e 11:39 #1)
# The ground is a smooth violet-to-teal gradient: fit a quadratic surface per channel to a 50 px border strip, and the
# figure is everything that differs from it. Holes are filled, the floor glow stays as a soft halo (intro), and the
# Android monochrome silhouette is the hard shape only, cut at the feet.
from scipy import ndimage

arr = np.asarray(pic).astype(float)
yy, xx = np.mgrid[0:SIZE, 0:SIZE] / float(SIZE)
strip = np.zeros((SIZE, SIZE), bool)
b = 50
strip[:b, :] = strip[-b:, :] = strip[:, :b] = strip[:, -b:] = True
X = np.stack([np.ones_like(xx), xx, yy, xx * yy, xx ** 2, yy ** 2], -1)
model = np.zeros_like(arr)
for c in range(3):
    coef, *_ = np.linalg.lstsq(X[strip], arr[..., c][strip], rcond=None)
    model[..., c] = X @ coef
diff = np.sqrt(((arr - model) ** 2).sum(-1))
hard = ndimage.binary_closing(diff > 70, iterations=6)
hard = ndimage.binary_fill_holes(hard)
hard = ndimage.binary_opening(hard, iterations=3)
lab, n = ndimage.label(hard)
if n > 1:
    sizes = ndimage.sum(hard, lab, range(1, n + 1))
    hard = lab == (1 + int(np.argmax(sizes)))
soft = np.clip((diff - 35) / 70, 0, 1) * 0.55
hard_f = ndimage.gaussian_filter(hard.astype(float), 1.5)
alpha = np.maximum(hard_f, soft)
alpha = alpha * ndimage.gaussian_filter((np.hypot(xx - 0.5, yy - 0.5) < 0.49).astype(float), 20)  # no hard frame edge


def figure(rgb: np.ndarray, a: np.ndarray, size: int) -> Image.Image:
    out = np.dstack([np.clip(rgb, 0, 255), np.clip(a, 0, 1) * 255]).astype('uint8')
    im = Image.fromarray(out, 'RGBA')
    return im if size == SIZE else im.resize((size, size), Image.Resampling.LANCZOS)


# Lit figure for the intro (shown at 240 pt, so 720 px covers @3x).
figure(arr, alpha, 720).save(brand / 'prism-figure.png', optimize=True, compress_level=9)
# Unlit figure = the native splash image and the intro's first frame: darker, cooler, a little desaturated.
grey = arr.mean(-1, keepdims=True)
dim = (arr * 0.6 + grey * 0.4) * 0.42
for name in ('splash-icon.png', 'splash-icon-dark.png'):
    figure(dim, alpha, 720).save(brand / name, optimize=True, compress_level=9)

# Android monochrome: the hard silhouette in white, scaled into the safe zone like the foreground.
# Stricter cut for the silhouette: the floor glow (soft, low contrast) drops out, the glass edges stay.
shape = ndimage.binary_fill_holes(ndimage.binary_closing(diff > 70, iterations=10))
shape = ndimage.binary_opening(shape, iterations=14)
lab, n = ndimage.label(shape)
if n > 1:
    shape = lab == (1 + int(np.argmax(ndimage.sum(shape, lab, range(1, n + 1)))))
# The two eyes (the darkest spots in the head) become holes, so the shape reads as the Prism, not a blob.
eyes = ndimage.binary_opening((arr.mean(-1) < 60) & shape & (yy < 0.5), iterations=2)
eyes = ndimage.binary_dilation(eyes, iterations=3)
shape = shape & ~eyes
sil = Image.fromarray((ndimage.gaussian_filter(shape.astype(float), 1.0) * 255).astype('uint8'))
sil_small = sil.resize((inner, inner), Image.Resampling.LANCZOS)
mono = Image.new('RGBA', (SIZE, SIZE), (255, 255, 255, 0))
mono.paste(Image.new('RGBA', (inner, inner), (255, 255, 255, 255)), (off, off), sil_small)
mono.quantize(colors=32, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(brand / 'adaptive-monochrome.png', optimize=True)

for name in ('prism-figure.png', 'splash-icon.png', 'adaptive-monochrome.png'):
    p = brand / name
    im = Image.open(p)
    print(name, im.mode, im.size, p.stat().st_size // 1024, 'KB')
