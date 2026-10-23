/**
 * Layout direction decisions (owner-1016 R3). Pure TS so it is tested in Node; the native side
 * (I18nManager, reload) lives in src/native/rtl.ts.
 *
 * React Native fixes the layout direction when the JS bundle starts: I18nManager.forceRTL only takes
 * effect after a reload. So switching between Arabic (right-to-left) and any other language needs a
 * restart, while switching between two left-to-right languages never does.
 */
import { isRtl, type AnyLocale } from './locales';

/** True when the running layout direction (currentIsRtl) does not match what `locale` wants. */
export function needsDirectionChange(locale: AnyLocale, currentIsRtl: boolean): boolean {
  return isRtl(locale) !== currentIsRtl;
}

export interface DirectionPlan {
  /** Value to hand to I18nManager.forceRTL. */
  forceRtl: boolean;
  /** True when the app must reload for the new direction to apply. */
  reload: boolean;
}

/**
 * What to do when the language changes from `prev` to `next`. The running layout (currentIsRtl) is
 * the source of truth, not `prev`: if a previous switch was postponed ("Later"), the layout may
 * disagree with `prev`, so a reload can be needed even when prev and next share a direction (and
 * none is needed when the layout already matches next).
 */
export function directionPlan(prev: AnyLocale, next: AnyLocale, currentIsRtl: boolean): DirectionPlan {
  void prev; // kept for callers and logs; the decision depends only on next vs the running layout
  return { forceRtl: isRtl(next), reload: needsDirectionChange(next, currentIsRtl) };
}
