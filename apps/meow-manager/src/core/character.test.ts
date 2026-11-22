import test from "node:test";
import assert from "node:assert/strict";
import {
  CharacterDirector,
  nextOpening,
  openingPose,
  OPENING_DURATION,
  REST,
  type Pose,
} from "../character/motion.ts";
import { applyPose, createKitty, disposeGraph } from "../character/rig.ts";

function advance(director: CharacterDirector, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) director.tick(1 / 60);
}
function distance(a: Pose, b: Pose) {
  return Math.max(
    ...(Object.keys(REST) as (keyof Pose)[]).map((k) => Math.abs(a[k] - b[k])),
  );
}
test("persisted scene choice never repeats immediately, including bag boundaries", () => {
  let bag: unknown = null;
  let last = "";
  const seen = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const choice = nextOpening(bag, () => (i % 2 ? 0.1 : 0.9));
    assert.notEqual(choice.opening, last);
    last = choice.opening;
    seen.add(last);
    bag = JSON.parse(JSON.stringify(choice.bag));
  }
  assert.equal(seen.size, 2);
});
test("corrupt or unknown entrance state recovers without accepting unimplemented scenes", () => {
  for (const raw of [
    null,
    {},
    { version: 1, remaining: ["bad", "nap", "nap"], last: "chips" },
    { version: 99, remaining: [12] },
  ]) {
    const choice = nextOpening(raw);
    assert.ok(["nap", "chips"].includes(choice.opening));
    assert.equal(
      new Set(choice.bag.remaining).size,
      choice.bag.remaining.length,
    );
  }
});
test("nap and chips have different starts but exactly the same assistant-ready endpoint", () => {
  assert.ok(distance(openingPose("nap", 0), openingPose("chips", 0)) > 0.5);
  assert.deepEqual(openingPose("nap", OPENING_DURATION.nap), REST);
  assert.deepEqual(openingPose("chips", OPENING_DURATION.chips), REST);
});
test("each authored opening is continuous and contains only finite bounded controls", () => {
  for (const opening of ["nap", "chips"] as const) {
    let previous = openingPose(opening, 0);
    for (let t = 1 / 120; t <= OPENING_DURATION[opening]; t += 1 / 120) {
      const pose = openingPose(opening, t);
      for (const value of Object.values(pose))
        assert.ok(Number.isFinite(value) && Math.abs(value) <= 4);
      assert.ok(
        distance(previous, pose) < 0.13,
        `${opening} discontinuity at ${t}`,
      );
      previous = pose;
    }
  }
});
test("both entrances finish automatically in a shared idle without replaying", () => {
  for (const opening of ["nap", "chips"] as const) {
    const d = new CharacterDirector(opening);
    advance(d, 8);
    assert.equal(d.mode, "idle");
    assert.equal(d.beat(), "ready");
    advance(d, 10);
    assert.equal(d.mode, "idle");
  }
});
test("a menu can interrupt either entrance at any point without a first-frame pose jump", () => {
  for (const opening of ["nap", "chips"] as const)
    for (const at of [0, 0.9, 2.7, 4.4, 6]) {
      const d = new CharacterDirector(opening);
      advance(d, at);
      const before = d.pose();
      d.setMode("menu");
      assert.equal(distance(before, d.pose()), 0);
      advance(d, 0.5);
      assert.equal(d.mode, "menu");
      assert.equal(d.beat(), "menu");
      assert.equal(d.pose().lookAtMenu, 1);
    }
});
test("listening interruption drops snack props and settles into an attentive pose", () => {
  const d = new CharacterDirector("chips");
  advance(d, 0.8);
  assert.equal(d.pose().bag, 1);
  d.setMode("listening");
  advance(d, 0.5);
  assert.equal(d.pose().bag, 0);
  assert.equal(d.pose().chip, 0);
  assert.equal(d.beat(), "listening");
  assert.equal(d.pose().jaw, 0);
});
test("backgrounding freezes the current motion and foreground resumes it", () => {
  const d = new CharacterDirector("nap");
  advance(d, 1);
  const before = d.pose();
  d.setActive(false);
  advance(d, 20);
  assert.deepEqual(d.pose(), before);
  d.setActive(true);
  advance(d, 0.5);
  assert.ok(distance(d.pose(), before) > 0.01);
});
test("a long stalled render delta cannot jump over the opening", () => {
  const d = new CharacterDirector("nap");
  d.tick(60);
  assert.ok(d.elapsed <= 0.1);
  assert.equal(d.beat(), "sleep");
});
test("reduced motion skips the opening and stays static", () => {
  const d = new CharacterDirector("nap");
  d.setReducedMotion(true);
  const before = d.pose();
  advance(d, 10);
  assert.deepEqual(d.pose(), before);
  d.setMode("opening", "chips");
  assert.equal(d.mode, "idle");
});
test("a tap wave returns to idle; speaking animates the jaw until stopped", () => {
  const d = new CharacterDirector("nap");
  d.setMode("wave");
  advance(d, 2.4);
  assert.equal(d.mode, "idle");
  d.setMode("speaking");
  advance(d, 0.5);
  const a = d.pose().jaw;
  advance(d, 0.11);
  assert.notEqual(d.pose().jaw, a);
  d.setMode("idle");
  advance(d, 0.5);
  assert.equal(d.pose().jaw, 0);
});
test("the actual rig contains exactly four uniquely attached paws and one articulated tail", () => {
  const rig = createKitty();
  const paws: string[] = [],
    tails: string[] = [];
  rig.root.traverse((node) => {
    if (/^paw_(fore|hind)_(left|right)$/.test(node.name)) {
      paws.push(node.name);
      assert.ok(node.parent);
    }
    if (/^tail_\d+$/.test(node.name)) tails.push(node.name);
  });
  assert.equal(paws.length, 4);
  assert.equal(new Set(paws).size, 4);
  assert.deepEqual(paws.sort(), [...rig.pawNodes].sort());
  assert.equal(tails.length, 11);
  disposeGraph(rig.root);
});
test("all authored frames leave the actual rig matrices finite", () => {
  const rig = createKitty();
  for (const opening of ["nap", "chips"] as const)
    for (let t = 0; t < 7.3; t += 0.2) {
      applyPose(rig, openingPose(opening, t), t);
      rig.root.updateMatrixWorld(true);
      rig.root.traverse((node) =>
        assert.ok(
          node.matrixWorld.elements.every(Number.isFinite),
          `${opening} ${t}: ${node.name}`,
        ),
      );
    }
  disposeGraph(rig.root);
});
