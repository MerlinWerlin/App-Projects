/**
 * Couch Plus copy for the paywall (app/plus.tsx), translated on read. Kept apart from entitlement.ts so the store
 * code stays free of the i18n runtime (Node tests import it directly).
 */
import { t } from '../i18n/core';
import { withCopy } from '../i18n/lazyCopy';
import type { PlusFeature } from './entitlement';

/** What each part of Couch Plus unlocks. Translated on read (t() getters). */
export const PLUS_FEATURE_COPY: Record<PlusFeature, { title: string; hint: string }> = {
  remote: withCopy({ title: '', hint: '' }, { title: 'core.plus.feature.remote.title', hint: 'core.plus.feature.remote.hint' }),
  cast: withCopy({ title: '', hint: '' }, { title: 'core.plus.feature.cast.title', hint: 'core.plus.feature.cast.hint' }),
};

/** The paywall headline, in the active language. */
export function plusPromise(): string {
  return t('core.plus.promise');
}
