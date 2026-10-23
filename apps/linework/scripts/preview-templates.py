#!/usr/bin/env python3
"""Render template SVGs (assets/templates) to PNG so their quality can be checked by eye.

Usage:
  node scripts/export-templates.ts            # refresh the SVG files first
  python3 scripts/preview-templates.py OUT_DIR [id-prefix ...]

Writes OUT_DIR/<id>.png (800 px) for each matching template and OUT_DIR/sheet-N.png contact
sheets (4 x 3 thumbnails with names). Uses the preinstalled Chromium through Playwright.
Dev-only tool: nothing here ships in the app.
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'assets' / 'templates'


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    out = pathlib.Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    prefixes = sys.argv[2:]
    files = sorted(p for p in ASSETS.glob('*.svg') if not prefixes or any(p.stem.startswith(x) for x in prefixes))
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={'width': 800, 'height': 800})
        for f in files:
            svg = f.read_text()
            page.set_content(
                '<html><body style="margin:0;background:#fff">'
                + svg.replace('<svg ', '<svg style="width:800px;height:800px;display:block" ', 1)
                + '</body></html>'
            )
            page.screenshot(path=str(out / f'{f.stem}.png'))
        per = 12
        for s in range(0, len(files), per):
            chunk = files[s:s + per]
            cells = ''.join(
                '<div style="display:inline-block;width:300px;margin:6px;text-align:center;font:14px sans-serif">'
                + f.read_text().replace('<svg ', '<svg style="width:300px;height:300px;border:1px solid #ddd" ', 1)
                + f'<div>{f.stem}</div></div>'
                for f in chunk
            )
            page.set_viewport_size({'width': 1300, 'height': 1000})
            page.set_content(f'<html><body style="margin:0;background:#fff">{cells}</body></html>')
            page.screenshot(path=str(out / f'sheet-{s // per + 1}.png'), full_page=True)
        browser.close()
    print(f'Rendered {len(files)} templates to {out}')


if __name__ == '__main__':
    main()
