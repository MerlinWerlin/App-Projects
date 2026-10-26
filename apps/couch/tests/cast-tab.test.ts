/**
 * cast-1024 T91: Cast tab. The picker mapping (fake expo-image-picker), the CastController logic
 * with fake drivers / queue / media server, and static checks on the screen and config.
 * Node built-ins only (Jest and Bun).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CastController,
  castUnconfirmed,
  urlHostPort,
  demoUrl,
  formatClock,
  isCastActive,
  playAction,
  probedRendererPorts,
  realCastTvs,
  seekTarget,
  toCastMedia,
  videoEnded,
  type CastQueueLike,
} from '../src/core/cast/castController';
import { validateMedia, type CastMedia } from '../src/core/cast/didl';
import type { CastDriver, CastTarget } from '../src/core/cast/driver';
import type { MediaServer, ServeRequest } from '../src/core/cast/mediaServer';
import { DEFAULT_SLIDESHOW_INTERVAL, type QueueItem, type QueueSnapshot } from '../src/core/cast/queueTypes';
import type { CastSnapshot } from '../src/core/cast/session';
import { DriverError } from '../src/core/types';
import type { Tv } from '../src/core/types';
import { en } from '../src/i18n/catalog';
import { castDeliveryText, castNoticeText } from '../src/ui/cast/castNotice';
import {
  _setImagePickerLoader,
  assetsToQueueItems,
  hasMediaPicker,
  isWidelySupported,
  mimeFor,
  pickMedia,
  pickMediaDetailed,
  pickerOptions,
  type ImagePickerModule,
  type PickerAsset,
} from '../src/native/mediaPicker';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

/* ---------------- picker ---------------- */

function fakePicker(over: Partial<ImagePickerModule> & { assets?: PickerAsset[] | null; canceled?: boolean; granted?: boolean } = {}) {
  const calls: Record<string, unknown>[] = [];
  const mod: ImagePickerModule = {
    requestMediaLibraryPermissionsAsync: async () => ({ granted: over.granted ?? true }),
    launchImageLibraryAsync: async (opts) => {
      calls.push(opts);
      return { canceled: over.canceled ?? false, assets: over.assets === undefined ? [] : over.assets };
    },
    UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
    VideoExportPreset: { H264_1920x1080: 7 },
    ...over,
  };
  return { mod, calls };
}

