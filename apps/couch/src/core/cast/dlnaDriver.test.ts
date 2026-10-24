import { setLocale, t } from '../../i18n/core';
import { DriverError } from '../types';
import { FakeRenderer, FakeTimer, fx } from './__tests__/fakes';
import { parseDeviceDescription, type CastRenderer } from './description';
import type { CastMedia } from './didl';
import type { CastTarget } from './driver';
import { createDlnaDriver } from './dlnaDriver';
import { firstText } from './xml';

setLocale('en');

const RENDERER = parseDeviceDescription(fx('description-urlbase.xml'), 'http://192.168.1.40:49152/description.xml');
const TARGET: CastTarget = { id: 'dlna:x', name: 'Screen', kind: 'dlna', host: '192.168.1.40', accepts: { photo: true, video: true } };
const VIDEO: CastMedia = {
  url: 'http://192.168.1.20:8090/Q2xpcEJvYXJkVG9rZW4xMjM0NTY.mp4',
  title: 'Party & cake',
  mime: 'video/mp4',
  kind: 'video',
  durationSec: 120,
};
const PHOTO: CastMedia = { ...VIDEO, url: VIDEO.url.replace('.mp4', '.jpg'), mime: 'image/jpeg', kind: 'photo', durationSec: undefined };

function setup() {
  const tv = new FakeRenderer();
  const timer = new FakeTimer();
  const d = createDlnaDriver(TARGET, RENDERER, tv.http.fetch, timer);
  return { tv, timer, d };
}

describe('createDlnaDriver', () => {
  it('sends SetAVTransportURI then Play to the advertised control URL, then polls', async () => {
    const { tv, timer, d } = setup();
    await d.load(VIDEO);
    expect(tv.actions).toEqual(['SetAVTransportURI', 'Play']);
    const set = tv.http.calls[0]!;
    expect(set.url).toBe('http://192.168.1.40:49152/upnp/control/AVTransport1');
    expect(set.method).toBe('POST');
    expect(set.headers['SOAPACTION']).toBe('"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"');
    expect(firstText(set.body, 'CurrentURI')).toBe(VIDEO.url);
    expect(firstText(set.body, 'CurrentURIMetaData')).toContain('<dc:title>Party &amp; cake</dc:title>');
    expect(d.snapshot().state).toBe('loading');

    await timer.advance(1000);
    expect(tv.actions.slice(2)).toEqual(['GetTransportInfo', 'GetPositionInfo']);
    // Position and duration from soap-get-position-info.xml (0:01:02 of 0:03:25.500).
    expect(d.snapshot()).toMatchObject({ state: 'playing', positionSec: 62, durationSec: 205.5 });
    d.dispose();
  });

  it('pause, play and seek map to Pause, Play and Seek(REL_TIME)', async () => {
    const { tv, timer, d } = setup();
    await d.load(VIDEO);
    await timer.advance(1000);
    tv.actions = [];
    await d.pause();
    await d.play();
    await d.seek(90);
    expect(tv.actions).toEqual(['Pause', 'Play', 'Seek']);
    const seek = tv.http.calls[tv.http.calls.length - 1]!;
    expect(firstText(seek.body, 'Unit')).toBe('REL_TIME');
    expect(firstText(seek.body, 'Target')).toBe('00:01:30');
    d.dispose();
  });

  it('a seek past the end is clamped to the duration', async () => {
    const { tv, timer, d } = setup();
    await d.load(VIDEO);
    await timer.advance(1000);
    await d.seek(9999);
    expect(firstText(tv.http.calls[tv.http.calls.length - 1]!.body, 'Target')).toBe('00:03:25');
    d.dispose();
  });

  it('a photo is not polled', async () => {
    const { tv, timer, d } = setup();
    await d.load(PHOTO);
    await timer.advance(5000);
    expect(tv.actions).toEqual(['SetAVTransportURI', 'Play']);
    expect(d.snapshot().state).toBe('playing');
    d.dispose();
  });

  it('reports stopped when the TV stops after playing (video ended)', async () => {
    const { tv, timer, d } = setup();
    await d.load(VIDEO);
    await timer.advance(1000);
    tv.state = 'STOPPED';
    await timer.advance(1000);
    expect(d.snapshot().state).toBe('stopped');
    expect(timer.active).toBe(0);
  });

  it('a SOAP fault on SetAVTransportURI rejects load with the translated error', async () => {
    const { tv, d } = setup();
    tv.faults.add('SetAVTransportURI');
    const e = await d.load(VIDEO).then(() => null, (x: unknown) => x);
    expect(e).toBeInstanceOf(DriverError);
    expect((e as DriverError).code).toBe('unsupported');
    expect((e as DriverError).message).toBe(t('core.driver.cast.formatUnsupported'));
    expect(d.snapshot()).toMatchObject({ state: 'error', errorCode: 'unsupported' });
    expect(tv.actions).toEqual(['SetAVTransportURI']);
  });

  it('a SOAP fault on Pause rejects pause and keeps playing', async () => {
    const { tv, timer, d } = setup();
    await d.load(VIDEO);
    await timer.advance(1000);
    tv.faults.add('Pause');
    await expect(d.pause()).rejects.toBeInstanceOf(DriverError);
    expect(d.snapshot().state).toBe('playing');
    d.dispose();
  });

  it('stop sends Stop', async () => {
    const { tv, timer, d } = setup();
    await d.load(VIDEO);
    await timer.advance(1000);
    await d.stop();
    expect(tv.actions[tv.actions.length - 1]).toBe('Stop');
    expect(d.snapshot().state).toBe('stopped');
  });

  it('refuses a renderer whose control URL is not on the LAN', () => {
    const bad: CastRenderer = { ...RENDERER, avTransportUrl: 'http://8.8.8.8/ctl' };
    expect(() => createDlnaDriver(TARGET, bad, new FakeRenderer().http.fetch, new FakeTimer())).toThrow(DriverError);
  });
});
