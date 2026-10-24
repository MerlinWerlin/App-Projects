import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';
import { HANDOFF_MAX_WAIT_MS, isFirstScreenReady, markFirstScreen, resetFirstScreenForTests, whenFirstScreen } from './startupHandoff.ts';

const root = new URL('../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');

beforeEach(() => resetFirstScreenForTests());

function fakeTimers() {
  const pending: { cb: () => void; ms: number; live: boolean }[] = [];
  return {
    set: (cb: () => void, ms: number) => {
      const t = { cb, ms, live: true };
      pending.push(t);
      return t;
    },
    clear: (id: unknown) => {
      (id as { live: boolean }).live = false;
    },
    fire: () => {
      for (const t of pending) if (t.live) t.cb();
    },
  };
}

test('the fade waits for the first screen layout, then fires once', () => {
  const timers = fakeTimers();
  let calls = 0;
  whenFirstScreen(() => (calls += 1), HANDOFF_MAX_WAIT_MS, timers.set, timers.clear);
  assert.equal(calls, 0);
  markFirstScreen();
  assert.equal(calls, 1);
  timers.fire(); // the cap was cleared
  markFirstScreen();
  assert.equal(calls, 1);
  assert.ok(isFirstScreenReady());
});

test('the cap releases the fade if no screen ever reports (never an endless intro)', () => {
  const timers = fakeTimers();
  let calls = 0;
  whenFirstScreen(() => (calls += 1), 500, timers.set, timers.clear);
  timers.fire();
  assert.equal(calls, 1);
  markFirstScreen();
  assert.equal(calls, 1);
});

test('already laid out: fires at once; cancel stops a pending wait', () => {
  let calls = 0;
  const timers = fakeTimers();
  const cancel = whenFirstScreen(() => (calls += 1), 500, timers.set, timers.clear);
  cancel();
  markFirstScreen();
  timers.fire();
  assert.equal(calls, 0);
  whenFirstScreen(() => (calls += 1));
  assert.equal(calls, 1);
  assert.ok(HANDOFF_MAX_WAIT_MS <= 1500);
});

test('the intro fades only after the first screen (IntroGlaze waits on whenFirstScreen after onReveal)', () => {
  const intro = read('src/ui/IntroGlaze.tsx');
  const reveal = intro.indexOf('onRevealRef.current?.()');
  const wait = intro.indexOf('whenFirstScreen(', reveal);
  const fade = intro.indexOf('Animated.timing(fade', reveal);
  assert.ok(reveal > 0 && wait > reveal && fade > wait, 'reveal → wait for first screen → fade');
  const tabs = read('app/(tabs)/_layout.tsx');
  assert.match(tabs, /markFirstScreen\(\)/);
  assert.match(tabs, /onLayout=/);
});

test('the splash stays up until the app takes over (preventAutoHideAsync at module load)', () => {
  const layout = read('app/_layout.tsx');
  assert.match(layout, /SplashScreen\.preventAutoHideAsync\(\)/);
  // No blank frame: the app and the intro sit on the same background colour.
  assert.match(layout, /backgroundColor: c\.bg/);
});
