#!/usr/bin/env python3
"""App Store In-App Event image (1920x1080) for Linework's "Trace your own Christmas cards" event.

  python -I marketing/linework/events/make_event_image.py

A Christmas card on a table, its tree traced in pencil from Linework's real "Starry Christmas tree" template
(apps/linework/assets/templates/kids-christmas-tree.svg), a finished holly-wreath card behind it
(bot-holly-wreath.svg), and the phone showing Linework's real trace screen (store art 01-trace) with that
same template in place of the rose. No words in the image: the App Store lays the event name over the bottom,
so the key art sits in the top two thirds. Jared, 21 Nov 2026: the first version "doesn't really look like a
Christmas card".
"""
import base64, io, pathlib, re
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[3]
T = ROOT / "apps/linework/assets/templates"
out = pathlib.Path(__file__).parent / "xmas-2026-event-1920x1080.jpg"


def inner(name, stroke, width=None):
    s = (T / name).read_text(encoding="utf-8")
    g = s[s.index("<g"): s.rindex("</g>") + 4]
    g = re.sub(r'stroke="#[0-9A-Fa-f]{6}"', f'stroke="{stroke}"', g)
    if width:
        g = re.sub(r'stroke-width="[0-9.]+"', f'stroke-width="{width}"', g)
    return g


# phone: the real trace screen, rose covered by the paper colour, tree template drawn in the app's line blue
shot = Image.open(ROOT / "apps/linework/store/jpg/a/01-trace.jpg").convert("RGB").crop((158, 598, 1162, 2770))  # just the phone, without the store card around it
buf = io.BytesIO(); shot.save(buf, "JPEG", quality=92)
phone_uri = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

tree_pencil = inner("kids-christmas-tree.svg", "#4A4641", 3.2)
tree_blue = inner("kids-christmas-tree.svg", "#3A55A6", 4.5)
wreath = inner("bot-holly-wreath.svg", "#4A4641", 2.6)

HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;width:1920px;height:1080px;overflow:hidden}}
.scene{{position:relative;width:1920px;height:1080px;
  background:radial-gradient(900px 620px at 50% 30%,#3f6b4f 0%,#24493a 45%,#173328 100%)}}
.bokeh{{position:absolute;border-radius:50%;filter:blur(6px)}}
.table{{position:absolute;left:0;right:0;bottom:0;height:430px;
  background:linear-gradient(180deg,#7b2a2c,#5e1d20);box-shadow:inset 0 18px 40px rgba(0,0,0,.35)}}
.card{{position:absolute;background:#fbf6ec;border-radius:10px;
  box-shadow:0 30px 60px rgba(0,0,0,.38),0 4px 10px rgba(0,0,0,.2)}}
.card:before{{content:"";position:absolute;inset:18px;border:3px solid #b8312f;border-radius:6px}}
.card svg{{position:absolute;inset:34px}}
.phone{{position:absolute;width:420px;border-radius:64px;box-shadow:0 40px 80px rgba(0,0,0,.45)}}
.screen{{position:absolute;overflow:hidden;border-radius:58px}}
.pencil{{position:absolute;width:420px;height:26px;border-radius:13px;
  background:linear-gradient(90deg,#e7a6a0 0 34px,#c9c3bb 34px 52px,#f2b83b 52px 86%,#f3d7b0 86%);
  box-shadow:0 10px 18px rgba(0,0,0,.35)}}
.pencil:after{{content:"";position:absolute;right:-26px;top:0;border-left:30px solid #f3d7b0;
  border-top:13px solid transparent;border-bottom:13px solid transparent}}
.pencil:before{{content:"";position:absolute;right:-30px;top:9px;border-left:10px solid #3b3833;
  border-top:4px solid transparent;border-bottom:4px solid transparent;z-index:2}}
</style></head><body><div class="scene">
<div id="bokeh"></div>
<div class="table"></div>

<!-- finished holly wreath card, behind -->
<div class="card" style="left:300px;top:150px;width:420px;height:560px;transform:rotate(-9deg)">
  <svg viewBox="0 0 400 400" width="352" height="492" preserveAspectRatio="xMidYMid meet">
    {wreath}
  </svg>
</div>

<!-- the card being traced, front -->
<div class="card" style="left:600px;top:120px;width:470px;height:630px;transform:rotate(4deg)">
  <svg viewBox="0 0 400 400" width="402" height="562" preserveAspectRatio="xMidYMid meet">
    {tree_pencil}
  </svg>
</div>
<div class="pencil" style="left:760px;top:640px;transform:rotate(-28deg)"></div>

<!-- phone with Linework's trace screen -->
<div style="position:absolute;left:1230px;top:70px;transform:rotate(6deg)">
  <img class="phone" src="{phone_uri}" style="position:relative;display:block">
  <div style="position:absolute;left:52px;top:200px;width:300px;height:450px;background:#f6f1e8;transform:rotate(-2deg)"></div>
  <svg viewBox="0 0 400 400" style="position:absolute;left:48px;top:240px;width:290px;height:380px">{tree_blue}</svg>
  </div>
</div>
<script>
const b=document.getElementById('bokeh');let s=11;const r=()=>{{s=(s*9301+49297)%233280;return s/233280}};
const cols=['rgba(255,214,140,.55)','rgba(255,190,120,.45)','rgba(255,240,200,.5)','rgba(220,80,70,.35)'];
for(let i=0;i<46;i++){{const d=8+r()*34;const e=document.createElement('div');e.className='bokeh';
e.style.cssText+=`left:${{r()*1920}}px;top:${{r()*640}}px;width:${{d}}px;height:${{d}}px;background:${{cols[i%4]}}`;b.appendChild(e);}}
</script></body></html>"""

with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_page(viewport={"width": 1920, "height": 1080})
    pg.set_content(HTML)
    pg.wait_for_timeout(300)
    png = pg.screenshot()
    br.close()
Image.open(io.BytesIO(png)).convert("RGB").save(out, quality=92)
print(out)
