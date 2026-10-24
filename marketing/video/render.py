#!/usr/bin/env python3
"""Turn a storyboard + a folder of images into a vertical marketing video (MP4, H.264, 1080x1920, 30 fps).

  python3 marketing/video/render.py marketing/<app>/media/<batch>/<id>.storyboard.json [out.mp4]

Storyboard (written by the OpenAI lane, see marketing/LANES.md):
{
  "id": "bs-v001", "app": "backspin", "title": "internal title",
  "shots": [
    {"image": "img/01.png", "caption": "Sing a line", "sub": "optional smaller line",
     "seconds": 2.5, "motion": "in" | "out" | "left" | "right" | "up" | "down" | "none"}
  ],
  "end": {"title": "Backspin", "line": "Coming soon to iPhone", "sub": "No ads. No subscription."},
  "accent": "#E8552B", "branded": false
}
Image paths are relative to the storyboard file. Missing images become a soft accent gradient so a run never fails
on one bad file. When "branded" is false the end card shows only "line" and "sub" (no app name).
"""
import json, math, os, pathlib, shutil, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS, XF = 1080, 1920, 30, 0.35
FONT_CANDIDATES = {
    "bold": ["/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf", "/usr/share/fonts/opentype/inter/Inter-Bold.otf",
             "/usr/share/fonts/truetype/inter/Inter-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"],
    "reg": ["/usr/share/fonts/opentype/inter/Inter-Medium.otf", "/usr/share/fonts/truetype/inter/Inter-Medium.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"],
}


