"""Cut the Flow-trial waterfall table reels (1080x1920, silent so a platform sound can be added at posting).

Sources: Flow (Veo 3.1 Fast) clips downloaded at 1080p, letterboxed 3:4 inside 9:16 (content at y=238, h=1446).
Flow's own audio is dropped (Jared, 15 Nov: it didn't line up). Overlays are drawn with PIL, cut with ffmpeg.
  python marketing/woodwork/media/2026-11-15/cut_reels.py
"""
import pathlib, subprocess
from PIL import Image, ImageDraw, ImageFont

HERE = pathlib.Path(__file__).parent
F = "C:/Windows/Fonts/"
serif = lambda s: ImageFont.truetype(F + "georgiab.ttf", s)
sans = lambda s: ImageFont.truetype(F + "segoeuib.ttf", s)
sansr = lambda s: ImageFont.truetype(F + "segoeui.ttf", s)
W, H = 1080, 1920
TITLE, LISTING = "Waterfall Coffee Table", "Woodworking plan · PDF"


def centred(d, y, text, font, fill):
    w = d.textlength(text, font=font)
    d.text(((W - w) / 2, y), text, font=font, fill=fill)


def title_overlay(path):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    band = Image.new("RGBA", (W, 330), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    for y in range(330):  # soft dark gradient so the text reads on the bright window
        bd.line([(0, y), (W, y)], fill=(20, 16, 12, int(205 * (1 - y / 330))))
    im.alpha_composite(band, (0, 0))
    d = ImageDraw.Draw(im)
    centred(d, 150, TITLE, serif(76), (255, 255, 255, 255))
    centred(d, 248, LISTING, sans(42), (255, 248, 238, 255))
    im.save(path)


def end_card(path):
    im = Image.new("RGB", (W, H), (43, 37, 32))
    d = ImageDraw.Draw(im)
    centred(d, 700, "Build it yourself", sansr(44), (214, 200, 182))
    centred(d, 780, TITLE, serif(84), (255, 255, 255))
    centred(d, 900, "Etsy plan · instant PDF download", sans(46), (240, 234, 226))
    centred(d, 975, "US · AU · UK · EU · DE editions", sansr(40), (214, 200, 182))
    centred(d, 1180, "Fern & Fable", serif(60), (233, 183, 154))
    centred(d, 1265, "Link in bio", sansr(42), (240, 234, 226))
    im.save(path)


def cut(src, out, start, end, speed, title=True):
    t, e = HERE / "_title.png", HERE / "_end.png"
    clip_len = (end - start) / speed
    vf = (f"[0:v]trim={start}:{end},setpts=(PTS-STARTPTS)/{speed},crop=1080:1446:0:238,"
          f"scale=-2:1920,crop=1080:1920,fps=30,format=yuv420p[v];"
          f"[v][1:v]overlay=0:0:enable='lt(t,{min(3.2, clip_len - 0.3) if title else 0})'[vt];"
          f"[2:v]scale=1080:1920,fps=30,format=yuv420p,trim=0:2.6,setpts=PTS-STARTPTS[ec];"
          f"[vt][ec]concat=n=2:v=1:a=0[outv]")
    total = clip_len + 2.6
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-i", str(t),
                    "-loop", "1", "-t", "3", "-i", str(e),
                    "-f", "lavfi", "-t", f"{total:.2f}", "-i", "anullsrc=r=44100:cl=stereo",
                    "-filter_complex", vf, "-map", "[outv]", "-map", "3:a",
                    "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-c:a", "aac", "-shortest",
                    "-movflags", "+faststart", str(out)], check=True)
    print(out.name, f"{total:.1f}s")


title_overlay(HERE / "_title.png")
end_card(HERE / "_end.png")
cut(HERE / "src-pushin-1080p.mp4", HERE / "ww-flow-waterfall-pushin.mp4", 0.0, 7.85, 1.0)
cut(HERE / "src-mug-1080p.mp4", HERE / "ww-flow-waterfall-mug.mp4", 4.6, 6.9, 0.8, title=False)  # title would sit on his face
