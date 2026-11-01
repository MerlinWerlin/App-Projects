/**
 * Text checks over the lan-wss native sources (modules/lan-wss). They cannot be compiled here, so
 * this only guards that the files exist, are registered under the right names, and that the relaxed
 * TLS path is RFC 1918-only and gated by the allowSelfSignedLan flag. UNVERIFIED on a device.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(__dirname, '..', 'modules', 'lan-wss');
const SWIFT = join(dir, 'ios', 'LanWssModule.swift');
const SWIFT_FETCH = join(dir, 'ios', 'LanFetch.swift');
const SWIFT_TLS = join(dir, 'ios', 'LanTls.swift');
const PODSPEC = join(dir, 'ios', 'LanWss.podspec');
const GRADLE = join(dir, 'android', 'build.gradle');
const KOTLIN = join(dir, 'android', 'src', 'main', 'java', 'expo', 'modules', 'lanwss', 'LanWssModule.kt');

const read = (p: string) => readFileSync(p, 'utf8');

describe('lan-wss native sources', () => {
  it('all native files exist', () => {
    for (const p of [SWIFT, SWIFT_FETCH, SWIFT_TLS, PODSPEC, GRADLE, KOTLIN]) {
      expect({ p, exists: existsSync(p) }).toEqual({ p, exists: true });
    }
  });

  it('expo-module.config.json names match the class names', () => {
    const cfg = JSON.parse(read(join(dir, 'expo-module.config.json'))) as {
      apple: { modules: string[] };
      android: { modules: string[] };
    };
    expect(cfg.apple.modules).toEqual(['LanWssModule']);
    expect(read(SWIFT)).toMatch(/public class LanWssModule\s*:\s*Module\b/);

    expect(cfg.android.modules).toEqual(['expo.modules.lanwss.LanWssModule']);
    const kt = read(KOTLIN);
    expect(kt).toMatch(/^package expo\.modules\.lanwss\s*$/m);
    expect(kt).toMatch(/class LanWssModule\s*:\s*Module\(\)/);
  });

  it('both platforms expose the JS contract (name, events, functions)', () => {
    // iOS adds onBonjourService (LanBonjour.swift); Android has no Bonjour browser.
    expect(read(SWIFT)).toContain('Events("onMessage", "onClose", "onError", "onTlsData", "onTlsClose", "onBonjourService")');
    expect(read(KOTLIN)).toContain('Events("onMessage", "onClose", "onError", "onTlsData", "onTlsClose")');
    for (const src of [read(SWIFT), read(KOTLIN)]) {
      expect(src).toContain('Name("LanWss")');
      expect(src).toContain('AsyncFunction("connect")');
      expect(src).toContain('Function("send")');
      expect(src).toContain('Function("close")');
    }
  });

  it('both platforms implement the RFC 1918 check (10/8, 172.16/12, 192.168/16)', () => {
    for (const src of [read(SWIFT), read(KOTLIN)]) {
      expect(src).toMatch(/a == 10\b/);
      expect(src).toMatch(/a == 172 && b (>= 16 && b <= 31|in 16\.\.31)/);
      expect(src).toMatch(/a == 192 && b == 168/);
    }
  });

  it('Swift relaxed trust is gated by the allow flag, wss, host match and RFC 1918', () => {
    const src = read(SWIFT);
    expect(src).toMatch(/if allowSelfSignedLan && scheme == "wss" && lanWssIsRfc1918Host\(host\)/);
    expect(src).toContain('NSURLAuthenticationMethodServerTrust');
    expect(src).toContain('space.host == allowedHost');
    expect(src).toContain('urlHost == allowedHost');
    expect(src).toContain('.performDefaultHandling');
    expect(src).toContain('.useCredential, URLCredential(trust: trust)');
    // .useCredential appears only once, after the guard.
    expect(src.split('.useCredential').length - 1).toBe(1);
    expect(src.indexOf('.performDefaultHandling')).toBeLessThan(src.indexOf('.useCredential'));
  });

  it('Kotlin relaxed client is gated by the allow flag and pins the hostname, no redirects', () => {
    const src = read(KOTLIN);
    expect(src).toMatch(/if \(allowSelfSignedLan && isWss && [^\n]*isRfc1918Host\(rawHost\)\)/);
    expect(src).toContain('if (relaxedHost != null) relaxedClient(relaxedHost) else defaultClient');
    expect(src).toContain('.hostnameVerifier { requested, _ -> requested == host }');
    expect(src).toContain('.followRedirects(false)');
    expect(src).toContain('.followSslRedirects(false)');
    // The permissive trust manager only exists inside relaxedClient.
    const start = src.indexOf('private fun relaxedClient(');
    expect(start).toBeGreaterThan(0);
    expect(src.indexOf('X509TrustManager {')).toBeGreaterThan(start);
    expect(src.split('relaxedClient(').length - 1).toBe(3); // definition + gated calls in connect and fetch
    // Two permissive trust managers: relaxedClient (wss/https) and lanTlsSocketFactory (T106 TLS socket).
    expect(src.split('X509TrustManager {').length - 1).toBe(2);
    const tls = src.indexOf('private fun lanTlsSocketFactory(');
    expect(tls).toBeGreaterThan(start);
    expect(src.indexOf('X509TrustManager {', src.indexOf('X509TrustManager {') + 1)).toBeGreaterThan(tls);
  });

  it('both platforms expose the T106 TLS socket (tlsConnect / tlsWrite / tlsClose)', () => {
    const swift = read(SWIFT);
    expect(swift).toMatch(
      /AsyncFunction\("tlsConnect"\) \{ \(id: String, host: String, port: Int, timeoutMs: Double, promise: Promise\) in/,
    );
    expect(swift).toContain('Function("tlsWrite") { (id: String, base64: String) -> Bool in');
    expect(swift).toContain('Function("tlsClose") { (id: String) in');
    expect(swift).toContain('self.tlsClient.closeAll()');
    const kt = read(KOTLIN);
    expect(kt).toMatch(/AsyncFunction\("tlsConnect"\) \{ id: String, host: String, port: Int, timeoutMs: Double, promise: Promise ->/);
    expect(kt).toContain('Function("tlsWrite") { id: String, base64: String ->');
    expect(kt).toContain('Function("tlsClose") { id: String ->');
    for (const src of [read(SWIFT_TLS), kt]) {
      expect(src).toContain('"onTlsData"');
      expect(src).toContain('"onTlsClose"');
      expect(src).toContain('"base64"');
      expect(src).toContain('ERR_LAN_TLS_HOST');
      expect(src).toContain('ERR_LAN_TLS_TIMEOUT');
    }
  });

  it('Swift TLS socket connects only to RFC 1918 hosts and trusts the certificate only for them', () => {
    const src = read(SWIFT_TLS);
    expect(src).toContain('import Network');
    // Host refused before any connection is made.
    const guard = src.indexOf('guard lanWssIsRfc1918Host(host) else {');
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(src.indexOf('NWConnection(host:'));
    expect(src).toContain('sec_protocol_options_set_verify_block(tlsOptions.securityProtocolOptions');
    expect(src).toContain('complete(lanWssIsRfc1918Host(allowedHost))');
    // The verify block never answers a bare true.
    expect(src).not.toMatch(/complete\(true\)/);
    expect(src).toContain('NWParameters(tls: tlsOptions, tcp: tcpOptions)');
  });

  it('Kotlin TLS socket connects only to RFC 1918 hosts; the relaxed factory refuses others', () => {
    const src = read(KOTLIN);
    const fn = src.slice(src.indexOf('private fun tlsConnect('), src.indexOf('private fun tlsReadLoop('));
    expect(fn).toContain('if (!isRfc1918Host(host)) {');
    expect(fn.indexOf('if (!isRfc1918Host(host)) {')).toBeLessThan(fn.indexOf('Socket()'));
    expect(fn).toContain('lanTlsSocketFactory(host).createSocket(raw, host, port, true) as SSLSocket');
    const factory = src.slice(src.indexOf('private fun lanTlsSocketFactory('));
    expect(factory).toMatch(/^private fun lanTlsSocketFactory\(host: String\): SSLSocketFactory \{\s*if \(!isRfc1918Host\(host\)\) throw/);
    expect(src.split('lanTlsSocketFactory(').length - 1).toBe(2); // definition + the gated call in tlsConnect
    expect(src).toContain('import android.util.Base64');
  });

  it('both platforms expose fetch(url, method, headersJson, body, timeoutMs, allowSelfSignedLan)', () => {
    const swift = read(SWIFT);
    expect(swift).toMatch(
      /AsyncFunction\("fetch"\) \{ \(url: String, method: String, headersJson: String, body: String\?, timeoutMs: Double, allowSelfSignedLan: Bool, promise: Promise\) in/,
    );
    expect(swift).toContain('self.fetchClient.fetch(');
    const kt = read(KOTLIN);
    expect(kt).toMatch(
      /AsyncFunction\("fetch"\) \{ url: String, method: String, headersJson: String, body: String\?, timeoutMs: Double, allowSelfSignedLan: Boolean, promise: Promise ->/,
    );
    for (const src of [read(SWIFT_FETCH), kt]) {
      expect(src).toContain('"status"');
      expect(src).toContain('"headersJson"');
      expect(src).toContain('"body"');
      expect(src).toContain('ERR_LAN_FETCH_TIMEOUT');
    }
  });

  it('Swift fetch relaxed trust is gated by the allow flag, https, host match and RFC 1918; no redirects', () => {
    const src = read(SWIFT_FETCH);
    expect(src).toMatch(/if allowSelfSignedLan && scheme == "https" && lanWssIsRfc1918Host\(host\)/);
    expect(src).toContain('NSURLAuthenticationMethodServerTrust');
    expect(src).toContain('space.host == allowedHost');
    expect(src).toContain('urlHost == allowedHost');
    expect(src.split('.useCredential').length - 1).toBe(1);
    expect(src.indexOf('.performDefaultHandling')).toBeLessThan(src.indexOf('.useCredential'));
    expect(src).toContain('willPerformHTTPRedirection');
    expect(src).toContain('completionHandler(nil)');
    // No credential store, so a Digest 401 reaches JS with its headers.
    expect(src).toContain('config.urlCredentialStorage = nil');
    // No session-level trust handler (would bypass the per-task rule).
    expect(src).not.toMatch(/func urlSession\(\s*_ session: URLSession,\s*didReceive challenge/);
  });

  it('Kotlin fetch relaxed client is gated by the allow flag, https and RFC 1918', () => {
    const src = read(KOTLIN);
    expect(src).toMatch(/if \(allowSelfSignedLan && isHttps && [^\n]*isRfc1918Host\(rawHost\)\)/);
    expect(src).toContain('val base = if (relaxedHost != null) relaxedClient(relaxedHost) else defaultClient');
    expect(src).toContain('.callTimeout(ms, TimeUnit.MILLISECONDS)');
    expect(src).toContain('import org.json.JSONObject');
  });

  it('Android Gradle depends on OkHttp and uses the lanwss namespace', () => {
    const g = read(GRADLE);
    expect(g).toContain('implementation "com.squareup.okhttp3:okhttp:4.12.0"');
    expect(g).toContain('namespace "expo.modules.lanwss"');
    expect(g).toContain("id 'expo-module-gradle-plugin'");
  });

  it('podspec depends on ExpoModulesCore and ships the Swift sources', () => {
    const p = read(PODSPEC);
    expect(p).toContain("s.name           = 'LanWss'");
    expect(p).toContain("s.dependency 'ExpoModulesCore'");
    expect(p).toContain("s.source_files = '**/*.{h,m,swift}'");
  });
});
