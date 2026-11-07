export type Opening = "nap" | "chips";
export type CharacterMode =
  | "opening"
  | "idle"
  | "wave"
  | "listening"
  | "speaking"
  | "menu";
export const OPENINGS: readonly Opening[] = ["nap", "chips"];
export type EntranceBag = {
  version: 1;
  last: Opening | null;
  remaining: Opening[];
};
export function nextOpening(
  raw: unknown,
  random: () => number = Math.random,
): { opening: Opening; bag: EntranceBag } {
  const source = raw as Partial<EntranceBag> | null;
  const last =
    source && OPENINGS.includes(source.last as Opening)
      ? (source.last as Opening)
      : null;
  let remaining =
    source?.version === 1 && Array.isArray(source.remaining)
      ? [
          ...new Set(
            source.remaining.filter((x): x is Opening => OPENINGS.includes(x)),
          ),
        ].filter((x) => x !== last)
      : [];
  if (!remaining.length) {
    remaining = [...OPENINGS];
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    if (remaining[0] === last)
      [remaining[0], remaining[1]] = [remaining[1], remaining[0]];
  }
  const opening = remaining.shift()!;
  return { opening, bag: { version: 1, last: opening, remaining } };
}

export const REST = {
  x: 0,
  y: 0,
  z: 0,
  scale: 1,
  yaw: 0,
  roll: 0,
  lean: 0,
  headPitch: -0.035,
  headYaw: 0,
  headRoll: 0,
  earL: 0,
  earR: 0,
  armLX: -0.16,
  armLZ: -0.1,
  foreLX: -0.22,
  foreLZ: 0.12,
  armRX: -0.16,
  armRZ: 0.1,
  foreRX: -0.22,
  foreRZ: -0.12,
  wristL: 0,
  wristR: 0,
  hipL: 0,
  hipR: 0,
  kneeL: 0,
  kneeR: 0,
  eyes: 1,
  jaw: 0,
  brow: 0,
  tail: 0.12,
  bag: 0,
  chip: 0,
  cushion: 0,
  lookAtMenu: 0,
};
export type Pose = typeof REST;
export type PosePatch = Partial<Pose>;
type Key = { at: number; pose: PosePatch };
export const OPENING_DURATION: Record<Opening, number> = {
  nap: 7.2,
  chips: 6.6,
};
const NAP: Key[] = [
  {
    at: 0,
    pose: {
      y: -0.32,
      x: 0.5,
      z: -0.45,
      scale: 0.81,
      roll: 1.05,
      yaw: -0.18,
      lean: 0.13,
      headRoll: -0.58,
      headPitch: 0.42,
      headYaw: -0.1,
      eyes: 0,
      armLX: -0.9,
      armLZ: 0.65,
      foreLX: -1.5,
      armRX: -0.8,
      armRZ: -0.65,
      foreRX: -1.5,
      hipL: -0.9,
      hipR: -0.9,
      kneeL: 1.15,
      kneeR: 1.15,
      tail: 1,
      cushion: 1,
    },
  },
  { at: 1.15, pose: { earL: -0.25 } },
  { at: 1.7, pose: { eyes: 0.28, headPitch: 0.29, earL: 0.08, earR: -0.1 } },
  {
    at: 2.35,
    pose: {
      eyes: 0.75,
      headPitch: 0.05,
      headYaw: 0.13,
      headRoll: -0.35,
      roll: 0.75,
    },
  },
  {
    at: 3.35,
    pose: {
      y: -0.08,
      x: 0.04,
      z: 0,
      scale: 0.96,
      roll: 0.14,
      yaw: 0,
      lean: -0.14,
      headRoll: 0.05,
      eyes: 0.85,
      armLX: -0.75,
      armLZ: -0.65,
      foreLX: -0.35,
      foreLZ: -0.4,
      armRX: -0.75,
      armRZ: 0.65,
      foreRX: -0.35,
      foreRZ: 0.4,
      hipL: -0.3,
      hipR: -0.3,
      kneeL: 0.3,
      kneeR: 0.3,
      tail: 0.25,
      cushion: 0.5,
    },
  },
  {
    at: 4.2,
    pose: {
      y: 0.035,
      x: 0,
      scale: 1,
      roll: 0,
      lean: -0.1,
      armLZ: -2.25,
      foreLZ: -0.12,
      armLX: -0.08,
      foreLX: -0.2,
      armRZ: 2.25,
      foreRZ: 0.12,
      armRX: -0.08,
      foreRX: -0.2,
      headPitch: -0.2,
      eyes: 0.12,
      jaw: 0.5,
      hipL: 0,
      hipR: 0,
      kneeL: 0,
      kneeR: 0,
      cushion: 0,
    },
  },
  {
    at: 4.9,
    pose: {
      y: 0,
      lean: 0.02,
      armLZ: -0.35,
      foreLZ: 0.1,
      armLX: -0.45,
      foreLX: -0.4,
      armRZ: 0.35,
      foreRZ: -0.1,
      armRX: -0.45,
      foreRX: -0.4,
      headPitch: 0.12,
      eyes: 1,
      jaw: 0,
    },
  },
  {
    at: 5.6,
    pose: {
      armLX: -0.7,
      armLZ: 0.5,
      foreLX: -1.5,
      foreLZ: 0.15,
      wristL: 0.15,
      headPitch: 0.18,
      headYaw: -0.05,
    },
  },
  {
    at: 6.05,
    pose: {
      armLX: REST.armLX,
      armLZ: REST.armLZ,
      foreLX: REST.foreLX,
      foreLZ: REST.foreLZ,
      wristL: 0,
      headPitch: -0.07,
      headYaw: 0,
      armRX: REST.armRX,
      armRZ: REST.armRZ,
      foreRX: REST.foreRX,
      foreRZ: REST.foreRZ,
    },
  },
  { at: 6.55, pose: { headPitch: 0.045, headRoll: -0.035, jaw: 0.14 } },
  { at: 7.2, pose: { ...REST } },
];
const CHIPS: Key[] = [
  {
    at: 0,
    pose: {
      headPitch: 0.11,
      headYaw: -0.12,
      armLX: -0.45,
      armLZ: 0.5,
      foreLX: -1.2,
      foreLZ: 0.35,
      armRX: -1.15,
      armRZ: -0.3,
      foreRX: -1.55,
      foreRZ: -0.4,
      wristR: -0.2,
      bag: 1,
      chip: 1,
      eyes: 0.8,
      jaw: 0.15,
      tail: 0.4,
    },
  },
  { at: 0.8, pose: { armRX: -1.32, foreRX: -1.5, headPitch: 0.06 } },
  {
    at: 1.55,
    pose: {
      headYaw: 0,
      headPitch: -0.08,
      eyes: 1.12,
      brow: 0.85,
      jaw: 0.27,
      armRX: -1.24,
    },
  },
  {
    at: 2.15,
    pose: {
      eyes: 1,
      brow: 0.15,
      jaw: 0,
      headPitch: 0.1,
      armRX: -0.45,
      foreRX: -1.35,
      foreRZ: -0.55,
      chip: 0,
    },
  },
  {
    at: 3.15,
    pose: {
      headYaw: -0.2,
      headPitch: 0.12,
      armLX: -0.2,
      armLZ: -1.12,
      foreLX: -0.3,
      foreLZ: -0.35,
      wristL: -0.45,
      armRX: -0.15,
      armRZ: 0.12,
      foreRX: -0.3,
      foreRZ: -0.12,
      bag: 0,
    },
  },
  {
    at: 3.8,
    pose: {
      headYaw: 0,
      headPitch: 0.22,
      armRX: -0.9,
      armRZ: -0.15,
      foreRX: -1.3,
      foreRZ: -0.25,
      armLX: -0.2,
      armLZ: -0.1,
      foreLX: -0.22,
      foreLZ: 0.12,
    },
  },
  { at: 4.15, pose: { armRX: -0.65, foreRX: -0.55, headPitch: 0.17 } },
  { at: 4.45, pose: { armRX: -0.9, foreRX: -1.3, headPitch: 0.18 } },
  { at: 4.85, pose: { armRX: -0.55, foreRX: -0.55, wristL: 0, tail: 0.12 } },
  { at: 5.35, pose: { armRX: -0.8, foreRX: -1.6, headPitch: 0.18 } },
  { at: 5.95, pose: { ...REST, headPitch: -0.05, headRoll: -0.045 } },
  { at: 6.6, pose: { ...REST } },
];

