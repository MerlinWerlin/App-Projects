import type { TcpFactory, TcpLike } from '../../driver';
import type { MdnsRecord } from '../../discovery';
import type { MdnsLike } from '../../discoveryService';
import { bonjourCastPortLookup, withCastPortLookup } from './castPort';

const sock = (): TcpLike => ({ write: () => undefined, close: () => undefined, onData: () => undefined, onClose: () => undefined });

function fakeMdns(records: MdnsRecord[]): MdnsLike & { stopped: number } {
  const m = {
    stopped: 0,
    browse(_types: readonly string[], on: (r: MdnsRecord) => void) {
      for (const r of records) on(r);
      return () => {
        m.stopped++;
      };
    },
  };
  return m;
}
const noWait = () => Promise.resolve();

describe('Google Cast port lookup (owner TCL C7K, 1 Nov 2026)', () => {
  it('finds the port the TV advertises over Bonjour and caches it', async () => {
    const mdns = fakeMdns([
      { type: '_googlecast._tcp', host: '192.168.4.10', port: 8009 },
      { type: '_googlecast._tcp', host: '192.168.4.52', port: 8012 },
    ]);
    const lookup = bonjourCastPortLookup(mdns, 10, noWait);
    expect(await lookup('192.168.4.52')).toBe(8012);
    expect(await lookup('192.168.4.52')).toBe(8012);
    expect(mdns.stopped).toBe(1);
    expect(await lookup('192.168.4.99')).toBeNull();
  });

  it('tries the advertised port, then 8009', async () => {
    const tried: number[] = [];
    const tcp: TcpFactory = async (_h, port) => {
      tried.push(port);
      if (port === 8009) throw new Error('Connection refused');
      return sock();
    };
    const f = withCastPortLookup(tcp, async () => 8012);
    await f('192.168.4.52', 8009, { tls: true });
    expect(tried).toEqual([8012]);

    tried.length = 0;
    const g = withCastPortLookup(async (_h, port) => {
      tried.push(port);
      if (port === 8012) throw new Error('nope');
      return sock();
    }, async () => 8012);
    await g('192.168.4.52', 8009, { tls: true });
    expect(tried).toEqual([8012, 8009]);
  });

  it('says which port failed and whether the TV announced Cast at all', async () => {
    const refuse: TcpFactory = async () => {
      throw new Error('Connection refused');
    };
    await expect(withCastPortLookup(refuse, async () => null)('192.168.4.52', 8009, { tls: true })).rejects.toThrow(
      'port 8009 (no Cast service announced): Connection refused',
    );
    await expect(withCastPortLookup(refuse, async () => 8012)('192.168.4.52', 8009, { tls: true })).rejects.toThrow('port 8012: Connection refused');
  });

  it('passes other ports and an empty lookup straight through', async () => {
    const tried: number[] = [];
    const tcp: TcpFactory = async (_h, port) => {
      tried.push(port);
      return sock();
    };
    await withCastPortLookup(tcp, async () => 8012)('192.168.4.52', 6466, { tls: true });
    await withCastPortLookup(tcp, async () => null)('192.168.4.52', 8009, { tls: true });
    await withCastPortLookup(tcp, async () => {
      throw new Error('x');
    })('192.168.4.52', 8009, { tls: true });
    expect(tried).toEqual([6466, 8009, 8009]);
  });
});

describe('withCastPortLookup announced on the default port', () => {
  it('says the TV announced Cast on 8009 when 8009 still refuses', async () => {
    const refuse: TcpFactory = async () => {
      throw new Error('Connection refused');
    };
    await expect(withCastPortLookup(refuse, async () => 8009)('192.168.4.52', 8009, { tls: true })).rejects.toThrow(
      'port 8009 (Cast announced on 8009): Connection refused',
    );
  });
});
