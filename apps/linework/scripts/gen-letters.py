#!/usr/bin/env python3
"""Letters (owner 24 Oct 2026): one tracing template per character, in many lettering styles.

Builds src/core/templateArt/letters/<style>.ts (finished SVG path strings on the 400x400 canvas, outline only) from
open-licence fonts (SIL OFL 1.1 or Apache 2.0, google/fonts). The font files are NOT shipped: only the glyph outlines
become line art, which both licences allow; credits and licence texts live in docs/THIRD_PARTY.md and docs/licences/.

Usage (dev only, needs fontTools):
  python3 scripts/gen-letters.py <google-fonts-checkout> [<repo-root>]
"""
import json
import os
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

UPPER = [chr(c) for c in range(ord('A'), ord('Z') + 1)]
LOWER = [chr(c) for c in range(ord('a'), ord('z') + 1)]
DIGITS = [str(d) for d in range(10)]
SYMBOLS = ['&', '!', '?']

# id, English style name, font path (relative to the google/fonts checkout), licence, character sets, level
STYLES = [
    ('bubble', 'Bubble', 'ofl/rubikbubbles/RubikBubbles-Regular.ttf', 'OFL-1.1', UPPER + DIGITS + SYMBOLS, 'beginner'),
    ('retro', 'Retro', 'ofl/shrikhand/Shrikhand-Regular.ttf', 'OFL-1.1', UPPER + DIGITS + SYMBOLS, 'beginner'),
    ('calligraphy', 'Calligraphy', 'ofl/greatvibes/GreatVibes-Regular.ttf', 'OFL-1.1', UPPER + LOWER + ['&'], 'intermediate'),
    ('script', 'Script', 'ofl/lobster/Lobster-Regular.ttf', 'OFL-1.1', UPPER + LOWER + ['&'], 'intermediate'),
    ('pixel', 'Pixel', 'ofl/pressstart2p/PressStart2P-Regular.ttf', 'OFL-1.1', UPPER + DIGITS + SYMBOLS, 'beginner'),
    ('graffiti', 'Graffiti', 'ofl/sedgwickave/SedgwickAve-Regular.ttf', 'OFL-1.1', UPPER + DIGITS + SYMBOLS, 'intermediate'),
    ('blackletter', 'Blackletter', 'ofl/unifrakturmaguntia/UnifrakturMaguntia-Book.ttf', 'OFL-1.1', UPPER + LOWER, 'intermediate'),
    ('serif', 'Classic serif', 'ofl/abrilfatface/AbrilFatface-Regular.ttf', 'OFL-1.1', UPPER + LOWER + DIGITS + ['&'], 'beginner'),
    ('stencil', 'Stencil', 'ofl/stardosstencil/StardosStencil-Bold.ttf', 'OFL-1.1', UPPER + DIGITS, 'beginner'),
    ('western', 'Western', 'ofl/rye/Rye-Regular.ttf', 'OFL-1.1', UPPER + DIGITS + SYMBOLS, 'intermediate'),
    ('deco', 'Art deco', 'ofl/limelight/Limelight-Regular.ttf', 'OFL-1.1', UPPER + DIGITS + ['&'], 'beginner'),
    ('handwritten', 'Handwritten', 'apache/schoolbell/Schoolbell-Regular.ttf', 'Apache-2.0', UPPER + LOWER + DIGITS, 'beginner'),
    ('neon', 'Neon outline', 'ofl/monoton/Monoton-Regular.ttf', 'OFL-1.1', UPPER + DIGITS, 'intermediate'),
    ('typewriter', 'Typewriter', 'apache/specialelite/SpecialElite-Regular.ttf', 'Apache-2.0', UPPER + LOWER + DIGITS + SYMBOLS, 'intermediate'),
    ('block', 'Block', 'ofl/bungee/Bungee-Regular.ttf', 'OFL-1.1', UPPER + DIGITS + SYMBOLS, 'beginner'),
    ('marker', 'Marker', 'apache/permanentmarker/PermanentMarker-Regular.ttf', 'Apache-2.0', UPPER + DIGITS + SYMBOLS, 'beginner'),
]

SYMBOL_KEY = {'&': 'ampersand', '!': 'exclamation', '?': 'question'}
SYMBOL_NAME = {'&': 'ampersand', '!': 'exclamation mark', '?': 'question mark'}

TOP, BOTTOM, MAX_W = 40, 360, 350
# Pixel fonts draw each glyph as overlapping squares; those overlaps would show as extra lines in a tracing
# template, so pixel styles are rebuilt from the union of their grid cells (CELL font units per cell).
PIXEL_STYLES = {'pixel': 125}


