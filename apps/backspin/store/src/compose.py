"""App Store screenshots for Backspin: real simulator captures of the current app, framed with a headline.

Captures come from `.github/workflows/backspin-ipad-capture.yml` with set=store (iphone-*.png at 1320x2868 on the
6.9-inch iPhone, ipad-*.png at 2064x2752 on the 13-inch iPad). The app screen inside each frame is the capture itself,
only scaled; nothing in it is redrawn.

    python apps/backspin/store/src/compose.py <captures folder>

Writes apps/backspin/store/jpg/ios/NN-name.jpg (1320x2868) and apps/backspin/store/ipad/NN-name.png (2064x2752).
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
STORE = os.path.dirname(HERE)
FONT = os.path.join(STORE, '..', 'assets', 'fonts', 'BackspinDisplay.ttf')

PAPER, INK, SUB, PINK, BLUE = '#F3F1EB', '#17151C', '#55515E', '#D81F7F', '#3255A4'

SHOTS = [
    ('01-score', 'Sing it backwards.', 'Get a real score.', 'Sound, rhythm and length, out of 100'),
    ('02-say', 'Say a line.', 'Any line.', '986 challenge lines, or freestyle'),
    ('03-listen', 'Hear it', 'backwards.', 'Loop it, slow it down, play it again'),
    ('04-copy', 'Copy that', 'strange sound.', 'Then Backspin flips your copy forwards'),
    ('05-party', 'Pass the phone.', 'Play together.', 'Party mode for 2 to 8 players'),
    ('06-home', 'A new challenge', 'every day.', 'Keep your streak going'),
    ('07-packs', '7 packs of', 'silly lines.', 'Tongue twisters, animals, family and more'),
    ('08-plus', '10 free goes.', 'Then yours for life.', 'One payment. No subscription, no ads.'),
]

SIZES = {
    # device: (canvas, headline pt, sub pt, top margin, screen width share, corner radius, output folder, extension)
    'iphone': ((1320, 2868), 118, 52, 150, 0.80, 64, os.path.join(STORE, 'jpg', 'ios'), 'jpg'),
    'ipad': ((2064, 2752), 132, 58, 140, 0.74, 44, os.path.join(STORE, 'ipad'), 'png'),
}


def fit_font(draw, text, pt, max_w):
    while pt > 40:
        f = ImageFont.truetype(FONT, pt)
        if draw.textlength(text, font=f) <= max_w:
            return f
        pt -= 4
    return ImageFont.truetype(FONT, pt)


def rounded(im, r):
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255)
    return mask


def compose(src, device, name, l1, l2, sub):
    (W, H), hpt, spt, top, share, r, out_dir, ext = SIZES[device]
    c = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(c)
    max_w = int(W * 0.88)
    y = top
    for text, colour in ((l1, INK), (l2, PINK)):
        f = fit_font(d, text, hpt, max_w)
        d.text((W / 2, y), text, font=f, fill=colour, anchor='mt')
        y += int(f.size * 1.08)
    f = fit_font(d, sub, spt, max_w)
    d.text((W / 2, y + int(spt * 0.45)), sub, font=f, fill=SUB, anchor='mt')
    y += int(spt * 0.45) + f.size + int(spt * 1.1)

    shot = Image.open(src).convert('RGB')
    sw = int(W * share)
    sh = int(shot.height * sw / shot.width)
    if y + sh > H - 40:  # keep the whole screen on the canvas
        sh = H - 40 - y
        sw = int(shot.width * sh / shot.height)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    x = (W - sw) // 2
    off = max(14, sw // 60)  # the blue plate sits out of register behind the screen, like the app's buttons
    d.rounded_rectangle((x + off, y + off, x + sw + off, y + sh + off), r, fill=BLUE)
    d.rounded_rectangle((x - 5, y - 5, x + sw + 5, y + sh + 5), r + 5, fill=INK)
    c.paste(shot, (x, y), rounded(shot, r))

    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f'{name}.{ext}')
    if ext == 'jpg':
        c.save(path, quality=92, optimize=True)
    else:
        c.save(path, optimize=True)
    return path


def main(cap):
    for device in SIZES:
        for name, l1, l2, sub in SHOTS:
            src = os.path.join(cap, f'{device}-{name}.png')
            if not os.path.exists(src):
                raise SystemExit(f'missing capture {src}')
            print(compose(src, device, name, l1, l2, sub))


if __name__ == '__main__':
    main(sys.argv[1])
