import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseOpening2D,
  FrameDirector,
  layerOpacities,
  single,
  type Mode2D,
  type Weights,
} from "../companion/timeline.ts";
function advance(d: FrameDirector, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) d.tick(1 / 60);
}
function near(a: Weights, b: Weights) {
  return Math.max(...a.map((value, i) => Math.abs(value - b[i])));
}
test("2D entrances avoid consecutive repeats and recover from old/corrupt values", () => {
  let last: unknown = null;
  for (let i = 0; i < 50; i++) {
    const next = chooseOpening2D(last, () => 0.1);
    assert.notEqual(next, last);
    last = next;
  }
  for (const invalid of [null, undefined, "chips", {}, 12])
    assert.ok(["doze", "watching"].includes(chooseOpening2D(invalid)));
});
test("2D openings begin differently and finish at the same ready drawing", () => {
  const a = new FrameDirector("doze"),
    b = new FrameDirector("watching");
  assert.ok(near(a.weights(), b.weights()) > 0.9);
  advance(a, 5);
  advance(b, 5);
  assert.equal(a.mode, "idle");
  assert.equal(b.mode, "idle");
  assert.deepEqual(a.weights(), single(0));
  assert.deepEqual(b.weights(), single(0));
});
test("an entrance does not start again after idle cycles", () => {
  const d = new FrameDirector("doze");
  advance(d, 60);
  assert.equal(d.mode, "idle");
  assert.equal(d.beat(), "ready");
});
test("facial mixes stay normalized and finite across openings and interactions", () => {
  for (const mode of [
    "opening",
    "idle",
    "greeting",
    "listening",
    "speaking",
    "menu",
  ] as Mode2D[]) {
    const d = new FrameDirector("doze");
    d.perform(mode);
    for (let i = 0; i < 1800; i++) {
      d.tick(1 / 120);
      const w = d.weights();
      assert.ok(w.every((x) => Number.isFinite(x) && x >= 0 && x <= 1));
      assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-10);
    }
  }
});
test("interrupting a partial blink preserves the current drawing then settles attentive", () => {
  const d = new FrameDirector("doze");
  advance(d, 1.2);
  const before = d.weights();
  d.perform("listening");
  assert.ok(near(d.weights(), before) < 1e-10);
  advance(d, 1);
  assert.deepEqual(d.weights(), single(0));
  assert.equal(d.beat(), "listening");
});
test("background pause freezes facial state and large frame gaps cannot jump the entrance", () => {
  const d = new FrameDirector("doze");
  advance(d, 0.7);
  d.active = false;
  const before = d.weights(),
    time = d.elapsed;
  advance(d, 10);
  assert.equal(d.elapsed, time);
  assert.deepEqual(d.weights(), before);
  d.active = true;
  d.tick(200);
  assert.ok(d.elapsed - time <= 0.100001);
  const elapsed = d.elapsed;
  d.tick(NaN);
  d.tick(-1);
  assert.equal(d.elapsed, elapsed);
});
test("reduced motion skips the entrance and retains a static face through interactions", () => {
  const d = new FrameDirector("doze");
  d.setReduced(true);
  assert.equal(d.mode, "idle");
  assert.deepEqual(d.weights(), single(0));
  d.perform("listening");
  advance(d, 10);
  assert.deepEqual(d.weights(), single(0));
  assert.equal(d.beat(), "listening");
});
test("layer opacity reconstructs the intended facial blend without fading the whole cat away", () => {
  const wanted: Weights = [0.1, 0.2, 0.3, 0.4, 0, 0],
    alpha = layerOpacities(wanted);
  let transmission = 1;
  const actual: Weights = [0, 0, 0, 0, 0, 0];
  for (let i = 5; i >= 0; i--) {
    actual[i] = alpha[i] * transmission;
    transmission *= 1 - alpha[i];
  }
  assert.ok(near(actual, wanted) < 1e-10);
  assert.equal(transmission, 0);
});