def font(kind, size):
    for p in FONT_CANDIDATES[kind]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def wrap(draw, text, f, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=f) <= width or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def cover(img, w, h):
    s = max(w / img.width, h / img.height)
    img = img.resize((math.ceil(img.width * s), math.ceil(img.height * s)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def base_frame(src, accent):
    """Frame-sized base; zoompan supplies the motion."""
    bw, bh = W, H
    if src and src.exists():
        im = Image.open(src).convert("RGB")
        if im.width / im.height > 0.75:  # landscape/square art: blurred fill behind a contained copy
            bg = cover(im, bw, bh).filter(ImageFilter.GaussianBlur(40))
            fg = im.copy()
            fg.thumbnail((int(bw * 0.92), int(bh * 0.7)), Image.LANCZOS)
            bg.paste(fg, ((bw - fg.width) // 2, (bh - fg.height) // 2))
            return bg
        return cover(im, bw, bh)
    a = hexrgb(accent)
    g = Image.new("RGB", (1, 2))
    g.putpixel((0, 0), tuple(min(255, c + 60) for c in a))
    g.putpixel((0, 1), a)
    return g.resize((bw, bh), Image.BICUBIC)


def caption_png(caption, sub, accent, path):
    """Caption on a dark rounded box in the top third, so it reads over any image."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fb, fs = font("bold", 84), font("reg", 46)
    lines = [(l, fb, 100) for l in wrap(d, caption or "", fb, W - 220)] + [(l, fs, 60) for l in wrap(d, sub or "", fs, W - 240)]
    if not lines:
        img.save(path)
        return
    hgt = sum(h for _, _, h in lines) + 70
    wid = max(d.textlength(l, font=f) for l, f, _ in lines) + 110
    x0, y0 = (W - wid) / 2, 250
    d.rounded_rectangle([x0, y0, x0 + wid, y0 + hgt], radius=36, fill=(12, 12, 16, 205))
    y = y0 + 32
    for l, f, h in lines:
        tw = d.textlength(l, font=f)
        d.text(((W - tw) / 2, y), l, font=f, fill=(255, 255, 255, 255) if f is fb else (225, 225, 230, 255))
        y += h
    img.save(path)


def end_card(end, accent, branded, path):
    a = hexrgb(accent)
    img = Image.new("RGB", (W, H), tuple(int(c * 0.22) for c in a))
    d = ImageDraw.Draw(img)
    y = 760
    if branded and end.get("title"):
        f = font("bold", 140)
        tw = d.textlength(end["title"], font=f)
        d.text(((W - tw) / 2, y), end["title"], font=f, fill=a)
        y += 190
    for key, kind, size, col in (("line", "bold", 72, (255, 255, 255)), ("sub", "reg", 48, (225, 225, 225))):
        if end.get(key):
            f = font(kind, size)
            for line in wrap(d, end[key], f, W - 180):
                tw = d.textlength(line, font=f)
                d.text(((W - tw) / 2, y), line, font=f, fill=col)
                y += int(size * 1.25)
            y += 20
    img.save(path)


def motion_expr(motion, N):
    p = f"(on/{N})"
    c = "(iw-iw/zoom)/2", "(ih-ih/zoom)/2"
    return {
        "in": (f"1+0.12*{p}",) + c,
        "out": (f"1.12-0.12*{p}",) + c,
        "left": ("1.08", f"(iw-iw/zoom)*(1-{p})", c[1]),
        "right": ("1.08", f"(iw-iw/zoom)*{p}", c[1]),
        "up": ("1.08", c[0], f"(ih-ih/zoom)*(1-{p})"),
        "down": ("1.08", c[0], f"(ih-ih/zoom)*{p}"),
        "none": ("1.0",) + c,
    }.get(motion, (f"1+0.12*{p}",) + c)


def shot_clip(tmp, n, base, cap_png, seconds, motion):
    """Ken Burns with zoompan on a 2x still (less jitter), then the caption overlay."""
    b = tmp / f"b{n}.png"
    base.resize((W * 2, H * 2), Image.LANCZOS).save(b)
    N = max(1, int(round(seconds * FPS)))
    z, x, y = motion_expr(motion, N)
    out = tmp / f"s{n}.mp4"
    vf = (f"[0:v]zoompan=z='{z}':x='{x}':y='{y}':d={N}:s={W}x{H}:fps={FPS},setsar=1[v];"
          f"[v][1:v]overlay=0:0,format=yuv420p")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(b), "-loop", "1", "-framerate", str(FPS), "-i", str(cap_png),
                    "-filter_complex", vf, "-frames:v", str(N), "-c:v", "libx264", "-preset", "medium", "-crf", "20", str(out)], check=True)
    return out


def render(sb_path, out_path=None):
    sb_path = pathlib.Path(sb_path)
    sb = json.loads(sb_path.read_text())
    accent = sb.get("accent", "#2346A8")
    out_path = pathlib.Path(out_path or sb_path.with_name(sb["id"] + ".mp4"))
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        clips, lens = [], []
        for n, s in enumerate(sb["shots"]):
            secs = float(s.get("seconds", 2.5))
            src = (sb_path.parent / s["image"]) if s.get("image") else None
            cap = tmp / f"c{n}.png"
            caption_png(s.get("caption", ""), s.get("sub", ""), accent, cap)
            clips.append(shot_clip(tmp, n, base_frame(src, accent), cap, secs, s.get("motion", "in")))
            lens.append(secs)
        if sb.get("end"):
            e = tmp / "end.png"
            end_card(sb["end"], accent, sb.get("branded", False), e)
            blank = tmp / "blank.png"
            Image.new("RGBA", (W, H), (0, 0, 0, 0)).save(blank)
            secs = float(sb["end"].get("seconds", 2.2))
            clips.append(shot_clip(tmp, 99, Image.open(e), blank, secs, "none"))
            lens.append(secs)
        # chain crossfades
        args, fc, prev, off = [], [], "[0:v]", 0.0
        for c in clips:
            args += ["-i", str(c)]
        for i in range(1, len(clips)):
            off += lens[i - 1] - XF
            lab = f"[x{i}]"
            fc.append(f"{prev}[{i}:v]xfade=transition=fade:duration={XF}:offset={off:.3f}{lab}")
            prev = lab
        cmd = ["ffmpeg", "-y", "-loglevel", "error"] + args
        if fc:
            cmd += ["-filter_complex", ";".join(fc), "-map", prev]
        cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "21", "-movflags", "+faststart", str(out_path)]
        subprocess.run(cmd, check=True)
    # poster frame for previews
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1.2", "-i", str(out_path), "-frames:v", "1",
                    "-vf", "scale=540:-1", str(out_path.with_suffix(".jpg"))], check=True)
    return out_path


if __name__ == "__main__":
    print(render(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None))