describe('mediaPicker', () => {
  afterEach(() => _setImagePickerLoader());

  it('detects mime types from the picker, then the file name, then the asset type', () => {
    expect(mimeFor({ uri: 'file:///a', mimeType: 'image/JPEG' })).toBe('image/jpeg');
    expect(mimeFor({ uri: 'file:///x/IMG_1.HEIC' })).toBe('image/heic');
    expect(mimeFor({ uri: 'ph://abc', fileName: 'clip.mov' })).toBe('video/quicktime');
    expect(mimeFor({ uri: 'content://media/42?x=1.png' })).toBeNull();
    expect(mimeFor({ uri: 'content://media/42', type: 'video' })).toBe('video/mp4');
    expect(mimeFor({ uri: 'content://media/43', type: 'image' })).toBe('image/jpeg');
    expect(mimeFor({ uri: 'file:///a/b.mp4?token=1' })).toBe('video/mp4');
    expect(mimeFor({ uri: 'file:///a/b', mimeType: 'application/pdf' })).toBeNull();
  });

  it('accepts JPEG, PNG and MP4; flags the rest', () => {
    for (const m of ['image/jpeg', 'image/png', 'video/mp4']) expect(isWidelySupported(m)).toBe(true);
    for (const m of ['image/heic', 'video/quicktime', 'image/gif']) expect(isWidelySupported(m)).toBe(false);
  });

  it('maps assets to queue items (kind, title, seconds, size, unique ids)', () => {
    const items = assetsToQueueItems([
      { uri: 'file:///p/IMG_1.jpg', assetId: 'A1', type: 'image', fileName: 'IMG_1.jpg', fileSize: 1234 },
      { uri: 'file:///p/clip.mp4', assetId: 'A2', type: 'video', mimeType: 'video/mp4', duration: 61_400 },
      { uri: 'file:///p/IMG_1.jpg', assetId: 'A1', type: 'image' },
      { uri: '', type: 'image' },
      { uri: 'file:///p/doc', mimeType: 'application/pdf' },
    ]);
    expect(items.length).toBe(3);
    expect(items[0]).toMatchObject({ uri: 'file:///p/IMG_1.jpg', mime: 'image/jpeg', kind: 'photo', title: 'IMG_1.jpg', sizeBytes: 1234 });
    expect(items[1]).toMatchObject({ kind: 'video', mime: 'video/mp4', durationSec: 61, title: 'clip.mp4' });
    expect(items[2]!.title).toBe('IMG_1.jpg');
    expect(new Set(items.map((i) => i.id)).size).toBe(3);
  });

  it('asks for compatible (JPEG / H.264) representations, multi-select up to 50', () => {
    const { mod } = fakePicker();
    const o = pickerOptions(mod);
    expect(o).toMatchObject({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: 50,
      quality: 0.9,
      preferredAssetRepresentationMode: 'compatible',
      videoExportPreset: 7,
    });
    const bare = pickerOptions({ ...mod, VideoExportPreset: undefined, UIImagePickerPreferredAssetRepresentationMode: undefined });
    expect(bare['preferredAssetRepresentationMode']).toBe('compatible');
    expect('videoExportPreset' in bare).toBe(false);
  });

  it('returns the picked items', async () => {
    const { mod, calls } = fakePicker({ assets: [{ uri: 'file:///a.png', type: 'image' }] });
    _setImagePickerLoader(() => mod);
    expect(hasMediaPicker()).toBe(true);
    const items = await pickMedia();
    expect(items?.map((i) => i.mime)).toEqual(['image/png']);
    expect(calls.length).toBe(1);
  });

  it('cancel -> null', async () => {
    _setImagePickerLoader(() => fakePicker({ canceled: true, assets: null }).mod);
    expect(await pickMedia()).toBeNull();
    expect((await pickMediaDetailed()).kind).toBe('cancelled');
  });

  it('missing module -> null (unavailable), and the real loader finds nothing in tests', async () => {
    _setImagePickerLoader(() => null);
    expect(hasMediaPicker()).toBe(false);
    expect(await pickMedia()).toBeNull();
    expect((await pickMediaDetailed()).kind).toBe('unavailable');
    _setImagePickerLoader();
    expect(hasMediaPicker()).toBe(false);
    _setImagePickerLoader(() => {
      throw new Error('boom');
    });
    expect((await pickMediaDetailed()).kind).toBe('unavailable');
  });

  it('permission denied -> null, and the picker is never opened', async () => {
    const f = fakePicker({ granted: false, assets: [{ uri: 'file:///a.jpg', type: 'image' }] });
    _setImagePickerLoader(() => f.mod);
    expect((await pickMediaDetailed()).kind).toBe('denied');
    expect(await pickMedia()).toBeNull();
    expect(f.calls.length).toBe(0);
  });

  it('a picker that throws -> failed, never throws', async () => {
    _setImagePickerLoader(() =>
      fakePicker({
        launchImageLibraryAsync: async () => {
          throw new Error('native');
        },
      }).mod,
    );
    expect((await pickMediaDetailed()).kind).toBe('failed');
    expect(await pickMedia()).toBeNull();
  });
});

/* ---------------- controller ---------------- */

const IDLE: CastSnapshot = { state: 'idle', media: null, positionSec: null, durationSec: null, error: null, errorCode: null };
const MOCK: CastTarget = { id: 'mock:demo', name: 'Demo TV', kind: 'mock', host: 'demo', accepts: { photo: true, video: true } };
const DLNA: CastTarget = { id: 'dlna:uuid-1', name: 'Living room', kind: 'dlna', host: '192.168.1.20', accepts: { photo: true, video: true } };
const PHOTO_ONLY: CastTarget = { id: 'dlna:uuid-2', name: 'Frame', kind: 'dlna', host: '192.168.1.21', accepts: { photo: true, video: false } };

