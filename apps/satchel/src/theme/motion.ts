// The one motion file (starter standard): three durations and one gentle spring. Respect Reduce Motion.
export const duration = { fast: 120, base: 200, slow: 320 } as const;
export const spring = { damping: 18, stiffness: 180, mass: 1 } as const;
export const pressScale = 0.97;
/** Duration to use given the Reduce Motion setting. */
export const dur = (ms: number, reduceMotion: boolean) => (reduceMotion ? 0 : ms);
