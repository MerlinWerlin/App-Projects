/**
 * Oversight D147-1: Google Cast (T106) is native code that has never compiled, so it sits behind
 * ONE switch, src/core/cast/googleCast/switch.ts:
 *  1. the switch is a single line of an exact form (the iOS podspec parses it);
 *  2. the app loads the lan-wss TLS socket only through that switch, and only in src/state/cast.tsx;
 *  3. LanWss.podspec reads the switch and, when it is off, sets COUCH_NO_GOOGLE_CAST;
 *  4. LanTls.swift then compiles only a stub LanTlsClient with the same API (no Network code);
 *  5. the TLS adapter still returns null without the native module (Expo Go never crashes).
 * Pure TS + Node built-ins (ruby is used for the podspec check when it is installed).
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { GOOGLE_CAST_ON } from '../src/core/cast/googleCast/switch';
import { loadLanTls } from '../src/native/lanTls';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const SWITCH_LINE = /^export const GOOGLE_CAST_ON = (true|false);$/m;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'ios' || name === 'android' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe('Google Cast switch (D147-1)', () => {
  it('is one exact line and the only export of switch.ts', () => {
    const src = read('src/core/cast/googleCast/switch.ts');
    expect(src.match(new RegExp(SWITCH_LINE.source, 'gm'))?.length).toBe(1);
    expect(src.match(/^export /gm)?.length).toBe(1);
    expect(typeof GOOGLE_CAST_ON).toBe('boolean');
  });

  it('gates the only loadLanTls() call in the app', () => {
    const callers = ['app', 'src']
      .flatMap((d) => walk(join(root, d)))
      .map((p) => ({ rel: relative(root, p).split(sep).join('/'), src: readFileSync(p, 'utf8') }))
      .filter((f) => f.rel !== 'src/native/lanTls.ts' && /loadLanTls\s*\(/.test(f.src));
    expect(callers.map((f) => f.rel)).toEqual(['src/state/cast.tsx']);
    const cast = callers[0]!.src;
    expect(cast).toMatch(/from '\.\.\/core\/cast\/googleCast\/switch'/);
    expect(cast).toMatch(/GOOGLE_CAST_ON \? loadLanTls\(\) : null/);
    expect(cast.match(/loadLanTls\s*\(/g)?.length).toBe(1);
  });

  it('podspec reads the switch and sets COUCH_NO_GOOGLE_CAST when off', () => {
    const spec = read('modules/lan-wss/ios/LanWss.podspec');
    expect(spec).toContain("'src', 'core', 'cast', 'googleCast', 'switch.ts'");
    expect(spec).toContain('COUCH_NO_GOOGLE_CAST');
    expect(spec).toContain('GOOGLE_CAST_ON\\s*=\\s*false');
  });

  it('podspec logic flips with the switch (ruby)', () => {
    const ruby = spawnSync('ruby', ['--version']);
    if (ruby.status !== 0) return; // no ruby here: the static checks above still hold
    const spec = read('modules/lan-wss/ios/LanWss.podspec');
    const prelude = spec.split('Pod::Spec.new')[0]!;
    for (const [line, expected] of [
      ['export const GOOGLE_CAST_ON = true;', 'true'],
      ['export const GOOGLE_CAST_ON = false;', 'false'],
    ] as const) {
      // Re-point the switch path at a temp file holding `line`, then print google_cast_on.
      const script =
        `require 'tmpdir'\nDir.mktmpdir do |d|\n` +
        `p = File.join(d, 'switch.ts'); File.write(p, "/** doc */\\n${line}\\n")\n` +
        prelude.replace(/google_cast_switch = .*\n/, 'google_cast_switch = p\n') +
        `\nputs google_cast_on\nend\n`;
      const r = spawnSync('ruby', ['-e', script], { encoding: 'utf8' });
      expect(r.stderr).toBe('');
      expect(r.stdout.trim()).toBe(expected);
    }
  });

  it('LanTls.swift has a stub LanTlsClient with the same API when switched off', () => {
    const swift = read('modules/lan-wss/ios/LanTls.swift');
    const m = swift.match(/#if COUCH_NO_GOOGLE_CAST\n([\s\S]*?)\n#else\n([\s\S]*)\n#endif\n?$/);
    expect(m).not.toBeNull();
    const [, stub, real] = m!;
    expect(stub).not.toMatch(/NWConnection|NWParameters|sec_protocol/);
    for (const sig of [
      'init(module: LanWssModule)',
      'func connect(id: String, host: String, port: Int, timeoutMs: Double, promise: Promise)',
      'func write(id: String, base64: String) -> Bool',
      'func close(id: String)',
      'func closeAll()',
    ]) {
      expect(stub).toContain(sig);
      expect(real).toContain(sig);
    }
    expect(stub).toContain('final class LanTlsClient');
    expect(real).toContain('final class LanTlsClient');
  });

  it('without the native module the TLS adapter is null (Expo Go safe)', () => {
    expect(loadLanTls()).toBeNull();
  });
});
