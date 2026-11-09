#!/usr/bin/env python3
"""Build the launch site from marketing/apps.json + marketing/site/answers.json.

For every app at stage launching/live it writes, under docs/<slug>/ (served by GitHub Pages at
https://merlinwerlin.github.io/App-Projects/<slug>/):

  index.html          product page: store buttons, screenshots, lead points, comparison, FAQ
  compare/index.html  "<App> compared with typical <category> apps" table + how we checked
  alternatives/       "Alternatives to <category>": the kinds of options, generically, and where the app fits
  faq/index.html      every question, with FAQPage structured data
  facts.txt           plain-text facts (price, platforms, what's free, privacy) for people and AI crawlers
  llms.txt            short index of the above for language-model crawlers

and at the site root: index.html (app list), llms.txt, sitemap.xml, robots.txt, .nojekyll.

Every claim lives in answers.json and must be backed by the live store listing or the app's code.
No "best", "only" or "#1"; follow each app's `avoid` list in apps.json.

  python3 marketing/site/build.py
"""
import datetime, html, json, pathlib, shutil
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
REG = json.loads((ROOT / "marketing" / "apps.json").read_text(encoding="utf-8"))
ANS = json.loads((ROOT / "marketing" / "site" / "answers.json").read_text(encoding="utf-8"))
DOCS = ROOT / "docs"
SITE = REG["site"].rstrip("/") + "/"
E = html.escape
PUBLISHER = ANS["publisher"]


def img(src, dst, width):
    im = Image.open(src)
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    if dst.suffix == ".jpg":
        im.convert("RGB").save(dst, quality=82, optimize=True, progressive=True)
    else:
        im.save(dst, optimize=True)


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def stores(a):
    """Live store links, in the order people expect."""
    out = []
    if a.get("appStoreUrl"):
        out.append(("App Store", "iOS", a["appStoreUrl"]))
    if a.get("playUrl"):
        out.append(("Google Play", "Android", a["playUrl"]))
    return out


def store_buttons(a):
    s = stores(a)
    if s:
        return "".join(f'<a class="cta" href="{E(u)}" rel="noopener">Get it on {E(n)}</a>' for n, _, u in s)
    if a.get("testflightUrl"):
        return f'<a class="cta" href="{E(a["testflightUrl"])}">Join the free beta on TestFlight</a>'
    return '<span class="cta off">Coming soon</span>'


CSS = """
:root{--paper:#F7F3EE;--ink:#1C1E22;--muted:#5A5F68;--accent:%(accent)s;--line:#DDD6CC;--card:#FFFDF9;
--display:"Fraunces",Georgia,serif;--text:"Atkinson Hyperlegible",system-ui,sans-serif}
@media (prefers-color-scheme:dark){:root{--paper:#15171B;--ink:#ECEAE6;--muted:#A3A7AF;--line:#2C3037;--card:#1C1F24;--accent:%(accentDark)s}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%%}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.55 var(--text)}
.w{max-width:1040px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-left))}
nav.top{display:flex;flex-wrap:wrap;gap:6px 16px;padding:18px 0 0;font-size:15px}
nav.top a{color:var(--muted);text-decoration:none}nav.top a[aria-current]{color:var(--ink);font-weight:700}
header{padding:34px 0 18px;display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:center}
header img{width:80px;height:80px;border-radius:18px;box-shadow:0 6px 18px rgba(0,0,0,.12)}
h1{font:700 clamp(30px,5.4vw,52px)/1.05 var(--display);margin:0;letter-spacing:-.01em;text-wrap:balance}
.sub{font:500 clamp(18px,2.4vw,22px)/1.3 var(--display);color:var(--muted);margin:6px 0 0}
.lede{max-width:68ch}
.ctas{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:20px 0 8px}
.cta{display:inline-block;background:var(--accent);color:#fff;font-weight:700;text-decoration:none;border-radius:12px;padding:13px 20px}
.cta.off{background:var(--line);color:var(--muted)}
.muted,.price{color:var(--muted);font-size:15px}
.shots{display:flex;gap:14px;overflow-x:auto;padding:22px 0 14px;scroll-snap-type:x mandatory}
.shots img{height:min(540px,68vh);width:auto;border-radius:18px;scroll-snap-align:start;box-shadow:0 8px 24px rgba(0,0,0,.10)}
h2{font:700 clamp(23px,3.2vw,30px)/1.15 var(--display);margin:44px 0 14px;text-wrap:balance}
h3{font-size:18px;margin:22px 0 6px}
.lead{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
.lead div{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}
.lead h3{margin:0 0 6px}.lead p{margin:0;color:var(--muted)}
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:var(--card)}
table{border-collapse:collapse;width:100%%;min-width:560px}th,td{text-align:left;padding:12px 14px;border-top:1px solid var(--line);vertical-align:top}
thead th{border-top:0;font-size:14px;color:var(--muted)}tbody th{font-weight:700}td.us{font-weight:700}
details{border-top:1px solid var(--line);padding:14px 0}details:last-of-type{border-bottom:1px solid var(--line)}
summary{font-weight:700;cursor:pointer}details p{margin:8px 0 0;max-width:70ch;color:var(--muted)}
.qa h3{margin-top:28px}.qa p{max-width:70ch;margin:6px 0 0}
ul.kinds{padding-left:1.1em}ul.kinds li{margin:10px 0;max-width:72ch}
.facts{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:6px 18px}
.facts dt{font-weight:700;margin-top:12px}.facts dd{margin:2px 0 12px;color:var(--muted)}
.more{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:10px}
.more a{display:block;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;text-decoration:none;color:var(--ink)}
.more a span{display:block;color:var(--muted);font-size:14px}
footer{margin:56px 0 40px;color:var(--muted);font-size:15px;display:flex;flex-wrap:wrap;gap:8px 20px}
a{color:var(--accent)}
@media (max-width:600px){table{min-width:0;font-size:15px}th,td{padding:10px 8px}}
"""

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700'
         '&family=Atkinson+Hyperlegible:wght@400;700&display=swap">')

