# Launch kits (studio brand)

Every app's launch posts are drawn in the one studio brand (`marketing/brand/brand.json`: palette Olive & Burgundy,
DM Serif Display / Bricolage Grotesque / DM Sans in `marketing/brand/fonts`). Change the brand file and re-run to
restyle every kit.

| Kit | Run | Makes |
|---|---|---|
| Glaze (theme showcase) | `python3 -I marketing/glaze/kit/fetch.py ART` → `screens.py ART SCREENS` → `compose.py SCREENS ART OUT` | Real Home and Lock Screens from the glaze-packs-v1 themes (wallpaper, blended widget art, glass icons), then collages, 4 category carousels, Pinterest pins, stories and sliding reels. Themes are picked in `marketing/glaze/kit/kit.json` |
| Any app with store shots | `python3 -I marketing/kit/shots_kit.py <slug> OUT [shots_dir]` | 4:5 carousel (cover, one slide per shot, call to action) and a 9:16 reel where the shots slide in, ending on the app card |

Outputs are kept out of the repo; they're published for review in the Launch kit page on claude.ai.
