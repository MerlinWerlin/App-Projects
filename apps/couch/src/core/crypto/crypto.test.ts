import { createHash, createHmac, randomBytes } from 'node:crypto';
import { fromBase64, toBase64, toHex, utf8 } from './bytes';
import { digestAuthorization, parseDigestChallenge } from './digest';
import { md5Hex } from './md5';
import { hmacSha1, hmacSha1Hex, sha1Hex } from './sha1';

const SAMPLES = ['', 'a', 'abc', 'message digest', 'The quick brown fox jumps over the lazy dog', 'héllo ✓ 🎬', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), 'q'.repeat(1000)];

describe('bytes', () => {
  it('utf8 matches Buffer', () => {
    for (const s of SAMPLES) expect(toHex(utf8(s))).toBe(Buffer.from(s, 'utf8').toString('hex'));
  });
  it('base64 round-trips and matches Buffer', () => {
    for (let n = 0; n < 40; n++) {
      const b = new Uint8Array(randomBytes(n));
      expect(toBase64(b)).toBe(Buffer.from(b).toString('base64'));
      expect(toHex(fromBase64(toBase64(b)))).toBe(toHex(b));
    }
  });
});

describe('md5', () => {
  it('RFC 1321 test vectors', () => {
    expect(md5Hex('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5Hex('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
  });
  it('matches node:crypto', () => {
    for (const s of SAMPLES) expect(md5Hex(s)).toBe(createHash('md5').update(s, 'utf8').digest('hex'));
    for (let n = 0; n < 200; n += 7) {
      const b = new Uint8Array(randomBytes(n));
      expect(md5Hex(b)).toBe(createHash('md5').update(b).digest('hex'));
    }
  });
});

describe('sha1 / hmac-sha1', () => {
  it('FIPS test vector', () => {
    expect(sha1Hex('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });
  it('matches node:crypto', () => {
    for (const s of SAMPLES) expect(sha1Hex(s)).toBe(createHash('sha1').update(s, 'utf8').digest('hex'));
    for (let n = 0; n < 200; n += 7) {
      const b = new Uint8Array(randomBytes(n));
      expect(sha1Hex(b)).toBe(createHash('sha1').update(b).digest('hex'));
    }
  });
  it('HMAC-SHA1 matches node:crypto incl. keys longer than a block', () => {
    for (const klen of [0, 1, 20, 64, 65, 100]) {
      const key = new Uint8Array(randomBytes(klen));
      for (const s of SAMPLES) {
        expect(hmacSha1Hex(key, s)).toBe(createHmac('sha1', key).update(s, 'utf8').digest('hex'));
      }
    }
    expect(toHex(hmacSha1('key', 'The quick brown fox jumps over the lazy dog'))).toBe('de7c9b85b8b78aa6bc8a7a36f70a90701c9db4d9');
  });
});

describe('digest auth', () => {
  it('parses a challenge', () => {
    const c = parseDigestChallenge('Digest realm="XTV", nonce="abc,def", qop="auth", algorithm=MD5, opaque="o"');
    expect(c).toEqual({ realm: 'XTV', nonce: 'abc,def', qop: 'auth', algorithm: 'MD5', opaque: 'o' });
    expect(parseDigestChallenge('Basic realm="x"')).toBeNull();
    expect(parseDigestChallenge(null)).toBeNull();
  });
  it('RFC 2617 section 3.5 example', () => {
    const c = parseDigestChallenge(
      'Digest realm="testrealm@host.com", qop="auth,auth-int", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", opaque="5ccc069c403ebaf9f0171e9517f40e41"',
    );
    const h = digestAuthorization({
      username: 'Mufasa',
      password: 'Circle Of Life',
      method: 'GET',
      uri: '/dir/index.html',
      challenge: c!,
      nc: 1,
      cnonce: '0a4f113b',
    });
    expect(h).toContain('response="6629fae49393a05397450978507c4ef1"');
    expect(h).toContain('qop=auth, nc=00000001, cnonce="0a4f113b"');
    expect(h).toContain('opaque="5ccc069c403ebaf9f0171e9517f40e41"');
  });
  it('legacy no-qop form', () => {
    const h = digestAuthorization({
      username: 'u',
      password: 'p',
      method: 'POST',
      uri: '/6/input/key',
      challenge: { realm: 'r', nonce: 'n' },
      nc: 1,
      cnonce: 'c',
    });
    const ha1 = createHash('md5').update('u:r:p').digest('hex');
    const ha2 = createHash('md5').update('POST:/6/input/key').digest('hex');
    expect(h).toContain(`response="${createHash('md5').update(`${ha1}:n:${ha2}`).digest('hex')}"`);
    expect(h).not.toContain('qop');
  });
});