SECTIONS = [("", "Overview"), ("compare/", "Compare"), ("alternatives/", "Alternatives"), ("faq/", "FAQ"), ("facts.txt", "Facts")]


def doc(a, x, sub, title, desc, body, lds, og_image):
    """One HTML page. sub is the path below docs/<slug>/ ('' for the product page)."""
    slug = a["slug"]
    url = f"{SITE}{slug}/{sub}"
    up = "../" if sub else ""
    nav = "".join(f'<a href="{up}{p}"{" aria-current=page" if p == sub else ""}>{E(n)}</a>' for p, n in SECTIONS)
    ld = "".join(f'<script type="application/ld+json">{json.dumps(o, ensure_ascii=False)}</script>' for o in lds)
    smart = f'<meta name="apple-itunes-app" content="app-id={a["ascAppId"]}">' if a.get("appStoreUrl") and a.get("ascAppId") else ""
    css = CSS % {"accent": a.get("accent", "#2346A8"), "accentDark": x.get("accentDark", "#9DB3FF")}
    foot = "".join(f'<a href="{E(u)}" rel="noopener">{E(a["name"])} on {E(n)}</a>' for n, _, u in stores(a))
    legal = "".join(f'<a href="{up}{E(h)}">{E(n)}</a>' for n, h in x.get("legal", [["Support", "support.html"], ["Privacy", "privacy.html"]]))
    ideas = f'<a href="{up}ideas/">Free drawings to trace</a>' if (DOCS / slug / "ideas" / "index.html").exists() else ""
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{E(title)}</title><meta name="description" content="{E(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{og_image}"><meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{up}img/icon.png">
<link rel="alternate" type="text/plain" href="{SITE}{slug}/facts.txt" title="{E(a['name'])} facts">
{smart}
{FONTS}
<style>{css}</style>
{ld}
</head><body><main class=w>
<nav class=top aria-label="{E(a['name'])} pages">{nav}<a href="{up}../">More apps</a></nav>
{body}
<footer><span>{E(a['storeName'] or a['name'])} by {E(PUBLISHER['name'])}</span>{foot}{legal}{ideas}<a href="{up}../">More apps</a></footer>
</main></body></html>
"""


def app_ld(a, x, base, shots):
    s = stores(a)
    o = {"@context": "https://schema.org", "@type": ["MobileApplication", "SoftwareApplication"],
         "@id": base + "#app", "name": a["storeName"] or a["name"], "alternateName": a["name"],
         "description": x["oneLine"], "url": base,
         "operatingSystem": ", ".join(p for _, p, _ in s) or x.get("os", "iOS"),
         "applicationCategory": x["schemaCategory"], "applicationSubCategory": x["category"],
         "image": base + "img/icon.png",
         "publisher": {"@type": "Organization", "name": PUBLISHER["name"], "url": SITE},
         "isAccessibleForFree": True,
         "featureList": x["free"] + x["plus"]["features"],
         "offers": [{"@type": "Offer", "name": "Download", "price": "0", "priceCurrency": "AUD", "category": "free"},
                    {"@type": "Offer", "name": x["plus"]["name"] + " (one-time in-app purchase)",
                     "price": x["plus"]["priceAUD"], "priceCurrency": "AUD"}],
         "sameAs": [u for _, _, u in s]}
    if s:
        o["installUrl"] = s[0][2]
        o["downloadUrl"] = [u for _, _, u in s]
    if shots:
        o["screenshot"] = [base + "img/" + p for p in shots]
    if x.get("languages"):
        o["inLanguage"] = x["languages"]
    return o


def faq_ld(url, qs):
    return {"@context": "https://schema.org", "@type": "FAQPage", "url": url, "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": ans}} for q, ans in qs]}


def crumbs(a, base, name, sub):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Apps", "item": SITE},
        {"@type": "ListItem", "position": 2, "name": a["name"], "item": base},
        {"@type": "ListItem", "position": 3, "name": name, "item": base + sub}]}


def table(a, x):
    c = x["compare"]
    rows = "".join(f"<tr><th scope=row>{E(r[0])}</th><td class=us>{E(r[1])}</td><td>{E(r[2])}</td></tr>" for r in c["rows"])
    return (f"<div class=tbl><table><thead><tr><th></th><th scope=col>{E(a['name'])}</th>"
            f"<th scope=col>{E(c['them'])}</th></tr></thead><tbody>{rows}</tbody></table></div>")


def more_links(x, here):
    items = [("compare/", f"How it compares", f"{x['compare']['title']}"),
             ("alternatives/", "Alternatives", x["alternatives"]["title"]),
             ("faq/", "Questions", f"{len(x['faq'])} answers"),
             ("facts.txt", "Plain-text facts", "Price, platforms, what's free, privacy")]
    up = "../" if here else ""
    return "<div class=more>" + "".join(
        f'<a href="{up}{p}">{E(t)}<span>{E(s)}</span></a>' for p, t, s in items if p != here) + "</div>"


def header(a, h1, sub):
    up = "../" if sub else ""
    return (f'<header><img src="{up}img/icon.png" alt="{E(a["name"])} app icon" width="80" height="80">'
            f'<div><h1>{E(h1)}</h1><p class=sub>{E(a["storeName"] or a["name"])}</p></div></header>')


def platforms_line(a, x):
    s = stores(a)
    names = " and ".join(f"{n} ({p})" for n, p, _ in s)
    return f"Available on {names}. {x.get('platformNote', '')}".strip()


def build_app(a):
    slug = a["slug"]
    x = ANS["apps"][slug]
    out = DOCS / slug
    base = f"{SITE}{slug}/"
    (out / "img").mkdir(parents=True, exist_ok=True)
    for f in ("privacy.html", "support.html"):
        src = ROOT / "apps" / slug / "docs" / f
        if not (out / f).exists() and src.exists():
            shutil.copy(src, out / f)
    icon = a.get("icon") or x.get("icon")
    if icon:
        img(ROOT / icon, out / "img" / "icon.png", 256)
    shots = []
    for p in x.get("screenshots", []):
        src = ROOT / p
        name = src.stem + ".jpg"
        img(src, out / "img" / name, 600)
        shots.append(name)
    og = base + "img/" + (shots[0] if shots else "icon.png")
    checked = ANS["checked"]
    app = app_ld(a, x, base, shots)

    # Product page
    lead = "".join(f"<div><h3>{E(t)}</h3><p>{E(b)}</p></div>" for t, b in x["lead"])
    faq_short = "".join(f"<details><summary>{E(q)}</summary><p>{E(ans)}</p></details>" for q, ans in x["faq"][:6])
    shots_html = "".join(f'<img src="img/{s}" alt="{E(a["name"])} screenshot {i+1}" loading="lazy" width="600">' for i, s in enumerate(shots))
    body = f"""{header(a, a['name'] + ': ' + x['h1'], '')}
