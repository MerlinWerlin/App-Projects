/**
 * media-server: a tiny HTTP/1.1 file server on the phone so a TV (DLNA / UPnP renderer) can fetch
 * one picked photo or video over the home network (cast-1024 phase A, T90).
 *
 * serve(uri, mime) registers a file:// (or Android content://) URI under a fresh random token and
 * starts the single per-process server on first use (ephemeral port >= 1024, all interfaces). The
 * file is then served at http://<phone IP>:<port>/<token>[.<ext>] (the JS wrapper
 * src/native/mediaServer.ts builds that URL and adds the extension). GET and HEAD only, single
 * byte ranges (206 / 416). The server stops on stopAll() and when the app goes to the background.
 *
 * UNVERIFIED: never compiled (needs a dev build) and not tested on a device or a TV. See README.md.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

export interface MediaServerServeResult {
  /** Handle for stop(id). */
  id: string;
  /** Listening TCP port (>= 1024). */
  port: number;
  /** URL path token: base64url, no padding, at least 128 random bits (24 chars). */
  token: string;
}

export interface MediaServerNativeModule {
  /**
   * Serves `uri` (file:// on both platforms, content:// on Android; ph:// is rejected) with
   * Content-Type `mime`. Rejects with ERR_MEDIA_SERVER_URI (unsupported or unreadable URI) or
   * ERR_MEDIA_SERVER_START (the listener could not start).
   */
  serve(uri: string, mime: string): Promise<MediaServerServeResult>;
  /** Stops serving one file (its URL answers 404 afterwards); unknown ids are ignored. */
  stop(id: string): Promise<void>;
  /** Forgets every file and stops the listener (it restarts on the next serve). */
  stopAll(): Promise<void>;
}

/** The native module, or null in Expo Go / web / tests where it is not compiled in. */
const MediaServer = requireOptionalNativeModule<MediaServerNativeModule>('MediaServer');

export default MediaServer;

export function isMediaServerAvailable(): boolean {
  return MediaServer !== null;
}