class FakeDriver implements CastDriver {
  snap: CastSnapshot = IDLE;
  loads: CastMedia[] = [];
  calls: string[] = [];
  failLoad: Error | null = null;
  disposed = false;
  private subs = new Set<(s: CastSnapshot) => void>();
  constructor(readonly target: CastTarget) {}
  emit(patch: Partial<CastSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const l of [...this.subs]) l(this.snap);
  }
  async load(media: CastMedia): Promise<void> {
    validateMedia(media);
    if (this.failLoad) throw this.failLoad;
    this.loads.push(media);
    this.emit({ state: 'playing', media, positionSec: 0, durationSec: media.durationSec ?? null });
  }
  async play(): Promise<void> {
    this.calls.push('play');
    this.emit({ state: 'playing' });
  }
  async pause(): Promise<void> {
    this.calls.push('pause');
    this.emit({ state: 'paused' });
  }
  async seek(p: number): Promise<void> {
    this.calls.push(`seek:${p}`);
    this.emit({ positionSec: p });
  }
  async stop(): Promise<void> {
    this.calls.push('stop');
    this.emit({ state: 'stopped' });
  }
  snapshot(): CastSnapshot {
    return this.snap;
  }
  subscribe(l: (s: CastSnapshot) => void): () => void {
    this.subs.add(l);
    return () => {
      this.subs.delete(l);
    };
  }
  dispose(): void {
    this.disposed = true;
    this.subs.clear();
  }
}

/** Tiny queue honouring the CastQueue contract the controller relies on. */
class FakeQueue implements CastQueueLike {
  snap: QueueSnapshot = { items: [], index: -1, slideshow: false, intervalSec: DEFAULT_SLIDESHOW_INTERVAL, loop: false };
  ended = 0;
  private subs = new Set<(s: QueueSnapshot) => void>();
  constructor(private readonly play: (item: QueueItem, index: number) => Promise<void>) {}
  private set(p: Partial<QueueSnapshot>): void {
    this.snap = { ...this.snap, ...p };
    for (const l of [...this.subs]) l(this.snap);
  }
  snapshot(): QueueSnapshot {
    return this.snap;
  }
  subscribe(l: (s: QueueSnapshot) => void): () => void {
    this.subs.add(l);
    return () => {
      this.subs.delete(l);
    };
  }
  add(items: QueueItem[]): void {
    this.set({ items: [...this.snap.items, ...items] });
  }
  remove(id: string): void {
    this.set({ items: this.snap.items.filter((i) => i.id !== id) });
  }
  move(from: number, to: number): void {
    const items = [...this.snap.items];
    const [x] = items.splice(from, 1);
    if (x) items.splice(to, 0, x);
    this.set({ items });
  }
  async start(index = 0): Promise<void> {
    const it = this.snap.items[index];
    if (!it) return;
    this.set({ index });
    await this.play(it, index);
  }
  async next(): Promise<void> {
    await this.start(this.snap.index + 1);
  }
  async prev(): Promise<void> {
    await this.start(Math.max(0, this.snap.index - 1));
  }
  setSlideshow(on: boolean): void {
    this.set({ slideshow: on });
  }
  setIntervalSec(sec: number): void {
    this.set({ intervalSec: sec });
  }
  setLoop(on: boolean): void {
    this.set({ loop: on });
  }
  async onMediaEnded(): Promise<void> {
    this.ended += 1;
    await this.next();
  }
  clear(): void {
    this.set({ items: [], index: -1 });
  }
  dispose(): void {
    this.subs.clear();
  }
}

function fakeServer(available: boolean) {
  const served: { req: ServeRequest; stopped: boolean }[] = [];
  let n = 0;
  let stopAll = 0;
  const server: MediaServer = {
    available,
    async serve(req) {
      const rec = { req, stopped: false };
      served.push(rec);
      n += 1;
      return { url: `http://192.168.1.5:8080/${'t'.repeat(22)}${n}.jpg`, stop: async () => void (rec.stopped = true) };
    },
    async stopAll() {
      stopAll += 1;
    },
  };
  return { server, served, stopAllCount: () => stopAll };
}

function setup(opts: { available?: boolean; targets?: CastTarget[] } = {}) {
  const drivers: FakeDriver[] = [];
  const srv = fakeServer(opts.available ?? true);
  let queue: FakeQueue | null = null;
  const c = new CastController({
    findTargets: async () => opts.targets ?? [DLNA],
    createDriver: (t) => {
      const d = new FakeDriver(t);
      drivers.push(d);
      return d;
    },
    mockTarget: MOCK,
    createMock: (t) => {
      const d = new FakeDriver(t);
      drivers.push(d);
      return d;
    },
    server: srv.server,
    createQueue: (play) => (queue = new FakeQueue(play)),
  });
  return { c, drivers, srv, queue: () => queue!, last: () => drivers[drivers.length - 1]! };
}