<p class=lede>{E(x['oneLine'])}</p>
<div class=ctas>{store_buttons(a)}</div>
<p class=price>{E(x['priceLine'])} {E(platforms_line(a, x))}</p>
<div class=shots>{shots_html}</div>
<h2>Why people pick {E(a['name'])}</h2><div class=lead>{lead}</div>
<h2>{E(x['compare']['title'])}</h2>{table(a, x)}
<p class=muted>Checked against public store listings on {E(checked)}. <a href="compare/">How we compared</a>.</p>
<h2>Questions</h2>{faq_short}
<p><a href="faq/">All {len(x['faq'])} questions</a></p>
<h2>More about {E(a['name'])}</h2>{more_links(x, '')}"""
    write(out / "index.html", doc(a, x, "", f"{a['storeName'] or a['name']}: {x['titleTail']}", x["metaDesc"], body,
                                  [app, faq_ld(base, x["faq"][:6])], og))

    # Compare page
    c = x["compare"]
    named = ""
    if c.get("named"):
        rows = "".join(f"<tr><th scope=row>{E(n['name'])}</th><td>{E(n['model'])}</td><td><a href=\"{E(n['source'])}\" rel=nofollow>store listing</a></td></tr>"
                       for n in c["named"])
        named = (f"<h2>Apps people often name, and how they charge</h2><p>{E(c['namedIntro'])}</p>"
                 f"<div class=tbl><table><thead><tr><th scope=col>App</th><th scope=col>How it charges (as listed)</th><th scope=col>Source</th></tr></thead><tbody>{rows}</tbody></table></div>")
    method = "".join(f"<li>{E(m)}</li>" for m in c["method"])
    fit = "".join(f"<li>{E(m)}</li>" for m in c["notFor"])
    body = f"""{header(a, c['title'], 'compare/')}
