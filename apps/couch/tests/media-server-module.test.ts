/**
 * Text checks over the media-server native sources (modules/media-server, T90). They cannot be
 * compiled here, so this only guards registration names, the JS contract src/native/mediaServer.ts
 * expects, and the security / HTTP rules (CSPRNG token, GET+HEAD, Range 206/416, DLNA headers,
 * stop on background, no logging). UNVERIFIED on a device.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(__dirname, '..', 'modules', 'media-server');
const INDEX = join(dir, 'index.ts');
const CONFIG = join(dir, 'expo-module.config.json');
const SWIFT_MODULE = join(dir, 'ios', 'MediaServerModule.swift');
const SWIFT_SERVER = join(dir, 'ios', 'MediaHttpServer.swift');
const PODSPEC = join(dir, 'ios', 'MediaServer.podspec');
const GRADLE = join(dir, 'android', 'build.gradle');
const MANIFEST = join(dir, 'android', 'src', 'main', 'AndroidManifest.xml');
const KOTLIN = join(dir, 'android', 'src', 'main', 'java', 'expo', 'modules', 'mediaserver', 'MediaServerModule.kt');
const README = join(dir, 'README.md');

const read = (p: string) => readFileSync(p, 'utf8');
const swift = () => read(SWIFT_MODULE) + '\n' + read(SWIFT_SERVER);

describe('media-server native module sources', () => {
  it('all files exist', () => {
    for (const p of [INDEX, CONFIG, SWIFT_MODULE, SWIFT_SERVER, PODSPEC, GRADLE, MANIFEST, KOTLIN, README]) {
      expect({ p, exists: existsSync(p) }).toEqual({ p, exists: true });
    }
  });

  it('expo-module.config.json names match the class names', () => {
    const cfg = JSON.parse(read(CONFIG)) as {
      platforms: string[];
      apple: { modules: string[] };
      android: { modules: string[] };
    };
    expect(cfg.platforms).toEqual(['apple', 'android']);
    expect(cfg.apple.modules).toEqual(['MediaServerModule']);
    expect(read(SWIFT_MODULE)).toMatch(/public class MediaServerModule\s*:\s*Module\b/);
    expect(cfg.android.modules).toEqual(['expo.modules.mediaserver.MediaServerModule']);
    const kt = read(KOTLIN);
    expect(kt).toMatch(/^package expo\.modules\.mediaserver\s*$/m);
    expect(kt).toMatch(/class MediaServerModule\s*:\s*Module\(\)/);
  });

  it('index.ts uses requireOptionalNativeModule (null when missing) and never throws at top level', () => {
    const src = read(INDEX);
    expect(src).toContain("import { requireOptionalNativeModule } from 'expo-modules-core';");
    expect(src).toContain("requireOptionalNativeModule<MediaServerNativeModule>('MediaServer')");
    expect(src).toContain('export default MediaServer;');
    expect(src).not.toMatch(/requireNativeModule\b/);
    expect(src).not.toMatch(/^\s*throw\b/m);
    // The shape the wrapper (src/native/mediaServer.ts) checks for.
    expect(src).toMatch(/serve\(uri: string, mime: string\): Promise<MediaServerServeResult>/);
    expect(src).toMatch(/stop\(id: string\): Promise<void>/);
    expect(src).toMatch(/stopAll\(\): Promise<void>/);
    for (const k of ['id: string', 'port: number', 'token: string']) expect(src).toContain(k);
  });

  it('both platforms expose Name("MediaServer") with serve, stop and stopAll', () => {
    expect(read(SWIFT_MODULE)).toContain('Name("MediaServer")');
    expect(read(SWIFT_MODULE)).toContain('AsyncFunction("serve") { (uri: String, mime: String, promise: Promise) in');
    expect(read(SWIFT_MODULE)).toContain('AsyncFunction("stop") { (id: String, promise: Promise) in');
    expect(read(SWIFT_MODULE)).toContain('AsyncFunction("stopAll") { (promise: Promise) in');
    const kt = read(KOTLIN);
    expect(kt).toContain('Name("MediaServer")');
    expect(kt).toContain('AsyncFunction("serve") { uri: String, mime: String, promise: Promise ->');
    expect(kt).toContain('AsyncFunction("stop") { id: String, promise: Promise ->');
    expect(kt).toContain('AsyncFunction("stopAll") { promise: Promise ->');
    for (const src of [swift(), kt]) {
      expect(src).toContain('"id"');
      expect(src).toContain('"port"');
      expect(src).toContain('"token"');
    }
  });

  it('tokens come from a CSPRNG: 18 bytes, base64url without padding', () => {
    const s = swift();
    expect(s).toContain('SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)');
    expect(s).toContain('[UInt8](repeating: 0, count: 18)');
    expect(s).toContain('.replacingOccurrences(of: "+", with: "-")');
    expect(s).toContain('.replacingOccurrences(of: "/", with: "_")');
    expect(s).toContain('.replacingOccurrences(of: "=", with: "")');
    const kt = read(KOTLIN);
    expect(kt).toContain('import java.security.SecureRandom');
    expect(kt).toContain('ByteArray(18)');
    expect(kt).toContain('Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP');
    expect(kt).not.toMatch(/java\.util\.Random\b|kotlin\.random|Math\.random/);
  });

  it('both platforms handle GET/HEAD, 404, 405, Range 206 and 416, and stream in 64 KiB chunks', () => {
    for (const src of [swift(), read(KOTLIN)]) {
      expect(src).toContain('"GET"');
      expect(src).toContain('"HEAD"');
      expect(src).toMatch(/405, (reason: )?"Method Not Allowed"/);
      expect(src).toMatch(/404, (reason: )?"Not Found"/);
      expect(src).toContain('"Partial Content"');
      expect(src).toContain('206');
      expect(src).toMatch(/416, (reason: )?"Range Not Satisfiable"/);
      expect(src).toContain('bytes */');
      expect(src).toContain('"bytes="');
      expect(src).toMatch(/contains\(","\)|contains\(','\)/); // several ranges -> full file
      expect(src).toContain('"Content-Length"');
      expect(src).toContain('"Content-Type"');
      expect(src).toContain('"Accept-Ranges"');
      expect(src).toContain('"Connection"');
      expect(src).toContain('"close"');
      expect(src).toContain('64 * 1024');
      expect(src).toContain('16 * 1024');
      expect(src).toContain('"transferMode.dlna.org"');
      expect(src).toContain('"Streaming"');
      expect(src).toContain('"Interactive"');
      expect(src).toContain('DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000');
      expect(src).toContain('ph://');
      expect(src).toContain('ERR_MEDIA_SERVER_URI');
      expect(src).toContain('>= 1024');
    }
  });

  it('iOS uses Network.framework on a serial queue and FileHandle with seek', () => {
    const s = swift();
    expect(s).toContain('import Network');
    expect(s).toContain('NWListener(using: params, on: NWEndpoint.Port.any)');
    expect(s).toContain('DispatchQueue(label: "couch.media-server")');
    expect(s).toContain('start(queue: queue)');
    expect(s).toContain('try handle.seek(toOffset: start)');
    expect(s).toContain('handle.read(upToCount: want)');
    expect(s).toContain('.contentProcessed');
    // Xcode 16 style rule from lan-wss: results typed before resolve.
    expect(s).toContain('let result: [String: Any] = ["id": entry.id, "port": Int(port), "token": entry.token]');
  });

  it('Android uses ServerSocket, an executor and ContentResolver for content://', () => {
    const kt = read(KOTLIN);
    expect(kt).toContain('ServerSocket(0, 50)');
    expect(kt).toContain('Executors.newCachedThreadPool(');
    expect(kt).toContain('resolver.openFileDescriptor(');
    expect(kt).toContain('resolver.openInputStream(');
    expect(kt).toContain('OpenableColumns.SIZE');
    expect(kt).toContain('"content://"');
  });

  it('both platforms stop when the app goes to the background', () => {
    const sm = read(SWIFT_MODULE);
    expect(sm).toContain('UIApplication.didEnterBackgroundNotification');
    expect(sm).toMatch(/didEnterBackgroundNotification[\s\S]{0,200}server\.stopAll\(/);
    expect(sm).toContain('OnDestroy');
    expect(read(KOTLIN)).toMatch(/OnActivityEntersBackground \{\s*server\.stopAll\(\)/);
    expect(read(KOTLIN)).toContain('OnDestroy');
  });

  it('never logs (tokens and file paths must not reach the system log)', () => {
    expect(swift()).not.toMatch(/\b(print|NSLog|debugPrint|os_log)\(|Logger\(/);
    expect(read(KOTLIN)).not.toMatch(/\bLog\.[a-z]\(|println\(|printStackTrace\(/);
  });

  it('build files: namespace, Gradle plugin, podspec', () => {
    const g = read(GRADLE);
    expect(g).toContain('namespace "expo.modules.mediaserver"');
    expect(g).toContain("id 'expo-module-gradle-plugin'");
    const p = read(PODSPEC);
    expect(p).toContain("s.name           = 'MediaServer'");
    expect(p).toContain("s.dependency 'ExpoModulesCore'");
    expect(p).toContain("s.source_files = '**/*.{h,m,swift}'");
    expect(read(MANIFEST)).toContain('android.permission.INTERNET');
  });

  it('README states it is unverified (never compiled, not tested on a device or TV)', () => {
    const r = read(README);
    expect(r).toContain('UNVERIFIED');
    expect(r).toContain('never compiled');
    expect(r).toContain('not tested on a device');
    expect(r).toContain('Not tested on a real TV');
  });
});
