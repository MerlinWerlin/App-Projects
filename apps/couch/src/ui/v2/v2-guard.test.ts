/**
 * Design v2 primitives (market-1018 M3) follow the app's rules:
 * - copy only through props (no hard-coded user-facing strings) and Text from src/ui/Text;
 * - start/end layout only (RTL), never physical left/right styles;
 * - Expo Go-safe imports only: no expo-blur / reanimated / gesture-handler static imports (not in
 *   package.json; blur is registered at runtime, see blurRegistry.ts);
 * - Reduce Motion honoured wherever something animates; continuous corners on rounded surfaces.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findHardcodedStrings, findPhysicalDirections } from '../../i18n/scan';

const dir = __dirname;
const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
const read = (f: string) => readFileSync(join(dir, f), 'utf8');
/** Source without comments (doc comments may show how to wire optional packages). */
const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const pkg = JSON.parse(readFileSync(join(dir, '..', '..', '..', 'package.json'), 'utf8')) as { dependencies: Record<string, string> };

describe('design v2 primitives', () => {
  it('ships every primitive', () => {
    for (const f of ['LargeTitleHeader.tsx', 'InsetGroupedList.tsx', 'Card.tsx', 'PillButton.tsx', 'BlurMaterial.tsx', 'index.ts']) expect(files).toContain(f);
  });

  it('no hard-coded user-facing strings and no physical left/right', () => {
    const hits = files.flatMap((f) => [...findHardcodedStrings(read(f)), ...findPhysicalDirections(read(f))].map((h) => `${f}:${h.line} ${h.text}`));
    expect(hits).toEqual([]);
  });

  it('text goes through src/ui/Text, never react-native Text', () => {
    for (const f of files) {
      const src = read(f);
      expect({ f, rnText: /import\s*\{[^}]*\bText\b[^}]*\}\s*from\s*'react-native'/.test(src) }).toEqual({ f, rnText: false });
      if (/<Text\b/.test(src)) expect({ f, wrapper: src.includes("from '../Text'") }).toEqual({ f, wrapper: true });
    }
  });

  it('imports only installed packages', () => {
    const allowed = new Set(['react', ...Object.keys(pkg.dependencies)]);
    for (const f of files) {
      for (const m of code(f).matchAll(/from\s+'([^'.][^']*)'/g)) {
        const name = m[1]!.startsWith('@') ? m[1]!.split('/').slice(0, 2).join('/') : m[1]!.split('/')[0]!;
        expect({ f, name, ok: allowed.has(name) }).toEqual({ f, name, ok: true });
      }
    }
    for (const f of files) expect(code(f)).not.toMatch(/from\s+'(expo-blur|react-native-reanimated|react-native-gesture-handler)'/);
  });

  it('animated primitives respect Reduce Motion', () => {
    expect(read('LargeTitleHeader.tsx')).toContain('useReducedMotion()');
    // Card and PillButton animate through PressableScale, which reads Reduce Motion itself.
    for (const f of ['Card.tsx', 'PillButton.tsx']) expect(read(f)).toContain('PressableScale');
    expect(read('BlurMaterial.tsx')).toContain('useReducedTransparency()');
  });

  it('rounded surfaces use continuous corners', () => {
    for (const f of ['Card.tsx', 'PillButton.tsx', 'InsetGroupedList.tsx']) expect(read(f)).toContain('continuous');
  });

  it('the row chevron mirrors in right-to-left layouts', () => {
    expect(read('InsetGroupedList.tsx')).toMatch(/I18nManager\.isRTL \? styles\.mirror/);
  });
});
