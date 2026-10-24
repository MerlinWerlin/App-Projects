// Startup hand-off (fb-1024 A, T117). Owner, 24 Oct: "when opening Glaze the animation is good but 'index' pops up at
// the time before it loads". Two causes: the root stack showed a default header titled with the raw route name for
// app/index.tsx (the redirect to Themes) for a frame, and the opening animation started fading the moment the app
// mounted, before the first screen had laid out.
//
// Now: every route has a real title or no header (src/core/routeTitles.test.ts), and the opening animation stays up
// until the first screen reports its first layout (markFirstScreen), with a short cap so it can never hang.
// Pure TypeScript (Node runs it in tests); the UI subscribes through `whenFirstScreen`.

/** Never hold the opening animation longer than this after the app mounted under it. */
export const HANDOFF_MAX_WAIT_MS = 1200;

let laidOut = false;
const waiters = new Set<() => void>();

/** The first real screen has laid out (called once from the tabs layout's onLayout, after a frame). */
export function markFirstScreen(): void {
  if (laidOut) return;
  laidOut = true;
  const list = [...waiters];
  waiters.clear();
  for (const fn of list) fn();
}

export function isFirstScreenReady(): boolean {
  return laidOut;
}

/**
 * Call `fn` once, when the first screen has laid out or after `maxMs`, whichever is first. Returns a cancel function.
 * `setTimer` / `clearTimer` are injectable for tests.
 */
export function whenFirstScreen(
  fn: () => void,
  maxMs: number = HANDOFF_MAX_WAIT_MS,
  setTimer: (cb: () => void, ms: number) => unknown = (cb, ms) => setTimeout(cb, ms),
  clearTimer: (id: unknown) => void = (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
): () => void {
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    waiters.delete(fire);
    clearTimer(timer);
    fn();
  };
  if (laidOut) {
    done = true;
    fn();
    return () => {};
  }
  const timer = setTimer(fire, maxMs);
  waiters.add(fire);
  return () => {
    done = true;
    waiters.delete(fire);
    clearTimer(timer);
  };
}

/** Test hook: back to a cold start. */
export function resetFirstScreenForTests(): void {
  laidOut = false;
  waiters.clear();
}