def pixel_union(glyph, cell, glyph_char, font_path):
    """Outline of the filled grid cells of a rectilinear glyph (nonzero winding), as font-unit polygons."""
    from fontTools.pens.recordingPen import RecordingPen
    rec = RecordingPen()
    glyph.draw(rec)
    polys, cur = [], []
    for op, args in rec.value:
        if op == 'moveTo':
            cur = [args[0]]
        elif op == 'lineTo':
            cur.append(args[0])
        elif op in ('closePath', 'endPath'):
            if cur:
                polys.append(cur)
            cur = []
    # FreeType (via Pillow) fills the glyph with the proper nonzero rule; sample each grid cell's centre.
    from PIL import Image, ImageDraw, ImageFont
    xs = [x for poly in polys for x, _ in poly]
    ys = [y for poly in polys for _, y in poly]
    upem, px_per_cell = 1000, 8
    size = upem * px_per_cell // cell
    img = Image.new('L', (size * 2, size * 2), 0)
    ImageDraw.Draw(img).text((size // 2, size * 3 // 2), glyph_char, font=ImageFont.truetype(font_path, size), fill=255, anchor='ls')
    filled = set()
    for gx in range(int(min(xs)) // cell, int(max(xs)) // cell + 1):
        for gy in range(int(min(ys)) // cell, int(max(ys)) // cell + 1):
            ix = size // 2 + int((gx + 0.5) * px_per_cell)
            iy = size * 3 // 2 - int((gy + 0.5) * px_per_cell)
            if img.getpixel((ix, iy)) > 127:
                filled.add((gx, gy))
    # directed boundary edges (filled cell on the left), then chain into loops and drop collinear points
    out = {}
    def add(a, b): out.setdefault(a, []).append(b)
    for gx, gy in filled:
        if (gx, gy - 1) not in filled: add((gx, gy), (gx + 1, gy))
        if (gx + 1, gy) not in filled: add((gx + 1, gy), (gx + 1, gy + 1))
        if (gx, gy + 1) not in filled: add((gx + 1, gy + 1), (gx, gy + 1))
        if (gx - 1, gy) not in filled: add((gx, gy + 1), (gx, gy))
    loops = []
    while out:
        start = next(iter(out))
        loop, p = [start], start
        while True:
            nxt = out[p].pop()
            if not out[p]: del out[p]
            if nxt == start: break
            loop.append(nxt)
            p = nxt
        simp = [pt for i, pt in enumerate(loop)
                if not ((loop[i - 1][0] == pt[0] == loop[(i + 1) % len(loop)][0]) or (loop[i - 1][1] == pt[1] == loop[(i + 1) % len(loop)][1]))]
        loops.append([(x * cell, y * cell) for x, y in simp])
    return loops


class _Polys:
    """Minimal glyph-like object: draws polygons through a pen (for pixel_union output)."""
    def __init__(self, loops): self.loops = loops
    def draw(self, pen):
        for loop in self.loops:
            pen.moveTo(loop[0])
            for pt in loop[1:]: pen.lineTo(pt)
            pen.closePath()


def key_for(ch, mixed):
    if ch in SYMBOL_KEY:
        return SYMBOL_KEY[ch]
    if ch.isalpha() and mixed:
        return ch.lower() + ('-small' if ch.islower() else '')
    return ch.lower()


def name_for(style_name, ch, mixed):
    if ch in SYMBOL_NAME:
        return f'{style_name} {SYMBOL_NAME[ch]}'
    if ch.isalpha() and mixed:
        return f"{style_name} {'small' if ch.islower() else 'capital'} {ch}"
    return f'{style_name} {ch}'


def glyph_paths(font, chars):
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    out = {}
    for ch in chars:
        gname = cmap.get(ord(ch))
        if not gname:
            continue
        from fontTools.pens.boundsPen import BoundsPen
        bp = BoundsPen(gs)
        gs[gname].draw(bp)
        if not bp.bounds:
            continue
        out[ch] = (gname, bp.bounds)
    return gs, out


def build_style(root, sid, sname, path, chars, level):
    font = TTFont(os.path.join(root, path))
    gs, glyphs = glyph_paths(font, chars)
    mixed = any(c.islower() for c in chars)
    # lower-case letters get their own scale so a single small letter fills the page as well as a capital does
    def group(c):
        return 'lower' if c.islower() else 'other'
    ranges = {}
    for c, (_, b) in glyphs.items():
        lo, hi = ranges.get(group(c), (b[1], b[3]))
        ranges[group(c)] = (min(lo, b[1]), max(hi, b[3]))
    items = []
    for ch in chars:
        if ch not in glyphs:
            print(f'  {sid}: no glyph for {ch!r}', file=sys.stderr)
            continue
        gname, (x0, y0, x1, y1) = glyphs[ch]
        ymin, ymax = ranges[group(ch)]
        scale = (BOTTOM - TOP) / (ymax - ymin)
        s = scale
        if (x1 - x0) * s > MAX_W:
            s = MAX_W / (x1 - x0)
        # baseline so the style's tallest ascender touches TOP; narrower scale keeps the glyph vertically centred
        top_y = TOP + ((ymax - ymin) * (scale - s)) / 2
        dy = top_y + ymax * s
        dx = (400 - (x1 - x0) * s) / 2 - x0 * s
        pen = SVGPathPen(gs, ntos=lambda v: str(int(round(v))))
        glyph = _Polys(pixel_union(gs[gname], PIXEL_STYLES[sid], ch, os.path.join(root, path))) if sid in PIXEL_STYLES else gs[gname]
        glyph.draw(TransformPen(pen, (s, 0, 0, -s, dx, dy)))
        d = pen.getCommands()
        # one path string per contour keeps each outline separate (and under the 300-path budget)
        contours = [('M' + c).strip() for c in d.split('M') if c.strip()]
        # drop specks that rounding collapsed (grunge dots in distressed fonts): they would draw nothing
        def extent(c):
            import re
            toks = re.findall(r'[MLHVQCZ]|-?\d+(?:\.\d+)?', c)
            xs, ys, cmd, i, x, y = [], [], None, 0, 0.0, 0.0
            while i < len(toks):
                if toks[i].isalpha():
                    cmd = toks[i]; i += 1
                    if cmd == 'Z':
                        continue
                n = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'Q': 4, 'C': 6}[cmd]
                vals = [float(v) for v in toks[i:i + n]]; i += n
                if cmd == 'H': x = vals[0]
                elif cmd == 'V': y = vals[0]
                else: x, y = vals[-2], vals[-1]
                xs.append(x); ys.append(y)
            return max(max(xs) - min(xs), max(ys) - min(ys)) if xs else 0
        contours = [c for c in contours if extent(c) >= 3]
        items.append({
            'id': f'char-{sid}-{key_for(ch, mixed)}',
            'name': name_for(sname, ch, mixed),
            'char': ch,
            'paths': contours,
        })
    return items


def ts_file(sid, sname, path, licence, level, items):
    var = 'letters' + ''.join(p.capitalize() for p in sid.split('-'))
    lines = [
        f'// Letters — {sname} style (owner 24 Oct 2026). GENERATED by scripts/gen-letters.py from {path.split("/")[-1]}',
        f'// ({licence}, google/fonts; credits in docs/THIRD_PARTY.md). Do not edit by hand: re-run the script.',
        "import type { Template } from '../../templates.ts';",
        '',
        f'export const {var}: Template[] = [',
    ]
    for it in items:
        obj = {
            'id': it['id'],
            'name': it['name'],
            'category': 'lettering',
            'level': level,
            'tags': ['letters', 'alphabet', f'style-{sid}'],
            'viewBox': '0 0 400 400',
            'paths': it['paths'],
        }
        lines.append('  ' + json.dumps(obj, ensure_ascii=False) + ',')
    lines.append('];')
    return var, '\n'.join(lines) + '\n'


def main():
    gf = sys.argv[1]
    repo = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..')
    out_dir = os.path.join(repo, 'src/core/templateArt/letters')
    os.makedirs(out_dir, exist_ok=True)
    index = [
        '// Letters (owner 24 Oct 2026): one template per character, grouped by lettering style (tag style-<id>).',
        '// GENERATED by scripts/gen-letters.py. Style list and labels: src/core/letterStyles.ts.',
        "import type { Template } from '../../templates.ts';",
    ]
    names = []
    total = 0
    for sid, sname, path, licence, chars, level in STYLES:
        items = build_style(gf, sid, sname, path, chars, level)
        var, text = ts_file(sid, sname, path, licence, level, items)
        with open(os.path.join(out_dir, f'{sid}.ts'), 'w', encoding='utf-8') as fh:
            fh.write(text)
        index.append(f"import {{ {var} }} from './{sid}.ts';")
        names.append(var)
        total += len(items)
        print(f'{sid}: {len(items)}')
    index += ['', f"export const letters: Template[] = [{', '.join('...' + n for n in names)}];", '']
    with open(os.path.join(out_dir, 'index.ts'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(index))
    print('total', total)


if __name__ == '__main__':
    main()
