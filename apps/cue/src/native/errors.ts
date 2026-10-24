/** Real error messages (starter standard: Save/Share never fail silently). */
import { t } from '../i18n';

export function reason(e: unknown): string {
  if (e instanceof Error && e.message) return e.message.replace(/^Error:\s*/, '').slice(0, 140);
  if (typeof e === 'string' && e) return e.slice(0, 140);
  return t('error.unknown');
}