const photo = (id: string): QueueItem => ({ id, uri: `file:///p/${id}.jpg`, mime: 'image/jpeg', kind: 'photo', title: `${id}.jpg` });
const video = (id: string): QueueItem => ({ id, uri: `file:///p/${id}.mp4`, mime: 'video/mp4', kind: 'video', title: `${id}.mp4`, durationSec: 90 });
const TV: Tv = { id: 'tv1', name: 'Living room', model: 'X', platform: 'samsung', host: '192.168.1.20' };

describe('castController helpers', () => {
  it('demo URLs pass validateMedia (MockCast never fetches them)', () => {
    const url = demoUrl({ ...photo('A1#3'), id: 'A/1#3 x' });
    expect(url).toMatch(/^http:\/\/192\.168\.0\.2:8080\/demo-[A-Za-z0-9_-]+$/);
    expect(() => validateMedia(toCastMedia(photo('p'), url))).not.toThrow();
    expect(() => validateMedia(toCastMedia(photo('p'), 'file:///p/p.jpg'))).toThrow();
  });

  it('formats clock times and clamps seeks', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(null)).toBe('0:00');
    expect(seekTarget(5, 90, -10)).toBe(0);
    expect(seekTarget(85, 90, 10)).toBe(90);
    expect(seekTarget(null, null, 10)).toBe(10);
  });

  it('active only with an index and a loading / playing / paused driver', () => {
    const q: QueueSnapshot = { items: [photo('a')], index: 0, slideshow: false, intervalSec: 5, loop: false };
    expect(isCastActive(q, { ...IDLE, state: 'playing' })).toBe(true);
    expect(isCastActive(q, { ...IDLE, state: 'loading' })).toBe(true);
    expect(isCastActive(q, { ...IDLE, state: 'stopped' })).toBe(false);
    expect(isCastActive({ ...q, index: -1 }, { ...IDLE, state: 'playing' })).toBe(false);
    expect(isCastActive(null, null)).toBe(false);
  });

  it('a video that stops by itself has ended; photos and loads have not', () => {
    const vm = toCastMedia(video('v'), demoUrl(video('v')));
    const pm = toCastMedia(photo('p'), demoUrl(photo('p')));
    expect(videoEnded({ ...IDLE, state: 'playing', media: vm }, { ...IDLE, state: 'stopped', media: vm })).toBe(true);
    expect(videoEnded({ ...IDLE, state: 'playing', media: pm }, { ...IDLE, state: 'stopped', media: pm })).toBe(false);
    expect(videoEnded({ ...IDLE, state: 'loading', media: vm }, { ...IDLE, state: 'stopped', media: vm })).toBe(false);
  });

  it('play/pause action per state', () => {
    const q: QueueSnapshot = { items: [photo('a')], index: 0, slideshow: true, intervalSec: 5, loop: false };
    const pm = toCastMedia(photo('a'), demoUrl(photo('a')));
    const vm = toCastMedia(video('v'), demoUrl(video('v')));
    expect(playAction({ ...q, items: [] }, IDLE)).toBe('none');
    expect(playAction({ ...q, index: -1 }, IDLE)).toBe('start');
    expect(playAction(q, { ...IDLE, state: 'playing', media: pm })).toBe('pauseSlideshow');
    expect(playAction({ ...q, slideshow: false }, { ...IDLE, state: 'playing', media: pm })).toBe('resumeSlideshow');
    expect(playAction(q, { ...IDLE, state: 'playing', media: vm })).toBe('pause');
    expect(playAction(q, { ...IDLE, state: 'paused', media: vm })).toBe('resume');
    expect(playAction(q, { ...IDLE, state: 'stopped', media: vm })).toBe('start');
  });
});

