#!/usr/bin/env python3
"""Build launch pages for every app at stage launching/live from marketing/apps.json.

Writes docs/<slug>/index.html (+ img/), and docs/index.html listing the apps. Served by GitHub Pages
(main branch, /docs) at https://merlinwerlin.github.io/App-Projects/<slug>/.
Privacy and support pages already live in docs/<slug>/ (copied from apps/<slug>/docs/ when missing).

  python3 marketing/site/build.py
"""
import html, json, pathlib, shutil
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
REG = json.loads((ROOT / "marketing" / "apps.json").read_text())
DOCS = ROOT / "docs"
E = html.escape


def img(src, dst, width):
    im = Image.open(src)
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    if dst.suffix == ".jpg":
        im.convert("RGB").save(dst, quality=82, optimize=True, progressive=True)
    else:
        im.save(dst, optimize=True)


def store_button(a):
    if a.get("appStoreUrl"):
        return f'<a class="cta" href="{E(a["appStoreUrl"])}">Download on the App Store</a>'
    if a.get("testflightUrl"):
        return f'<a class="cta" href="{E(a["testflightUrl"])}">Join the free beta on TestFlight</a><span class="soon">App Store release soon</span>'
    return '<span class="cta off">Coming soon to the App Store</span>'


CSS = """
:root{--paper:%(paper)s;--ink:#1C1E22;--muted:#5A5F68;--accent:%(accent)s;--line:#DDD6CC;--card:#FFFDF9;
--display:"Fraunces",Georgia,serif;--text:"Atkinson Hyperlegible",system-ui,sans-serif}
@media (prefers-color-scheme:dark){:root{--paper:#15171B;--ink:#ECEAE6;--muted:#A3A7AF;--line:#2C3037;--card:#1C1F24;--accent:#9DB3FF}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%%}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.55 var(--text)}
.w{max-width:1040px;margin:0 auto;padding:0 max(18px,env(safe-area-inset-left))}
header{padding:56px 0 24px;display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:center}
header img{width:88px;height:88px;border-radius:20px;box-shadow:0 6px 18px rgba(0,0,0,.12)}
h1{font:700 clamp(34px,6vw,58px)/1.02 var(--display);margin:0;letter-spacing:-.01em;text-wrap:balance}
.sub{font:500 clamp(19px,2.6vw,24px)/1.3 var(--display);color:var(--muted);margin:6px 0 0}
.hero p{max-width:62ch;margin:0}
.ctas{display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center;margin:22px 0 8px}
.cta{display:inline-block;background:var(--accent);color:#fff;font-weight:700;text-decoration:none;border-radius:12px;padding:14px 22px}
.cta.off{background:var(--line);color:var(--muted)}
.soon,.price{color:var(--muted);font-size:15px}
.shots{display:flex;gap:14px;overflow-x:auto;padding:26px 0 18px;scroll-snap-type:x mandatory}
.shots img{height:min(560px,70vh);width:auto;border-radius:18px;scroll-snap-align:start;box-shadow:0 8px 24px rgba(0,0,0,.10)}
h2{font:700 clamp(24px,3.4vw,32px)/1.15 var(--display);margin:46px 0 16px;text-wrap:balance}
.lead{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}
.lead div{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}
.lead h3{margin:0 0 6px;font-size:18px}.lead p{margin:0;color:var(--muted)}
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:var(--card)}
table{border-collapse:collapse;width:100%%;min-width:560px}th,td{text-align:left;padding:12px 14px;border-top:1px solid var(--line);vertical-align:top}
tr:first-child th{border-top:0}th{font-size:14px;color:var(--muted);font-weight:700}td.us{font-weight:700}
details{border-top:1px solid var(--line);padding:14px 0}details:last-child{border-bottom:1px solid var(--line)}
summary{font-weight:700;cursor:pointer}details p{margin:8px 0 0;max-width:68ch;color:var(--muted)}
footer{margin:56px 0 40px;color:var(--muted);font-size:15px;display:flex;flex-wrap:wrap;gap:8px 20px}
a{color:var(--accent)}
"""


