"""Validate/convert upload formats; preserve the actual captured UI pixels."""
from pathlib import Path
from PIL import Image
import hashlib
import json

root = Path(__file__).resolve().parents[2]
out = root / "apps/linework/store/play"
source = root / "apk-output/linework-v11-4kb-settled-qualified-20261104"
feature = out / "feature.png"
Image.open(feature).convert("RGB").save(feature)
assets = []
for name, original, alt in [
    ("01-home.png", "linework-home.png", "Choose a photo or a built-in template from Linework Home."),
    ("02-lightbox.png", "linework-lightbox-template.png", "Trace a cat in Lightbox, with lock and reset controls."),
]:
    Image.open(source / original).convert("RGB").save(out / name)
    assets.append({"file": name, "source": str((source / original).relative_to(root)).replace("\\", "/"),
                   "sourceSha256": hashlib.sha256((source / original).read_bytes()).hexdigest(),
                   "alt": alt, "conversion": "RGB PNG only; no UI retouch or pixel scaling"})
assets.extend([
    {"file": "icon.png", "source": "apps/linework/assets/brand/icon.svg", "alt": "A looping blue pencil stroke on warm paper."},
    {"file": "feature.png", "source": "feature.svg and the original bot-sunflower-head.svg template", "alt": "Find your own line, with a sunflower drawing on paper."},
])
for asset in assets:
    p = out / asset["file"]
    im = Image.open(p)
    asset.update(width=im.width, height=im.height, mode=im.mode, bytes=p.stat().st_size,
                 sha256=hashlib.sha256(p.read_bytes()).hexdigest())
    if asset["file"] == "icon.png":
        assert im.size == (512, 512) and im.mode == "RGBA" and p.stat().st_size < 1024 * 1024
    elif asset["file"] == "feature.png":
        assert im.size == (1024, 500) and im.mode == "RGB"
    else:
        assert im.mode == "RGB" and min(im.size) >= 320 and max(im.size) <= 3840 and max(im.size) <= 2 * min(im.size)
        assert im.tobytes() == Image.open(root / asset["source"]).convert("RGB").tobytes()
(out / "assets.json").write_text(json.dumps({
    "status": "prepared_not_uploaded",
    "rules": "https://support.google.com/googleplay/android-developer/answer/9866151?hl=en",
    "renderer": "@resvg/resvg-js2.6.2; Pillow format conversion",
    "captureSource": "Signed v11/source4828362, run41726267099; UI layout unchanged by payment recovery2014ef0. The v11 binary is superseded for upload; captures retained.",
    "assets": assets,
}, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"assetsValidated": len(assets), "screenshotPixelsUnchanged": True}))
