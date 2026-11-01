#!/usr/bin/env python3
"""Download the real Glaze theme art (wallpaper + widget art + manifest) for the kit's themes.

  python3 -I marketing/glaze/kit/fetch.py <art_dir>

Reads the theme ids from kit.json (hero, trios, carousels, reels) and pulls each theme's files from the
public glaze-packs-v1 release (the same files the app downloads). Then run screens.py and compose.py.
"""
import concurrent.futures as cf, json, pathlib, subprocess, sys

BASE = "https://github.com/MerlinWerlin/App-Projects/releases/download/glaze-packs-v1/"
kit = json.loads((pathlib.Path(__file__).parent / "kit.json").read_text())
ids = set(kit["hero"])
for t in kit["trios"] + list(kit["carousels"].values()) + kit["reels"]:
    ids |= set(t["themes"])
out = pathlib.Path(sys.argv[1])


def curl(url, dest):
    subprocess.run(["curl", "-fsSL", "-o", str(dest), url], check=True)


cat_path = out / "catalog.json"
out.mkdir(parents=True, exist_ok=True)
curl(BASE + "catalog.json", cat_path)
cat = {p["id"]: p for p in json.loads(cat_path.read_text())["packs"]}
jobs = []
for i in sorted(ids):
    if i not in cat:
        print("not in catalogue:", i)
        continue
    d = out / i
    d.mkdir(exist_ok=True)
    curl(BASE + cat[i]["manifest"].replace("/", "__"), d / "manifest.json")
    m = json.loads((d / "manifest.json").read_text())
    pre = f"art__{i}__v{m['packVersion']}__"
    for a in m["assets"]:
        if a["role"] == "wallpaper" and a["width"] == 1290:
            jobs.append((BASE + pre + a["path"], d / "wallpaper.webp"))
        if a["role"] == "widget-art":
            jobs.append((BASE + pre + a["path"], d / ("w-" + a["path"])))
with cf.ThreadPoolExecutor(12) as ex:
    list(ex.map(lambda j: curl(*j), jobs))
print(len(ids), "themes,", len(jobs), "files")
