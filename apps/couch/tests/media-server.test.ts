/**
 * T76: src/native/mediaServer.ts wraps a native HTTP file server that only exists in a dev build.
 * Without it (Expo Go, tests) the app gets the unavailable server; with a fake module the wrapper
 * builds and checks the LAN URL. Pure TS + fakes; nothing here touched a real phone or TV.
 */
import { UNAVAILABLE_MEDIA_SERVER } from '../src/core/cast/mediaServer';
import { _setMediaServerDeps, hasMediaServer, loadMediaServer, type MediaServerModule } from '../src/native/mediaServer';

const TOKEN = 'Q2xpcEJvYXJkVG9rZW4xMjM0NTY';

function fakeModule(over: Partial<MediaServerModule> = {}): MediaServerModule & { stopped: string[] } {
  const stopped: string[] = [];
  return {
    stopped,
    serve: async () => ({ id: 'f1', port: 8090, token: TOKEN }),
    stop: async (id) => {
      stopped.push(id);
    },
    stopAll: async () => {
      stopped.push('*');
    },
    ...over,
  };
}

afterEach(() => _setMediaServerDeps());

describe('native media server guard', () => {
  it('is unavailable when the native module is not installed', () => {
    expect(loadMediaServer()).toBe(UNAVAILABLE_MEDIA_SERVER);
    expect(hasMediaServer()).toBe(false);
  });

  it('is unavailable when there is no Wi-Fi IP provider, or loading throws', () => {
    _setMediaServerDeps({ loadModule: () => fakeModule(), loadPhoneIp: () => null });
    expect(loadMediaServer().available).toBe(false);
    _setMediaServerDeps({
      loadModule: () => {
        throw new Error('native crash');
      },
    });
    expect(loadMediaServer()).toBe(UNAVAILABLE_MEDIA_SERVER);
  });

  it('serves a file at http://<phone-ip>:<port>/<token>.<ext> and stops it', async () => {
    const mod = fakeModule();
    _setMediaServerDeps({ loadModule: () => mod, loadPhoneIp: () => async () => '192.168.1.20' });
    const server = loadMediaServer();
    expect(server.available).toBe(true);
    const served = await server.serve({ uri: 'file:///photo.jpg', mime: 'image/jpeg' });
    expect(served.url).toBe(`http://192.168.1.20:8090/${TOKEN}.jpg`);
    await served.stop();
    await server.stopAll();
    expect(mod.stopped).toEqual(['f1', '*']);
  });

  it('refuses (and stops) when the native side returns an unsafe port or token', async () => {
    const mod = fakeModule({ serve: async () => ({ id: 'f2', port: 8090, token: 'weak' }) });
    _setMediaServerDeps({ loadModule: () => mod, loadPhoneIp: () => async () => '192.168.1.20' });
    await expect(loadMediaServer().serve({ uri: 'file:///v.mp4', mime: 'video/mp4' })).rejects.toMatchObject({
      code: 'network',
      message: "Couldn't share the file with the TV.",
    });
    expect(mod.stopped).toEqual(['f2']);
  });

  it('refuses without a phone Wi-Fi address or when the native serve fails', async () => {
    _setMediaServerDeps({ loadModule: () => fakeModule(), loadPhoneIp: () => async () => null });
    await expect(loadMediaServer().serve({ uri: 'file:///v.mp4', mime: 'video/mp4' })).rejects.toMatchObject({ code: 'network' });
    _setMediaServerDeps({
      loadModule: () =>
        fakeModule({
          serve: async () => {
            throw new Error('EADDRINUSE');
          },
        }),
      loadPhoneIp: () => async () => '192.168.1.20',
    });
    await expect(loadMediaServer().serve({ uri: 'file:///v.mp4', mime: 'video/mp4' })).rejects.toMatchObject({
      message: "Couldn't share the file with the TV.",
    });
  });
});
