/**
 * owner-1016 R3: the remote's physical-direction controls keep their layout in right-to-left
 * languages (Arabic). Each control's root view must render inside <NeverMirror> or carry
 * NEVER_MIRROR_STYLE (src/ui/NeverMirror.tsx), in its own component file. Add new physical
 * controls to NEVER_MIRROR_CONTROLS. Node built-ins only (Jest and Bun).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifySwipe } from '../src/ui/remote/controls';

const root = join(__dirname, '..');

/** file -> components in it whose root must not mirror. */
export const NEVER_MIRROR_CONTROLS: ReadonlyArray<{ file: string; components: string[]; what: string }> = [
  { file: 'src/ui/remote/DPad.tsx', components: ['DPad'], what: 'd-pad and arrow keys' },
  { file: 'src/ui/remote/Touchpad.tsx', components: ['Touchpad'], what: 'touchpad' },
  { file: 'src/ui/remote/RemoteKey.tsx', components: ['Rocker', 'PlaybackRow'], what: 'volume/channel rockers, rewind/fast-forward' },
  { file: 'src/ui/remote/SimpleRemote.tsx', components: ['SimpleRemote'], what: 'simple-mode volume/channel keys' },
];

/** Body of `function Name(` up to the next top-level declaration. */
function componentBody(src: string, name: string): string | null {
  const start = src.search(new RegExp(`(^|\\n)(export )?function ${name}\\(`));
  if (start < 0) return null;
  const rest = src.slice(start + 1);
  const end = rest.search(/\n(export |function |const |\/\*\*)/);
  return end < 0 ? rest : rest.slice(0, end);
}

const usesNeverMirror = (code: string) => /<NeverMirror[\s>]/.test(code) || /\bNEVER_MIRROR_STYLE\b/.test(code);

describe('never-mirror controls (RTL)', () => {
  for (const { file, components, what } of NEVER_MIRROR_CONTROLS) {
    it(`${file}: ${what} keep physical directions`, () => {
      const path = join(root, file);
      expect(existsSync(path)).toBe(true);
      const src = readFileSync(path, 'utf8');
      expect(src).toMatch(/from '\.\.\/NeverMirror'/);
      for (const c of components) {
        const body = componentBody(src, c);
        expect({ component: c, found: body !== null }).toEqual({ component: c, found: true });
        expect({ component: c, neverMirror: usesNeverMirror(body ?? '') }).toEqual({ component: c, neverMirror: true });
      }
    });
  }

  it('physical controls never branch on RTL', () => {
    for (const { file } of NEVER_MIRROR_CONTROLS) {
      const src = readFileSync(join(root, file), 'utf8');
      expect({ file, rtl: /\bisRTL\b|I18nManager/.test(src) }).toEqual({ file, rtl: false });
    }
  });

  it('touchpad swipe math uses the physical dx (not negated for RTL)', () => {
    const src = readFileSync(join(root, 'src/ui/remote/Touchpad.tsx'), 'utf8');
    expect(src).toContain('classifySwipe(s.dx - g.current.ox, s.dy - g.current.oy');
    expect(src).toContain('classifySwipe(s.dx, s.dy');
    expect(src).not.toMatch(/-\s*s\.dx\b/);
    expect(classifySwipe(60, 0)).toBe('RIGHT');
    expect(classifySwipe(-60, 0)).toBe('LEFT');
  });
});
