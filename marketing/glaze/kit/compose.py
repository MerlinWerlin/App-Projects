#!/usr/bin/env python3
"""Glaze launch kit: posts, collages, carousels, pins and slide reels from rendered screens.

  python3 -I marketing/glaze/kit/compose.py <screens_dir> <art_dir> <out_dir>

<screens_dir> holds <theme>-home.png / <theme>-lock.png from screens.py; <art_dir>/<theme>/manifest.json
gives names and moods. Everything is drawn in the studio brand (marketing/brand/brand.json: palette
and fonts), so every app's posts look like one business. Theme lists come from kit.json.
"""
import json, math, pathlib, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[3]
KIT = json.loads((pathlib.Path(__file__).parent / "kit.json").read_text())
BRAND = json.loads((ROOT / "marketing/brand/brand.json").read_text())
C = BRAND["colours"]
FD = ROOT / "marketing/brand/fonts"
screens, art, out = (pathlib.Path(a) for a in sys.argv[1:4])
out.mkdir(parents=True, exist_ok=True)


def font(role, size):
    spec = BRAND["fonts"][role]
    f = ImageFont.truetype(str(FD / spec["file"]), size)
    try:
        vals = []
        for a in f.get_variation_axes():
            n = a["name"].decode() if isinstance(a["name"], bytes) else a["name"]
            v = {"Weight": spec.get("wght"), "Optical size": spec.get("opsz", size), "Width": spec.get("wdth", 100)}.get(n)
            vals.append(max(a["minimum"], min(a["maximum"], v if v is not None else a["default"])))
        f.set_variation_by_axes(vals)
    except Exception:
        pass
    return f


def meta(tid):
    m = json.loads((art / tid / "manifest.json").read_text())
    mood = m["meta"].get("mood", "").split(",")[0].split(" with ")[0].rstrip(".") + "."
    return m["name"], mood


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ---------- phone mockup ----------
def phone(tid, height, kind="home"):
    scr = Image.open(screens / f"{tid}-{kind}.png").convert("RGB")
    sh = int(height * 0.955)
    sw = int(sh * scr.width / scr.height)
    scr = scr.resize((sw, sh), Image.LANCZOS)
    bez = int(height * 0.0225)
    W, H = sw + 2 * bez, sh + 2 * bez
    R = int(W * 0.17)
    ph = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ph)
    d.rounded_rectangle([0, 0, W - 1, H - 1], R, fill=(28, 24, 22, 255))
    d.rounded_rectangle([2, 2, W - 3, H - 3], R - 2, outline=(92, 84, 78, 255), width=2)
    m = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, sw - 1, sh - 1], R - bez, fill=255)
    ph.paste(scr, (bez, bez), m)
    return ph


