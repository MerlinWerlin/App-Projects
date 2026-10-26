/**
 * T106: the TLS TcpFactory over the lan-wss module (Google Cast). In tests the native module is
 * absent (like Expo Go), so loadLanTls() is null; behaviour is checked against a fake module.
 */
import { hasLanTls, lanTlsFromModule, loadLanTls, type LanTlsModule } from '../src/native/lanTls';

type Listener = (e: { id: string; base64?: string; message?: string }) => void;

function fakeModule(opts: { fail?: Error } = {}) {
  const listeners: { event: string; cb: Listener; removed: boolean }[] = [];
  const connects: { id: string; host: string; port: number; timeoutMs: number }[] = [];
  const writes: { id: string; base64: string }[] = [];
  const closes: string[] = [];
  let writable = true;
  const emit = (event: string, e: { id: string; base64?: string; message?: string }) => {
    for (const l of listeners) if (!l.removed && l.event === event) l.cb(e);
  };
  const mod: LanTlsModule = {
    tlsConnect: async (id, host, port, timeoutMs) => {
      connects.push({ id, host, port, timeoutMs });
      if (opts.fail) throw opts.fail;
    },
    tlsWrite: (id, base64) => {
      writes.push({ id, base64 });
      return writable;
    },
    tlsClose: (id) => {
      closes.push(id);
      emit('onTlsClose', { id, message: '' });
    },
    addListener: ((event: string, cb: Listener) => {
      const l = { event, cb, removed: false };
      listeners.push(l);
      return { remove: () => void (l.removed = true) };
    }) as LanTlsModule['addListener'],
  };
  return {
    mod,
    connects,
    writes,
    closes,
    emit,
    live: () => listeners.filter((l) => !l.removed).length,
    setWritable: (w: boolean) => void (writable = w),
  };
}

describe('loadLanTls without the native module', () => {
  it('returns null / false', () => {
    expect(loadLanTls()).toBeNull();
    expect(hasLanTls()).toBe(false);
  });
});

describe('lanTlsFromModule', () => {
  it('connects with TLS to an RFC 1918 host and moves bytes as base64 both ways', async () => {
    const f = fakeModule();
    const tcp = lanTlsFromModule(f.mod, 5000);
    const sock = await tcp('192.168.1.60', 8009, { tls: true });
    expect(f.connects).toHaveLength(1);
    expect(f.connects[0]).toMatchObject({ host: '192.168.1.60', port: 8009, timeoutMs: 5000 });
    const id = f.connects[0]!.id;

    sock.write(Uint8Array.from([0, 0, 0, 3, 0xff, 0x10, 0x41]));
    expect(f.writes).toEqual([{ id, base64: 'AAAAA/8QQQ==' }]);

    // Data that arrives before onData is registered is buffered.
    f.emit('onTlsData', { id, base64: 'AQID' });
    f.emit('onTlsData', { id: 'someone-else', base64: 'BAUG' });
    const got: number[][] = [];
    sock.onData((d) => got.push([...d]));
    f.emit('onTlsData', { id, base64: 'BA==' });
    expect(got).toEqual([[1, 2, 3], [4]]);
  });

  it('refuses public hosts, hostnames and plain TCP without calling native code', async () => {
    const f = fakeModule();
    const tcp = lanTlsFromModule(f.mod);
    await expect(tcp('8.8.8.8', 8009, { tls: true })).rejects.toThrow();
    await expect(tcp('tv.local', 8009, { tls: true })).rejects.toThrow();
    await expect(tcp('127.0.0.1', 8009, { tls: true })).rejects.toThrow();
    await expect(tcp('192.168.1.60', 8009)).rejects.toThrow();
    await expect(tcp('192.168.1.60', 0, { tls: true })).rejects.toThrow();
    expect(f.connects).toEqual([]);
    expect(f.live()).toBe(0);
  });

  it('rejects and removes its listeners when the native connect fails', async () => {
    const f = fakeModule({ fail: new Error('Connection refused') });
    await expect(lanTlsFromModule(f.mod)('10.0.0.5', 8009, { tls: true })).rejects.toThrow('Connection refused');
    expect(f.live()).toBe(0);
  });

  it('reports a close once, with the native message, and refuses writes afterwards', async () => {
    const f = fakeModule();
    const sock = await lanTlsFromModule(f.mod)('172.16.4.2', 8009, { tls: true });
    const id = f.connects[0]!.id;
    const closes: (string | undefined)[] = [];
    sock.onClose?.((e) => closes.push(e?.message));
    f.emit('onTlsClose', { id, message: 'Connection reset' });
    f.emit('onTlsClose', { id, message: 'again' });
    expect(closes).toEqual(['Connection reset']);
    expect(f.live()).toBe(0);
    expect(() => sock.write(Uint8Array.from([1]))).toThrow();
    // A late onClose subscriber still hears about it.
    sock.onClose?.((e) => closes.push(e?.message));
    expect(closes).toEqual(['Connection reset', 'Connection reset']);
  });

  it('close() asks native to close; a refused write throws', async () => {
    const f = fakeModule();
    const sock = await lanTlsFromModule(f.mod)('192.168.0.9', 8009, { tls: true });
    f.setWritable(false);
    expect(() => sock.write(Uint8Array.from([1]))).toThrow();
    let closed = 0;
    sock.onClose?.(() => closed++);
    sock.close();
    expect(f.closes).toEqual([f.connects[0]!.id]);
    expect(closed).toBe(1);
  });
});
