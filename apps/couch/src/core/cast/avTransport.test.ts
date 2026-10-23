import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FetchLike } from '../driver';
import { setLocale } from '../../i18n/core';
import {
  AvTransportClient,
  buildSoapEnvelope,
  faultToError,
  parseHms,
  parseSoapFault,
  soapActionHeader,
} from './avTransport';
import { buildDidlLite, formatHms, protocolInfo, type CastMedia } from './didl';
import { firstText, unescapeXml } from './xml';

const fx = (name: string): string => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');
const CTL = 'http://192.168.1.40:49152/upnp/control/AVTransport1';
const AVT = 'urn:schemas-upnp-org:service:AVTransport:1';

const PHOTO: CastMedia = {
  url: 'http://192.168.1.20:8090/Q2xpcEJvYXJkVG9rZW4xMjM0NTY.jpg',
  title: 'Beach & "Sunset" <2026>',
  mime: 'image/jpeg',
  kind: 'photo',
  sizeBytes: 2048,
};
const VIDEO: CastMedia = {
  url: 'http://192.168.1.20:8090/Q2xpcEJvYXJkVG9rZW4xMjM0NTY.mp4?a=1&b=2',
  title: "Kid's party",
  mime: 'video/mp4',
  kind: 'video',
  durationSec: 205,
};

interface Call {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

function soapFetch(reply: (action: string) => { status: number; body: string } | Error): FetchLike & { calls: Call[] } {
  const calls: Call[] = [];
  const f = (async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    const call: Call = { url };
    if (init?.method) call.method = init.method;
    if (init?.headers) call.headers = init.headers;
    if (init?.body !== undefined) call.body = init.body;
    calls.push(call);
    const action = /#(\w+)"$/.exec(init?.headers?.['SOAPACTION'] ?? '')?.[1] ?? '';
    const r = reply(action);
    if (r instanceof Error) throw r;
    return { status: r.status, ok: r.status >= 200 && r.status < 300, text: async () => r.body };
  }) as FetchLike & { calls: Call[] };
  f.calls = calls;
  return f;
}

const okFor = (action: string): { status: number; body: string } => {
  const files: Record<string, string> = {
    SetAVTransportURI: 'soap-set-uri-response.xml',
    Play: 'soap-play-response.xml',
    GetTransportInfo: 'soap-get-transport-info.xml',
    GetPositionInfo: 'soap-get-position-info.xml',
  };
  const file = files[action];
  return {
    status: 200,
    body: file ? fx(file) : fx('soap-play-response.xml').replace(/PlayResponse/g, `${action}Response`),
  };
};

afterEach(() => setLocale('en'));

describe('hh:mm:ss', () => {
  it('formats and parses', () => {
    expect(formatHms(0)).toBe('00:00:00');
    expect(formatHms(3725.9)).toBe('01:02:05');
    expect(formatHms(205, 1)).toBe('0:03:25');
    expect(formatHms(-4)).toBe('00:00:00');
    expect(formatHms(Number.NaN)).toBe('00:00:00');
    expect(parseHms('0:03:25.500')).toBe(205.5);
    expect(parseHms('10:00:00')).toBe(36000);
    expect(parseHms('0:00:01.1/2')).toBe(1.5);
    expect(parseHms('NOT_IMPLEMENTED')).toBeNull();
    expect(parseHms('')).toBeNull();
    expect(parseHms(null)).toBeNull();
  });
});

