/**
 * User-facing DriverErrors (owner-1016 T53).
 *
 * A DriverError's message reaches the user: as a toast via describeError() (src/core/session.ts),
 * as the driver's 'error' event (session lastError, diagnostics), or on the add-TV / pairing
 * screens. So every message is a catalogue key, translated with t() when the error is created.
 * The `code` stays stable for logic; never branch on the message text.
 *
 * Brand / product names are data passed as {device} ("Roku", "Fire TV", "Sony TV"), not translated.
 * Technical values (key names, app ids, HTTP status, ports, raw TV replies) go in as string params
 * so they are not number-formatted (port 8002, not "8,002").
 *
 * Diagnostic-only text that is never shown to users (code comments, thrown programming errors such
 * as "no emitter", String(e) of an unexpected transport error) may stay English.
 */
import { t, type MessageKey, type Params } from '../../i18n/core';
import { DriverError } from '../types';

export type DriverErrorCode = DriverError['code'];

/** A DriverError whose message is `key` translated for the active locale. */
export function driverError(code: DriverErrorCode, key: MessageKey, params?: Params): DriverError {
  return new DriverError(code, t(key, params));
}

/**
 * Any thrown value as a DriverError. A non-DriverError (an unexpected transport or runtime error)
 * becomes 'network' with a translated sentence; its own English text is kept only as {detail},
 * for diagnostics.
 */
export function asDriverError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  const detail = e instanceof Error ? e.message : String(e);
  return driverError('network', 'core.driver.common.unexpected', { detail });
}
