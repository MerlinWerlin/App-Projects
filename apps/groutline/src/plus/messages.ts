export const PURCHASE_MESSAGES = {
  unavailable: 'The App Store is unavailable right now. Nothing was charged. Try again when you have signal. [E_STORE_UNAVAILABLE]',
  failed: (code: string) => `The purchase could not be confirmed. Nothing extra will be charged; use Restore purchases to check before trying again. [${code}]`,
  cancelled: 'Purchase cancelled. Nothing was charged.',
  pending: 'Your purchase is waiting for approval. Groutline unlocks as soon as the App Store confirms it, or use Restore purchases.',
  nothingToRestore: 'No Groutline purchases were found for this Apple Account.',
};
