// Which screens want the privacy cover (T57). The vault, a document and the document editor each register while
// mounted; the root layout shows <PrivacyCover> over the whole stack while any are registered. Module-level, like
// the vault lock, so no Provider is needed.
import { useEffect, useSyncExternalStore } from 'react';

let count = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Call in a screen that shows private documents: the app is covered in the app switcher while it is mounted. */
export function usePrivacyGuard(): void {
  useEffect(() => {
    count += 1;
    emit();
    return () => {
      count = Math.max(0, count - 1);
      emit();
    };
  }, []);
}

/** True while at least one private screen is mounted. */
export function usePrivacyGuarded(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => count > 0,
  );
}