<p class=lede>{E(c['intro'])}</p>
<div class=ctas>{store_buttons(a)}</div>
{table(a, x)}
{named}
<h2>How we compared</h2><ul class=kinds>{method}<li>Last checked {E(checked)}. Prices change; the store listing is always the final word.</li></ul>
<h2>When another app may suit you better</h2><ul class=kinds>{fit}</ul>
<h2>More</h2>{more_links(x, 'compare/')}"""
    write(out / "compare" / "index.html", doc(a, x, "compare/", c["title"], c["metaDesc"], body,
                                               [app, crumbs(a, base, "Compare", "compare/")], og))

    # Alternatives page
    al = x["alternatives"]
    kinds = "".join(f"<li><b>{E(k)}</b> {E(v)}</li>" for k, v in al["kinds"])
    look = "".join(f"<li>{E(m)}</li>" for m in al["lookFor"])
    body = f"""{header(a, al['title'], 'alternatives/')}
<p class=lede>{E(al['intro'])}</p>
<h2>The main kinds of alternative</h2><ul class=kinds>{kinds}</ul>
<h2>What to check before you install</h2><ul class=kinds>{look}</ul>
<h2>Where {E(a['name'])} fits</h2><p class=lede>{E(al['fit'])}</p>
<div class=ctas>{store_buttons(a)}</div>
<h2>More</h2>{more_links(x, 'alternatives/')}"""
    write(out / "alternatives" / "index.html", doc(a, x, "alternatives/", al["title"], al["metaDesc"], body,
                                                    [app, crumbs(a, base, "Alternatives", "alternatives/")], og))

    # FAQ page
    qa = "".join(f"<h3>{E(q)}</h3><p>{E(ans)}</p>" for q, ans in x["faq"])
    body = f"""{header(a, a['name'] + ' questions and answers', 'faq/')}