describe('DIDL-Lite', () => {
  it('describes a photo with escaped title, class and protocolInfo', () => {
    const didl = buildDidlLite(PHOTO);
    expect(didl).toContain('<dc:title>Beach &amp; &quot;Sunset&quot; &lt;2026&gt;</dc:title>');
    expect(didl).toContain('<upnp:class>object.item.imageItem.photo</upnp:class>');
    expect(didl).toContain('<res protocolInfo="http-get:*:image/jpeg:*" size="2048">');
    expect(didl).not.toContain('duration=');
    expect(didl.startsWith('<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"')).toBe(true);
  });

  it('describes a video with duration and an escaped URL', () => {
    const didl = buildDidlLite(VIDEO);
    expect(didl).toContain('<upnp:class>object.item.videoItem</upnp:class>');
    expect(didl).toContain('duration="0:03:25"');
    expect(didl).toContain('.mp4?a=1&amp;b=2</res>');
    expect(didl).toContain('<dc:title>Kid&apos;s party</dc:title>');
    expect(protocolInfo('Video/MP4')).toBe('http-get:*:video/mp4:*');
  });

  it('refuses mismatched mime types and off-LAN URLs', () => {
    expect(() => buildDidlLite({ ...PHOTO, mime: 'video/mp4' })).toThrow("The TV can't play this kind of file.");
    expect(() => buildDidlLite({ ...VIDEO, mime: 'text/html' })).toThrow();
    expect(() => buildDidlLite({ ...PHOTO, url: 'http://203.0.113.9/x.jpg' })).toThrow('That device is not on your local network.');
  });
});

describe('SOAP envelope', () => {
  it('builds the envelope and quoted SOAPACTION', () => {
    expect(soapActionHeader(AVT, 'Play')).toBe(`"${AVT}#Play"`);
    const env = buildSoapEnvelope(AVT, 'Seek', [
      ['InstanceID', '0'],
      ['Target', '<&>'],
    ]);
    expect(env).toContain(`<s:Body><u:Seek xmlns:u="${AVT}"><InstanceID>0</InstanceID><Target>&lt;&amp;&gt;</Target></u:Seek></s:Body>`);
    expect(env.startsWith('<?xml version="1.0" encoding="utf-8"?><s:Envelope ')).toBe(true);
  });

  it('parses a UPnP fault', () => {
    expect(parseSoapFault(fx('soap-fault-714.xml'))).toEqual({ code: 714, description: 'Illegal MIME-type' });
    expect(parseSoapFault(fx('soap-play-response.xml'))).toBeNull();
    expect(parseSoapFault('<s:Fault><faultstring>x</faultstring></s:Fault>')).toEqual({ code: null, description: null });
  });

  it.each([
    [401, 'unsupported', 'This TV does not support that casting command.'],
    [602, 'unsupported', 'This TV does not support that casting command.'],
    [701, 'unsupported', "The TV can't do that right now."],
    [704, 'unsupported', "The TV can't play this kind of file."],
    [714, 'unsupported', "The TV can't play this kind of file."],
    [716, 'network', "The TV couldn't open the file from this phone. Check both are on the same Wi-Fi."],
    [711, 'unsupported', "The TV can't jump to that point."],
    [705, 'forbidden', 'The TV is busy with another cast. Try again in a moment.'],
    [501, 'network', 'The TV reported a casting error (501).'],
    [null, 'network', 'The TV reported a casting error (?).'],
  ] as const)('fault %s -> %s', (code, want, message) => {
    const e = faultToError(code);
    expect(e.code).toBe(want);
    expect(e.message).toBe(message);
  });

  it('translates fault messages for the active locale', () => {
    setLocale('de');
    expect(faultToError(704).message).toBe('Der Fernseher kann diese Art von Datei nicht abspielen.');
  });
});

