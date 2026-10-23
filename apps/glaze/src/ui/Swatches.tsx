import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useT } from '../i18n';
import { radiusV2, sizeV2, spaceV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { haptic } from './haptics';

export type Swatch = {
  /** Colour shown (any RN colour; hex recommended). */
  hex: string;
  /** Spoken name, e.g. "Plum". */
  name: string;
  /** Optional second colour drawn as a diagonal half (e.g. a gradient preview). */
  hex2?: string;
  /** Optional Feather icon drawn on top (e.g. 'image' for "from wallpaper"). */
  icon?: 'image' | 'droplet' | 'star';
  /** Value passed to onChange; defaults to hex. */
  value?: string;
};

type Props = {
  /** Group name for screen readers, e.g. "Background colour". */
  label: string;
  swatches: readonly Swatch[];
  /** Currently selected value (compared case-insensitively). */
  value: string | null | undefined;
  onChange: (value: string, swatch: Swatch) => void;
  style?: StyleProp<ViewStyle>;
};

function sameColour(a: string | null | undefined, b: string): boolean {
  return typeof a === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Readable mark colour on top of a swatch. */
function markOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})/i.exec(hex.trim());
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#1E1A1D' : '#FFFFFF';
}

/**
 * Wrapping row of round colour swatches, each a 48 pt radio button. Design v2 (T56): the chosen
 * dot gets a 2.5 pt berry tint ring, dots sit on a hairline in the v2 separator colour.
 */
export function Swatches({ label, swatches, value, onChange, style }: Props) {
  const { c } = useColorsV2();
  const { t } = useT();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.wrap, style]}>
      {swatches.map((s) => {
        const v = s.value ?? s.hex;
        const selected = sameColour(value, v);
        const mark = markOn(s.hex);
        const glyph = s.icon ?? (selected ? 'check' : null);
        return (
          <Pressable
            key={`${v}-${s.name}`}
            accessibilityRole="radio"
            accessibilityLabel={t('themeUi.swatch', { label, name: s.name })}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => {
              haptic('select');
              onChange(v, s);
            }}
            style={({ pressed }) => [styles.target, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View
              style={[
                styles.ring,
                { borderColor: selected ? c.tint : 'transparent' },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: s.hex, borderColor: c.separator }]}>
                {s.hex2 ? <View style={[styles.half, { backgroundColor: s.hex2 }]} /> : null}
                {glyph ? <Feather name={glyph} size={16} color={mark} /> : null}
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const DOT = 34;

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.xs },
  target: { width: sizeV2.touch, height: sizeV2.touch, alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: 2.5, borderRadius: radiusV2.pill, padding: 2 },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  half: {
    position: 'absolute',
    width: DOT * 1.5,
    height: DOT,
    top: DOT / 2,
    left: -DOT / 4,
    transform: [{ rotate: '-45deg' }],
  },
});
