/**
 * Tip jar tiers as data only. No store products exist; ids are local and would be mapped to store
 * product ids by the owner when a real PurchaseProvider is added. Tips unlock nothing.
 */
import { t } from '../i18n/core';
import { withCopy } from '../i18n/lazyCopy';

export interface TipTier {
  id: string;
  label: string;
  /** Indicative US$ price for display planning; the store sets real, localised prices. */
  usd: number;
  note: string;
}

/** Label and note translate on read (t() getters). */
export const TIP_TIERS: readonly TipTier[] = [
  withCopy({ id: 'tip.small', label: '', usd: 0.99, note: '' }, { label: 'core.plus.tip.small.label', note: 'core.plus.tip.small.note' }),
  withCopy({ id: 'tip.medium', label: '', usd: 2.99, note: '' }, { label: 'core.plus.tip.medium.label', note: 'core.plus.tip.medium.note' }),
  withCopy({ id: 'tip.large', label: '', usd: 4.99, note: '' }, { label: 'core.plus.tip.large.label', note: 'core.plus.tip.large.note' }),
];

/** The tip jar's promise, in the active language. */
export function tipJarCopy(): string {
  return t('core.plus.tipJar');
}

export function tipTier(id: string): TipTier | undefined {
  return TIP_TIERS.find((t) => t.id === id);
}
