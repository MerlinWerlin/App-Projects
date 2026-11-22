"""Compare native rendered frames; no mock animation or image alteration."""
import json
from pathlib import Path
from PIL import Image, ImageChops

root = Path('output')
def changed(first, second):
    a, b = Image.open(root / first).convert('RGB'), Image.open(root / second).convert('RGB')
    assert a.size == b.size
    w, h = a.size
    box = (int(w * .12), int(h * .23), int(w * .88), int(h * .60))
    difference = ImageChops.difference(a.crop(box), b.crop(box))
    pixels = list(difference.getdata())
    return sum(max(p) > 5 for p in pixels) / len(pixels)

animated = changed('motion-a.png', 'motion-b.png')
reduced = changed('reduced-a.png', 'reduced-b.png')
result = {'animated_changed_fraction': animated, 'motion_off_changed_fraction': reduced,
          'animated_pass': animated > .003, 'motion_off_pass': reduced < .002}
(root / 'motion-verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
assert result['animated_pass'], 'The native cloud scene did not visibly animate'
assert result['motion_off_pass'], 'Cloud motion continued after disabling animations'
