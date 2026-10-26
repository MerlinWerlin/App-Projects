/**
 * T106: CASTV2 channel over a fake TLS socket (scripted receiver, fake timer). No real network.
 */
import { FakeTimer, flush } from '../__tests__/fakes';
import { FakeCastDevice, NS_HB, NS_RCV } from '../__tests__/fakeCastDevice';
import { CastChannel, CastChannelError, HEARTBEAT_MS, NS_CONNECTION, RECEIVER_ID } from './channel';

async function open(dev = new FakeCastDevice(), timer = new FakeTimer()) {
  const ch = await CastChannel.open(dev.tcp, '192.168.1.60', timer);
  return { ch, dev, timer };
}

describe('CastChannel', () => {
  it('opens TLS on port 8009 and sends CONNECT sender-0 -> receiver-0', async () => {
    const { dev } = await open();
    expect(dev.connects).toEqual([{ host: '192.168.1.60', port: 8009, tls: true }]);
    expect(dev.sent[0]).toMatchObject({
      namespace: NS_CONNECTION,
      sourceId: 'sender-0',
      destinationId: RECEIVER_ID,
      payload: { type: 'CONNECT' },
    });
  });

  it('refuses a non-LAN host without connecting', async () => {
    const dev = new FakeCastDevice();
    const e = await CastChannel.open(dev.tcp, '8.8.8.8', new FakeTimer()).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(CastChannelError);
    expect((e as CastChannelError).reason).toBe('notLan');
    expect(dev.connects).toEqual([]);
  });

  it('maps a refused connection and a connect timeout', async () => {
    const dev = new FakeCastDevice();
    dev.connectMode = 'refuse';
    const e1 = await CastChannel.open(dev.tcp, '10.0.0.4', new FakeTimer()).catch((x: unknown) => x);
    expect((e1 as CastChannelError).reason).toBe('refused');

    dev.connectMode = 'hang';
    const timer = new FakeTimer();
    const p = CastChannel.open(dev.tcp, '10.0.0.4', timer, { connectTimeoutMs: 3000 }).catch((x: unknown) => x);
    await timer.advance(3000);
    expect(((await p) as CastChannelError).reason).toBe('timeout');
    expect(timer.active).toBe(0);
  });

  it('sends PING every 5 s and answers the device PING with PONG', async () => {
    const { dev, timer, ch } = await open();
    await timer.advance(HEARTBEAT_MS);
    expect(dev.sent.filter((m) => m.namespace === NS_HB).map((m) => m.payload['type'])).toEqual(['PING']);
    dev.push(NS_HB, 'receiver-0', { type: 'PING' });
    await flush();
    const hb = dev.sent.filter((m) => m.namespace === NS_HB);
    expect(hb.map((m) => m.payload['type'])).toEqual(['PING', 'PONG']);
    expect(hb[1]!.destinationId).toBe('receiver-0');
    await timer.advance(HEARTBEAT_MS * 4);
    expect(ch.closed).toBe(false);
    ch.close();
  });

  it('closes with "heartbeat" when the device goes silent', async () => {
    const dev = new FakeCastDevice();
    dev.answerPing = false;
    const { ch, timer } = await open(dev);
    const reasons: string[] = [];
    ch.onClose((e) => reasons.push(e.reason));
    await timer.advance(20_000);
    expect(reasons).toEqual(['heartbeat']);
    expect(ch.closed).toBe(true);
    expect(dev.socket.closed).toBe(true);
    expect(timer.active).toBe(0);
  });

  it('matches replies by requestId and times out unanswered requests', async () => {
    const { ch, timer } = await open();
    const reply = await ch.request(NS_RCV, RECEIVER_ID, { type: 'GET_STATUS' }, 5000);
    expect(reply.payload.type).toBe('RECEIVER_STATUS');
    expect(typeof reply.payload.requestId).toBe('number');

    const p = ch.request(NS_RCV, RECEIVER_ID, { type: 'NOT_ANSWERED' }, 5000).catch((x: unknown) => x);
    await timer.advance(5000);
    expect(((await p) as CastChannelError).reason).toBe('timeout');
    ch.close();
    expect(timer.active).toBe(0);
  });

  it('reads replies delivered byte by byte', async () => {
    const dev = new FakeCastDevice();
    dev.chunked = true;
    const { ch } = await open(dev);
    const reply = await ch.request(NS_RCV, RECEIVER_ID, { type: 'GET_STATUS' }, 5000);
    expect(reply.payload.type).toBe('RECEIVER_STATUS');
    ch.close();
  });

  it('fails pending requests when the socket drops, and reports it once', async () => {
    const { ch, dev } = await open();
    dev.launchMode = 'silent';
    const reasons: string[] = [];
    ch.onClose((e) => reasons.push(e.reason));
    const p = ch.request(NS_RCV, RECEIVER_ID, { type: 'LAUNCH', appId: 'CC1AD845' }, 15_000).catch((x: unknown) => x);
    dev.socket.drop();
    expect(((await p) as CastChannelError).reason).toBe('closed');
    expect(reasons).toEqual(['closed']);
    expect(() => ch.send(NS_RCV, RECEIVER_ID, { type: 'GET_STATUS' })).toThrow(CastChannelError);
  });

  it('fails on an oversized frame from the device', async () => {
    const { ch, dev } = await open();
    const reasons: string[] = [];
    ch.onClose((e) => reasons.push(e.reason));
    dev.socket.deliver(Uint8Array.of(0, 1, 0, 1, 0, 0));
    expect(reasons).toEqual(['framing']);
  });

  it('close() sends CLOSE and does not report itself as a failure', async () => {
    const { ch, dev, timer } = await open();
    const reasons: string[] = [];
    ch.onClose((e) => reasons.push(e.reason));
    ch.close();
    expect(dev.sent[dev.sent.length - 1]).toMatchObject({ namespace: NS_CONNECTION, payload: { type: 'CLOSE' } });
    expect(dev.socket.closed).toBe(true);
    expect(reasons).toEqual([]);
    expect(timer.active).toBe(0);
  });
});
