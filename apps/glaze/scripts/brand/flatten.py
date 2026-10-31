"""Shrink the brand PNGs (the app bundle is near its size cap; T190 aims for < 100 KB each).

- icon.png / icon-dark.png: opaque, no alpha channel and no transparency chunk (App Store rule). Reduced to an
  adaptive 160-colour palette (PNG colour type 3, no tRNS; no dithering, so flat areas stay flat and compress well).
  An RGB save of the same pixels is ~240 KB; the palette file is a fraction of that. Expo re-encodes the iOS
  AppIcon sizes from it at prebuild anyway.
- splash and Android adaptive images: 8-bit palette with transparency (PNG colour type 3 + tRNS), which keeps the
  soft edges and is a fraction of the RGBA size.
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
    q = im.quantize(colors=160, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    q.save(p, optimize=True, compress_level=9)


def transparent(p: Path) -> None:
    im = Image.open(p).convert('RGBA')
    q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(p, optimize=True)


for name in ('icon.png', 'icon-dark.png'):
    opaque(brand / name)
for name in ('splash-icon.png', 'splash-icon-dark.png', 'adaptive-foreground.png', 'adaptive-monochrome.png'):
    transparent(brand / name)
docs = root / 'docs' / 'mascot'
for name in ('prism-icon.png',):
    if (docs / name).exists():
        opaque(docs / name)
for name in ('prism-mascot.png',):
    if (docs / name).exists():
        transparent(docs / name)
for p in sorted(list(brand.glob('*.png')) + list(docs.glob('prism-*.png'))):
    im = Image.open(p)
    print(p.name, im.mode, im.size, p.stat().st_size // 1024, 'KB')