describe('CastController', () => {
  it('demo mode (Expo Go: no file server) uses the demo TV and never serves files', async () => {
    const { c, srv, last } = setup({ available: false });
    await c.setContext({ demo: false, tvs: [TV] });
    const s = c.getSnapshot();
    expect(s.demo).toBe(true);
    expect(s.serverAvailable).toBe(false);
    expect(s.targets.map((t) => t.id)).toEqual(['mock:demo']);
    await c.addItems([photo('a'), photo('b')]);
    expect(srv.served.length).toBe(0);
    expect(last().target.kind).toBe('mock');
    expect(last().loads[0]!.url).toMatch(/^http:\/\/192\.168\.0\.2:8080\/demo-/);
    expect(c.getSnapshot().queue.index).toBe(0);
    expect(c.isActive()).toBe(true);
  });

  it('the remote in demo mode also means demo casting', async () => {
    const { c } = setup({ available: true });
    await c.setContext({ demo: true, tvs: [] });
    expect(c.getSnapshot().demo).toBe(true);
    expect(c.getSnapshot().targetId).toBe('mock:demo');
  });

  it('real mode: finds targets, serves each item, stops the previous served file', async () => {
    const { c, srv, last } = setup();
    await c.setContext({ demo: false, tvs: [TV] });
    expect(c.getSnapshot().demo).toBe(false);
    expect(c.getSnapshot().targetId).toBe('dlna:uuid-1');
    await c.addItems([photo('a'), photo('b')]);
    expect(srv.served.map((s) => s.req.uri)).toEqual(['file:///p/a.jpg']);
    expect(last().loads[0]).toMatchObject({ title: 'a.jpg', mime: 'image/jpeg', kind: 'photo' });
    await c.next();
    expect(srv.served.length).toBe(2);
    expect(srv.served[0]!.stopped).toBe(true);
    expect(srv.served[1]!.stopped).toBe(false);
    await c.stop();
    expect(srv.served[1]!.stopped).toBe(true);
    expect(srv.stopAllCount()).toBe(1);
    expect(last().calls).toContain('stop');
    expect(c.isActive()).toBe(false);
  });

  it('when a video ends on the TV the queue moves on; a stop we asked for does not', async () => {
    const { c, last, queue } = setup();
    await c.setContext({ demo: false, tvs: [TV] });
    await c.addItems([video('v1'), video('v2'), video('v3')]);
    last().emit({ state: 'stopped' });
    await Promise.resolve();
    await Promise.resolve();
    expect(queue().ended).toBe(1);
    expect(c.getSnapshot().queue.index).toBe(1);
    await c.stop();
    expect(queue().ended).toBe(1);
  });

  it('play/pause, seek and errors', async () => {
    const { c, last } = setup();
    await c.setContext({ demo: false, tvs: [TV] });
    await c.addItems([video('v')]);
    await c.togglePlay();
    expect(last().calls).toEqual(['pause']);
    await c.togglePlay();
    expect(last().calls).toEqual(['pause', 'play']);
    last().emit({ positionSec: 85 });
    await c.seekBy(10);
    expect(last().calls).toContain('seek:90');
    last().failLoad = new DriverError('unsupported', 'The TV refused it.');
    await c.start(0);
    expect(c.getSnapshot().error).toBe('The TV refused it.');
    c.dismissError();
    expect(c.getSnapshot().error).toBeNull();
  });

  it('photo play/pause toggles the slideshow', async () => {
    const { c } = setup({ available: false });
    await c.setContext({ demo: true, tvs: [] });
    await c.addItems([photo('a'), photo('b')]);
    expect(c.getSnapshot().queue.slideshow).toBe(false);
    await c.togglePlay();
    expect(c.getSnapshot().queue.slideshow).toBe(true);
    await c.togglePlay();
    expect(c.getSnapshot().queue.slideshow).toBe(false);
  });

  it('refuses a video on a photo-only target with a translated message', async () => {
    const { c, last } = setup({ targets: [PHOTO_ONLY] });
    await c.setContext({ demo: false, tvs: [TV] });
    await c.addItems([video('v')]);
    expect(last().loads.length).toBe(0);
    expect(c.getSnapshot().error).toBe(en['core.driver.cast.formatUnsupported']);
  });

  it('no targets found: nothing selected, adding items does not start', async () => {
    const { c, drivers } = setup({ targets: [] });
    await c.setContext({ demo: false, tvs: [TV] });
    expect(c.getSnapshot().targetId).toBeNull();
    await c.addItems([photo('a')]);
    expect(drivers.length).toBe(0);
    expect(c.getSnapshot().queue.items.length).toBe(1);
    expect(c.getSnapshot().queue.index).toBe(-1);
  });

  it('switching targets stops and disposes the previous driver', async () => {
    const { c, drivers } = setup({ targets: [DLNA, PHOTO_ONLY] });
    await c.setContext({ demo: false, tvs: [TV] });
    await c.addItems([photo('a')]);
    const first = drivers[0]!;
    c.selectTarget(PHOTO_ONLY.id);
    await Promise.resolve();
    await Promise.resolve();
    expect(first.calls).toContain('stop');
    expect(first.disposed).toBe(true);
    expect(c.getSnapshot().targetId).toBe(PHOTO_ONLY.id);
    expect(c.getSnapshot().cast.state).toBe('idle');
  });

  it('the same TVs do not trigger a new search', async () => {
    let searches = 0;
    const c = new CastController({
      findTargets: async () => {
        searches += 1;
        return [DLNA];
      },
      createDriver: (t) => new FakeDriver(t),
      mockTarget: MOCK,
      createMock: (t) => new FakeDriver(t),
      server: fakeServer(true).server,
      createQueue: (play) => new FakeQueue(play),
    });
    await c.setContext({ demo: false, tvs: [TV] });
    await c.setContext({ demo: false, tvs: [{ ...TV }] });
    expect(searches).toBe(1);
    await c.refresh();
    expect(searches).toBe(2);
    c.dispose();
  });
});

