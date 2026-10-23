/**
 * Expo Router system-path redirect for widget links (T77). Pure TypeScript.
 *
 * Expo Router turns every incoming couch:// URL into a route, and there is no /widget route, so a
 * widget tap would otherwise land on the "unmatched route" screen. app/+native-intent.tsx re-exports
 * redirectSystemPath from here (docs/WIDGET.md): widget links open the remote ("/" redirects to it)
 * while useWidgetLinks() receives the same URL from Linking and sends the key. Not verified on a
 * device.
 */
import { looksLikeWidgetLink } from '../../core/widget/links';

/** True for a widget link given as a full URL or as the router's path form (/widget/..., widget/...). */
export function isWidgetSystemPath(path: string): boolean {
  return looksLikeWidgetLink(path) || /^\/?widget(\/|\?|$)/.test(path);
}

export function redirectSystemPath({ path }: { path: string; initial?: boolean }): string {
  try {
    return isWidgetSystemPath(path) ? '/' : path;
  } catch {
    return path;
  }
}
