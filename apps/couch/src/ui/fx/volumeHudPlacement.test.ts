import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// fb-1022d: the volume / mute HUD sat under the Dynamic Island. It must clear the safe-area top inset.
describe('VolumeHud placement', () => {
  const src = readFileSync(join(__dirname, 'VolumeHud.tsx'), 'utf8');
  it('offsets by the safe-area top inset', () => {
    expect(src).toContain('useSafeAreaInsets()');
    expect(src).toContain('top: insets.top + 8');
  });
});
