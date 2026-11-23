/** Store messages (purchases.ts expects a `t(key, vars)` lookup). */
const M = {
  'plus.failed': 'The purchase could not be confirmed. Use Restore purchases to check before trying again. [{code}]',
  'plus.unavailable': 'The App Store is unavailable right now. Nothing was charged. Please try again when connected. [E_STORE_UNAVAILABLE]',
  'plus.cancelled': 'Purchase cancelled. Nothing was charged.',
  'plus.pending': 'Your purchase is waiting for approval. Eaveline unlocks once the App Store confirms it; you can also tap Restore purchases.',
  'plus.nothingToRestore': 'No Eaveline purchases were found for this App Store account.',
} as const;
export type MessageKey = keyof typeof M;
export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  return M[key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}
