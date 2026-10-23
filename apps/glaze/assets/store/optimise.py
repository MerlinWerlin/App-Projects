"""Shrink store PNGs in place: 256-colour palette (fast octree), size unchanged (1290x2796).

Usage: python3 assets/store/optimise.py file.png [...]
"""
import os
import sys

from PIL import Image

for path in sys.argv[1:]:
    before = os.path.getsize(path)
    img = Image.open(path).convert("RGB")
    q = img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    q.save(path, optimize=True)
    print(f"{os.path.basename(path)}: {before // 1024} KB -> {os.path.getsize(path) // 1024} KB, {q.size[0]}x{q.size[1]}")
