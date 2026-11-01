/**
 * T79 (market-1018 M3, DESIGN_V2 step 8): the remote's chrome is on Design v2 while the keys,
 * d-pad geometry and NeverMirror stay as they are.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');

describe('remote chrome on design v2', () => {
  const remote = read('app/(tabs)/remote.tsx');
  const header = read('src/ui/remote/TvHeader.tsx');
  const sheet = read('src/ui/Sheet.tsx');

  it('the remote tab (and every sheet it opens) sits inside RemoteDesignProvider with the remote theme', () => {
    expect(remote).toContain("import { RemoteDesignProvider } from '../../src/ui/v2';");
    expect(remote).toContain('<RemoteDesignProvider theme={theme}>');
    expect(remote.indexOf('<RemoteDesignProvider')).toBeLessThan(remote.indexOf('<KeyboardSheet'));
    expect(remote.indexOf('</RemoteDesignProvider>')).toBeGreaterThan(remote.indexOf('<SleepTimerSheet'));
  });

  it('the TV header takes v2 roles from the remote theme and has continuous corners', () => {
    expect(header).toContain('remoteDesignPalette(theme)');
    expect(header).toContain('...continuous');
    expect(header).toContain("textStyle('footnote')");
    expect(header).not.toMatch(/t\.(muted|ink|body|accentSoft)\b/);
  });

  it('sheets use the v2 sheet radius with continuous corners', () => {
    expect(sheet).toContain('borderTopStartRadius: radii.sheet');
    expect(sheet).toContain('...continuous');
  });

  it('keys and d-pad are untouched: still themed directly, still never mirrored', () => {
    expect(remote).toContain('<NeverMirror');
    expect(read('src/ui/remote/DPad.tsx')).toContain('dpadGeometry(');
  });
});
