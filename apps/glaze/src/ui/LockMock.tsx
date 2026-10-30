import { Feather } from '@expo/vector-icons';
import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LOCK_SAFE_AREAS } from '../core/loop';
import { artFontsV2 as fonts } from '../theme/tokensV2';
import { useT } from '../i18n';
import { noMirror, noMirrorText, textStyleFor } from './i18nLayout';

type Props = {
  width: number;
  height: number;
  /** Draw dashed outlines around the areas the system covers (date, clock, controls). */
  showGuides?: boolean;
};

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/**
 * Lock Screen overlay drawn on top of a preview frame (`width` x `height` points):
 * date, clock and the two bottom controls, so people keep faces and text clear of them.
 * Purely decorative; it ignores touches and is hidden from screen readers.
 */
// T162: memoised, so a parent re-render (a list scroll, a store change) skips it.
export const LockMock = memo(function LockMock({ width, height, showGuides = true }: Props) {
  const now = useNow();
  const { formatClock, formatDate, script } = useT();
  const { date, clock, controls } = LOCK_SAFE_AREAS;
  // The date reads in the phone's language (as iOS shows it); the clock stays Latin digits, LTR.
  const dateText = formatDate(now, { weekday: 'long', day: 'numeric', month: 'long' });
  const clockSize = height * clock.height * 0.85;
  const ctrl = height * controls.height;
  const guide = showGuides ? styles.guide : null;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, noMirror, { width, height }]}
    >
      <View style={[styles.band, guide, { top: height * date.top, height: height * date.height }]}>
        <Text style={[styles.text, { fontFamily: fonts.bodyMedium, fontSize: height * date.height * 0.6 }, textStyleFor(script)]} numberOfLines={1}>
          {dateText}
        </Text>
      </View>
      <View style={[styles.band, guide, { top: height * clock.top, height: height * clock.height }]}>
        <Text
          style={[styles.text, noMirrorText, { fontFamily: fonts.display, fontSize: clockSize, lineHeight: clockSize * 1.1 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatClock(now)}
        </Text>
      </View>
      <View
        style={[
          styles.controls,
          guide,
          { bottom: height * controls.bottom, height: ctrl, paddingHorizontal: width * 0.1 },
        ]}
      >
        {(['zap', 'camera'] as const).map((name) => (
          <View key={name} style={[styles.ctrl, { width: ctrl, height: ctrl, borderRadius: ctrl / 2 }]}>
            <Feather name={name} size={ctrl * 0.42} color="#FFFFFF" />
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  band: { position: 'absolute', left: '8%', right: '8%', alignItems: 'center', justifyContent: 'center' }, // rtl-ok (mock never mirrors)
  guide: { borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.55)', borderRadius: 6 },
  text: {
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  controls: {
    position: 'absolute',
    left: '4%', // rtl-ok
    right: '4%', // rtl-ok
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ctrl: { backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
});