/* ---------------- static checks ---------------- */

describe('Cast tab wiring (static)', () => {
  const screen = read('app/(tabs)/cast.tsx');

  it('the cast screen and its components never import src/plus (casting basics are free)', () => {
    const files = [
      'app/(tabs)/cast.tsx',
      'src/state/cast.tsx',
      'src/core/cast/castController.ts',
      'src/native/mediaPicker.ts',
      'src/ui/cast/QueueList.tsx',
      'src/ui/cast/TransportBar.tsx',
      'src/ui/cast/SlideshowControls.tsx',
      'src/ui/cast/TargetPicker.tsx',
      'src/ui/cast/CastPill.tsx',
      'src/ui/cast/IconButton.tsx',
    ];
    for (const f of files) expect({ f, plus: /from\s+['"][^'"]*\/plus(\/|['"])/.test(read(f)) }).toEqual({ f, plus: false });
  });

  it('registers the Cast tab after Remote, and the AirPlay guide route', () => {
    const tabs = read('app/(tabs)/_layout.tsx');
    const remote = tabs.indexOf('name="remote"');
    const cast = tabs.indexOf('name="cast"');
    expect(remote).toBeGreaterThan(0);
    expect(cast).toBeGreaterThan(remote);
    expect(cast).toBeLessThan(tabs.indexOf('name="apps"'));
    expect(tabs).toContain("t('app.tabs.cast')");
    expect(en['app.tabs.cast']).toBe('Cast');
    const root = read('app/_layout.tsx');
    expect(root).toMatch(/<Stack.Screen name="airplay"[ />]/);
    expect(root).toMatch(/<SessionProvider>[\s\S]*<CastProvider>[\s\S]*<\/CastProvider>[\s\S]*<\/SessionProvider>/);
  });

  it('declares the expo-image-picker dependency and its config plugin (photos only)', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
    // Pinned to the same Expo SDK as `expo` itself (build page: SDK 55; App-Projects: SDK 57).
    expect(pkg.dependencies['expo-image-picker'].split('.')[0]).toBe(pkg.dependencies['expo'].split('.')[0]);
    const names = Object.keys(pkg.dependencies);
    expect(names).toEqual([...names].sort());
    const app = JSON.parse(read('app.json')) as { expo: { plugins: unknown[] } };
    const plugin = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-image-picker') as [string, Record<string, unknown>] | undefined;
    expect(plugin).toBeDefined();
    expect(plugin![1]).toEqual({
      photosPermission: 'Couch shows the photos and videos you pick on your TV.',
      cameraPermission: false,
      microphonePermission: false,
    });
  });

  it('says how casting works in Expo Go, and shows it', () => {
    expect(en['app.cast.expoGoNote']).toBe('Casting to a real TV works in the TestFlight build. Here you can try it in demo mode.');
    expect(screen).toContain("t('app.cast.expoGoNote')");
    expect(screen).toContain('!snap.serverAvailable');
  });

  it('includes the AirPlay shortcut, the empty state and the picker', () => {
    expect(screen).toContain("<AirPlayButton onShowGuide={() => router.push('/airplay')} />");
    expect(screen).toContain('<EmptyState');
    expect(screen).toContain('pickMediaDetailed()');
    expect(screen).toContain('<LargeTitleHeader');
  });

  it('transport arrows never mirror in right-to-left languages', () => {
    const bar = read('src/ui/cast/TransportBar.tsx');
    expect(bar).toContain('<NeverMirror');
    expect(bar).toMatch(/<NeverMirror[^>]*>\s*<IconButton\s+icon=\{<RemoteIcon name="left"/);
  });

  it('the remote routes Play/Pause to an active cast and shows the casting pill', () => {
    const remote = read('app/(tabs)/remote.tsx');
    expect(remote).toContain('useCastRouting()');
    expect(remote).toContain('<RemoteCastPill />');
    expect(remote).toMatch(/if \(castHandles\(key\)\) \{[\s\S]*?castTogglePlay\(\);[\s\S]*?return;/);
    const state = read('src/state/cast.tsx');
    expect(state).toContain("key === 'PLAY_PAUSE'");
  });
});