def page(a):
    slug = a["slug"]
    out = DOCS / slug
    (out / "img").mkdir(parents=True, exist_ok=True)
    for f in ("privacy.html", "support.html"):
        src = ROOT / "apps" / slug / "docs" / f
        if not (out / f).exists() and src.exists():
            shutil.copy(src, out / f)
    img(ROOT / a["icon"], out / "img" / "icon.png", 256)
    shots = []
    sd = ROOT / a.get("screenshots", "")
    if a.get("screenshots") and sd.is_dir():
        for p in sorted(sd.glob("*.jpg")):
            img(p, out / "img" / p.name, 600)
            shots.append(p.name)
    base = REG["site"].rstrip("/") + f"/{slug}/"
    ld = {"@context": "https://schema.org", "@type": "MobileApplication", "name": a["storeName"] or a["name"],
          "operatingSystem": "iOS", "applicationCategory": "DesignApplication", "description": a["tagline"],
          "offers": {"@type": "Offer", "price": "0", "priceCurrency": "AUD"}, "url": base}
    if a.get("appStoreUrl"):
        ld["installUrl"] = a["appStoreUrl"]
    faq_ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": ans}} for q, ans in a.get("faq", [])]}
    c = a.get("compare")
    compare = ""
    if c:
        rows = "".join(f"<tr><td>{E(r[0])}</td><td class=us>{E(r[1])}</td><td>{E(r[2])}</td></tr>" for r in c["rows"])
        compare = (f"<h2>How {E(a['name'])} compares</h2><div class=tbl><table><tr><th></th><th>{E(a['name'])}</th>"
                   f"<th>{E(c['them'])}</th></tr>{rows}</table></div>")
    lead = "".join(f"<div><h3>{E(x['title'])}</h3><p>{E(x['body'])}</p></div>" for x in a.get("lead", []))
    faq = "".join(f"<details><summary>{E(q)}</summary><p>{E(ans)}</p></details>" for q, ans in a.get("faq", []))
    shots_html = "".join(f'<img src="img/{s}" alt="{E(a["name"])} screenshot {i+1}" loading="lazy" width="600">' for i, s in enumerate(shots))
    title = f"{a['storeName'] or a['name']}"
    desc = f"{a['tagline']}. {a.get('price','')}".strip()
    doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{E(title)}</title><meta name="description" content="{E(desc)}">
<link rel="canonical" href="{base}">
<meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}">
<meta property="og:image" content="{base}img/{shots[0] if shots else 'icon.png'}"><meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="img/icon.png">
{'<meta name="apple-itunes-app" content="app-id=' + a['ascAppId'] + '">' if a.get('appStoreUrl') else ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Atkinson+Hyperlegible:wght@400;700&display=swap">
<style>{CSS % {"paper": a.get("paper", "#F7F3EE"), "accent": a.get("accent", "#2346A8")}}</style>
<script type="application/ld+json">{json.dumps(ld)}</script>
<script type="application/ld+json">{json.dumps(faq_ld)}</script>
</head><body><main class=w>
<header><img src="img/icon.png" alt="" width="88" height="88"><div><h1>{E(a['name'])}</h1><p class=sub>{E(a['tagline'])}</p></div></header>
<section class=hero><div class=ctas>{store_button(a)}</div><p class=price>{E(a.get('price',''))}</p></section>
<div class=shots>{shots_html}</div>
<h2>Why people switch to {E(a['name'])}</h2><div class=lead>{lead}</div>
{compare}
<h2>Questions</h2>{faq}
<footer><span>{E(title)}</span><a href="support.html">Support</a><a href="privacy.html">Privacy</a><a href="../">More apps</a></footer>
</main></body></html>"""
    (out / "index.html").write_text(doc)
    return slug


def index(built):
    items = "".join(f'<li><a href="{s}/">{E(next(a for a in REG["apps"] if a["slug"]==s)["name"])}</a></li>' for s in built)
    (DOCS / "index.html").write_text(f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Apps by Jared Bradley</title><style>body{{font:18px/1.5 system-ui,sans-serif;max-width:640px;margin:60px auto;padding:0 18px}}</style></head>
<body><h1>Apps</h1><ul>{items}</ul></body></html>""")
    (DOCS / ".nojekyll").write_text("")


if __name__ == "__main__":
    built = [page(a) for a in REG["apps"] if a.get("stage") in ("launching", "live")]
    index(built)
    print("built", built)
