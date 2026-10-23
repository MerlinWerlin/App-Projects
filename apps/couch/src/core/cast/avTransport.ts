/**
 * UPnP AVTransport SOAP client (T76): SetAVTransportURI, Play, Pause, Stop, Seek, GetTransportInfo,
 * GetPositionInfo over an injected fetch. Every argument value is XML-escaped; a SOAP fault becomes
 * a translated DriverError via faultToError(). Tested against reconstructed fixtures only.
 */
import type { FetchLike } from '../driver';
import { driverError } from '../drivers/errors';
import type { DriverError } from '../types';
import { AV_TRANSPORT_1, isLanHttpUrl } from './description';
import { buildDidlLite, formatHms, validateMedia, type CastMedia } from './didl';
import { elementsXml, escapeXml, firstText } from './xml';

export type TransportState =
  | 'STOPPED'
  | 'PLAYING'
  | 'PAUSED_PLAYBACK'
  | 'TRANSITIONING'
  | 'NO_MEDIA_PRESENT'
  | (string & {});

export interface TransportInfo {
  state: TransportState;
  /** CurrentTransportStatus: OK or ERROR_OCCURRED. */
  status: string;
  speed: string;
}

export interface PositionInfo {
  /** Seconds, or null when the renderer reports NOT_IMPLEMENTED / nothing. */
  durationSec: number | null;
  positionSec: number | null;
  trackUri: string | null;
}

/** What CastSession needs; AvTransportClient implements it, tests use fakes. */
export interface AvTransport {
  setUri(media: CastMedia): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seek(seconds: number): Promise<void>;
  getTransportInfo(): Promise<TransportInfo>;
  getPositionInfo(): Promise<PositionInfo>;
}

export function soapActionHeader(serviceType: string, action: string): string {
  return `"${serviceType}#${action}"`;
}

export function buildSoapEnvelope(serviceType: string, action: string, args: ReadonlyArray<readonly [string, string]>): string {
  const body = args.map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`).join('');
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
    `<s:Body><u:${action} xmlns:u="${escapeXml(serviceType)}">${body}</u:${action}></s:Body>` +
    '</s:Envelope>'
  );
}

/** H+:MM:SS[.F+] (or F0/F1 fractions) to seconds; null for NOT_IMPLEMENTED, empty or malformed. */
export function parseHms(value: string | null | undefined): number | null {
  const m = /^\s*\+?(\d+):([0-5]?\d):([0-5]?\d)(?:\.(\d+)(?:\/(\d+))?)?\s*$/.exec(value ?? '');
  if (!m) return null;
  let s = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  if (m[4]) s += m[5] ? Number(m[4]) / Math.max(1, Number(m[5])) : Number(`0.${m[4]}`);
  return s;
}

export interface SoapFault {
  /** UPnP errorCode, or null when the fault carries none. */
  code: number | null;
  description: string | null;
}

/** The UPnPError inside a SOAP fault, or null when the body is not a fault. */
export function parseSoapFault(xml: string): SoapFault | null {
  if (elementsXml(xml, 'Fault').length === 0) return null;
  const codeText = firstText(xml, 'errorCode');
  const code = codeText !== null && /^\d+$/.test(codeText) ? Number(codeText) : null;
  return { code, description: firstText(xml, 'errorDescription') };
}

/** UPnP / AVTransport error code to a translated DriverError (code stays stable for logic). */
export function faultToError(code: number | null): DriverError {
  switch (code) {
    case 401: // Invalid Action
    case 602: // Optional action not implemented
      return driverError('unsupported', 'core.driver.cast.actionUnsupported');
    case 701: // Transition not available
      return driverError('unsupported', 'core.driver.cast.notNow');
    case 704: // Playback format not supported
    case 714: // Illegal MIME-type
      return driverError('unsupported', 'core.driver.cast.formatUnsupported');
    case 702: // No contents
    case 703: // Read error
    case 716: // Resource not found
      return driverError('network', 'core.driver.cast.fileUnreachable');
    case 710: // Seek mode not supported
    case 711: // Illegal seek target
      return driverError('unsupported', 'core.driver.cast.seekUnsupported');
    case 705: // Transport is locked
      return driverError('forbidden', 'core.driver.cast.busy');
    default:
      return driverError('network', 'core.driver.cast.tvError', { code: code === null ? '?' : String(code) });
  }
}

export interface AvTransportOptions {
  serviceType?: string;
  instanceId?: string;
  timeoutMs?: number;
}

export class AvTransportClient implements AvTransport {
  private readonly serviceType: string;
  private readonly instanceId: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly fetch: FetchLike,
    private readonly controlUrl: string,
    opts: AvTransportOptions = {},
  ) {
    if (!isLanHttpUrl(controlUrl)) throw driverError('forbidden', 'core.driver.cast.notLan');
    this.serviceType = opts.serviceType ?? AV_TRANSPORT_1;
    this.instanceId = opts.instanceId ?? '0';
    this.timeoutMs = opts.timeoutMs ?? 5000;
  }

  /** Sends one action; returns the response XML. Throws a translated DriverError. */
  async call(action: string, args: ReadonlyArray<readonly [string, string]> = []): Promise<string> {
    const body = buildSoapEnvelope(this.serviceType, action, [['InstanceID', this.instanceId], ...args]);
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.fetch(this.controlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset="utf-8"',
          SOAPACTION: soapActionHeader(this.serviceType, action),
        },
        body,
        timeoutMs: this.timeoutMs,
      });
    } catch {
      throw driverError('network', 'core.driver.common.unreachable');
    }
    let text = '';
    try {
      text = await res.text();
    } catch {
      text = '';
    }
    const fault = parseSoapFault(text);
    if (fault) throw faultToError(fault.code);
    if (!res.ok) throw driverError('network', 'core.driver.common.http', { status: String(res.status) });
    if (elementsXml(text, `${action}Response`).length === 0) throw driverError('network', 'core.driver.cast.badReply');
    return text;
  }

  async setUri(media: CastMedia): Promise<void> {
    validateMedia(media);
    await this.call('SetAVTransportURI', [
      ['CurrentURI', media.url],
      ['CurrentURIMetaData', buildDidlLite(media)],
    ]);
  }

  async play(): Promise<void> {
    await this.call('Play', [['Speed', '1']]);
  }

  async pause(): Promise<void> {
    await this.call('Pause');
  }

  async stop(): Promise<void> {
    await this.call('Stop');
  }

  async seek(seconds: number): Promise<void> {
    await this.call('Seek', [
      ['Unit', 'REL_TIME'],
      ['Target', formatHms(seconds, 2)],
    ]);
  }

  async getTransportInfo(): Promise<TransportInfo> {
    const xml = await this.call('GetTransportInfo');
    const state = firstText(xml, 'CurrentTransportState');
    if (!state) throw driverError('network', 'core.driver.cast.badReply');
    return { state, status: firstText(xml, 'CurrentTransportStatus') ?? '', speed: firstText(xml, 'CurrentSpeed') ?? '' };
  }

  async getPositionInfo(): Promise<PositionInfo> {
    const xml = await this.call('GetPositionInfo');
    const uri = firstText(xml, 'TrackURI');
    return {
      durationSec: parseHms(firstText(xml, 'TrackDuration')),
      positionSec: parseHms(firstText(xml, 'RelTime')),
      trackUri: uri && uri !== '' ? uri : null,
    };
  }
}
