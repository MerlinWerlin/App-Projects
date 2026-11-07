/**
 * Couch Plus guard (owner decision 7 Nov 2026, replacing the old "every TV control is free forever" rule).
 * The remote and casting are the paid part of Couch. They are stopped in exactly one place: src/plus/gate.tsx
 * installs one gate function on the RemoteSession (session.setGate) and the CastController (cast.setGate). So:
 * - control paths never read the entitlement themselves (no src/plus imports in src/core, the remote, the tabs, the
 *   session or cast state) and only ask session.allowed() / cast.allowed();
 * - every control entry point of RemoteSession checks the gate first;
 * - the gate is mounted once at the root, and src/plus never sends anything to a TV itself;
 * - adding and finding TVs, the TVs list, settings and themes never go through the gate.
 * Uses only Node built-ins so it runs under Jest (and Bun) without extra deps.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const guarded = ['src/core', 'src/ui/remote', 'app/(tabs)', 'src/state/session.tsx', 'src/state/cast.tsx'];

function files(p: string): string[] {
  if (!existsSync(p)) return [];
  if (statSync(p).isFile()) return /\.(ts|tsx)$/.test(p) ? [p] : [];
  return readdirSync(p).flatMap((n) => files(join(p, n)));
}

/** Module specifiers from import/export-from, dynamic import() and require(). */
function specifiers(src: string): string[] {
  const out: string[] = [];
  const re = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;
  for (const m of src.matchAll(re)) out.push(m[1]!);
  return out;
}

const isPlus = (s: string) => /(^|\/)plus(\/|$)/.test(s);
/** Drivers, the driver interface, sessions and transports: anything that can send keys to a TV. */
const isControl = (s: string) =>
  /(^|\/)(drivers?|session|transport|lanWss|udp|ir|wol)(\/|$)/.test(s) || /(^|\/)core\/drivers\//.test(s);

describe('Couch Plus guard', () => {
  const all = guarded.flatMap((g) => files(join(root, g)));

  it('scans every guarded path', () => {
    for (const g of guarded) expect(files(join(root, g)).length).toBeGreaterThan(0);
  });

  it('no control path imports src/plus (they only ask the installed gate)', () => {
    const offenders = all.filter((f) => specifiers(readFileSync(f, 'utf8')).some(isPlus));
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });

  it('the specifier scan catches plus imports', () => {
    expect(specifiers("import { canUse } from '../../plus/entitlement';").some(isPlus)).toBe(true);
    expect(specifiers("const p = require('../plus');").some(isPlus)).toBe(true);
    expect(specifiers("await import('../src/plus/usePlus')").some(isPlus)).toBe(true);
    expect(specifiers("import { x } from './plusOne';").some(isPlus)).toBe(false);
  });

  it('every RemoteSession control entry point checks the gate before anything is sent', () => {
    const src = code('src/core/session.ts');
    for (const m of ['sendKey(key: Key)', 'sendText(text: string)', 'launchApp(appId: string)', 'exec(fn: (d: TvDriver) => Promise<void>)']) {
      const at = src.indexOf(m);
      expect({ m, found: at >= 0 }).toEqual({ m, found: true });
      const body = src.slice(at, src.indexOf('\n  }', at));
      expect({ m, gated: /^\s*if \(!this\.allowed\(\)\) return Promise\.resolve\(false\);/m.test(body.split('\n').slice(1).join('\n')) }).toEqual({ m, gated: true });
    }
  });

  it('casting checks the gate before anything is put on the TV', () => {
    const src = code('src/core/cast/castController.ts');
    const play = src.slice(src.indexOf('async play(item: QueueItem'));
    expect(play.slice(0, 400)).toContain('if (!this.allowed())');
    expect(code('app/(tabs)/cast.tsx')).toContain('if (!cast.allowed()) return;');
  });

  it('the remote, voice and apps screens ask before showing "Sent", opening a sheet or launching', () => {
    expect(code('app/(tabs)/remote.tsx')).toContain('if (!session.allowed()) return;');
    expect(code('src/ui/remote/VoiceButton.tsx')).toContain('if (!session.allowed()) return;');
    expect(code('app/(tabs)/apps.tsx')).toContain('if (!session.allowed()) return;');
  });

  it('the one gate is installed on the session and the cast controller, mounted once at the root', () => {
    const gate = code('src/plus/gate.tsx');
    expect(gate).toContain('session.setGate(controlsGate)');
    expect(gate).toContain('cast.setGate(controlsGate)');
    // Locked: open the paywall; if it can't open, say so (never a silent dead button).
    expect(gate).toContain("router.push('/plus')");
    expect(gate).toContain("showToast(t('core.plus.locked'), 'warning')");
    const layout = code('app/_layout.tsx');
    expect(layout.match(/<PlusGate \/>/g)?.length).toBe(1);
    expect(layout.indexOf('<CastProvider>')).toBeLessThan(layout.indexOf('<PlusGate />'));
    // Access is read at load, before any screen writes storage (grandfathering).
    expect(layout).toMatch(/^plusAccess\(\);$/m);
    const setters = files(join(root, 'src'))
      .concat(files(join(root, 'app')))
      .filter((f) => !/\.test\.tsx?$/.test(f) && /\.setGate\(/.test(code(relative(root, f))));
    expect(setters.map((f) => relative(root, f).replace(/\\/g, '/'))).toEqual(['src/plus/gate.tsx']);
  });

  it('free for everyone: adding and finding TVs, the TVs list, settings and themes never ask the gate', () => {
    for (const f of ['app/add-tv.tsx', 'app/add-tv-ir.tsx', 'app/(tabs)/tvs.tsx', 'app/settings.tsx', 'app/themes.tsx', 'src/state/tvs.ts']) {
      expect({ f, gated: /\.allowed\(\)/.test(code(f)) }).toEqual({ f, gated: false });
    }
  });

  it('src/plus never sends anything to a TV; only the gate touches the session and cast state', () => {
    const plus = files(join(root, 'src/plus')).filter((f) => !/\.test\.tsx?$/.test(f));
    expect(plus.length).toBeGreaterThan(0);
    const importers = plus
      .filter((f) => specifiers(readFileSync(f, 'utf8')).some(isControl))
      .map((f) => relative(root, f).replace(/\\/g, '/'));
    expect(importers).toEqual(['src/plus/gate.tsx']);
    const senders = plus.filter((f) => /\bsendKey\b|\bsendText\b|\blaunchApp\b|\.exec\(|\.play\(/.test(code(relative(root, f))));
    expect(senders.map((f) => relative(root, f))).toEqual([]);
  });

  it('the real store library is installed, pinned exactly (release standard 2)', () => {
    const pkg = JSON.parse(read('package.json')) as Record<string, Record<string, string> | undefined>;
    expect(pkg['dependencies']?.['expo-iap']).toMatch(/^\d+\.\d+\.\d+$/);
    const deps = Object.keys({ ...pkg['dependencies'], ...pkg['devDependencies'] });
    expect(deps.filter((d) => /purchases|billing|storekit|revenuecat/i.test(d))).toEqual([]);
  });

  it('src/core has no React Native imports', () => {
    const core = files(join(root, 'src/core'));
    const offenders = core.filter((f) => /from\s+['"](react-native|expo)/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });
});