def shadowed(img, blur=40, offset=(0, 28), alpha=95):
    pad = blur * 3
    canvas = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("RGBA", img.size, (40, 26, 18, alpha))
    sh.putalpha(Image.eval(img.split()[3], lambda a: a * alpha // 255))
    canvas.paste(sh, (pad + offset[0], pad + offset[1]), sh)
    canvas = canvas.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(img, (pad, pad))
    return canvas, pad


def place(bg, img, cx, cy, angle=0, shadow=True):
    if angle:
        img = img.rotate(angle, resample=Image.BICUBIC, expand=True)
    if shadow:
        img, _ = shadowed(img)
    bg.alpha_composite(img, (int(cx - img.width / 2), int(cy - img.height / 2)))


def canvas(w, h, tone="bg"):
    return Image.new("RGBA", (w, h), rgb(C[tone]) + (255,))


def text_c(d, xy, s, f, fill, anchor="mm", spacing=8):
    d.multiline_text(xy, s, font=f, fill=rgb(fill) if isinstance(fill, str) else fill, anchor=anchor, align="center", spacing=spacing)


def wrap(d, s, f, width):
    words, lines, cur = s.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= width or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    return "\n".join(lines + [cur] if cur else lines)


def pill(d, cx, cy, s, f, fill, ink, padx=34, h=None):
    tw = d.textlength(s, font=f)
    h = h or int(f.size * 2.1)
    d.rounded_rectangle([cx - tw / 2 - padx, cy - h / 2, cx + tw / 2 + padx, cy + h / 2], h // 2, fill=rgb(fill))
    d.text((cx, cy), s, font=f, fill=rgb(ink), anchor="mm")


def footer(d, w, y, line=None):
    text_c(d, (w / 2, y), line or KIT["footer"], font("caption", 30), C["secondary"])


def save(img, name):
    img.convert("RGB").save(out / name, quality=92)
    print(name)


# ---------- 1. trio collage (feed post 4:5) ----------
def trio(ids, title, name):
    W, H = 1080, 1350
    bg = canvas(W, H)
    d = ImageDraw.Draw(bg)
    two = "\n" in title
    d.text((W / 2, 80 if two else 120), KIT["eyebrow"], font=font("label", 28), fill=rgb(C["olive"]), anchor="mm")
    text_c(d, (W / 2, 240 if two else 215), title, font("title", 88 if two else 92), C["text"])
    ph = [phone(t, 760) for t in ids]
    place(bg, ph[0], 260, 790, angle=6)
    place(bg, ph[2], 820, 790, angle=-6)
    place(bg, ph[1], 540, 760)
    f = font("button", 28)
    for t, x in zip(ids, (250, 540, 830)):
        pill(d, x, 1210, meta(t)[0], f, C["card"], C["text"], padx=22)
    footer(d, W, 1290)
    save(bg, name)


# ---------- 2. carousel (4:5 slides) ----------
def carousel(key, spec):
    W, H = 1080, 1350
    ids = spec["themes"]
    slides = []
    # cover
    bg = canvas(W, H, "dark")
    d = ImageDraw.Draw(bg)
    d.text((W / 2, 130), KIT["eyebrow"], font=font("label", 28), fill=rgb(C["wash"]), anchor="mm")
    text_c(d, (W / 2, 245), spec["title"], font("title", 96), C["bg"])
    for i, (t, x, a) in enumerate(zip(ids[:3], (290, 790, 540), (7, -7, 0))):
        place(bg, phone(t, 700), x, 820, angle=a)
    pill(d, W / 2, 1255, "Swipe for every theme  →", font("button", 30), C["pop"], C["bg"])
    slides.append(bg)
    for t in ids:
        bg = canvas(W, H)
        d = ImageDraw.Draw(bg)
        n, mood = meta(t)
        place(bg, phone(t, 980), W / 2, 600)
        text_c(d, (W / 2, 1180), n, font("heading", 64), C["text"])
        text_c(d, (W / 2, 1250), wrap(d, mood, font("body", 32), 860), font("body", 32), C["secondary"])
        slides.append(bg)
    bg = canvas(W, H, "olive")
    d = ImageDraw.Draw(bg)
    text_c(d, (W / 2, 520), KIT["cta_title"], font("title", 100), C["bg"])
    text_c(d, (W / 2, 690), wrap(d, KIT["cta_body"], font("body", 38), 820), font("body", 38), C["wash"], spacing=14)
    pill(d, W / 2, 880, KIT["cta_button"], font("button", 34), C["bg"], C["text"])
    slides.append(bg)
    for i, s in enumerate(slides, 1):
        save(s, f"carousel-{key}-{i:02d}.jpg")


# ---------- 3. Pinterest pins (2:3) ----------
def pin(t):
    W, H = 1000, 1500
    bg = canvas(W, H)
    d = ImageDraw.Draw(bg)
    n, mood = meta(t)
    d.text((W / 2, 110), "IPHONE HOME SCREEN IDEA", font=font("label", 26), fill=rgb(C["olive"]), anchor="mm")
    text_c(d, (W / 2, 190), n, font("title", 84), C["text"])
    place(bg, phone(t, 1020, "lock"), 330, 830, angle=4)
    place(bg, phone(t, 1080), 640, 820, angle=-3)
    pill(d, W / 2, 1420, "Wallpaper · icons · widgets", font("button", 28), C["card"], C["text"])
    save(bg, f"pin-{t}.jpg")


# ---------- 4. story (9:16 still) ----------
def story(t):
    W, H = 1080, 1920
    bg = canvas(W, H)
    d = ImageDraw.Draw(bg)
    n, _ = meta(t)
    text_c(d, (W / 2, 250), KIT["story_title"], font("title", 104), C["text"])
    place(bg, phone(t, 1260), W / 2, 1040)
    pill(d, W / 2, 1760, n, font("button", 34), C["olive"], C["bg"])
    save(bg, f"story-{t}.jpg")


# ---------- 5. slide reel (9:16 video) ----------
def ease(x):
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, x)))