const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
export function blend(a: Pose, b: Pose, weight: number): Pose {
  const result = { ...REST };
  const w = smooth(weight);
  for (const key of Object.keys(REST) as (keyof Pose)[])
    result[key] = a[key] + (b[key] - a[key]) * w;
  return result;
}
function timeline(keys: Key[], time: number): Pose {
  let previous = { ...REST, ...keys[0].pose };
  if (time <= keys[0].at) return previous;
  for (let i = 1; i < keys.length; i++) {
    const target = { ...previous, ...keys[i].pose };
    if (time <= keys[i].at)
      return blend(
        previous,
        target,
        (time - keys[i - 1].at) / (keys[i].at - keys[i - 1].at),
      );
    previous = target;
  }
  return previous;
}
export function openingPose(opening: Opening, time: number): Pose {
  const pose = timeline(opening === "nap" ? NAP : CHIPS, time);
  if (opening === "nap" && time < 1.7) {
    pose.scale += Math.sin(time * 2.5) * 0.008;
    pose.headPitch += Math.sin(time * 2.5) * 0.008;
  }
  if (opening === "chips" && time < 1.5) {
    pose.jaw = 0.08 + (Math.sin(time * 17) + 1) * 0.12;
    pose.foreRX += Math.sin(time * 7) * 0.05;
  }
  return pose;
}
export function actionPose(
  mode: Exclude<CharacterMode, "opening">,
  time: number,
): Pose {
  const pose = { ...REST };
  const blinkCycle = time % 4.6;
  pose.eyes =
    blinkCycle > 4.22
      ? 1 - Math.sin(((blinkCycle - 4.22) / 0.38) * Math.PI) * 0.98
      : 1;
  pose.lean = Math.sin(time * 1.65) * 0.007;
  pose.tail += Math.sin(time * 1.1) * 0.045;
  pose.headYaw = Math.sin(time * 0.55) * 0.025;
  if (mode === "wave") {
    const weight = smooth(time / 0.36) * (1 - smooth((time - 1.3) / 0.45));
    pose.armLZ = REST.armLZ + (-2.05 - REST.armLZ) * weight;
    pose.foreLZ = REST.foreLZ + (-0.48 - REST.foreLZ) * weight;
    pose.armLX = -0.1;
    pose.wristL = Math.sin(time * 16) * 0.28 * weight;
    pose.headRoll = -0.08 * weight;
    pose.jaw = 0.2 * weight;
  } else if (mode === "listening") {
    pose.headPitch = -0.065 + Math.sin(time * 2.8) * 0.025;
    pose.headRoll = -0.1;
    pose.headYaw = 0.04;
    pose.earL = -0.08;
    pose.earR = 0.08;
    pose.brow = 0.2;
    pose.lean = 0.035;
  } else if (mode === "speaking") {
    pose.jaw =
      0.1 + Math.abs(Math.sin(time * 10.8) * Math.sin(time * 3.6)) * 0.62;
    pose.headPitch += Math.sin(time * 2.6) * 0.045;
    pose.headRoll = Math.sin(time * 1.8) * 0.035;
    pose.armRX = -0.25 + Math.sin(time * 2) * 0.08;
    pose.foreRX = -0.5;
    pose.armRZ = 0.2;
    pose.foreRZ = -0.15;
    pose.brow = 0.1 + Math.sin(time * 3) * 0.08;
  } else if (mode === "menu") {
    pose.headYaw = -0.18;
    pose.headRoll = 0.05;
    pose.lookAtMenu = 1;
  }
  return pose;
}
export type ActingBeat =
  | "sleep"
  | "wake"
  | "stretch"
  | "nibble"
  | "caught"
  | "tidy"
  | "ready"
  | "wave"
  | "listening"
  | "speaking"
  | "menu";