<div class=ctas>{store_buttons(a)}</div>
<div class=qa>{qa}</div>
<h2>More</h2>{more_links(x, 'faq/')}"""
    write(out / "faq" / "index.html", doc(a, x, "faq/", f"{a['name']} FAQ: {x['faqTitleTail']}", x["faqDesc"], body,
                                           [faq_ld(base + "faq/", x["faq"]), crumbs(a, base, "FAQ", "faq/")], og))

    # Plain-text facts
    s = stores(a)
    legal_txt = [f"{n}: {base}{h}" for n, h in x.get("legal", [["Support", "support.html"], ["Privacy policy", "privacy.html"]])]
    lines = [f"{a['storeName'] or a['name']}: facts", "=" * 40, "",
             f"What it is: {x['oneLine']}", f"Category: {x['category']}", f"Made by: {PUBLISHER['name']} ({PUBLISHER['where']})", "",
             "Where to get it:"] + [f"- {n} ({p}): {u}" for n, p, u in s] + (
             [f"- {x['platformNote']}"] if x.get("platformNote") else []) + ["",
             f"Price: {x['priceLine']}", "", "Free (no subscription):"] + [f"- {f}" for f in x["free"]] + ["",
             f"{x['plus']['name']} ({x['plus']['priceText']}, one-time, not a subscription):"] + [f"- {f}" for f in x["plus"]["features"]] + [
             "", "Trial: " + x["trial"], "", "Ads: none. Subscription: none. Account: none needed.", "",
             "Privacy:"] + [f"- {p}" for p in x["privacy"]] + ["",
             "Not claimed: " + x["notClaimed"], "",
             f"Web page: {base}", f"Comparison: {base}compare/", f"Alternatives: {base}alternatives/", f"FAQ: {base}faq/",
             *legal_txt, "",
             f"Facts checked against the live store listings on {checked}."]
    write(out / "facts.txt", "\n".join(lines) + "\n")
    write(out / "llms.txt", "\n".join([
        f"# {a['storeName'] or a['name']}", "", f"> {x['oneLine']} {x['priceLine']}", "",
        "## Pages", f"- [Facts (plain text)]({base}facts.txt): price, platforms, what's free, privacy",
        f"- [Overview]({base})", f"- [{c['title']}]({base}compare/)", f"- [{al['title']}]({base}alternatives/)",
        f"- [FAQ]({base}faq/)", "", "## Stores"] + [f"- [{n} ({p})]({u})" for n, p, u in s]) + "\n")
    pages = [base, base + "compare/", base + "alternatives/", base + "faq/"]
    if (out / "ideas" / "index.html").exists():
        pages.append(base + "ideas/")
    return slug, pages


def site(built):
    apps = {a["slug"]: a for a in REG["apps"]}
    items, ll, urls = [], [], [SITE]
    for slug, pages in built:
        a, x = apps[slug], ANS["apps"][slug]
        st = " · ".join(f'<a href="{E(u)}" rel="noopener">{E(n)}</a>' for n, _, u in stores(a))
        items.append(f'<li><a href="{slug}/"><b>{E(a["storeName"] or a["name"])}</b></a><br>{E(x["oneLine"])}<br>'
                     f'<span class=m>{E(x["priceLine"])}</span><br>{st} · <a href="{slug}/compare/">Compare</a> · <a href="{slug}/faq/">FAQ</a> · <a href="{slug}/facts.txt">Facts</a></li>')
        ll.append(f"- [{a['storeName'] or a['name']}]({SITE}{slug}/facts.txt): {x['oneLine']} {x['priceLine']}")
        urls += pages
    ld = {"@context": "https://schema.org", "@type": "ItemList", "name": f"Apps by {PUBLISHER['name']}", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "url": f"{SITE}{s}/"} for i, (s, _) in enumerate(built)]}
    other = "".join(f'<p class=m>Also: <a href="{E(h)}">{E(n)}</a></p>' for h, n in ANS.get("otherPages", []))
    write(DOCS / "index.html", f"""<!doctype html><html lang="en"><head>{ANS.get("headExtra", "")}<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Apps by {E(PUBLISHER['name'])}</title><meta name="description" content="Small phone apps with no ads and no subscriptions, by {E(PUBLISHER['name'])}.">
<link rel="canonical" href="{SITE}"><link rel="alternate" type="text/plain" href="{SITE}llms.txt">
<script type="application/ld+json">{json.dumps(ld)}</script>
<style>body{{font:18px/1.5 system-ui,sans-serif;max-width:680px;margin:56px auto;padding:0 16px;background:#F7F3EE;color:#1C1E22}}li{{margin:0 0 22px}}.m{{color:#5A5F68;font-size:15px}}a{{color:#2346A8}}
@media (prefers-color-scheme:dark){{body{{background:#15171B;color:#ECEAE6}}.m{{color:#A3A7AF}}a{{color:#9DB3FF}}}}</style></head>
<body><h1>Apps by {E(PUBLISHER['name'])}</h1><p>Small phone apps. No ads, no subscriptions, no accounts.</p><ul>{''.join(items)}</ul>{other}</body></html>
""")
    write(DOCS / "llms.txt", "\n".join([f"# Apps by {PUBLISHER['name']}", "",
        f"> Small phone apps from {PUBLISHER['where']}. No ads, no subscriptions, no accounts; optional one-time purchases. "
        "Each app has a plain-text facts file with price, platforms, what's free and privacy, checked against the live store listings.", "",
        "## Apps"] + ll + ["", "## Per-app pages"] + [f"- [{apps[s]['name']}]({SITE}{s}/llms.txt)" for s, _ in built]) + "\n")
    today = datetime.date.today().isoformat()
    write(DOCS / "sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          "".join(f"<url><loc>{E(u)}</loc><lastmod>{today}</lastmod></url>\n" for u in urls) + "</urlset>\n")
    write(DOCS / "robots.txt", f"# Everything here may be crawled and quoted, including by AI assistants.\nUser-agent: *\nAllow: /\n\nSitemap: {SITE}sitemap.xml\n")
    write(DOCS / ".nojekyll", "")


if __name__ == "__main__":
    built = [build_app(a) for a in REG["apps"] if a.get("stage") in ("launching", "live") and a["slug"] in ANS["apps"]]
    skipped = [a["slug"] for a in REG["apps"] if a.get("stage") in ("launching", "live") and a["slug"] not in ANS["apps"]]
    site(built)
    print("built", [s for s, _ in built], "skipped (no answers.json entry yet)", skipped)
