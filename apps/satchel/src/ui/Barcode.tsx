// T87: barcodes drawn offline with react-native-svg from the pure encoders in src/core (code128.ts, qr.ts).
// Always black bars on a white panel with its quiet zone (barcodePanel token), in light and dark mode, so scanners
// read it. Module sizes are whole points so bar edges stay crisp.
import { memo, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { barRuns, encodeCode128 } from '../core/code128.ts';
import type { BarcodeType } from '../core/loyalty.ts';
import { encodeQr, QR_QUIET } from '../core/qr.ts';
import { barcodePanel, radius, space } from '../theme/tokens.ts';

/** True when `value` can be drawn as `type` (so a screen can fall back to the number). */
export function canDraw(type: BarcodeType, value: string): boolean {
  if (type === 'code128') return encodeCode128(value) != null;
  if (type === 'qr') return encodeQr(value) != null;
  return false;
}

/**
 * The barcode panel for `value`, fitted inside `maxWidth` points. Renders nothing when the value can't be drawn.
 * `label` is what a screen reader hears (the code itself is an image).
 */
export const BarcodeView = memo(function BarcodeView({ type, value, maxWidth, label }: { type: BarcodeType; value: string; maxWidth: number; label: string }) {
  const shape = useMemo(() => {
    if (type === 'code128') {
      const c = encodeCode128(value);
      if (!c) return null;
      const n = c.modules.length;
      // Whole-point modules when they fit; a very long number is squeezed into the width instead.
      const unit = n <= maxWidth ? Math.floor(maxWidth / n) : maxWidth / n;
      const d = barRuns(c.modules)
        .map(([x, w]) => `M${x} 0h${w}v1h-${w}z`)
        .join('');
      return { d, w: n * unit, h: Math.max(72, Math.min(140, Math.round(n * unit * 0.32))), viewBox: `0 0 ${n} 1` };
    }
    if (type === 'qr') {
      const q = encodeQr(value);
      if (!q) return null;
      const n = q.size + QR_QUIET * 2;
      const unit = Math.max(2, Math.floor(Math.min(maxWidth, 320) / n));
      let d = '';
      q.modules.forEach((row, y) => {
        let x = 0;
        while (x < q.size) {
          if (!row[x]) {
            x++;
            continue;
          }
          let e = x;
          while (e < q.size && row[e]) e++;
          d += `M${x + QR_QUIET} ${y + QR_QUIET}h${e - x}v1h-${e - x}z`;
          x = e;
        }
      });
      return { d, w: n * unit, h: n * unit, viewBox: `0 0 ${n} ${n}` };
    }
    return null;
  }, [type, value, maxWidth]);
  if (!shape) return null;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{ alignSelf: 'center', backgroundColor: barcodePanel.bg, borderRadius: radius.m, padding: space.s }}
    >
      <Svg width={shape.w} height={shape.h} viewBox={shape.viewBox} preserveAspectRatio="none">
        <Path d={shape.d} fill={barcodePanel.ink} />
      </Svg>
    </View>
  );
});
