"""Write flattened RGB copies of the store PNGs for App Store Connect (out/upload/, not committed).

Usage: python3 assets/store/export_rgb.py
"""
import glob
import os

from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
dest = os.path.join(here, "out", "upload")
os.makedirs(dest, exist_ok=True)
for path in sorted(glob.glob(os.path.join(here, "[0-9][0-9].png"))):
    out = os.path.join(dest, os.path.basename(path))
    Image.open(path).convert("RGB").save(out, optimize=True)
    print("wrote", out)
