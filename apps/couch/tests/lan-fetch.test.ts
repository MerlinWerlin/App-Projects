/**
 * T32: the LAN-trusting fetch adapter over the lan-wss module. In tests the native module is absent
 * (like Expo Go), so loadLanFetch() is null; behaviour is checked against a fake module.
 */
import { responseHeader } from '../src/core/drivers/philips';
import { hasLanFetch, lanFetchFromModule, lanTrustAllowed, loadLanFetch, type LanFetchModule } from '../src/native/lanFetch';

interface Call {
  url: string;
  method: string;
  headersJson: string;
  body: string | null;
  timeoutMs: number;
  allowSelfSignedLan: boolean;
}

function fakeModule(reply: { status: number; headersJson: string; body: string } | Error) {
  const calls: Call[] = [];
  const mod: LanFetchModule = {
    fetch: async (url, method, headersJson, body, timeoutMs, allowSelfSignedLan) => {
      calls.push({ url, method, headersJson, body, timeoutMs, allowSelfSignedLan });
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
  return { mod, calls };
}

describe('loadLanFetch without the native module', () => {
  it('returns null / false', () => {
    expect(loadLanFetch()).toBeNull();
    expect(hasLanFetch()).toBe(false);
  });
});

describe('lanFetchFromModule', () => {
  it('passes method, headers, body and timeout through and exposes status/ok/text', async () => {
    const { mod, calls } = fakeModule({ status: 200, headersJson: '{"content-type":"application/json"}', body: '{"a":1}' });
    const f = lanFetchFromModule(mod);
    const res = await f('https://192.168.1.20:7345/key_command/', {
      method: 'put',
      headers: { 'Content-Type': 'application/json', AUTH: 'tok' },
      body: '{"x":1}',
      timeoutMs: 3000,
    });
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(await res.text()).toBe('{"a":1}');
    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    expect(c.method).toBe('PUT');
    expect(JSON.parse(c.headersJson)).toEqual({ 'Content-Type': 'application/json', AUTH: 'tok' });
    expect(c.body).toBe('{"x":1}');
    expect(c.timeoutMs).toBe(3000);
    expect(c.allowSelfSignedLan).toBe(true);
  });

  it('defaults: GET, no body, 10 s timeout', async () => {
    const { mod, calls } = fakeModule({ status: 204, headersJson: '{}', body: '' });
    const res = await lanFetchFromModule(mod)('https://10.0.0.5:1926/6/system');
    expect(res.ok).toBe(true);
    expect(calls[0]).toMatchObject({ method: 'GET', headersJson: '{}', body: null, timeoutMs: 10000 });
  });

  it('exposes response headers case-insensitively (Philips Digest reads WWW-Authenticate)', async () => {
    const challenge = 'Digest realm="XTV", nonce="abc", qop="auth"';
    const { mod } = fakeModule({ status: 401, headersJson: JSON.stringify({ 'WWW-Authenticate': challenge, 'x-a': 'b' }), body: '' });
    const res = await lanFetchFromModule(mod)('https://192.168.0.9:1926/6/powerstate');
    expect(res.status).toBe(401);
    expect(res.ok).toBe(false);
    expect(res.headers?.get('www-authenticate')).toBe(challenge);
    expect(res.headers?.get('WWW-Authenticate')).toBe(challenge);
    expect(res.headers?.get('X-A')).toBe('b');
    expect(res.headers?.get('missing')).toBeNull();
    expect(responseHeader(res, 'WWW-Authenticate')).toBe(challenge);
  });

  it('tolerates malformed headersJson', async () => {
    const { mod } = fakeModule({ status: 200, headersJson: 'not json', body: 'ok' });
    const res = await lanFetchFromModule(mod)('https://192.168.0.9/');
    expect(res.headers?.get('content-type')).toBeNull();
    expect(await res.text()).toBe('ok');
  });

  it('requests relaxed trust only for https:// to a literal RFC 1918 IPv4 host', async () => {
    const cases: [string, boolean][] = [
      ['https://192.168.1.20:7345/', true],
      ['https://10.1.2.3/', true],
      ['https://172.16.0.1:1926/x', true],
      ['https://172.31.255.255/', true],
      ['HTTPS://192.168.1.2/', true],
      ['http://192.168.1.20:8080/', false],
      ['https://172.32.0.1/', false],
      ['https://8.8.8.8/', false],
      ['https://127.0.0.1/', false],
      ['https://169.254.1.1/', false],
      ['https://tv.local/', false],
      ['https://192.168.1.020/', false],
      ['https://example.com/', false],
      ['https://user@192.168.1.2/', false],
      ['https://[fd00::1]/', false],
    ];
    for (const [url, allowed] of cases) {
      const { mod, calls } = fakeModule({ status: 200, headersJson: '{}', body: '' });
      await lanFetchFromModule(mod)(url);
      expect({ url, allow: calls[0]!.allowSelfSignedLan }).toEqual({ url, allow: allowed });
      expect({ url, allowed: lanTrustAllowed(url) }).toEqual({ url, allowed });
    }
  });

  it('maps a native timeout to a TimeoutError and other failures to plain errors', async () => {
    const timeout = Object.assign(new Error('The request timed out.'), { code: 'ERR_LAN_FETCH_TIMEOUT' });
    await expect(lanFetchFromModule(fakeModule(timeout).mod)('https://192.168.1.2/')).rejects.toMatchObject({
      name: 'TimeoutError',
    });
    const tls = Object.assign(new Error('certificate rejected'), { code: 'ERR_LAN_FETCH' });
    const p = lanFetchFromModule(fakeModule(tls).mod)('https://8.8.8.8/');
    await expect(p).rejects.toThrow('certificate rejected');
    await p.catch((e: Error) => expect(e.name).toBe('Error'));
  });
});
