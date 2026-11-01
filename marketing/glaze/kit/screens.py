#!/usr/bin/env python3
"""Render Glaze Home Screens and Lock Screens from the real theme packs (marketing launch kit).

  python3 -I marketing/glaze/kit/screens.py <art_dir> <out_dir> [theme ...]

<art_dir>/<theme>/ holds manifest.json, wallpaper.webp and w-*.webp widget art, downloaded from the
glaze-packs-v1 release by fetch.py. Each theme gives:
  <out>/<theme>-home.png  1170x2532 (390x844 pt at 3x): real wallpaper, the theme's widget art as
                          small + medium widgets, icon rows and dock in the theme's icon colours
  <out>/<theme>-lock.png  1170x2532: wallpaper, date and time
Icons use Glaze's own glyph set and tile maths (apps/glaze/assets/store/src/art.js, original art).
Nothing here is fetched; fonts are local.
"""
import base64, json, pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[3]
STORE = ROOT / "apps/glaze/assets/store/src"
art_dir, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
themes = sys.argv[3:] or sorted(p.name for p in art_dir.iterdir() if (p / "manifest.json").exists())


def blended_uri(p):
    """Widget art blended the way the phone does it (no frame, no box): apps/glaze/scripts/packs/blend-audit.py."""
    import importlib.util, io
    import numpy as np
    from PIL import Image
    spec = importlib.util.spec_from_file_location("blend", ROOT / "apps/glaze/scripts/packs/blend-audit.py")
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    rgba = m.load_rgba(p)
    out = m.apply_blend(rgba, m.decide(m.measure(rgba)))
    buf = io.BytesIO(); Image.fromarray(out, "RGBA").resize((512, 512), Image.LANCZOS).save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def data_uri(p):
    mime = "image/webp" if p.suffix == ".webp" else "image/png"
    return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()


# Shared CSS from the store page (phone, status bar, tiles, dock), so the look matches the App Store shots.
shot = (STORE / "shot.html").read_text()
css = shot[shot.index("<style>") + 7: shot.index("</style>")]

PAGE = """<!doctype html><html><head><meta charset="utf-8"><style>%s
html,body{width:390px;height:844px;background:#000}
.wall{background-size:cover;background-position:center}
.wart{position:absolute;background-size:contain;background-repeat:no-repeat;background-position:center}
.gt{position:relative;width:62px;height:62px;border-radius:14px;display:flex;align-items:center;justify-content:center;overflow:hidden;backdrop-filter:blur(10px) saturate(1.2);-webkit-backdrop-filter:blur(10px)}
.gt:after{content:"";position:absolute;inset:0;border-radius:14px;box-shadow:inset 0 0 0 .8px rgba(255,255,255,.22);background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.03) 45%%,rgba(255,255,255,0))}
.dock{backdrop-filter:blur(26px) saturate(1.3)}
.lbl{text-shadow:0 1px 3px rgba(0,0,0,.25)}
</style>
<script>window.GLAZE_DATA=%s;</script><script>%s</script></head><body><div id="root" style="position:relative;width:390px;height:844px;overflow:hidden"></div>
<script>
(function(){
const GA = window.GlazeArt, T = %s;
const isDark = GA.isDark;
function rgbaOf(h,a){h=h.replace('#','');return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`;}
function gtile(g){ const p=T.palette; return `<div class="gt" style="background:${rgbaOf(p.surface,0.5)}">${GA.glyph(g, p.glyph, 30, 2)}</div>`; }
function screenHome(){
  const ink = T.wallDark ? '#FFFFFF' : '#16130F';
  let h=`<div class="screen"><div class="wall" style="background-image:url(${T.wall})"></div>`;
  const sb = GA.home(T,[],{noDock:true}).match(/<div class="status"[\s\S]*?<\/div>/)[0].replace(/color:[^;"]+/,'color:'+ink).replace(/fill="[^"]+"/g,'fill="'+ink+'"').replace(/stroke="(?!none)[^"]+"/g,'stroke="'+ink+'"');
  h+=sb;
  const W=T.widgets;
  if(W[0]) h+=`<div class="wart" style="left:18px;top:60px;width:167px;height:167px;background-image:url(${W[0]})"></div>`;
  if(W[1]) h+=`<div class="wart" style="left:205px;top:60px;width:167px;height:167px;background-image:url(${W[1]})"></div>`;
  let y=246, k=0;
  for(const n of [4,4]){ for(let i=0;i<n;i++){ const [g,l]=GA.APPS[k++]; h+=`<div class="abs app" style="left:${24+i*93.3}px;top:${y}px">${gtile(g)}<div class="lbl" style="color:${ink}">${l}</div></div>`;} y+=100; }
  const dock=`<div class="dock" style="background:rgba(255,255,255,${T.wallDark?0.12:0.28})">${['chat','image','music','compass'].map(g=>gtile(g)).join('')}</div>`;
  const dots=`<div class="pdots"><span style="background:${ink}"></span><span style="background:${ink};opacity:.4"></span><span style="background:${ink};opacity:.4"></span></div>`;
  return h+dots+dock+'</div>';
}
function screenLock(){
  return `<div class="screen"><div class="wall" style="background-image:url(${T.wall})"></div><div class="scrim-top" style="opacity:${T.wallDark?1:.6}"></div>
  <div class="lockdate">Saturday 8 November</div><div class="lockclock">9:41</div><div class="homebar"></div></div>`;
}
document.getElementById('root').innerHTML = (location.hash==='#lock'?screenLock():screenHome());
})();
</script></body></html>"""


