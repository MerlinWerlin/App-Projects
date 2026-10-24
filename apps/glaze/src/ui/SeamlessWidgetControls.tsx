// T131 Seamless widget controls (Expo Go safe): widget size, grid slot, and a nudge pad that moves
// the crop by 1 pt or 5 pt per press (±40 pt, src/core/seamlessWidget.ts stepNudge) plus reset.
// Every text comes in through `strings` (the caller passes t() results; docs/I18N.md), so this
// file holds no copy. Arrow buttons are ≥ 48 pt with their own accessibility labels.
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  SEAMLESS_SIZES,
  clampNudge,
  normaliseSlot,
  slotsFor,
  stepNudge,
  type Nudge,
  type SeamlessSize,
  type SeamlessSlot,
} from '../core/seamlessWidget';
import { continuous, radiusV2, sizeV2, spaceV2, tabularV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import type { FeatherName } from './featherName';
import { noMirror } from './i18nLayout';
import { PillButton } from './PillButton';
import { PressableScale } from './PressableScale';
import { Segmented } from './Segmented';

export type NudgeDirection = 'up' | 'down' | 'left' | 'right';

/** All user-facing text, already translated by the caller. */
export type SeamlessControlsStrings = {
  sizeGroup: string;
  sizes: Record<SeamlessSize, string>;
  slotGroup: string;
  slots: Record<SeamlessSlot, string>;
  /** Group name of the step picker, e.g. "Nudge step". */
  stepGroup: string;
  /** Labels of the two steps, e.g. "1 pt" and "5 pt". */
  step1: string;
  step5: string;
  /** Accessibility label of an arrow, e.g. (dir, 5) → "Move up 5 points". */
  nudgeA11y: (dir: NudgeDirection, step: number) => string;
  reset: string;
  /** Visible readout of the current nudge, e.g. "Moved 3 pt right, 1 pt up". */
  readout: (nudge: Nudge) => string;
};

export type SeamlessWidgetControlsProps = {
  size: SeamlessSize;
  slot: SeamlessSlot;
  nudge: Nudge;
  onSizeChange: (size: SeamlessSize) => void;
  onSlotChange: (slot: SeamlessSlot) => void;
  onNudgeChange: (nudge: Nudge) => void;
  strings: SeamlessControlsStrings;
  style?: StyleProp<ViewStyle>;
};

const ARROWS: readonly { dir: NudgeDirection; icon: FeatherName }[] = [
  { dir: 'left', icon: 'arrow-left' },
  { dir: 'up', icon: 'arrow-up' },
  { dir: 'down', icon: 'arrow-down' },
  { dir: 'right', icon: 'arrow-right' },
];

export function SeamlessWidgetControls({
  size,
  slot,
  nudge,
  onSizeChange,
  onSlotChange,
  onNudgeChange,
  strings,
  style,
}: SeamlessWidgetControlsProps) {
  const { c } = useColorsV2();
  const [step, setStep] = useState<'1' | '5'>('1');
  const stepPt = step === '5' ? 5 : 1;
  const current = clampNudge(nudge);
  const slots = slotsFor(size);
  const shownSlot = normaliseSlot(size, slot);
  const moved = current.dx !== 0 || current.dy !== 0;

  return (
    <View style={[styles.wrap, style]}>
      <Segmented
        label={strings.sizeGroup}
        options={SEAMLESS_SIZES.map((s) => ({ value: s, label: strings.sizes[s] }))}
        value={size}
        onChange={(s) => {
          onSizeChange(s);
          const next = normaliseSlot(s, slot);
          if (next !== slot) onSlotChange(next);
        }}
      />
      <Segmented
        label={strings.slotGroup}
        options={slots.map((s) => ({ value: s, label: strings.slots[s] }))}
        value={shownSlot}
        onChange={onSlotChange}
        grid={slots.length > 3}
      />
      <Segmented
        label={strings.stepGroup}
        options={[
          { value: '1', label: strings.step1 },
          { value: '5', label: strings.step5 },
        ]}
        value={step}
        onChange={setStep}
      />
      <View style={[styles.pad, noMirror]}>
        {ARROWS.map((a) => (
          <PressableScale
            key={a.dir}
            haptic="select"
            accessibilityRole="button"
            accessibilityLabel={strings.nudgeA11y(a.dir, stepPt)}
            onPress={() => onNudgeChange(stepNudge(current, a.dir, stepPt))}
            style={[styles.arrow, continuous, { backgroundColor: c.fill }]}
          >
            <Feather name={a.icon} size={22} color={c.ink} />
          </PressableScale>
        ))}
      </View>
      <View style={styles.footer}>
        <Text accessibilityLiveRegion="polite" style={[textV2.footnote, tabularV2, styles.readout, { color: c.inkSecondary }]}>
          {strings.readout(current)}
        </Text>
        <PillButton
          label={strings.reset}
          icon="rotate-ccw"
          variant="tinted"
          size="small"
          disabled={!moved}
          onPress={() => onNudgeChange({ dx: 0, dy: 0 })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spaceV2.md },
  pad: { flexDirection: 'row', justifyContent: 'center', gap: spaceV2.md },
  arrow: {
    width: sizeV2.touch,
    height: sizeV2.touch,
    minWidth: sizeV2.touch,
    minHeight: sizeV2.touch,
    borderRadius: radiusV2.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spaceV2.md },
  readout: { flex: 1 },
});
