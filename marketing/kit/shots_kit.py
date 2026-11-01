#!/usr/bin/env python3
"""Launch posts for any app from its App Store screenshots, in the studio brand.

  python3 -I marketing/kit/shots_kit.py <slug> <out_dir> [shots_dir]

For apps whose store shots already carry their own headline (Linework, Cue, Backspin, Couch...):
  - reel-<slug>.mp4      9:16, the shots slide in one after another on the studio background + end card
  - carousel-<slug>-NN   4:5: cover, one slide per shot, call to action
Names and taglines come from marketing/apps.json; colours and fonts from marketing/brand/brand.json.
"""
import json, math, pathlib, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
BRAND = json.loads((ROOT / "marketing/brand/brand.json").read_text())
C = BRAND["colours"]
FD = ROOT / "marketing/brand/fonts"
slug, out = sys.argv[1], pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
APP = next(a for a in json.loads((ROOT / "marketing/apps.json").read_text())["apps"] if a["slug"] == slug)
DEFAULT_SHOTS = {"linework": "apps/linework/store/jpg/a", "cue": "apps/cue/store/jpg/ios",
                 "backspin": "apps/backspin/store/jpg/ios", "couch": "apps/couch/store/jpg/ios"}
shots_dir = ROOT / (sys.argv[3] if len(sys.argv) > 3 else DEFAULT_SHOTS.get(slug, APP.get("screenshots", "")))
shots = sorted(p for p in shots_dir.iterdir() if p.suffix.lower() in (".jpg", ".png"))
NAME = APP.get("storeName") or APP["name"]
TAG = APP.get("tagline", "")


def font(role, size):
    spec = BRAND["fonts"][role]
    f = ImageFont.truetype(str(FD / spec["file"]), size)
    try:
        vals = []
        for a in f.get_variation_axes():
            n = a["name"].decode() if isinstance(a["name"], bytes) else a["name"]
            v = {"Weight": spec.get("wght"), "Optical size": spec.get("opsz", size), "Width": 100}.get(n)
            vals.append(max(a["minimum"], min(a["maximum"], v if v is not None else a["default"])))
        f.set_variation_by_axes(vals)
    except Exception:
        pass
    return f


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def card(path, height, radius_share=0.06):
    im = Image.open(path).convert("RGB")
    w = int(height * im.width / im.height)
    im = im.resize((w, height), Image.LANCZOS)
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, height - 1], int(w * radius_share), fill=255)
    rgba = im.convert("RGBA")
    rgba.putalpha(m)
    return rgba


def shadowed(img, blur=36, dy=24, alpha=90):
    pad = blur * 3
    c = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("RGBA", img.size, (40, 26, 18, 255))
    sh.putalpha(Image.eval(img.split()[3], lambda a: a * alpha // 255))
    c.paste(sh, (pad, pad + dy), sh)
    c = c.filter(ImageFilter.GaussianBlur(blur))
    c.alpha_composite(img, (pad, pad))
    return c


def place(bg, img, cx, cy, angle=0):
    if angle:
        img = img.rotate(angle, resample=Image.BICUBIC, expand=True)
    img = shadowed(img)
    bg.alpha_composite(img, (int(cx - img.width / 2), int(cy - img.height / 2)))


def canvas(w, h, tone="bg"):
    return Image.new("RGBA", (w, h), rgb(C[tone]) + (255,))


def ctext(d, xy, s, f, col, spacing=10):
    d.multiline_text(xy, s, font=f, fill=rgb(col), anchor="mm", align="center", spacing=spacing)


def pill(d, cx, cy, s, f, fill, ink, padx=32):
    tw = d.textlength(s, font=f); h = int(f.size * 2.1)
    d.rounded_rectangle([cx - tw / 2 - padx, cy - h / 2, cx + tw / 2 + padx, cy + h / 2], h // 2, fill=rgb(fill))
    d.text((cx, cy), s, font=f, fill=rgb(ink), anchor="mm")


def save(img, name):
    img.convert("RGB").save(out / name, quality=92); print(name)


def carousel():
    W, H = 1080, 1350
    bg = canvas(W, H, "dark"); d = ImageDraw.Draw(bg)
    d.text((W / 2, 120), "NEW ON IPHONE", font=font("label", 28), fill=rgb(C["wash"]), anchor="mm")
    ctext(d, (W / 2, 215), NAME.split(":")[0], font("title", 104), C["bg"])
    ctext(d, (W / 2, 305), TAG, font("body", 38), C["wash"])
    a, b = shots[0], shots[1 % len(shots)]
    place(bg, card(b, 760), 700, 860, -6)
    place(bg, card(a, 800), 400, 840, 5)
    pill(d, W / 2, 1270, "Swipe to see it  →", font("button", 30), C["pop"], C["bg"])
    slides = [bg]
    for s in shots:
        bg = canvas(W, H); place(bg, card(s, 1180), W / 2, H / 2 - 10); slides.append(bg)
    bg = canvas(W, H, "olive"); d = ImageDraw.Draw(bg)
    ctext(d, (W / 2, 520), NAME.split(":")[0], font("title", 120), C["bg"])
    ctext(d, (W / 2, 650), TAG, font("body", 40), C["wash"])
    pill(d, W / 2, 820, "On the App Store", font("button", 34), C["bg"], C["text"])
    slides.append(bg)
    for i, s in enumerate(slides, 1):
        save(s, f"carousel-{slug}-{i:02d}.jpg")


def ease(x):
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, x)))


def reel(hold=1.6, slide=0.5, fps=30):
    W, H = 1080, 1920
    base = canvas(W, H); d = ImageDraw.Draw(base)
    d.text((W / 2, 1830), f"{NAME}  ·  for iPhone", font=font("caption", 32), fill=rgb(C["secondary"]), anchor="mm")
    cards = [shadowed(card(s, 1640)) for s in shots]
    cw, ch = cards[0].size
    end = canvas(W, H, "olive"); ed = ImageDraw.Draw(end)
    ctext(ed, (W / 2, 820), NAME.split(":")[0], font("title", 150), C["bg"])
    ctext(ed, (W / 2, 980), TAG, font("body", 46), C["wash"])
    pill(ed, W / 2, 1160, "On the App Store", font("button", 40), C["bg"], C["text"])
    seg = hold + slide
    n = int((seg * len(cards) + 1.8) * fps)
    cy = 900
    with tempfile.TemporaryDirectory() as td:
        for i in range(n):
            t = i / fps
            k = int(t // seg)
            f = base.copy()
            if k < len(cards):
                u = (t - k * seg - hold) / slide
                p = ease(u) if u > 0 else 0.0
                x0 = int(W / 2 - cw / 2 - p * W)
                f.alpha_composite(cards[k], (x0, int(cy - ch / 2)))
                if k + 1 < len(cards):
                    f.alpha_composite(cards[k + 1], (x0 + W, int(cy - ch / 2)))
                elif p > 0:
                    f = Image.blend(f.convert("RGB"), end.convert("RGB"), p).convert("RGBA")
            else:
                f = end.copy()
            f.convert("RGB").save(f"{td}/f{i:05d}.jpg", quality=90)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", f"{td}/f%05d.jpg", "-c:v", "libx264",
                        "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", str(out / f"reel-{slug}.mp4")], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "0.5", "-i", str(out / f"reel-{slug}.mp4"), "-frames:v", "1",
                    "-vf", "scale=540:-1", str(out / f"reel-{slug}.jpg")], check=True)
    print(f"reel-{slug}.mp4")


if __name__ == "__main__":
    carousel()
    reel()
