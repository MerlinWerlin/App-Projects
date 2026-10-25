// Daily goals for the habit trackers (T86). Reached from the goal chip under the water, sleep and
// steps cards on the Widgets tab. One inset card per tracker with a − / + stepper (and the same
// steps as a VoiceOver adjustable), plus "Back to <default>" once a goal has been changed.
// Goal rules and validation live in src/core/habitGoals.ts; goals are stored by
// src/store/widgetHabits.ts (AsyncStorage, works in Expo Go) and copied into the App Group trackers
// that the Home Screen habit widgets read in a full iOS build.
import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HABIT_DEFS, habitNameKey } from '../src/core/habits';
import { GOAL_HABIT_KINDS, canStepHabitGoal, defaultHabitGoal, habitGoalFor, stepHabitGoal, type GoalHabitKind } from '../src/core/habitGoals';
import { useT } from '../src/i18n';
import { setWidgetHabitGoal, useWidgetHabits } from '../src/store/widgetHabits';
import { continuous, sizeV2, spaceV2, textV2 } from '../src/theme/tokensV2';
import { useColorsV2 } from '../src/theme/useTokens';
import { haptic } from '../src/ui/haptics';
import { textStyleFor } from '../src/ui/i18nLayout';
import { InsetGroup } from '../src/ui/InsetGroup';
import { PillButton } from '../src/ui/PillButton';

/** Untyped lookup for keys carried in data (habit names and units from HABIT_DEFS). */
type LooseT = (key: string, params?: Record<string, string | number>) => string;

export default function HabitGoalsScreen() {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const state = useWidgetHabits();

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.body}>
        <Text style={[textV2.callout, textStyleFor(script, textV2.callout), styles.intro, { color: c.inkSecondary }]}>
          {t('tabs.widgetsTab.goals.intro')}
        </Text>

        {GOAL_HABIT_KINDS.map((kind) => (
          <GoalCard key={kind} kind={kind} goal={habitGoalFor(state.goals, kind)} loading={!state.goalsLoaded} />
        ))}

        <Text style={[textV2.footnote, textStyleFor(script, textV2.footnote), styles.intro, { color: c.inkSecondary }]}>
          {state.available ? t('tabs.widgetsTab.goals.widgetNote') : t('tabs.widgetsTab.goals.previewNote')}
        </Text>
        <Text style={[textV2.footnote, textStyleFor(script, textV2.footnote), styles.intro, { color: c.inkSecondary }]}>
          {t('tabs.widgetsTab.goals.moodNote')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function GoalCard({ kind, goal, loading }: { kind: GoalHabitKind; goal: number; loading: boolean }) {
  const { c } = useColorsV2();
  const { t, script, formatNumber } = useT();
  const tl = t as unknown as LooseT;
  const def = HABIT_DEFS[kind];
  const habit = tl(habitNameKey(kind));
  const amountOf = (n: number): string =>
    t('tabs.widgetsTab.goals.amount', { value: formatNumber(n, { maximumFractionDigits: def.decimals }), unit: tl(def.unitKey) });
  const amount = amountOf(goal);
  const fallback = defaultHabitGoal(kind);
  const isDefault = goal === fallback;
  const canDown = !loading && canStepHabitGoal(kind, goal, -1);
  const canUp = !loading && canStepHabitGoal(kind, goal, 1);

  const step = (direction: 1 | -1) => {
    if (direction === 1 ? !canUp : !canDown) return;
    haptic('select');
    void setWidgetHabitGoal(kind, stepHabitGoal(kind, goal, direction));
  };
  const onA11yAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') step(1);
    else if (e.nativeEvent.actionName === 'decrement') step(-1);
  };

  const stepper = (direction: 1 | -1) => {
    const enabled = direction === 1 ? canUp : canDown;
    return (
      <Pressable
        onPress={() => step(direction)}
        disabled={!enabled}
        accessibilityRole="button"
        accessibilityLabel={direction === 1 ? t('tabs.widgetsTab.goals.increase', { habit }) : t('tabs.widgetsTab.goals.decrease', { habit })}
        accessibilityState={{ disabled: !enabled }}
        style={({ pressed }) => [
          styles.stepBtn,
          continuous,
          { backgroundColor: c.tintSoft, opacity: !enabled ? 0.4 : pressed ? 0.7 : 1 },
        ]}
      >
        <Feather name={direction === 1 ? 'plus' : 'minus'} size={22} color={c.onTintSoft} />
      </Pressable>
    );
  };

  return (
    <InsetGroup header={habit}>
      <View style={styles.card}>
        <View style={styles.stepRow}>
          {stepper(-1)}
          <View
            style={styles.value}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={t('tabs.widgetsTab.goals.goalA11y', { habit, goal: amount })}
            accessibilityValue={{ text: amount }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={onA11yAction}
          >
            <Text
              style={[textV2.title2, textStyleFor(script, textV2.title2), styles.centre, { color: c.ink }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {amount}
            </Text>
            {isDefault ? (
              <Text style={[textV2.caption1, textStyleFor(script, textV2.caption1), styles.centre, { color: c.inkSecondary }]}>
                {t('tabs.widgetsTab.goals.defaultTag')}
              </Text>
            ) : null}
          </View>
          {stepper(1)}
        </View>
        {isDefault ? null : (
          <PillButton
            label={t('tabs.widgetsTab.goals.reset', { goal: amountOf(fallback) })}
            icon="rotate-ccw"
            variant="plain"
            size="small"
            haptic="select"
            disabled={loading}
            onPress={() => void setWidgetHabitGoal(kind, null)}
            accessibilityLabel={t('tabs.widgetsTab.goals.resetA11y', { habit, goal: amountOf(fallback) })}
            style={styles.reset}
          />
        )}
      </View>
    </InsetGroup>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingVertical: spaceV2.lg, gap: spaceV2.xl, paddingBottom: spaceV2.xxl },
  intro: { marginHorizontal: spaceV2.lg },
  card: { paddingHorizontal: spaceV2.lg, paddingVertical: spaceV2.md, gap: spaceV2.sm },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, minHeight: sizeV2.rowMin },
  stepBtn: {
    width: sizeV2.touch,
    height: sizeV2.touch,
    borderRadius: sizeV2.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spaceV2.xxs },
  centre: { textAlign: 'center' },
  reset: { alignSelf: 'center' },
});