def reel(name, ids, title, hold=1.35, slide=0.55, fps=30):
    W, H = 1080, 1920
    base = canvas(W, H)
    d = ImageDraw.Draw(base)
    text_c(d, (W / 2, 210), title, font("title", 96), C["text"])
    footer(d, W, 1840)
    ph_h = 1300
    frame = phone(ids[0], ph_h)
    fw, fh = frame.size
    bez = int(ph_h * 0.0225)
    sh = int(ph_h * 0.955)
    scr = [Image.open(screens / f"{t}-home.png").convert("RGB").resize((fw - 2 * bez, sh), Image.LANCZOS) for t in ids]
    sw = scr[0].width
    R = int(fw * 0.17)
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, sh - 1], R - bez, fill=255)
    shell = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shell)
    sd.rounded_rectangle([0, 0, fw - 1, fh - 1], R, fill=(28, 24, 22, 255))
    sd.rounded_rectangle([2, 2, fw - 3, fh - 3], R - 2, outline=(92, 84, 78, 255), width=2)
    shell_sh, pad = shadowed(shell)
    px, py = int(W / 2 - shell_sh.width / 2), int(1010 - shell_sh.height / 2)
    names = [meta(t)[0] for t in ids]
    fpill = font("button", 36)
    seg = hold + slide
    total = seg * len(ids)
    n = int(total * fps)
    with tempfile.TemporaryDirectory() as td:
        for i in range(n):
            t = i / fps
            k = int(t // seg) % len(ids)
            u = (t - k * seg - hold) / slide
            p = ease(u) if u > 0 else 0.0
            nxt = (k + 1) % len(ids)
            strip = Image.new("RGB", (sw, sh))
            off = int(p * sw)
            strip.paste(scr[k], (-off, 0))
            strip.paste(scr[nxt], (sw - off, 0))
            f = base.copy()
            f.alpha_composite(shell_sh, (px, py))
            f.paste(strip, (px + pad + bez, py + pad + bez), mask)
            fd = ImageDraw.Draw(f)
            label = names[nxt] if p > 0.5 else names[k]
            a = abs(p - 0.5) * 2 if u > 0 else 1.0
            col = tuple(int(c1 * a + c0 * (1 - a)) for c1, c0 in zip(rgb(C["bg"]), rgb(C["olive"])))
            tw = fd.textlength(label, font=fpill)
            fd.rounded_rectangle([W / 2 - tw / 2 - 36, 1702, W / 2 + tw / 2 + 36, 1778], 38, fill=rgb(C["olive"]))
            fd.text((W / 2, 1740), label, font=fpill, fill=col, anchor="mm")
            f.convert("RGB").save(f"{td}/f{i:05d}.jpg", quality=90)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", f"{td}/f%05d.jpg",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", str(out / name)], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "0.5", "-i", str(out / name), "-frames:v", "1",
                    "-vf", "scale=540:-1", str((out / name).with_suffix(".jpg"))], check=True)
    print(name)


if __name__ == "__main__":
    only = set(sys.argv[4:])
    def want(k): return not only or k in only
    if want("trio"):
        for i, tr in enumerate(KIT["trios"], 1):
            trio(tr["themes"], tr["title"], f"collage-{i:02d}.jpg")
    if want("carousel"):
        for k, spec in KIT["carousels"].items():
            carousel(k, spec)
    if want("pin"):
        for t in KIT["hero"]:
            pin(t)
    if want("story"):
        for t in KIT["hero"][:6]:
            story(t)
    if want("reel"):
        for i, r in enumerate(KIT["reels"], 1):
            reel(f"reel-{i:02d}.mp4", r["themes"], r["title"])
