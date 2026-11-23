/** Purchase messages (English; Spigot is English-only for 1.0). Every failure says nothing was charged. */
const M = {
  'plus.unavailable': 'The App Store isn’t available right now. Nothing was charged. Try again when you’re connected. [E_STORE_UNAVAILABLE]',
  'plus.failed': 'The purchase couldn’t be confirmed. Nothing was charged. Use Restore purchases to check before trying again. [{code}]',
  'plus.cancelled': 'Purchase cancelled. Nothing was charged.',
  'plus.pending': 'Your purchase is waiting for approval. Spigot unlocks once the App Store confirms it. You can also use Restore purchases.',
  'plus.nothingToRestore': 'No Spigot purchases were found for this Apple Account. Nothing was charged.',
  'plus.trial.left': '{n} days of your free trial left',
  'plus.trial.leftOne': 'Last day of your free trial',
} as const;
export type MessageKey = keyof typeof M;
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return M[key].replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''));
}
