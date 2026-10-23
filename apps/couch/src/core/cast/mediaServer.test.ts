import { UNAVAILABLE_MEDIA_SERVER, extensionForMime, isServedUrl, isValidToken, servedUrl } from './mediaServer';

const TOKEN = 'Q2xpcEJvYXJkVG9rZW4xMjM0NTY'; // 27 URL-safe chars

describe('MediaServer adapter (core)', () => {
  it('the unavailable server refuses with a translated DriverError', async () => {
    expect(UNAVAILABLE_MEDIA_SERVER.available).toBe(false);
    await expect(UNAVAILABLE_MEDIA_SERVER.serve({ uri: 'file:///x.jpg', mime: 'image/jpeg' })).rejects.toMatchObject({
      name: 'DriverError',
      code: 'unsupported',
      message: 'Casting needs the full app.',
    });
    await expect(UNAVAILABLE_MEDIA_SERVER.stopAll()).resolves.toBeUndefined();
  });

  it('builds http://<lan-ip>:<port>/<token>[.ext] only from safe parts', () => {
    expect(servedUrl('192.168.1.20', 8090, TOKEN, 'JPG')).toBe(`http://192.168.1.20:8090/${TOKEN}.jpg`);
    expect(servedUrl('10.0.0.2', 49200, TOKEN)).toBe(`http://10.0.0.2:49200/${TOKEN}`);
    expect(servedUrl('8.8.8.8', 8090, TOKEN)).toBeNull();
    expect(servedUrl('127.0.0.1', 8090, TOKEN)).toBeNull();
    expect(servedUrl('192.168.1.20', 80, TOKEN)).toBeNull();
    expect(servedUrl('192.168.1.20', 70000, TOKEN)).toBeNull();
    expect(servedUrl('192.168.1.20', 8090, 'short')).toBeNull();
    expect(servedUrl('192.168.1.20', 8090, '../../etc/passwd-aaaaaaaaaaaaaaaaaa')).toBeNull();
    expect(servedUrl('192.168.1.20', 8090, TOKEN, 'j/pg')).toBeNull();
  });

  it('recognises served URLs', () => {
    expect(isServedUrl(`http://192.168.1.20:8090/${TOKEN}.mp4`)).toBe(true);
    expect(isServedUrl(`http://192.168.1.20:8090/${TOKEN}`)).toBe(true);
    expect(isServedUrl(`https://192.168.1.20:8090/${TOKEN}`)).toBe(false);
    expect(isServedUrl(`http://192.168.1.20:8090/${TOKEN}/x`)).toBe(false);
    expect(isServedUrl(`http://203.0.113.1:8090/${TOKEN}`)).toBe(false);
    expect(isValidToken('a'.repeat(21))).toBe(false);
    expect(isValidToken('a'.repeat(22))).toBe(true);
  });

  it('maps common mime types to extensions', () => {
    expect(extensionForMime('image/JPEG')).toBe('jpg');
    expect(extensionForMime('video/quicktime')).toBe('mov');
    expect(extensionForMime('application/pdf')).toBeUndefined();
  });
});
