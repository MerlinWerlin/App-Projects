#!/usr/bin/env python3
"""Tell Bing, Yandex and other IndexNow engines that the site's pages changed (Bing's index feeds ChatGPT search and Copilot).

Run after GitHub Pages has deployed a build:  python3 marketing/site/indexnow.py
Sends every URL in docs/sitemap.xml. The key file docs/9f4b95c1e974deb4a880fa3b08853ffd.txt proves we own the /App-Projects/ path,
which is why keyLocation sits there and every URL is under it. No account needed.
"""
import json, pathlib, re, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
KEY = "9f4b95c1e974deb4a880fa3b08853ffd"
SITE = "https://merlinwerlin.github.io/App-Projects/"
urls = re.findall(r"<loc>([^<]+)</loc>", (ROOT / "docs" / "sitemap.xml").read_text(encoding="utf-8"))
body = json.dumps({"host": "merlinwerlin.github.io", "key": KEY, "keyLocation": f"{SITE}{KEY}.txt", "urlList": urls}).encode()
req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body, headers={"Content-Type": "application/json; charset=utf-8"})
with urllib.request.urlopen(req, timeout=30) as r:
    print("IndexNow", r.status, len(urls), "URLs")
