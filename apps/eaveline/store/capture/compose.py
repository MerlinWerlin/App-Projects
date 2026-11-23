"""Eaveline App Store screenshots: a bold caption over each real simulator capture.

python3 compose.py --raw <captures dir> --out <dir> [--mode light]

Every shot is 1320 x 2868 (6.9-inch iPhone), RGB JPEG. Background: the app's hi-vis yellow with corrugated roof-sheet
ribs fading in at the bottom and a black eave line; captions in Archivo Narrow (SIL OFL, bundled by the app).
"""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
APP = HERE.parent.parent
W, H = 1320, 2868
YELLOW = (255, 210, 31)
RIB = (232, 188, 18)
INK = (18, 20, 23)
INK2 = (61, 52, 20)


def font(name, size):
    for c in (APP / 'node_modules' / '@expo-google-fonts').glob(f'**/{name}'):
        return ImageFont.truetype(str(c), size)
    raise SystemExit(f'font {name} not found (npm ci first)')


def background():
    img = Image.new('RGB', (W, H), YELLOW)
    d = ImageDraw.Draw(img)
    # Corrugated ribs in the lower half, getting stronger towards the bottom.
    top = H // 2
    for y0 in range(top, H, 4):
        t = (y0 - top) / (H - top)
        col = tuple(round(YELLOW[i] * (1 - t * 0.9) + RIB[i] * (t * 0.9)) for i in range(3))
        for x in range(0, W, 66):
            d.rectangle((x, y0, x + 22, y0 + 3), fill=col)
    return img


def wrap(d, text, f, max_w):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=f) <= max_w:
            cur = t
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def rounded(im, r):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.size[0] - 1, im.size[1] - 1), r, fill=255)
    out = im.convert('RGBA')
    out.putalpha(m)
    return out


def compose(shot, raw, out):
    img = background()
    d = ImageDraw.Draw(img)
    head = font('ArchivoNarrow_700Bold.ttf', 132)
    sub = font('AtkinsonHyperlegible_400Regular.ttf', 54)
    y = 160
    for line in wrap(d, shot['title'], head, 1180):
        w = d.textlength(line, font=head)
        d.text(((W - w) / 2, y), line, font=head, fill=INK)
        y += 140
    y += 46
    d.rounded_rectangle((W / 2 - 110, y, W / 2 + 110, y + 18), 9, fill=INK)  # the eave line
    y += 60
    if shot.get('sub'):
        for line in wrap(d, shot['sub'], sub, 1100):
            w = d.textlength(line, font=sub)
            d.text(((W - w) / 2, y), line, font=sub, fill=INK2)
            y += 70
    y += 46
    cap = Image.open(raw).convert('RGB')
    pw = 1040
    ph = round(cap.height * pw / cap.width)
    cap = cap.resize((pw, ph), Image.LANCZOS)
    bezel = 22
    frame = rounded(Image.new('RGB', (pw + 2 * bezel, ph + 2 * bezel), INK), 120)
    img.paste(frame, ((W - frame.width) // 2, y), frame)
    screen = rounded(cap, 100)
    img.paste(screen, ((W - pw) // 2, y + bezel), screen)
    img.save(out, 'JPEG', quality=93, subsampling=0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--mode', default='light')
    a = ap.parse_args()
    shots = json.loads((HERE / 'shots.json').read_text(encoding='utf-8'))
    Path(a.out).mkdir(parents=True, exist_ok=True)
    for i, s in enumerate(shots, 1):
        src = next(Path(a.raw).glob(f"{s['capture']}-{a.mode}*.png"), None)
        if not src:
            print('missing capture', s['capture'])
            continue
        compose(s, src, Path(a.out) / f"{i:02d}-{s['capture']}.jpg")
        print('composed', s['capture'])


if __name__ == '__main__':
    main()