/* ---------------- D145-2: say why casting does not reach a real TV ---------------- */

describe('Cast notices (oversight D145-2)', () => {
  const ROKU_TV: Tv = { id: 'tv2', name: 'Bedroom', model: 'R', platform: 'roku', host: '192.168.1.30' };
  const IR_TV: Tv = { id: 'tv3', name: 'Kitchen', model: 'I', platform: 'ir', host: 'ir' };
  const fakeT = (key: string, params?: Record<string, string | number>) =>
    key + (params ? ' ' + JSON.stringify(params) : '');

  it('real TV connected but no receiver found: noReceiver names the TV and the probed ports', async () => {
    const { c } = setup({ targets: [] });
    await c.setContext({ demo: false, tvs: [TV] });
    const s = c.getSnapshot();
    expect(s.demo).toBe(false);
    expect(s.targetId).toBeNull();
    expect(s.notice).toEqual({ kind: 'noReceiver', tvNames: ['Living room'], ports: [9197, 52323], searched: false });
  });

  it('noReceiver says whether the network search ran', async () => {
    const drivers: CastDriver[] = [];
    const c = new CastController({
      findTargets: async () => [],
      createDriver: (t) => {
        throw new Error('unused ' + t.id + drivers.length);
      },
      mockTarget: MOCK,
      createMock: (t) => {
        throw new Error('unused ' + t.id);
      },
      server: { available: true } as unknown as MediaServer,
      createQueue: () => ({ snapshot: () => ({ items: [], index: -1, slideshow: false, intervalSec: 5, loop: false }), subscribe: () => () => undefined }) as unknown as CastQueueLike,
      canSearch: true,
    });
    await c.setContext({ demo: false, tvs: [TV] });
    expect(c.getSnapshot().notice).toMatchObject({ kind: 'noReceiver', searched: true });
  });

  it('a receiver found clears the notice', async () => {
    const { c } = setup();
    await c.setContext({ demo: false, tvs: [TV] });
    expect(c.getSnapshot().notice).toBeNull();
  });

  it('real TV connected but no phone media server: says so instead of using the demo TV silently', async () => {
    const { c } = setup({ available: false });
    await c.setContext({ demo: false, tvs: [IR_TV, ROKU_TV, TV] });
    const s = c.getSnapshot();
    expect(s.demo).toBe(true);
    expect(s.notice).toEqual({ kind: 'serverUnavailable', tvName: 'Bedroom' });
  });

  it('no real TV and no media server (Expo Go): the Expo Go note; remote in demo mode: the demo note', async () => {
    const a = setup({ available: false });
    await a.c.setContext({ demo: false, tvs: [IR_TV] });
    expect(a.c.getSnapshot().notice).toEqual({ kind: 'expoGo' });
    const b = setup({ available: true });
    await b.c.setContext({ demo: true, tvs: [TV] });
    expect(b.c.getSnapshot().notice).toEqual({ kind: 'demo' });
  });

  it('infrared TVs never count as cast TVs', () => {
    expect(realCastTvs([TV, ROKU_TV, IR_TV]).map((t) => t.id)).toEqual(['tv1', 'tv2']);
    expect(probedRendererPorts()).toEqual([9197, 52323]);
  });

  it('notice text uses catalogue keys with the TV name and ports', () => {
    expect(castNoticeText({ kind: 'serverUnavailable', tvName: 'Bedroom' }, fakeT as never)).toBe('ui.cast.serverUnavailable {"name":"Bedroom"}');
    expect(castNoticeText({ kind: 'noReceiver', tvNames: ['A', 'B'], ports: [9197, 52323], searched: false }, fakeT as never)).toBe(
      'ui.cast.noReceiver {"name":"A, B","ports":"9197, 52323"} ui.cast.noReceiverNoSearch',
    );
    expect(castNoticeText({ kind: 'noReceiver', tvNames: ['A'], ports: [9197], searched: true }, fakeT as never)).toContain('ui.cast.noReceiverSearched');
    expect(castNoticeText({ kind: 'demo' }, fakeT as never)).toBeNull();
    expect(en['ui.cast.noReceiver']).toContain('{ports}');
    expect(en['ui.cast.serverUnavailable']).toContain('{name}');
  });

  it('the screen renders every notice kind', () => {
    const screen = read('app/(tabs)/cast.tsx');
    expect(screen).toContain("snap.notice?.kind === 'demo'");
    expect(screen).toContain("snap.notice?.kind === 'expoGo'");
    expect(screen).toContain('castNoticeText(snap.notice, t)');
    expect(read('src/state/cast.tsx')).toContain('canSearch: !!udp');
  });
});

