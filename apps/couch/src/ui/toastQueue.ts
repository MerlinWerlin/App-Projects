/**
 * Toast queue (premium polish rule 5). Pure TS, no React Native: src/ui/Toast.tsx renders it.
 * One toast visible at a time for TOAST_MS (prototype toast(): 2.2 s); identical consecutive
 * messages are dropped; at most MAX_PENDING wait behind the visible one (oldest dropped).
 */
export type ToastKind = 'info' | 'success' | 'warning';

export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

export interface ToastState {
  visible: ToastItem | null;
  pending: ToastItem[];
  nextId: number;
}

export const TOAST_MS = 2200;
export const MAX_PENDING = 3;

export const emptyToasts: ToastState = { visible: null, pending: [], nextId: 1 };

/** Add a toast. Blank messages and repeats of the latest (visible or last pending) toast are ignored. */
export function enqueue(s: ToastState, message: string, kind: ToastKind = 'info'): ToastState {
  const text = message.trim();
  if (!text) return s;
  const latest = s.pending.length > 0 ? s.pending[s.pending.length - 1] : s.visible;
  if (latest && latest.message === text && latest.kind === kind) return s;
  const item: ToastItem = { id: s.nextId, message: text, kind };
  if (s.visible === null) return { visible: item, pending: s.pending, nextId: s.nextId + 1 };
  const pending = [...s.pending, item].slice(-MAX_PENDING);
  return { visible: s.visible, pending, nextId: s.nextId + 1 };
}

/** The visible toast finished: show the next pending one (or nothing). */
export function advance(s: ToastState): ToastState {
  const [head, ...rest] = s.pending;
  return { visible: head ?? null, pending: rest, nextId: s.nextId };
}

/** Haptic per kind (names match src/ui/remote/haptics.ts HapticKind). */
export function toastHaptic(kind: ToastKind): 'success' | 'warning' | 'light' {
  return kind === 'success' ? 'success' : kind === 'warning' ? 'warning' : 'light';
}

/** Module-level store so any screen can call showToast without context. */
export function createToastStore() {
  let state = emptyToasts;
  const subs = new Set<() => void>();
  const set = (next: ToastState) => {
    if (next === state) return;
    state = next;
    for (const fn of [...subs]) {
      try {
        fn();
      } catch {
        // A broken listener never breaks the caller.
      }
    }
  };
  return {
    get: (): ToastState => state,
    show: (message: string, kind: ToastKind = 'info'): void => set(enqueue(state, message, kind)),
    /** Advance only if `id` is still the visible toast (stale timers do nothing). */
    done: (id: number): void => {
      if (state.visible?.id === id) set(advance(state));
    },
    subscribe: (fn: () => void): (() => void) => {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
    reset: (): void => set(emptyToasts),
  };
}

export const toastStore = createToastStore();
