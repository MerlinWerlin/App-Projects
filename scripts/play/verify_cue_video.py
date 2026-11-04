"""Validate saved synthetic-emulator video metadata, without a real-person take."""
import json
from pathlib import Path
import re
import sys

source = Path(sys.argv[1])
text = source.read_text(encoding="utf-8")
rows = []
for line in text.splitlines():
    fields = {key: int(value) for key, value in re.findall(r"\b(duration|width|height)=(\d+)", line)}
    if fields:
        rows.append(fields)
assert any(r.get("duration", 0) >= 1500 and r.get("width", 0) > 0 and r.get("height", 0) > 0 for r in rows), text
(source.parent / "saved-video-verification.json").write_text(
    json.dumps({"status": "PASS", "video_metadata": rows, "scope": "Synthetic emulator camera; no physical microphone or real-person capture."}, indent=2) + "\n",
    encoding="utf-8",
)
