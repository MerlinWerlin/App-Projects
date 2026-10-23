import {
  collapseProgress,
  collapseRanges,
  collapseThreshold,
  evaluate,
  FADE,
  isCollapsed,
  MAX_GROW,
  PULL,
  startOrigin,
} from './headerCollapse';

describe('large title collapse', () => {
  it('threshold is the measured title height, at least 1', () => {
    expect(collapseThreshold(52.4)).toBe(52);
    expect(collapseThreshold(0)).toBe(1);
    expect(collapseThreshold(Number.NaN)).toBe(1);
    expect(collapseThreshold(140)).toBe(140); // wrapped title at a large Dynamic Type size
  });

  it('inline title fades in over the last FADE pt before the title is fully hidden', () => {
    const r = collapseRanges(52, false);
    expect(evaluate(r.inlineOpacity, 0)).toBe(0);
    expect(evaluate(r.inlineOpacity, 52 - FADE)).toBe(0);
    expect(evaluate(r.inlineOpacity, 52 - FADE / 2)).toBeCloseTo(0.5);
    expect(evaluate(r.inlineOpacity, 52)).toBe(1);
    expect(evaluate(r.inlineOpacity, 500)).toBe(1);
    expect(evaluate(r.barOpacity, 52)).toBe(1);
  });

  it('ranges are strictly increasing (Animated.interpolate requirement)', () => {
    for (const t of [1, 5, 52, 200]) {
      for (const reduce of [false, true]) {
        const r = collapseRanges(t, reduce);
        for (const range of [r.inlineOpacity, r.barOpacity, r.largeScale]) {
          for (let k = 1; k < range.inputRange.length; k++) expect(range.inputRange[k]!).toBeGreaterThan(range.inputRange[k - 1]!);
          expect(range.outputRange.length).toBe(range.inputRange.length);
        }
      }
    }
  });

  it('overscroll grows the large title up to MAX_GROW; never shrinks it on scroll', () => {
    const r = collapseRanges(52, false);
    expect(evaluate(r.largeScale, 0)).toBe(1);
    expect(evaluate(r.largeScale, 300)).toBe(1);
    expect(evaluate(r.largeScale, -PULL / 2)).toBeCloseTo(1 + (MAX_GROW - 1) / 2);
    expect(evaluate(r.largeScale, -1000)).toBe(MAX_GROW);
  });

  it('Reduce Motion: step swap, no growth', () => {
    const r = collapseRanges(52, true);
    expect(evaluate(r.inlineOpacity, 51)).toBe(0);
    expect(evaluate(r.inlineOpacity, 52)).toBe(1);
    expect(evaluate(r.largeScale, -1000)).toBe(1);
    expect(collapseProgress(51, 52, true)).toBe(0);
    expect(collapseProgress(52, 52, true)).toBe(1);
  });

  it('progress and collapsed state', () => {
    expect(collapseProgress(-40, 52)).toBe(0);
    expect(collapseProgress(52 - FADE / 2, 52)).toBeCloseTo(0.5);
    expect(collapseProgress(80, 52)).toBe(1);
    expect(collapseProgress(Number.NaN, 52)).toBe(0);
    expect(isCollapsed(51, 52)).toBe(false);
    expect(isCollapsed(52, 52)).toBe(true);
  });

  it('short titles shrink the fade band instead of starting below zero', () => {
    const r = collapseRanges(5, false);
    expect(r.inlineOpacity.inputRange[0]).toBe(0);
  });

  it('the large title grows from its start edge in both directions', () => {
    expect(startOrigin(false)).toBe('left top');
    expect(startOrigin(true)).toBe('right top');
  });
});
