# Composes App Store screenshots (1320 x 2868, 6.9-inch) from raw simulator captures made by
# .github/workflows/trammel-store-capture.yml: a headline on blade yellow with tape ticks, and the real screen in a
# rounded device frame. Usage: python compose.py <raw-capture-dir> <out-dir>
import sys, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, '..', '..', 'node_modules', '@expo-google-fonts')
HEAD = ImageFont.truetype(os.path.join(FONTS, 'barlow-condensed', '800ExtraBold', 'BarlowCondensed_800ExtraBold.ttf'), 132)
SUB = ImageFont.truetype(os.path.join(FONTS, 'barlow', '500Medium', 'Barlow_500Medium.ttf'), 54)
Y, K = (255, 194, 26), (17, 17, 17)
W, H = 1320, 2868

SHOTS = [
    # Headline lines are separated by "|".
    ('dark-01-stairs.png', 'STAIRS, CHECKED|AGAINST YOUR CODE', 'Risers, going and 2R+G in one go'),
    ('dark-16-welcome.png', 'BUILT FOR WHERE|YOU BUILD', 'Local codes, trade words and timber sizes'),
    ('dark-08-cutlist.png', 'CUT LISTS THAT|WASTE LESS', 'From the lengths your yard stocks'),
    ('dark-02-rafter.png', 'RAFTERS AND|BIRDSMOUTHS', 'Length, plumb cut, height above plate'),
    ('dark-04-crown.png', 'CORNICE CUTS,|ANY CORNER', 'Bevel and mitre straight to the saw'),
    ('dark-00-home.png', 'EVERY TOOL A|CHIPPY NEEDS', 'Big buttons, every step shown'),
    ('dark-17-rafter-locked.png', 'TRY EVERY TOOL|FREE FOR A WEEK', 'Then one unlock, no subscription'),
]

def ticks(d, y0, up=True):
    for i, x in enumerate(range(12, W, 24)):
        h = 70 if i % 10 == 0 else 46 if i % 5 == 0 else 26
        if up:
            d.rectangle([x - 3, y0 - h, x + 3, y0], fill=K)
        else:
            d.rectangle([x - 3, y0, x + 3, y0 + h], fill=K)

def compose(raw, title, sub, out):
    bg = Image.new('RGB', (W, H), Y)
    d = ImageDraw.Draw(bg)
    ticks(d, 0, up=False)
    y = 190
    for line in title.split('|'):
        tw = d.textlength(line, font=HEAD)
        d.text(((W - tw) / 2, y), line, font=HEAD, fill=K)
        y += 140
    tw = d.textlength(sub, font=SUB)
    d.text(((W - tw) / 2, y + 26), sub, font=SUB, fill=K)
    shot = Image.open(raw).convert('RGB')
    sw = 1010
    sh = round(shot.height * sw / shot.width)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    top = y + 150
    bez = 26
    frame = Image.new('RGBA', (sw + 2 * bez, sh + 2 * bez), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle([0, 0, frame.width - 1, frame.height - 1], radius=150, fill=K + (255,))
    mask = Image.new('L', (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, sh - 1], radius=126, fill=255)
    frame.paste(shot, (bez, bez), mask)
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([(W - frame.width) // 2 + 10, top + 24, (W + frame.width) // 2 + 10, top + frame.height + 24], radius=150, fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(30))
    bg = Image.alpha_composite(bg.convert('RGBA'), shadow)
    bg.paste(frame, ((W - frame.width) // 2, top), frame)
    bg.convert('RGB').save(out, quality=92)

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)
    for i, (f, t, s) in enumerate(SHOTS, 1):
        name = f.split('-', 2)[2].replace('.png', '')
        compose(os.path.join(src, f), t, s, os.path.join(dst, f'{i:02d}-{name}.jpg'))
        print('wrote', i, name)
