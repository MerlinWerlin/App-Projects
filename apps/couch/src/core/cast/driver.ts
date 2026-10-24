/**
 * CastDriver (cast-1024, T89 contract): one way of putting a phone photo or video on one TV.
 * Same idea as TvDriver for the remote: the screen only talks to this interface, and each
 * transport (DLNA/UPnP MediaRenderer, Roku media player, MockCast for demo mode) implements it.
 *
 * The media is already being served by the phone (MediaServer) when load() is called: `media.url`
 * is an http://<phone-lan-ip>:<port>/<token> URL. Drivers never serve files themselves.
 *
 * Pure TypeScript. Real drivers are tested against fixtures only; nothing here has been tried on
 * real hardware.
 */
import type { CastMedia } from './didl';
import type { CastSnapshot } from './session';

export type CastTransportKind = 'dlna' | 'roku' | 'mock';

/** A cast target found on the network (or the demo TV). */
export interface CastTarget {
  /** Stable id: `dlna:<udn or location>`, `roku:<host>`, `mock:demo`. */
  id: string;
  /** Name to show (friendlyName, TV name). */
  name: string;
  kind: CastTransportKind;
  host: string;
  /** Which media kinds this target accepts. */
  accepts: { photo: boolean; video: boolean };
  /** Id of the saved TV (src/state/tvs) this target belongs to, when matched by host. */
  tvId?: string;
}

export interface CastDriver {
  readonly target: CastTarget;
  /** Starts showing/playing `media`, replacing whatever was on before. Rejects with DriverError. */
  load(media: CastMedia): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  /** Absolute position in seconds; clamped by the driver. Photos ignore it. */
  seek(positionSec: number): Promise<void>;
  /** Stops casting (the TV goes back to what it showed before, where the TV supports it). */
  stop(): Promise<void>;
  /** Latest playback state. */
  snapshot(): CastSnapshot;
  /** Subscribe to state changes; returns an unsubscribe function. */
  subscribe(listener: (s: CastSnapshot) => void): () => void;
  /** Releases timers and sockets. The driver is unusable afterwards. */
  dispose(): void;
}

export type CastDriverFactory = (target: CastTarget) => CastDriver;
