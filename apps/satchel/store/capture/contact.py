"""Contact sheet of every raw store capture, labelled with its file name, for checking each one by eye.

python3 contact.py --raw <captures dir> --out <sheet.jpg> [--cols 6]
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument('--raw', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--cols', type=int, default=6)
a = ap.parse_args()
files = sorted(Path(a.raw).glob('*.png'))
TW, TH, LAB = 440, 956, 44
rows = (len(files) + a.cols - 1) // a.cols or 1
sheet = Image.new('RGB', (a.cols * (TW + 16) + 16, rows * (TH + LAB + 16) + 16), (60, 60, 66))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 24)
except OSError:
    font = ImageFont.load_default()
for i, f in enumerate(files):
    x = 16 + (i % a.cols) * (TW + 16)
    y = 16 + (i // a.cols) * (TH + LAB + 16)
    im = Image.open(f).convert('RGB')
    im.thumbnail((TW, TH))
    sheet.paste(im, (x, y + LAB))
    d.text((x, y + 8), f.stem, font=font, fill=(255, 255, 255))
sheet.save(a.out, quality=88)
print(f'{len(files)} captures -> {a.out}')