def lum(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def edge_colour(path):
    from PIL import Image, ImageStat
    im = Image.open(path).convert("RGB").resize((64, 64))
    strips = [im.crop((0, 0, 4, 64)), im.crop((60, 0, 64, 64))]
    m = [sum(ImageStat.Stat(s).mean[i] for s in strips) / 2 for i in range(3)]
    return "#%02x%02x%02x" % tuple(int(v) for v in m)


def wall_is_dark(path):
    from PIL import Image, ImageStat
    im = Image.open(path).convert("L").resize((60, 130))
    top = im.crop((0, 0, 60, 70))  # where icons and status bar sit
    return ImageStat.Stat(top).mean[0] < 128


catalogue = (STORE / "catalogue.js").read_text()
glaze_data = catalogue[catalogue.index("=") + 1:].strip().rstrip(";")
art_js = (STORE / "art.js").read_text()

with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=3)
    pg.on("pageerror", lambda e: print("PAGE ERROR", e))
    pg.on("console", lambda m: print("CONSOLE", m.text) if m.type == "error" else None)
    for tid in themes:
        d = art_dir / tid
        m = json.loads((d / "manifest.json").read_text())
        pal = m["palette"]
        wall = d / "wallpaper.webp"
        order = [w["image"] for w in m.get("widgets", []) if w.get("kind") == "art"]
        files = [d / ("w-" + f) for f in order if (d / ("w-" + f)).exists()] or sorted(d.glob("w-*"))
        t = {"id": tid, "name": m["name"],
             "palette": {"bg": pal["bg"], "surface": pal["tile"], "accent": pal["tile"], "ink": pal["text"], "glyph": pal["glyph"]},
             "widget": {"style": "solid", "font": "body", "accent": pal["accent"]}, "categories": [], "displayFont": "rounded", "plus": False,
             "wall": data_uri(wall), "wallDark": wall_is_dark(wall), "widgets": [blended_uri(f) for f in files[:3]], "wmEdge": edge_colour(files[2] if len(files) > 2 else files[0])}
        html = PAGE % (css, glaze_data, art_js, json.dumps(t))
        for kind in ("home", "lock"):
            pg.set_content(html.replace("location.hash==='#lock'", "true" if kind == "lock" else "false"))
            pg.wait_for_timeout(150)
            pg.screenshot(path=str(out / f"{tid}-{kind}.png"))
        print(tid)
    b.close()
