"""Render Pinterest pins (1000x1500 JPEG) for any App Factory app.

Usage: python3 -I marketing/pins/render_pins.py <app-slug> <plan.json> <out_dir>
  Reads marketing/apps.json for the app's pinSource:
    svg-templates -> styles "single" (one template on taped paper) and "grid" (4/6/9 templates)
    any app       -> style "shot": one store screenshot (item "image": path relative to repo) on a pastel card
plan.json: list of {id, style, title, sub?, kicker?, templates?:[ids], image?, palette, foot?:[chips], hs?}
A "brand" chip (the app's store name) is added to the footer only when the app's nameLocked is true
and the item sets "branded": true.
"""
import json, sys, re, html, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
slug, plan_path, out = sys.argv[1], pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)
APP = next(a for a in json.loads((ROOT / "marketing" / "apps.json").read_text())["apps"] if a["slug"] == slug)
src_cfg = APP.get("pinSource", {})
tdir = ROOT / src_cfg.get("dir", "apps/%s/assets/templates" % slug)
plan = json.loads(plan_path.read_text())

PALETTES = {
    "peach": ("#F8E3D6", "#E9B79A", "#3B2A22"),
    "lilac": ("#E9E2F5", "#BFA9E3", "#2D2540"),
    "mint":  ("#DDF0E6", "#99CDB1", "#1F3A2E"),
    "sky":   ("#DDEBF7", "#9CC0E3", "#1D2E44"),
    "butter":("#F7EFCF", "#E3CC7A", "#3A321A"),
    "rose":  ("#F7DDE3", "#E3A2B3", "#3F2229"),
    "ink":   ("#1F2633", "#3A4A66", "#F4F1EA"),
}

def svg_inner(tid, stroke):
    s = (tdir / f"{tid}.svg").read_text()
    s = re.sub(r"<title>.*?</title>", "", s, flags=re.S)
    s = s.replace('stroke="#22201C"', f'stroke="{stroke}"')
    s = re.sub(r'width="400" height="400"', 'width="100%" height="100%"', s, count=1)
    return s

GRAIN = ("<svg class='grain' xmlns='http://www.w3.org/2000/svg' width='1000' height='1500'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .07 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(#n)'/></svg>")

BASE_CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{width:1000px;height:1500px;overflow:hidden;font-family:Inter,sans-serif}
.pin{position:relative;width:1000px;height:1500px;background:var(--bg);color:var(--ink);display:flex;flex-direction:column;align-items:center}
.grain{position:absolute;inset:0;pointer-events:none}
.kicker{font:600 30px/1 Inter;letter-spacing:.14em;text-transform:uppercase;opacity:.7;margin-top:84px}
h1{font-family:Lora,Georgia,serif;font-weight:700;font-size:var(--hs,84px);line-height:1.05;text-align:center;max-width:860px;margin-top:22px;text-wrap:balance}
.sub{font:500 34px/1.3 Inter;opacity:.75;margin-top:18px;text-align:center;max-width:820px}
.paper{position:relative;background:#FFFEFB;border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.14),0 2px 6px rgba(0,0,0,.08);transform:rotate(-1.6deg)}
.tape{position:absolute;width:150px;height:46px;background:var(--accent);opacity:.65;top:-20px}
.tape.l{left:40px;transform:rotate(-8deg)} .tape.r{right:40px;transform:rotate(7deg)}
.foot{position:absolute;bottom:64px;font:600 32px/1 Inter;display:flex;gap:16px;align-items:center}
.chip{background:var(--chip);border-radius:99px;padding:14px 26px}
.grid{display:grid;gap:26px}
.cell{background:#FFFEFB;border-radius:18px;box-shadow:0 8px 24px rgba(0,0,0,.10);padding:22px}
.pencil{position:absolute;width:420px;height:28px;right:-60px;bottom:120px;transform:rotate(-38deg);border-radius:4px;
 background:linear-gradient(90deg,#2b2b2b 0 22px,#f2c9a0 22px 70px,#F2B83B 70px 92%,#e88f9a 92%)}
"""

def page(item):
    bg, accent, ink = PALETTES[item.get("palette", "peach")]
    chip = "rgba(255,255,255,.65)" if item.get("palette") != "ink" else "rgba(255,255,255,.12)"
    stroke = "#22201C"
    t = item.get("templates", [])
    style = item["style"]
    hs = item.get("hs", 84 if len(item["title"]) < 34 else 70)
    head = f"<div class='kicker'>{html.escape(item.get('kicker','Draw this'))}</div><h1>{html.escape(item['title'])}</h1>"
    if item.get("sub"):
        head += f"<div class='sub'>{html.escape(item['sub'])}</div>"
    if style == "shot":
        import base64
        data = base64.b64encode((ROOT / item["image"]).read_bytes()).decode()
        body = (f"<div style='flex:1;display:flex;align-items:center;padding-bottom:130px'>"
                f"<img src='data:image/jpeg;base64,{data}' style='height:1020px;border-radius:36px;box-shadow:0 18px 50px rgba(0,0,0,.18)'></div>")
    elif style == "single":
        body = (f"<div class='paper' style='width:820px;height:820px;margin-top:56px;padding:60px'>"
                f"<div class='tape l'></div><div class='tape r'></div>{svg_inner(t[0], stroke)}</div><div class='pencil'></div>")
    else:
        n = len(t); cols = 2 if n in (4, 6) else 3
        size = 420 if cols == 2 else 280
        if n == 6: size = 330
        cells = "".join(f"<div class='cell' style='width:{size}px;height:{size}px'>{svg_inner(x, stroke)}</div>" for x in t)
        body = (f"<div style='flex:1;display:flex;align-items:center;padding-bottom:130px'>"
                f"<div class='grid' style='grid-template-columns:repeat({cols},{size}px)'>{cells}</div></div>")
    foot_items = list(item.get("foot", ["Save to trace later"]))
    if item.get("branded") and APP.get("nameLocked"):
        foot_items.append(APP.get("storeName") or APP["name"])
    foot = "<div class='foot'>" + "".join(f"<span class='chip'>{html.escape(f)}</span>" for f in foot_items) + "</div>"
    return (f"<!doctype html><html><head><meta charset='utf-8'><style>{BASE_CSS}</style></head><body>"
            f"<div class='pin' style='--bg:{bg};--accent:{accent};--ink:{ink};--chip:{chip};--hs:{hs}px'>"
            f"{GRAIN}{head}{body}{foot}</div></body></html>")

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1000, "height": 1500})
    for item in plan:
        pg.set_content(page(item))
        pg.screenshot(path=str(out / f"{item['id']}.jpg"), type="jpeg", quality=88)
    b.close()
print("rendered", len(plan))
