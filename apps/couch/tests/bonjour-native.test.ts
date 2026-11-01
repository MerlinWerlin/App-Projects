/**
 * Bonjour native code (modules/lan-wss/ios/LanBonjour.swift). It cannot be compiled here, so these
 * are text checks, in the style of androidtv-native / google-cast-switch:
 *  1. one switch line (src/core/bonjour/switch.ts) gates the JS loader and the podspec;
 *  2. LanBonjour.swift has a stub with the same API under COUCH_NO_BONJOUR;
 *  3. the real code browses with NWBrowser (Bonjour + TXT, domain local.) and resolves with an
 *     IPv4-only NWConnection to the service endpoint, all on one private queue;
 *  4. the module registers bonjourBrowse / bonjourStop / bonjourResolve and the onBonjourService event;
 *  5. the JS adapter loads lan-wss only through a guarded require and is wired into discovery.
 * Pure TS + Node built-ins (ruby for the podspec check when installed).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BONJOUR_NATIVE_ON } from '../src/core/bonjour/switch';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const SWITCH_LINE = /^export const BONJOUR_NATIVE_ON = (true|false);$/m;
const SWIFT = 'modules/lan-wss/ios/LanBonjour.swift';

describe('Bonjour switch', () => {
  it('is one exact line and the only export of switch.ts', () => {
    const src = read('src/core/bonjour/switch.ts');
    expect(src.match(new RegExp(SWITCH_LINE.source, 'gm'))?.length).toBe(1);
    expect(src.match(/^export /gm)?.length).toBe(1);
    expect(typeof BONJOUR_NATIVE_ON).toBe('boolean');
  });

  it('gates the JS loader', () => {
    const src = read('src/native/bonjour.ts');
    expect(src).toMatch(/if \(!BONJOUR_NATIVE_ON\) return null;/);
    expect(src).toContain("from '../core/bonjour/switch'");
  });

  it('podspec reads the switch and sets COUCH_NO_BONJOUR when off', () => {
    const spec = read('modules/lan-wss/ios/LanWss.podspec');
    expect(spec).toContain("'src', 'core', 'bonjour', 'switch.ts'");
    expect(spec).toContain('BONJOUR_NATIVE_ON\\s*=\\s*false');
    expect(spec).toContain("conditions << 'COUCH_NO_BONJOUR' unless bonjour_on");
    // the other switches are untouched
    expect(spec).toContain("conditions << 'COUCH_NO_ANDROIDTV_TLS' unless androidtv_on");
    expect(spec).toContain("conditions << 'COUCH_NO_GOOGLE_CAST' unless google_cast_on");
  });

  it('podspec logic flips with the switch (ruby)', () => {
    const ruby = spawnSync('ruby', ['--version']);
    if (ruby.status !== 0) return; // no ruby here: the static checks above still hold
    const spec = read('modules/lan-wss/ios/LanWss.podspec');
    const prelude = spec.split('Pod::Spec.new')[0]!;
    for (const [line, expected] of [
      ['export const BONJOUR_NATIVE_ON = true;', 'true'],
      ['export const BONJOUR_NATIVE_ON = false;', 'false'],
    ] as const) {
      const script =
        `require 'tmpdir'\nDir.mktmpdir do |d|\n` +
        `p = File.join(d, 'switch.ts'); File.write(p, "/** doc */\\n${line}\\n")\n` +
        prelude
          .replace(/google_cast_switch = .*\n/, "google_cast_switch = '/nonexistent'\n")
          .replace(/androidtv_switch = .*\n/, "androidtv_switch = '/nonexistent'\n")
          .replace(/bonjour_switch = .*\n/, 'bonjour_switch = p\n') +
        `\nputs bonjour_on\nputs androidtv_on\nputs google_cast_on\nend\n`;
      const r = spawnSync('ruby', ['-e', script], { encoding: 'utf8' });
      expect(r.stderr).toBe('');
      expect(r.stdout.trim().split('\n')).toEqual([expected, 'true', 'true']);
    }
  });
});