/* ---------------- owner brief 25 Oct 2026: real TV accepted the cast, nothing appeared ---------------- */

describe('Cast delivery state (owner TestFlight 1.0.1 cast test)', () => {
  const fakeT = (key: string, params?: Record<string, string | number>) =>
    key + (params ? ' ' + JSON.stringify(params) : '');

  it('a send to a real TV records where it went and stays unconfirmed until the TV says it is showing it', async () => {
    const { c, last } = setup();
    await c.setContext({ demo: false, tvs: [TV] });
    await c.addItems([photo('a')]);
    const s = c.getSnapshot();
    expect(s.delivery).toEqual({ tvName: 'Living room', via: 'dlna', tvHost: '192.168.1.20', fileHost: '192.168.1.5:8080' });
    expect(castUnconfirmed(s)).toBe(true);
    last().emit({ confirmed: true });
    expect(castUnconfirmed(c.getSnapshot())).toBe(false);
  });

  it('a failed send keeps the delivery so the error says where it went; stop clears it', async () => {
    const { c, last } = setup();
    await c.setContext({ demo: false, tvs: [TV] });
    last().failLoad = new DriverError('network', 'boom');
    await c.addItems([photo('a')]);
    expect(c.getSnapshot().error).toBe('boom');
    expect(c.getSnapshot().delivery).toMatchObject({ tvHost: '192.168.1.20' });
    await c.stop();
    expect(c.getSnapshot().delivery).toBeNull();
  });

  it('demo casting never claims a delivery and is never unconfirmed', async () => {
    const { c } = setup({ available: false });
    await c.setContext({ demo: false, tvs: [] });
    await c.addItems([photo('a')]);
    const s = c.getSnapshot();
    expect(s.delivery).toBeNull();
    expect(castUnconfirmed(s)).toBe(false);
  });

  it('a Roku target is reported as the Roku media player', async () => {
    const ROKU: CastTarget = { id: 'roku:192.168.1.30', name: 'Bedroom', kind: 'roku', host: '192.168.1.30', accepts: { photo: true, video: true } };
    const { c } = setup({ targets: [ROKU] });
    await c.setContext({ demo: false, tvs: [TV] });
    await c.addItems([video('v')]);
    expect(c.getSnapshot().delivery).toMatchObject({ via: 'roku', tvHost: '192.168.1.30' });
  });

  it('delivery text names the TV address and the phone address', () => {
    expect(castDeliveryText({ tvName: 'A', via: 'dlna', tvHost: '192.168.1.20', fileHost: '192.168.1.5:8080' }, fakeT as never)).toBe(
      'ui.cast.deliveryDlna {"tvHost":"192.168.1.20","fileHost":"192.168.1.5:8080"}',
    );
    expect(castDeliveryText({ tvName: 'A', via: 'roku', tvHost: 'h', fileHost: '' }, fakeT as never)).toContain('ui.cast.deliveryRoku');
    expect(urlHostPort('http://192.168.1.5:8080/abc.jpg')).toBe('192.168.1.5:8080');
    expect(urlHostPort('nope')).toBe('');
    expect(en['ui.cast.deliveryDlna']).toContain('{fileHost}');
    expect(en['ui.cast.sent']).toContain('{title}');
  });

  it('the screen shows sent / help / delivery lines', () => {
    const screen = read('app/(tabs)/cast.tsx');
    expect(screen).toContain('castUnconfirmed(snap)');
    expect(screen).toContain("t('ui.cast.sent'");
    expect(screen).toContain("t('ui.cast.unconfirmedHelp')");
    expect(screen).toContain('castDeliveryText(snap.delivery, t)');
  });
});
