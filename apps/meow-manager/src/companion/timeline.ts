export type Frame = 0 | 1 | 2 | 3 | 4 | 5;
export type Opening2D = "doze" | "watching";
export type Mode2D =
  | "opening"
  | "idle"
  | "greeting"
  | "listening"
  | "speaking"
  | "menu";
export type Beat2D =
  | "sleep"
  | "notice"
  | "ready"
  | "hello"
  | "listening"
  | "speaking"
  | "menu";
export type Weights = [number, number, number, number, number, number];
type Key = { at: number; frame: Frame; fade?: number };
export const DURATION_2D = { doze: 4.2, watching: 3.5 };
const DOZE: Key[] = [
  { at: 0, frame: 2 },
  { at: 1.1, frame: 1, fade: 0.18 },
  { at: 1.6, frame: 0, fade: 0.22 },
  { at: 2.3, frame: 3, fade: 0.1 },
  { at: 2.5, frame: 0, fade: 0.12 },
  { at: 3.2, frame: 1, fade: 0.06 },
  { at: 3.28, frame: 2, fade: 0.05 },
  { at: 3.4, frame: 1, fade: 0.06 },
  { at: 3.48, frame: 0, fade: 0.08 },
];
const WATCHING: Key[] = [
  { at: 0, frame: 4 },
  { at: 0.8, frame: 0, fade: 0.24 },
  { at: 1.6, frame: 3, fade: 0.12 },
  { at: 1.84, frame: 0, fade: 0.12 },
  { at: 2.5, frame: 1, fade: 0.08 },
  { at: 2.6, frame: 2, fade: 0.07 },
  { at: 2.82, frame: 1, fade: 0.09 },
  { at: 2.94, frame: 0, fade: 0.14 },
];
const IDLE: Key[] = [
  { at: 0, frame: 0 },
  { at: 4.3, frame: 1, fade: 0.05 },
  { at: 4.36, frame: 2, fade: 0.05 },
  { at: 4.48, frame: 1, fade: 0.05 },
  { at: 4.54, frame: 0, fade: 0.07 },
  { at: 9, frame: 3, fade: 0.1 },
  { at: 9.2, frame: 0, fade: 0.14 },
];
const HELLO: Key[] = [
  { at: 0, frame: 0 },
  { at: 0.2, frame: 1, fade: 0.14 },
  { at: 0.4, frame: 2, fade: 0.14 },
  { at: 0.75, frame: 1, fade: 0.18 },
  { at: 0.98, frame: 0, fade: 0.22 },
  { at: 1.8, frame: 3, fade: 0.1 },
  { at: 2.02, frame: 0, fade: 0.14 },
];
// The proposed tilted drawing (frame5) changes the ear silhouette too far for
// a clean dissolve. Hold an attentive face until proper in-betweens exist.
const ATTEND: Key[] = [{ at: 0, frame: 0 }];
const MENU: Key[] = [
  { at: 0, frame: 0 },
  { at: 0.12, frame: 4, fade: 0.2 },
];
export function single(frame: Frame): Weights {
  const weights: Weights = [0, 0, 0, 0, 0, 0];
  weights[frame] = 1;
  return weights;
}
function smooth(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
function blend(a: Weights, b: Weights, t: number): Weights {
  return a.map((v, i) => v + (b[i] - v) * t) as Weights;
}
function script(keys: Key[], elapsed: number): Weights {
  let previous = keys[0].frame;
  for (let i = 1; i < keys.length; i++) {
    const key = keys[i];
    if (elapsed < key.at) return single(previous);
    if (elapsed < key.at + (key.fade ?? 0))
      return blend(
        single(previous),
        single(key.frame),
        smooth((elapsed - key.at) / (key.fade ?? 1)),
      );
    previous = key.frame;
  }
  return single(previous);
}
// Alpha-over compositing equivalent to normalized frame weights. The first
// visible drawing is opaque; fading all layers independently would show holes.
export function layerOpacities(weights: Weights): Weights {
  let prefix = 0;
  return weights.map((weight) => {
    prefix += weight;
    return prefix > 0 ? weight / prefix : 0;
  }) as Weights;
}
export function chooseOpening2D(
  last: unknown,
  random = Math.random,
): Opening2D {
  return last === "doze"
    ? "watching"
    : last === "watching"
      ? "doze"
      : random() < 0.5
        ? "doze"
        : "watching";
}
export class FrameDirector {
  mode: Mode2D = "opening";
  opening: Opening2D;
  elapsed = 0;
  active = true;
  reduced = false;
  private origin: Weights | null = null;
  constructor(opening: Opening2D) {
    this.opening = opening;
  }
  perform(mode: Mode2D, opening?: Opening2D) {
    this.origin = this.weights();
    this.mode = mode;
    this.elapsed = 0;
    if (opening) this.opening = opening;
  }
  setReduced(reduced: boolean) {
    this.reduced = reduced;
    if (reduced) {
      this.mode = "idle";
      this.elapsed = 0;
      this.origin = null;
    }
  }
  tick(delta: number) {
    if (!this.active || this.reduced || !Number.isFinite(delta) || delta < 0)
      return;
    this.elapsed += Math.min(delta, 0.1);
    if (
      (this.mode === "opening" && this.elapsed >= DURATION_2D[this.opening]) ||
      (this.mode === "greeting" && this.elapsed >= 2.8)
    ) {
      this.mode = "idle";
      this.elapsed = 0;
      this.origin = null;
    }
  }
  weights(): Weights {
    if (this.reduced) return single(0);
    const keys =
      this.mode === "opening"
        ? this.opening === "doze"
          ? DOZE
          : WATCHING
        : this.mode === "idle"
          ? IDLE
          : this.mode === "greeting"
            ? HELLO
            : this.mode === "menu"
              ? MENU
              : ATTEND;
    const target = script(
      keys,
      this.mode === "idle" ? this.elapsed % 12 : this.elapsed,
    );
    return this.origin && this.elapsed < 0.22
      ? blend(this.origin, target, smooth(this.elapsed / 0.22))
      : target;
  }
  beat(): Beat2D {
    if (this.mode === "opening")
      return this.opening === "doze" && this.elapsed < 1.4 ? "sleep" : "notice";
    return this.mode === "idle"
      ? "ready"
      : this.mode === "greeting"
        ? "hello"
        : this.mode;
  }
}