describe('AvTransportClient', () => {
  it('refuses an off-LAN control URL before any request', () => {
    const f = soapFetch(okFor);
    expect(() => new AvTransportClient(f, 'http://203.0.113.1/ctl')).toThrow('That device is not on your local network.');
    expect(f.calls).toEqual([]);
  });

  it('SetAVTransportURI posts escaped URI and double-escaped DIDL metadata', async () => {
    const f = soapFetch(okFor);
    await new AvTransportClient(f, CTL).setUri(VIDEO);
    const c = f.calls[0]!;
    expect(c.url).toBe(CTL);
    expect(c.method).toBe('POST');
    expect(c.headers).toEqual({ 'Content-Type': 'text/xml; charset="utf-8"', SOAPACTION: `"${AVT}#SetAVTransportURI"` });
    expect(c.body).toContain('<InstanceID>0</InstanceID>');
    expect(c.body).toContain('<CurrentURI>http://192.168.1.20:8090/Q2xpcEJvYXJkVG9rZW4xMjM0NTY.mp4?a=1&amp;b=2</CurrentURI>');
    // The metadata element holds the DIDL document as escaped text: one decode gives back the DIDL.
    const meta = /<CurrentURIMetaData>([\s\S]*)<\/CurrentURIMetaData>/.exec(c.body!)![1]!;
    expect(meta).not.toContain('<');
    expect(unescapeXml(meta)).toBe(buildDidlLite(VIDEO));
    expect(meta).toContain('a=1&amp;amp;b=2');
  });

  it('sends Play, Pause, Stop and Seek with the right arguments', async () => {
    const f = soapFetch(okFor);
    const c = new AvTransportClient(f, CTL);
    await c.play();
    await c.pause();
    await c.stop();
    await c.seek(3725);
    expect(f.calls.map((x) => x.headers?.['SOAPACTION'])).toEqual(
      ['Play', 'Pause', 'Stop', 'Seek'].map((a) => `"${AVT}#${a}"`),
    );
    expect(f.calls[0]!.body).toContain('<InstanceID>0</InstanceID><Speed>1</Speed></u:Play>');
    expect(f.calls[1]!.body).toContain('<u:Pause xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:Pause>');
    expect(f.calls[3]!.body).toContain('<Unit>REL_TIME</Unit><Target>01:02:05</Target>');
  });

  it('uses the advertised serviceType', async () => {
    const f = soapFetch((a) => ({ status: 200, body: `<u:${a}Response xmlns:u="x"/>` }));
    await new AvTransportClient(f, CTL, { serviceType: 'urn:schemas-upnp-org:service:AVTransport:2' }).play();
    expect(f.calls[0]!.headers?.['SOAPACTION']).toBe('"urn:schemas-upnp-org:service:AVTransport:2#Play"');
  });

  it('reads GetTransportInfo and GetPositionInfo', async () => {
    const c = new AvTransportClient(soapFetch(okFor), CTL);
    expect(await c.getTransportInfo()).toEqual({ state: 'PLAYING', status: 'OK', speed: '1' });
    expect(await c.getPositionInfo()).toEqual({
      durationSec: 205.5,
      positionSec: 62,
      trackUri: 'http://192.168.1.20:8090/Q2xpcEJvYXJkVG9rZW4xMjM0NTY.mp4',
    });
    const meta = firstText(fx('soap-get-position-info.xml'), 'TrackMetaData');
    expect(meta?.startsWith('<DIDL-Lite')).toBe(true);
  });

  it('turns a SOAP fault (HTTP 500) into a translated DriverError', async () => {
    const c = new AvTransportClient(soapFetch(() => ({ status: 500, body: fx('soap-fault-714.xml') })), CTL);
    await expect(c.setUri(PHOTO)).rejects.toMatchObject({ name: 'DriverError', code: 'unsupported', message: "The TV can't play this kind of file." });
  });

  it('maps unreachable, HTTP errors and unreadable replies', async () => {
    await expect(new AvTransportClient(soapFetch(() => new Error('ETIMEDOUT')), CTL).play()).rejects.toMatchObject({
      code: 'network',
      message: "Can't reach the TV. Check it's on and on the same Wi-Fi.",
    });
    await expect(new AvTransportClient(soapFetch(() => ({ status: 503, body: '' })), CTL).play()).rejects.toMatchObject({
      message: 'The TV answered HTTP 503.',
    });
    await expect(new AvTransportClient(soapFetch(() => ({ status: 200, body: '<ok/>' })), CTL).play()).rejects.toMatchObject({
      message: 'The TV sent a casting reply we could not read.',
    });
    const noState = soapFetch((a) => ({ status: 200, body: `<u:${a}Response xmlns:u="x"></u:${a}Response>` }));
    await expect(new AvTransportClient(noState, CTL).getTransportInfo()).rejects.toMatchObject({ code: 'network' });
  });

  it('validates media before sending anything', async () => {
    const f = soapFetch(okFor);
    await expect(new AvTransportClient(f, CTL).setUri({ ...PHOTO, mime: 'application/pdf' })).rejects.toMatchObject({
      code: 'unsupported',
    });
    expect(f.calls).toEqual([]);
  });
});
