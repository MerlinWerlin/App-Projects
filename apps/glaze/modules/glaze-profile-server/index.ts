// Typed wrapper for the GlazeProfileServer native module (iOS native builds only, T126).
// App code must NOT import this file: go through src/native/profileServer.ts, which reports
// "unavailable" in Expo Go, on Android and in builds without the module, and never throws.
import { requireOptionalNativeModule } from 'expo';

export type GlazeProfileServerStart = {
  /** Landing page to open in Safari, e.g. http://127.0.0.1:52011/ */
  url: string;
  /** Direct profile URL, e.g. http://127.0.0.1:52011/glaze.mobileconfig */
  profileUrl: string;
  port: number;
};

export type GlazeProfileServerNative = {
  /**
   * Serve the .mobileconfig at `path` (file:// URI or plain path) until it has been fetched, the
   * timeout passes or iOS ends the background time. `pageJson` holds the landing page texts
   * ({ lang, title, body, button }). Rejects when the file is unreadable or the port won't open.
   */
  start(path: string, pageJson: string, timeoutSeconds: number): Promise<GlazeProfileServerStart>;
  stop(): boolean;
  /** True while the server is listening. */
  isServing(): boolean;
  /** How many times Safari has fetched the profile since the last start. */
  fetchCount(): number;
};

/** The native module, or null where it isn't built in. */
export default requireOptionalNativeModule<GlazeProfileServerNative>('GlazeProfileServer');
