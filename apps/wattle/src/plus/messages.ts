/** Store messages. A failure always says nothing was charged and shows the store's code (release standard §2). */
export const msg = {
  failed: (code: string) => `The purchase didn't go through and nothing was charged. Please try again in a moment. [${code}]`,
  unavailable: "The App Store isn't reachable right now, so nothing was charged. Check your connection and try again. [E_STORE_UNAVAILABLE]",
  pending: 'Your purchase is waiting for approval (for example Ask to Buy). Wattle unlocks as soon as Apple confirms it.',
  cancelled: 'Purchase cancelled. Nothing was charged.',
  nothingToRestore: 'No Wattle purchase or trial was found for this Apple Account.',
};
