"""Build Play artwork from the committed Backspin mascot. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import json
import os

root = Path(__file__).resolve().parents[2]
app = root / 'apps/backspin'
out = app / 'store/play'
out.mkdir(exist_ok=True)
source = app / 'assets/icon.png'
icon = Image.open(source).convert('RGB')
icon.resize((512, 512), Image.Resampling.LANCZOS).save(out / 'icon-512.png')
font_root = Path(os.environ.get('WINDIR', '/usr/share')) / 'Fonts'
def font(size, bold=False):
    choices = [font_root / ('arialbd.ttf' if bold else 'arial.ttf'),
               Path('/usr/share/fonts/truetype/dejavu') / ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')]
    return ImageFont.truetype(str(next(p for p in choices if p.exists())), size)
feature = Image.new('RGB', (1024, 500), '#14111F')
feature.paste(icon.resize((400, 400), Image.Resampling.LANCZOS), (40, 50))
d = ImageDraw.Draw(feature)
d.text((490, 112), 'Backspin', font=font(78, True), fill='#F7F1FF')
d.text((494, 230), 'Say it. Reverse it.', font=font(36), fill='#D5C6F2')
d.text((494, 285), 'Try it. Flip it.', font=font(36), fill='#D5C6F2')
feature.save(out / 'feature-1024x500.png')
receipt = dict(source=str(source.relative_to(root)), source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
               assets={p.name:dict(size=Image.open(p).size, mode=Image.open(p).mode,
                                  sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in out.glob('*.png')},
               status='prepared_not_uploaded', screenshots='Only actual Android emulator captures may populate the phone screenshot set')
(out / 'artwork-receipt.json').write_text(json.dumps(receipt, indent=2))
print(json.dumps(receipt, indent=2))
