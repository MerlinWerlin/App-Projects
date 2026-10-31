// A tiny change signal (T63): something on the phone changed, listeners reload what they show. Pure TS, synchronous,
// no payload. Used for offline city maps (src/native/cityMaps.ts emits after a download, a delete or a new catalog
// copy) so the trip's "Ready to go?" map row and the cached Nearest help pack data refresh straight away instead of
// waiting for the next screen focus or app start. A listener that throws never stops the others.

export type Signal = {
  /** Calls every listener (in subscribe order) and bumps the version. */
  emit: () => void;
  /** Adds a listener; returns the unsubscribe function (safe to call twice). */
  subscribe: (listener: () => void) => () => void;
  /** How many times emit has run: handy as a React dependency. */
  version: () => number;
};

export function createSignal(): Signal {
  const listeners = new Set<() => void>();
  let v = 0;
  return {
    emit() {
      v++;
      for (const l of [...listeners]) {
        try {
          l();
        } catch {
          // one broken listener must not stop the rest
        }
      }
    },
    subscribe(listener) {
      const own = () => listener();
      listeners.add(own);
      return () => {
        listeners.delete(own);
      };
    },
    version: () => v,
  };
}

/** Offline city maps on this phone changed: a city was installed or deleted, or a new catalog copy was saved. */
export const cityMapsChanged: Signal = createSignal();
