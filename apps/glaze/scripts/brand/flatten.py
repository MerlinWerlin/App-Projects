"""Strip alpha from the opaque brand PNGs (App Store icons must have no alpha channel) and recompress the rest."""
import sys
from pathlib import Path
from PIL import Image

root = Path(sys.argv[1] if len(sys.argv) > 1 else '.') / 'assets' / 'brand'
for name in ('icon.png', 'icon-dark.png'):
    p = root / name
    im = Image.open(p)
    if im.mode != 'RGB':
        bg = Image.new('RGB', im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1] if im.mode in ('RGBA', 'LA') else None)
        bg.save(p, optimize=True)
    print(name, Image.open(p).mode, Image.open(p).size)
for name in ('splash-icon.png', 'splash-icon-dark.png', 'adaptive-foreground.png', 'adaptive-monochrome.png'):
    p = root / name
    Image.open(p).save(p, optimize=True)
