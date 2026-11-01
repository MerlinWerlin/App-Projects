/**
 * Google TV remote native code (modules/lan-wss/ios/LanAtv.swift). It cannot be compiled here, so
 * these are text checks, in the style of lan-wss-sources / google-cast-switch:
 *  1. one switch line (src/core/drivers/androidtv/switch.ts) gates the JS loader and the podspec;
 *  2. LanAtv.swift has a stub with the same API under COUCH_NO_ANDROIDTV_TLS;
 *  3. the module registers atvKey / atvSign / atvSetCertificate / atvConnect / atvWrite / atvClose
 *     and reuses the onTlsData / onTlsClose events (the Events line is unchanged);
 *  4. the socket is RFC 1918-only, presents the Keychain identity and never answers a bare true;
 *  5. the key is RSA-2048 in the Keychain, signatures are PKCS#1 v1.5 SHA-256;
 *  6. the JS adapter loads lan-wss only through a guarded require.
 * Pure TS + Node built-ins (ruby for the podspec check when installed).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANDROIDTV_NATIVE_ON } from '../src/core/drivers/androidtv/switch';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const SWITCH_LINE = /^export const ANDROIDTV_NATIVE_ON = (true|false);$/m;
const ATV = 'modules/lan-wss/ios/LanAtv.swift';

describe('Google TV remote switch', () => {
  it('is one exact line and the only export of switch.ts', () => {
    const src = read('src/core/drivers/androidtv/switch.ts');
    expect(src.match(new RegExp(SWITCH_LINE.source, 'gm'))?.length).toBe(1);
    expect(src.match(/^export /gm)?.length).toBe(1);
    expect(typeof ANDROIDTV_NATIVE_ON).toBe('boolean');
  });

  it('gates the JS loader', () => {
    const src = read('src/native/androidTvTls.ts');
    expect(src).toMatch(/if \(!ANDROIDTV_NATIVE_ON\) return null;/);
    expect(src).toContain("from '../core/drivers/androidtv/switch'");
  });

  it('podspec reads the switch and sets COUCH_NO_ANDROIDTV_TLS when off', () => {
    const spec = read('modules/lan-wss/ios/LanWss.podspec');
    expect(spec).toContain("'src', 'core', 'drivers', 'androidtv', 'switch.ts'");
    expect(spec).toContain('ANDROIDTV_NATIVE_ON\\s*=\\s*false');
    expect(spec).toContain("conditions << 'COUCH_NO_ANDROIDTV_TLS' unless androidtv_on");
    expect(spec).toContain("conditions << 'COUCH_NO_GOOGLE_CAST' unless google_cast_on");
  });

  it('podspec logic flips with the switch (ruby)', () => {
    const ruby = spawnSync('ruby', ['--version']);
    if (ruby.status !== 0) return; // no ruby here: the static checks above still hold
    const spec = read('modules/lan-wss/ios/LanWss.podspec');
    const prelude = spec.split('Pod::Spec.new')[0]!;
    for (const [line, expected] of [
      ['export const ANDROIDTV_NATIVE_ON = true;', 'true'],
      ['export const ANDROIDTV_NATIVE_ON = false;', 'false'],
    ] as const) {
      const script =
        `require 'tmpdir'\nDir.mktmpdir do |d|\n` +
        `p = File.join(d, 'switch.ts'); File.write(p, "/** doc */\\n${line}\\n")\n` +
        prelude.replace(/google_cast_switch = .*\n/, "google_cast_switch = '/nonexistent'\n").replace(/androidtv_switch = .*\n/, 'androidtv_switch = p\n') +
        `\nputs androidtv_on\nputs google_cast_on\nend\n`;
      const r = spawnSync('ruby', ['-e', script], { encoding: 'utf8' });
      expect(r.stderr).toBe('');
      expect(r.stdout.trim().split('\n')).toEqual([expected, 'true']);
    }
  });
});

