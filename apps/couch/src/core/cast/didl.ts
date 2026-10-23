/**
 * DIDL-Lite metadata for SetAVTransportURI (T76). Every value is XML-escaped here; the whole
 * document is escaped once more when it goes into the SOAP envelope (avTransport.ts).
 */
import { driverError } from '../drivers/errors';
import { isLanHttpUrl } from './description';
import { escapeXml } from './xml';

export type CastKind = 'photo' | 'video';

export interface CastMedia {
  /** http://<phone-lan-ip>:<port>/<token> from the MediaServer. */
  url: string;
  title: string;
  /** e.g. image/jpeg, video/mp4. */
  mime: string;
  kind: CastKind;
  durationSec?: number;
  sizeBytes?: number;
}

export const UPNP_CLASS: Record<CastKind, string> = {
  photo: 'object.item.imageItem.photo',
  video: 'object.item.videoItem',
};

const MIME: Record<CastKind, RegExp> = {
  photo: /^image\/[a-z0-9][a-z0-9.+-]*$/i,
  video: /^video\/[a-z0-9][a-z0-9.+-]*$/i,
};

/** Seconds as H:MM:SS for DIDL (and HH:MM:SS for Seek via formatHms in avTransport). */
export function formatHms(totalSec: number, padHours = 2): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSec) ? totalSec : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(padHours, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Throws a translated DriverError when the media cannot be described for a renderer. */
export function validateMedia(media: CastMedia): void {
  if (!isLanHttpUrl(media.url)) throw driverError('forbidden', 'core.driver.cast.notLan');
  if (!MIME[media.kind].test(media.mime)) throw driverError('unsupported', 'core.driver.cast.formatUnsupported');
}

/** protocolInfo for an HTTP-served file: http-get:*:<mime>:* */
export function protocolInfo(mime: string): string {
  return `http-get:*:${mime.toLowerCase()}:*`;
}

export function buildDidlLite(media: CastMedia): string {
  validateMedia(media);
  const attrs = [`protocolInfo="${escapeXml(protocolInfo(media.mime))}"`];
  if (media.sizeBytes !== undefined && Number.isFinite(media.sizeBytes) && media.sizeBytes >= 0) {
    attrs.push(`size="${Math.floor(media.sizeBytes)}"`);
  }
  if (media.kind === 'video' && media.durationSec !== undefined && media.durationSec > 0) {
    attrs.push(`duration="${formatHms(media.durationSec, 1)}"`);
  }
  return (
    '<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"' +
    ' xmlns:dc="http://purl.org/dc/elements/1.1/"' +
    ' xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">' +
    '<item id="0" parentID="-1" restricted="1">' +
    `<dc:title>${escapeXml(media.title)}</dc:title>` +
    `<upnp:class>${UPNP_CLASS[media.kind]}</upnp:class>` +
    `<res ${attrs.join(' ')}>${escapeXml(media.url)}</res>` +
    '</item></DIDL-Lite>'
  );
}
