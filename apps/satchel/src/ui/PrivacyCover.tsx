// Privacy cover (T57). While a private screen (vault, document, document editor) is up, an opaque branded cover
// (theme paper + the app mark, light or dark) goes over the app as soon as AppState turns 'inactive' or 'background',
// so the iOS app-switcher snapshot never shows a passport or document image. Back to 'active' it fades away with a
// short timed fade (no spring; instant with Reduce Motion). The policy is src/core/privacy.ts.
// While guarded the view stays mounted at opacity 0, so showing it is a native setValue, not a React render. Hidden
// from VoiceOver and touch-transparent whenever it is not showing.
// Mount it as the last child over the content: once in the root layout (covers the stack and its headers) and inside
// any modal screen (native modals sit above the root view).
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, StyleSheet } from 'react-native';
import { coverAction, coversApp } from '../core/privacy.ts';
import { useApp } from '../state/app.tsx';
import { duration, fadeOut } from '../theme/motion.ts';
import { brand } from '../theme/tokens.ts';
import { BrandGlyph } from './StartupMark.tsx';

/** Glyph size on the cover (pt): smaller than the splash, so it reads as a cover and not a relaunch. */
const COVER_GLYPH = 120;

function currentState(): string | undefined {
  try {
    return AppState.currentState;
  } catch {
    return undefined;
  }
}

export function PrivacyCover({ guarded = true }: { guarded?: boolean }) {
  const { t, theme, reduceMotion } = useApp();
  const initial = guarded && coversApp(currentState());
  const [shown, setShown] = useState(initial);
  const [fading, setFading] = useState(false);
  const opacity = useRef(new Animated.Value(initial ? 1 : 0)).current;
  const shownRef = useRef(initial);
  const guardedRef = useRef(guarded);
  const reduceRef = useRef(reduceMotion);
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  guardedRef.current = guarded;
  reduceRef.current = reduceMotion;

  const apply = useRef((state: string | undefined) => {
    const action = coverAction(shownRef.current, state, guardedRef.current);
    if (action === 'show') {
      anim.current?.stop();
      opacity.setValue(1);
      shownRef.current = true;
      setFading(false);
      setShown(true);
    } else if (action === 'fade') {
      shownRef.current = false;
      setShown(false);
      setFading(true);
      const a = fadeOut(opacity, reduceRef.current, duration.base);
      anim.current = a;
      a.start(({ finished }) => {
        if (finished && !shownRef.current) setFading(false);
      });
    }
  }).current;

  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    try {
      sub = AppState.addEventListener('change', (s) => apply(s));
    } catch {
      // no AppState (unusual hosts): the vault still locks; nothing to cover
    }
    return () => {
      sub?.remove();
      anim.current?.stop();
    };
  }, [apply]);

  // A private screen opening or closing while the app is already in the background is handled here.
  useEffect(() => apply(currentState()), [guarded, apply]);

  if (!guarded && !shown && !fading) return null;
  const palette = theme.dark ? brand.dark : brand.light;
  return (
    <Animated.View
      pointerEvents={shown ? 'auto' : 'none'}
      accessible={shown}
      accessibilityLabel={shown ? t('privacy.coverA11y') : undefined}
      accessibilityElementsHidden={!shown}
      importantForAccessibility={shown ? 'yes' : 'no-hide-descendants'}
      style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', opacity }]}
    >
      <BrandGlyph size={COVER_GLYPH} palette={palette} />
    </Animated.View>
  );
}
