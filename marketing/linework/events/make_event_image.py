#!/usr/bin/env python3
"""App Store In-App Event image (1920x1080) for Linework's "Trace your own Christmas cards" event.

  python -I marketing/linework/events/make_event_image.py
Uses only the real store art (apps/linework/store/jpg/a), cropped below the captions, on a warm festive card.
No text in the image: the App Store lays the event name over the bottom of the card, so key art stays in the top two thirds.
"""
import pathlib, random
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[3]
A = ROOT / "apps/linework/store/jpg/a"
W, H = 1920, 1080
out = pathlib.Path(__file__).parent / "xmas-2026-event-1920x1080.jpg"

# background: deep pine green with a warm glow behind the art
bg = Image.new("RGB", (W, H))
d = ImageDraw.Draw(bg)
top, bot = (24, 58, 46), (20, 46, 38)
for x in range(W):
    t = x / (W - 1)
    d.line([(x, 0), (x, H)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
glow = Image.new("L", (W, H), 0)
ImageDraw.Draw(glow).ellipse((380, -260, 1540, 900), fill=90)
bg = Image.composite(Image.new("RGB", (W, H), (196, 150, 96)), bg, glow.filter(ImageFilter.GaussianBlur(220)))

# little gold stars, kept off the art
rnd = random.Random(7)
d = ImageDraw.Draw(bg)
for _ in range(70):
    x, y, r = rnd.randrange(W), rnd.randrange(H), rnd.choice((2, 2, 3, 4))
    d.ellipse((x - r, y - r, x + r, y + r), fill=(246, 214, 140))


def card(name, box, height, radius=46):
    im = Image.open(A / name).convert("RGB").crop(box)
    im = im.resize((int(im.width * height / im.height), height), Image.LANCZOS)
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius, fill=255)
    return im, m


def place(im, m, x, y):
    sh = Image.new("RGBA", (im.width + 120, im.height + 120), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((60, 75, im.width + 60, im.height + 75), 46, fill=(0, 0, 0, 120))
    bg.paste(sh.filter(ImageFilter.GaussianBlur(28)), (x - 60, y - 60), sh.filter(ImageFilter.GaussianBlur(28)))
    bg.paste(im, (x, y), m)


# left: phone held over the paper with a pencil (00-scan, below its caption)
a, am = card("00-scan.jpg", (0, 560, 1320, 2868), 760)
# right: the trace screen (01-trace, below its caption)
b, bm = card("01-trace.jpg", (60, 560, 1260, 2868), 760)
place(a, am, 470, 70)
place(b, bm, 1040, 70)
bg.save(out, quality=92)
print(out, bg.size)
