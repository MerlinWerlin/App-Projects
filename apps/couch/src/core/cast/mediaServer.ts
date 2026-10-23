/**
 * MediaServer adapter (T76): serves one local file (a photo or video picked on the phone) over
 * plain HTTP on the LAN so a renderer can fetch it with SetAVTransportURI. The real server is a
 * native module that only exists in a dev build (src/native/mediaServer.ts); in Expo Go, web and
 * tests the app gets UNAVAILABLE_MEDIA_SERVER, which refuses with a translated DriverError.
 *
 * Served URLs are always http://<phone RFC 1918 IPv4>:<port>/<token>[.<ext>] with an unguessable
 * token, so another device on the Wi-Fi cannot list or guess the phone's files.
 */
import { driverError } from '../drivers/errors';
import { isRfc1918Host } from '../lanHost';

export interface ServeRequest {
  /** Local file URI from the picker (file://, content:// or ph://). */
  uri: string;
  mime: string;
}

export interface ServedFile {
  /** URL the TV fetches. */
  url: string;
  /** Stops serving this file (the URL then answers 404). */
  stop(): Promise<void>;
}

export interface MediaServer {
  /** false in Expo Go / without the native module: serve() always rejects. */
  readonly available: boolean;
  serve(req: ServeRequest): Promise<ServedFile>;
  stopAll(): Promise<void>;
}

export const UNAVAILABLE_MEDIA_SERVER: MediaServer = Object.freeze({
  available: false,
  serve: async (): Promise<ServedFile> => {
    throw driverError('unsupported', 'core.driver.cast.needsFullApp');
  },
  stopAll: async (): Promise<void> => {},
});

/** At least 128 bits as URL-safe characters; an optional short file extension may follow. */
const TOKEN = /^[A-Za-z0-9_-]{22,128}$/;
const EXT = /^[a-z0-9]{1,5}$/i;

export function isValidToken(token: string): boolean {
  return TOKEN.test(token);
}

/** Builds the served URL, or null when any part is unsafe (non-LAN IP, bad port, weak token). */
export function servedUrl(phoneIp: string, port: number, token: string, ext?: string): string | null {
  if (!isRfc1918Host(phoneIp)) return null;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return null;
  if (!isValidToken(token)) return null;
  if (ext !== undefined && !EXT.test(ext)) return null;
  return `http://${phoneIp}:${port}/${token}${ext ? `.${ext.toLowerCase()}` : ''}`;
}

/** True for a URL servedUrl() could have produced. */
export function isServedUrl(url: string): boolean {
  const m = /^http:\/\/([0-9.]+):(\d{1,5})\/([A-Za-z0-9_-]+)(?:\.([A-Za-z0-9]+))?$/.exec(url);
  if (!m) return false;
  return servedUrl(m[1]!, Number(m[2]), m[3]!, m[4]) !== null;
}

/** File extension the URL should carry for a mime type (some renderers sniff the path). */
export function extensionForMime(mime: string): string | undefined {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-matroska': 'mkv',
    'video/webm': 'webm',
  };
  return map[mime.toLowerCase()];
}
