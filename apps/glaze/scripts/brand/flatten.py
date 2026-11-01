"""Finish the brand PNGs.

T199: the Prism diamond is all soft gradients (the beam, the colour fan, the glow), and a palette PNG bands them
badly (tried 112 to 256 colours, with and without dithering), so:
- icon.png / icon-dark.png: opaque RGB (colour type 2), no alpha channel and no transparency chunk (App Store rule),
  zlib level 9. About 420 KB each; Expo re-encodes the iOS AppIcon sizes from it at prebuild anyway.
- adaptive-foreground.png and the splash images: RGBA, for the same reason.
- the Android monochrome icon: white on transparency, so an 8-bit palette with transparency (PNG colour type 3 +
  tRNS) stays faithful and small.
"""
import sys
from pathlib import Path
from PIL import Image

root = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
brand = root / 'assets' / 'brand'


def opaque(p: Path) -> None:
    im = Image.open(p)
    if im.mode != 'RGB':
        bg = Image.new('RGB', im.size, (0, 0, 0))
        bg.paste(im, mask=im.split()[-1] if im.mode in ('RGBA', 'LA') else None)
        im = bg
    im.save(p, optimize=True, compress_level=9)


def rgba(p: Path) -> None:
    Image.open(p).convert('RGBA').save(p, optimize=True, compress_level=9)


def transparent(p: Path) -> None:
    im = Image.open(p).convert('RGBA')
    q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(p, optimize=True)


for name in ('icon.png', 'icon-dark.png'):
    opaque(brand / name)
for name in ('adaptive-foreground.png', 'splash-icon.png', 'splash-icon-dark.png'):
    rgba(brand / name)
for name in ('adaptive-monochrome.png',):
    transparent(brand / name)
for p in sorted(brand.glob('*.png')):
    im = Image.open(p)
    print(p.name, im.mode, im.size, p.stat().st_size // 1024, 'KB')
