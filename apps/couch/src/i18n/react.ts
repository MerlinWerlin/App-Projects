/**
 * React binding for src/i18n/core: useT() re-renders the component when the language changes.
 * Components call `const t = useT();` then `t('app.settings.title')`.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { getLocale, subscribeLocale, t as translate, type MessageKey, type Params } from './core';
import type { AnyLocale } from './locales';

export function useLocale(): AnyLocale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}

export function useT(): (key: MessageKey, params?: Params) => string {
  const locale = useLocale();
  return useCallback((key: MessageKey, params?: Params) => translate(key, params, locale), [locale]);
}
