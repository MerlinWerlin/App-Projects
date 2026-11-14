// Design review 1.0.32 (ui-review / ios-review of the Widgets tab): a sample of the live value on number-free
// live art in the widget art menu (src/ui/WidgetArtMenu.tsx). Kept out of WidgetArtMenu because that file is
// guarded against shadows (src/core/artBlend.test.ts); the value here gets the same soft halo as the widget's
// own (LiveArtOverlay.swift valueShadow). Only tokens; no motion.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FOCUS_MINUTES, liveArtKindOf } from '../core/liveArt';
import type { Rect, WidgetOption } from '../core/widgetOptions';
import { useT } from '../i18n';
import { onArtV2, spaceV2 } from '../theme/tokensV2';

/** Black or white, whichever stands out from `hex` (#RRGGBB): the soft halo under a live value. */
function haloFor(hex: string): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  if (!Number.isFinite(n)) return `${onArtV2.black}66`;
  const lightness = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return `${lightness < 0.5 ? onArtV2.ink : onArtV2.black}99`;
}

/**
 * Design review 1.0.32: number-free live pieces (an empty calendar frame, an empty focus ring) looked broken in
 * the menu because the value is drawn by the widget (LiveArtOverlay.swift). Draw today's date, the time or the
 * 25:00 focus start inside the piece's liveFrame, in the same layout as the widget, so the card shows what the
 * widget will show. Battery, countdown and analog clocks show the art alone (no made-up number, no fake hands).
 * Decorative: the card's own label already names the piece.
 */
export function LiveArtSample({ option, art, ink }: { option: WidgetOption; art: Rect; ink: string }) {
  const { formatDate, formatClock } = useT();
  const f = option.liveFrame;
  const kind = option.numberFree === true && f ? liveArtKindOf(option.kind) : null;
  if (!f || !kind) return null;
  const [fx, fy, fw, fh] = f.rect;
  const box = { left: art.x + fx * art.w, top: art.y + fy * art.h, width: fw * art.w, height: fh * art.h };
  const s = Math.min(box.width, box.height);
  if (s < 12) return null;
  const now = new Date();
  const compact = f.valueStyle === 'compact';
  const shadow = { textShadowColor: haloFor(ink), textShadowRadius: 1.5, textShadowOffset: { width: 0, height: 0 } };
  const line = (text: string, size: number, weight: '600' | '700') => (
    <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4} style={[styles.value, shadow, { color: ink, fontSize: size, fontWeight: weight }]}>
      {text}
    </Text>
  );
  let body: ReactNode = null;
  if (kind === 'date') {
    body = compact ? (
      line(formatDate(now, { weekday: 'short', day: 'numeric', month: 'short' }), Math.max(9, s * 0.2), '600')
    ) : (
      <>
        {line(formatDate(now, { weekday: 'short' }).toLocaleUpperCase(), Math.max(8, s * 0.13), '600')}
        {line(formatDate(now, { day: 'numeric' }), Math.max(16, s * 0.42), '700')}
        {line(formatDate(now, { month: 'short' }).toLocaleUpperCase(), Math.max(8, s * 0.13), '600')}
      </>
    );
  } else if (kind === 'focus') {
    body = line(`${FOCUS_MINUTES}:00`, Math.max(10, s * (compact ? 0.2 : 0.26)), '700'); // i18n-ignore (timer digits)
  } else if (kind === 'clock' && f.clockStyle && f.clockStyle !== 'analog') {
    body = line(formatClock(now), Math.max(10, s * 0.26), '700');
  }
  if (!body) return null;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.box, box]}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spaceV2.xxs },
  value: { textAlign: 'center', fontVariant: ['tabular-nums'] },
});
