/**
 * UPnP device description parsing for MediaRenderers (T76): friendly name plus the AVTransport and
 * RenderingControl control URLs, resolved against <URLBase> or the LOCATION URL. Every URL must be
 * plain http on a private LAN address (src/core/lanHost.ts); anything else is refused, so a
 * description can never point the phone at the internet.
 */
import type { FetchLike } from '../driver';
import { driverError } from '../drivers/errors';
import { isRfc1918Host, urlHost } from '../lanHost';
import { elementsXml, firstText } from './xml';

export const AV_TRANSPORT_1 = 'urn:schemas-upnp-org:service:AVTransport:1';
export const RENDERING_CONTROL_1 = 'urn:schemas-upnp-org:service:RenderingControl:1';

const AV_TRANSPORT = /^urn:schemas-upnp-org:service:AVTransport:\d+$/;
const RENDERING_CONTROL = /^urn:schemas-upnp-org:service:RenderingControl:\d+$/;

export interface CastRenderer {
  /** friendlyName from the description (falls back to modelName, then the host). */
  name: string;
  /** Unique device name (uuid:...), when given. */
  udn?: string;
  host: string;
  location: string;
  /** Absolute AVTransport control URL. */
  avTransportUrl: string;
  /** serviceType exactly as advertised (used in SOAPACTION). */
  avTransportType: string;
  renderingControlUrl?: string;
  renderingControlType?: string;
  modelName?: string;
}

/** True for http:// on a literal RFC 1918 IPv4 host. */
export function isLanHttpUrl(url: string): boolean {
  if (!/^http:\/\//i.test(url)) return false;
  const h = urlHost(url);
  return h !== null && isRfc1918Host(h);
}

function origin(url: string): string | null {
  const m = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]+)/i.exec(url);
  return m?.[1] ?? null;
}

function normalisePath(path: string): string {
  const out: string[] = [];
  const segs = path.split('/');
  segs.forEach((s, i) => {
    if (s === '.') {
      if (i === segs.length - 1) out.push('');
      return;
    }
    if (s === '..') {
      if (out.length > 1) out.pop();
      if (i === segs.length - 1) out.push('');
      return;
    }
    out.push(s);
  });
  const joined = out.join('/');
  return joined.startsWith('/') ? joined : `/${joined}`;
}

/**
 * Resolves `ref` against `base` (RFC 3986 subset: absolute, scheme-relative, path-absolute and
 * path-relative references). Returns null when the base has no scheme://host.
 */
export function resolveUrl(base: string, ref: string): string | null {
  const r = ref.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(r)) return r;
  const o = origin(base);
  if (!o) return null;
  if (r.startsWith('//')) return `${o.slice(0, o.indexOf('//'))}${r}`;
  const split = (s: string): [string, string] => {
    const i = s.search(/[?#]/);
    return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i)];
  };
  const [refPath, refTail] = split(r);
  if (refPath === '') {
    // Query- or fragment-only reference: keep the base path.
    const [basePath] = split(base.slice(o.length));
    return `${o}${basePath || '/'}${refTail}`;
  }
  if (refPath.startsWith('/')) return `${o}${normalisePath(refPath)}${refTail}`;
  const [basePath] = split(base.slice(o.length));
  const dir = basePath.includes('/') ? basePath.slice(0, basePath.lastIndexOf('/') + 1) : '/';
  return `${o}${normalisePath(dir + refPath)}${refTail}`;
}

/**
 * Parses a device description. Throws a translated DriverError when the LOCATION or any control
 * URL is not on the LAN ('forbidden'), when there is no AVTransport service ('unsupported'), or
 * when the document is not a UPnP description ('network').
 */
export function parseDeviceDescription(xml: string, location: string): CastRenderer {
  if (!isLanHttpUrl(location)) throw driverError('forbidden', 'core.driver.cast.notLan');
  if (elementsXml(xml, 'root').length === 0 && elementsXml(xml, 'device').length === 0) {
    throw driverError('network', 'core.driver.cast.badReply');
  }
  const urlBase = firstText(xml, 'URLBase');
  const base = urlBase && urlBase !== '' ? urlBase : location;
  if (urlBase && urlBase !== '' && !isLanHttpUrl(urlBase)) throw driverError('forbidden', 'core.driver.cast.notLan');

  let av: { url: string; type: string } | null = null;
  let rc: { url: string; type: string } | null = null;
  for (const svc of elementsXml(xml, 'service')) {
    const type = firstText(svc, 'serviceType') ?? '';
    const ctl = firstText(svc, 'controlURL');
    if (!ctl) continue;
    const isAv = AV_TRANSPORT.test(type);
    const isRc = RENDERING_CONTROL.test(type);
    if (!isAv && !isRc) continue;
    if ((isAv && av) || (isRc && rc)) continue;
    const url = resolveUrl(base, ctl);
    if (!url || !isLanHttpUrl(url)) throw driverError('forbidden', 'core.driver.cast.notLan');
    if (isAv) av = { url, type };
    else rc = { url, type };
  }
  if (!av) throw driverError('unsupported', 'core.driver.cast.noRenderer');

  const host = urlHost(location)!;
  const modelName = firstText(xml, 'modelName') ?? undefined;
  const friendly = firstText(xml, 'friendlyName');
  const name = friendly && friendly !== '' ? friendly : modelName && modelName !== '' ? modelName : host;
  const r: CastRenderer = { name, host, location, avTransportUrl: av.url, avTransportType: av.type };
  const udn = firstText(xml, 'UDN');
  if (udn) r.udn = udn;
  if (modelName) r.modelName = modelName;
  if (rc) {
    r.renderingControlUrl = rc.url;
    r.renderingControlType = rc.type;
  }
  return r;
}

/** Fetches and parses the description at `location` (LAN-only; checked before any request). */
export async function fetchRenderer(fetch: FetchLike, location: string, timeoutMs = 3000): Promise<CastRenderer> {
  if (!isLanHttpUrl(location)) throw driverError('forbidden', 'core.driver.cast.notLan');
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetch(location, { method: 'GET', timeoutMs });
  } catch {
    throw driverError('network', 'core.driver.common.unreachable');
  }
  if (!res.ok) throw driverError('network', 'core.driver.common.http', { status: String(res.status) });
  return parseDeviceDescription(await res.text(), location);
}
