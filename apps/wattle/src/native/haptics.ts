/** Light haptics on selection and a success tap after a purchase. Guarded: never throws. */
declare const require: (id: string) => unknown;
type H = { selectionAsync?: () => Promise<void>; notificationAsync?: (t: unknown) => Promise<void>; NotificationFeedbackType?: { Success: unknown } };
let mod: H | null | undefined;
function h(): H | null {
  if (mod !== undefined) return mod;
  try { mod = require('expo-haptics') as H; } catch { mod = null; }
  return mod;
}
export function tap(on: boolean): void {
  if (on) h()?.selectionAsync?.().catch(() => undefined);
}
export function success(on: boolean): void {
  const m = h();
  if (on && m?.notificationAsync && m.NotificationFeedbackType) m.notificationAsync(m.NotificationFeedbackType.Success).catch(() => undefined);
}