describe('LanBonjour.swift', () => {
  const swift = read(SWIFT);
  const m = swift.match(/#if COUCH_NO_BONJOUR\n([\s\S]*?)\n#else\n([\s\S]*)\n#endif\n?$/);

  it('has a stub LanBonjourClient with the same API when switched off', () => {
    expect(m).not.toBeNull();
    const [, stub, real] = m!;
    expect(stub).not.toMatch(/NWBrowser|NWConnection|NWParameters/);
    for (const sig of [
      'init(module: LanWssModule)',
      'func browse(id: String, types: [String], timeoutMs: Double) -> Bool',
      'func stop(id: String)',
      'func resolve(type: String, name: String, timeoutMs: Double, promise: Promise)',
      'func stopAll()',
    ]) {
      expect({ sig, stub: stub!.includes(sig) }).toEqual({ sig, stub: true });
      expect({ sig, real: real!.includes(sig) }).toEqual({ sig, real: true });
    }
    expect(stub).toContain('final class LanBonjourClient');
    expect(real).toContain('final class LanBonjourClient');
    // the stub never leaves a JS promise hanging
    expect(stub).toContain('promise.resolve(nil)');
  });

  it('browses Bonjour with TXT in local., emits onBonjourService, stops on a timer', () => {
    const real = m![2]!;
    expect(swift).toMatch(/^import Network$/m);
    expect(real).toContain('NWBrowser.Descriptor.bonjourWithTXTRecord(type: type, domain: "local.")');
    expect(real).toContain('NWBrowser(for: descriptor, using: params)');
    expect(real).toContain('browser.start(queue: self.queue)');
    expect(real).toContain('browseResultsChangedHandler');
    expect(real).toContain('module?.emit("onBonjourService", ["id": sessionId, "type": type, "name": name, "txt": txt])');
    expect(real).toContain('case let .service(name, _, _, _) = result.endpoint');
    expect(real).toContain('guard case let .bonjour(record) = metadata else { return out }');
    expect(real).toContain('self.queue.asyncAfter(deadline: .now() + .milliseconds(ms))');
    expect(real).toContain('browser.cancel()');
    // TXT is bounded; types are validated before any browser starts
    expect(real).toContain('lanBonjourMaxTxtEntries');
    expect(real).toContain('guard proto == "_tcp" || proto == "_udp" else { return nil }');
  });

  it('resolves with an IPv4-only NWConnection to the service endpoint and always settles the promise', () => {
    const real = m![2]!;
    expect(real).toContain('NWEndpoint.service(name: name, type: t, domain: "local.", interface: nil)');
    expect(real).toContain('params.defaultProtocolStack.internetProtocol as? NWProtocolIP.Options');
    expect(real).toContain('ip.version = .v4');
    expect(real).toContain('connection?.currentPath?.remoteEndpoint');
    expect(real).toContain('case let .hostPort(host, port) = remote');
    expect(real).toContain('case let .ipv4(address) = host');
    expect(real).toContain('connection.start(queue: self.queue)');
    expect(real).toContain('connection?.cancel()');
    // resolved exactly once (ready, failure, cancel or timeout)
    expect(real).toContain('if job.done { return }');
    expect(real).toContain('job.promise.resolve(found)');
    expect(real).toContain('private let queue = DispatchQueue(label: "couch.lanwss.bonjour")');
    // never force-unwrapped bridge data
    expect(real).not.toMatch(/as! |try!/);
  });
});

describe('LanWssModule registers the Bonjour API', () => {
  const mod = read('modules/lan-wss/ios/LanWssModule.swift');
  it('functions and events', () => {
    expect(mod).toContain('private lazy var bonjourClient = LanBonjourClient(module: self)');
    expect(mod).toContain('Function("bonjourBrowse") { (id: String, types: [String], timeoutMs: Double) -> Bool in');
    expect(mod).toContain('Function("bonjourStop") { (id: String) in');
    expect(mod).toContain('AsyncFunction("bonjourResolve") { (type: String, name: String, timeoutMs: Double, promise: Promise) in');
    expect(mod).toContain('self.bonjourClient.stopAll()');
    expect(mod).toContain('Events("onMessage", "onClose", "onError", "onTlsData", "onTlsClose", "onBonjourService")');
  });

  it('the JS types list the optional functions and the event', () => {
    const idx = read('modules/lan-wss/index.ts');
    for (const f of ['bonjourBrowse?(', 'bonjourStop?(', 'bonjourResolve?(', "addListener(event: 'onBonjourService'"]) expect(idx).toContain(f);
  });
});

describe('Bonjour JS wiring', () => {
  it('discovery deps prefer the Bonjour browser for mDNS', () => {
    const deps = read('src/native/discoveryDeps.ts');
    expect(deps).toContain("import { loadBonjour } from './bonjour';");
    expect(deps).toContain('const mdns = safe(loadBonjour) ?? safe(loadZeroconf);');
  });

  it('the adapter requires lan-wss only inside try', () => {
    const src = read('src/native/bonjour.ts');
    expect(src).not.toMatch(/^import[^;]*modules\/lan-wss/m);
    const at = src.indexOf("require('../../modules/lan-wss')");
    expect(at).toBeGreaterThan(src.indexOf('try {'));
  });
});
