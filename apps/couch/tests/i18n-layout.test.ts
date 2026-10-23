/**
 * owner-1016 R3: repo-wide i18n layout checks.
 * - No hard-coded user-facing strings in app/** or src/ui/** components.
 * - Physical left/right styles only inside controls that must never mirror (or allowlisted with a reason).
 * - The remote's physical-direction controls render with direction 'ltr' (the d-pad is NOT mirrored in Arabic).
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { findHardcodedStrings, findPhysicalDirections, usesNeverMirror } from '../src/i18n/scan';

const root = join(__dirname, '..');
const files = execSync("git ls-files 'app/*.tsx' 'src/ui/*.tsx'", { cwd: root }).toString().trim().split('\n').filter(Boolean);
const read = (f: string) => readFileSync(join(root, f), 'utf8');

/** Files whose physical left/right is intentional: they keep the TV's physical directions. */
const PHYSICAL_OK: Record<string, string> = {
  'src/ui/remote/DPad.tsx': 'd-pad arrows map to the TV physical left/right',
  'src/ui/remote/Touchpad.tsx': 'touchpad swipes map to the TV physical left/right',
  'src/ui/remote/ColorKeys.tsx': 'red/green/yellow/blue keep the TV order',
  'src/ui/fx/VolumeHud.tsx': 'right-aligned number column (digits)',
  'src/ui/IntroRemote.tsx': 'opening animation: logo art laid out in fixed viewBox coordinates (inside NEVER_MIRROR_STYLE)',
};

describe('i18n layout (owner-1016)', () => {
  it('scans a real set of files', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('no hard-coded UI strings in app/ and src/ui components', () => {
    const hits = files.flatMap((f) => findHardcodedStrings(read(f)).map((h) => `${f}:${h.line} ${h.text}`));
    expect(hits).toEqual([]);
  });

  it('physical left/right only where directions must stay physical', () => {
    const bad = files.filter((f) => !(f in PHYSICAL_OK)).flatMap((f) => findPhysicalDirections(read(f)).map((h) => `${f}:${h.line} ${h.text}`));
    expect(bad).toEqual([]);
  });

  it('every physical-direction control is wrapped to stay left-to-right in RTL', () => {
    for (const f of ['src/ui/remote/DPad.tsx', 'src/ui/remote/Touchpad.tsx', 'src/ui/remote/ColorKeys.tsx', 'src/ui/remote/RemoteKey.tsx', 'src/ui/remote/SimpleRemote.tsx', 'app/(tabs)/remote.tsx', 'src/ui/IntroRemote.tsx']) {
      expect({ f, wrapped: usesNeverMirror(read(f)) }).toEqual({ f, wrapped: true });
    }
    expect(read('src/ui/NeverMirror.tsx')).toContain("NEVER_MIRROR_STYLE = { direction: 'ltr' }");
  });
});