export class CharacterDirector {
  mode: CharacterMode = "opening";
  opening: Opening;
  elapsed = 0;
  private active = true;
  private reduceMotion = false;
  private from: Pose | null = null;
  constructor(opening: Opening) {
    this.opening = opening;
  }
  restartOpening(opening: Opening) {
    this.setMode("opening", opening);
    this.from = null;
  }
  setActive(active: boolean) {
    this.active = active;
  }
  setReducedMotion(reduced: boolean) {
    this.reduceMotion = reduced;
    if (reduced) {
      this.mode = "idle";
      this.elapsed = 0;
      this.from = null;
    }
  }
  setMode(mode: CharacterMode, opening?: Opening) {
    this.from = this.pose();
    this.mode = mode;
    this.elapsed = 0;
    if (opening) this.opening = opening;
    if (this.reduceMotion && mode === "opening") {
      this.mode = "idle";
      this.from = null;
    }
  }
  tick(seconds: number) {
    if (!this.active || !Number.isFinite(seconds) || seconds <= 0) return;
    this.elapsed += Math.min(seconds, 0.1);
    if (
      this.mode === "opening" &&
      this.elapsed >= OPENING_DURATION[this.opening]
    ) {
      this.mode = "idle";
      this.elapsed = 0;
      this.from = null;
    }
    if (this.mode === "wave" && this.elapsed >= 1.8) this.setMode("idle");
  }
  pose(): Pose {
    let target =
      this.mode === "opening"
        ? openingPose(this.opening, this.elapsed)
        : actionPose(this.mode, this.reduceMotion ? 0 : this.elapsed);
    if (this.from && this.elapsed < 0.42)
      target = blend(this.from, target, this.elapsed / 0.42);
    return target;
  }
  beat(): ActingBeat {
    if (this.mode !== "opening")
      return this.mode === "idle" ? "ready" : this.mode;
    if (this.opening === "nap")
      return this.elapsed < 1.6
        ? "sleep"
        : this.elapsed < 3.5
          ? "wake"
          : this.elapsed < 4.9
            ? "stretch"
            : this.elapsed < 6
              ? "tidy"
              : "ready";
    return this.elapsed < 1.5
      ? "nibble"
      : this.elapsed < 2.2
        ? "caught"
        : this.elapsed < 5.9
          ? "tidy"
          : "ready";
  }
}