describe('LanAtv.swift', () => {
  const swift = read(ATV);
  const m = swift.match(/#if COUCH_NO_ANDROIDTV_TLS\n([\s\S]*?)\n#else\n([\s\S]*)\n#endif\n?$/);

  it('has a stub LanAtvClient with the same API when switched off', () => {
    expect(m).not.toBeNull();
    const [, stub, real] = m!;
    expect(stub).not.toMatch(/NWConnection|NWParameters|sec_protocol|SecItem|SecKey/);
    for (const sig of [
      'init(module: LanWssModule)',
      'func key(promise: Promise)',
      'func sign(dataBase64: String, promise: Promise)',
      'func setCertificate(certBase64: String, promise: Promise)',
      'func connect(id: String, host: String, port: Int, timeoutMs: Double, promise: Promise)',
      'func write(id: String, base64: String) -> Bool',
      'func close(id: String)',
      'func closeAll()',
    ]) {
      expect({ sig, stub: stub!.includes(sig) }).toEqual({ sig, stub: true });
      expect({ sig, real: real!.includes(sig) }).toEqual({ sig, real: true });
    }
    expect(stub).toContain('final class LanAtvClient');
    expect(real).toContain('final class LanAtvClient');
  });

  it('connects only to RFC 1918 hosts, presents the Keychain identity, trusts the TV only for them', () => {
    const real = m![2]!;
    const guard = real.indexOf('guard lanWssIsRfc1918Host(host) else {');
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(real.indexOf('NWConnection(host:'));
    expect(real).toContain('sec_protocol_options_set_local_identity(tlsOptions.securityProtocolOptions, localIdentity)');
    expect(real).toContain('sec_identity_create(secIdentity)');
    expect(real).toContain('sec_protocol_options_set_verify_block(tlsOptions.securityProtocolOptions');
    expect(real).toContain('complete(lanWssIsRfc1918Host(allowedHost))');
    expect(real).not.toMatch(/complete\(true\)/);
    expect(real).toContain('NWParameters(tls: tlsOptions, tcp: tcpOptions)');
    // peer key captured for the pairing hash and handed back on connect
    expect(real).toContain('peer.keyData = atvPeerKeyData(trust)');
    expect(real).toContain('pending?.resolve(["peerKeyBase64": peerKey])');
    for (const code of ['ERR_ATV_TLS_HOST', 'ERR_ATV_TLS_AUTH', 'ERR_ATV_TLS_IDENTITY', 'ERR_ATV_TLS_TIMEOUT', 'ERR_ATV_TLS_CONNECT']) {
      expect(real).toContain(code);
    }
    // bytes on the shared TLS events
    expect(real).toContain('emit("onTlsData", ["id": conn.id, "base64": data.base64EncodedString()])');
    expect(real).toContain('emit("onTlsClose", ["id": conn.id, "message": message])');
  });

  it('keeps an RSA-2048 key in the Keychain and signs with PKCS#1 v1.5 SHA-256', () => {
    const real = m![2]!;
    expect(swift).toMatch(/^import Security$/m);
    expect(swift).toMatch(/^import Network$/m);
    expect(real).toContain('kSecAttrKeySizeInBits as String: 2048');
    expect(real).toContain('kSecAttrKeyType as String: kSecAttrKeyTypeRSA');
    expect(real).toContain('kSecAttrIsPermanent as String: true');
    expect(real).toContain('kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly');
    expect(real).toContain('SecKeyCreateRandomKey(');
    expect(real).toContain('.rsaSignatureMessagePKCS1v15SHA256');
    expect(real).toContain('kSecClass as String: kSecClassIdentity');
    // the certificate must be for our key before it is stored
    expect(real).toContain('certKeyData == ours');
    // no private key export
    expect(real).not.toMatch(/SecKeyCopyExternalRepresentation\(privateKey/);
  });
});

describe('LanWssModule registers the Google TV API', () => {
  const mod = read('modules/lan-wss/ios/LanWssModule.swift');
  it('functions and events', () => {
    expect(mod).toContain('private lazy var atvClient = LanAtvClient(module: self)');
    expect(mod).toContain('AsyncFunction("atvKey") { (promise: Promise) in');
    expect(mod).toContain('AsyncFunction("atvSign") { (dataBase64: String, promise: Promise) in');
    expect(mod).toContain('AsyncFunction("atvSetCertificate") { (certBase64: String, promise: Promise) in');
    expect(mod).toMatch(/AsyncFunction\("atvConnect"\) \{ \(id: String, host: String, port: Int, timeoutMs: Double, promise: Promise\) in/);
    expect(mod).toContain('Function("atvWrite") { (id: String, base64: String) -> Bool in');
    expect(mod).toContain('Function("atvClose") { (id: String) in');
    expect(mod).toContain('self.atvClient.closeAll()');
    // no new events: the mutual-TLS socket reuses onTlsData / onTlsClose
    expect(mod).toContain('Events("onMessage", "onClose", "onError", "onTlsData", "onTlsClose")');
  });

  it('the JS types list the optional functions', () => {
    const idx = read('modules/lan-wss/index.ts');
    for (const f of ['atvKey?(', 'atvSign?(', 'atvSetCertificate?(', 'atvConnect?(', 'atvWrite?(', 'atvClose?(']) expect(idx).toContain(f);
  });
});

describe('JS adapter', () => {
  const src = read('src/native/androidTvTls.ts');
  it('requires lan-wss only inside a try block and checks every function', () => {
    const i = src.indexOf("require('../../modules/lan-wss')");
    expect(i).toBeGreaterThan(0);
    expect(src.lastIndexOf('try {', i)).toBeGreaterThan(src.lastIndexOf('} catch', i));
    expect(src).not.toMatch(/^import[^;]*modules\/lan-wss/m);
    for (const f of ['atvKey', 'atvSign', 'atvSetCertificate', 'atvConnect', 'atvWrite', 'atvClose']) expect(src).toContain(`'${f}'`);
  });

  it('is wired into the app transport behind a try', () => {
    const t = read('src/native/transport.ts');
    expect(t).toMatch(/try \{\n\s+atv = loadAndroidTvTransport\(\);\n\s+\} catch \{/);
    expect(t).toContain('if (atv) t.androidTv = atv;');
  });
});
