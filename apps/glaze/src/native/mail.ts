// Mail composer adapter for "Send feedback" (T23). expo-mail-composer ships in Expo Go, but it is
// still loaded lazily and behind a native-module check so a missing module can never crash a
// screen (including the error fallback): callers just get "unavailable" and show the fallback.
import { requireOptionalNativeModule } from 'expo';

type MailComposerModule = typeof import('expo-mail-composer');

export type ComposeOutcome = 'sent' | 'saved' | 'cancelled' | 'unknown' | 'unavailable' | 'failed';

export type ComposeRequest = {
  recipients: string[];
  subject: string;
  body: string;
  /** Local file URIs (e.g. a screenshot picked from Photos). */
  attachments?: string[];
};

let cached: MailComposerModule | null | undefined;

function load(): MailComposerModule | null {
  if (cached !== undefined) return cached;
  let mod: MailComposerModule | null = null;
  try {
    const native =
      typeof requireOptionalNativeModule === 'function' ? requireOptionalNativeModule('ExpoMailComposer') : null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = native ? (require('expo-mail-composer') as MailComposerModule) : null;
  } catch {
    mod = null;
  }
  cached = mod;
  return mod;
}

/** True when a Mail account is set up and the in-app composer can open. Never throws. */
export async function isMailAvailable(): Promise<boolean> {
  const m = load();
  if (!m) return false;
  try {
    return await m.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Open the system composer pre-filled. Nothing is sent unless the user presses Send there. */
export async function composeMail(req: ComposeRequest): Promise<ComposeOutcome> {
  const m = load();
  if (!m) return 'unavailable';
  try {
    if (!(await m.isAvailableAsync())) return 'unavailable';
    const res = await m.composeAsync({
      recipients: req.recipients,
      subject: req.subject,
      body: req.body,
      isHtml: false,
      attachments: req.attachments && req.attachments.length > 0 ? req.attachments : undefined,
    });
    const status = String(res?.status ?? '');
    if (status === 'sent' || status === 'saved' || status === 'cancelled') return status;
    return 'unknown';
  } catch {
    return 'failed';
  }
}
