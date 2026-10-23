// Widgets tab (T70, docs/MARKET.md L1 + L3). Pick a theme, pick a size sub-tab (Small / Medium /
// Large / Lock), then browse a 2-column grid of that theme's matching widgets. Theme-set widgets
// (src/core/widgetSets.ts) show a real preview and open Widget Studio with theme, kind and size.
// T78: catalogue kinds (src/core/widgetKinds.ts) show a real preview too (CatalogueWidgetPreview,
// drawn at the device's current time) named with widgetKinds' own keys, and open Widget Studio.
// Widgets with buttons (habit trackers, album) carry a "Preview only" badge: their buttons do
// nothing in the app. A kind the Studio can't edit would still get the plain "Coming soon" card.
// Card order and links come from src/core/tabNav.ts. Works in Expo Go (plain views + SVG).
// T86: habit cards show today's logged value and the person's daily goal (useWidgetHabits, as in
// Widget Studio), and water / sleep / steps cards get a goal chip that opens the Daily goals screen.
// T85: a look row (theme / clear glass / tinted glass / glow) redraws every preview in that look;
// glass is solved against the theme wallpaper, or the user's own photo's sampled colours.
// T89: habit cards get a "Today: …" value button that logs one step by hand (water +150 ml, sleep
// +1 h, steps +500, mood to the next face) through logWidgetHabit; works in Expo Go too.
// T94: touch and hold the same button (or VoiceOver "decrement") takes one step off.
// T91: the grid is drawn row by row (src/core/widgetGrid.ts); a card whose neighbour has a log
// button or goal chip reserves an empty slot of the same height, so rows stay even.
// fb-1023 C: every option row is visual as well as text: theme chips show a swatch of the theme,
// look chips a swatch of the look (solved like the widgets), size tabs a tiny widget outline in
// that size's aspect (src/core/widgetOptionArt.ts, drawn by src/ui/WidgetOptionArt.tsx). No motion.
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native';
import { WIDGET_TAB_SIZES, widgetStudioHref, widgetTabCards, widgetTabSizeKey, type WidgetTabCard, type WidgetTabSize } from '../../src/core/tabNav';
import { getAnyTheme } from '../../src/core/plusThemes';
import { THEMES, type Theme } from '../../src/core/themes';
import { CATALOGUE_SIZE_POINTS, catalogueKindKey, catalogueSizeKey, catalogueSpecOf, type CatalogueKind } from '../../src/core/widgetKinds';
import { wallpaperTokensFor } from '../../src/core/wallpaperPalette';
import { widgetLookKey, type WidgetLook } from '../../src/core/widgetLook';
import { generateWidgetSet, generateWidgetSetFromTokens, widgetSpecOf } from '../../src/core/widgetSets';
import {
  catalogueHasButtons,
  catalogueSpecInLook,
  catalogueStudioKinds,
  previewLooks,
  setSpecInLook,
  studioCatalogue,
  studioKinds,
} from '../../src/core/widgetStudio';
import { HABIT_DEFS, habitNameKey, moodLevelKey, type HabitKind } from '../../src/core/habits';
import { isGoalHabitKind } from '../../src/core/habitGoals';
import { canTapHabit, canUndoHabitTap, habitTapStep, nextHabitTapValue } from '../../src/core/habitTap';
import { WIDGET_GRID_COLUMNS, gridRows, rowExtras, slotFor, type GridCardExtras, type GridSlot } from '../../src/core/widgetGrid';
import { useT } from '../../src/i18n';
import { useStudio } from '../../src/store/studio';
import { logWidgetHabit, undoWidgetHabit, useWidgetHabits, widgetHabitGoal, widgetHabitValue } from '../../src/store/widgetHabits';
import { continuous, radiusV2, sizeV2, spaceV2, textV2 } from '../../src/theme/tokensV2';
import { useColorsV2 } from '../../src/theme/useTokens';
import type { FeatherName } from '../../src/ui/featherName';
import { haptic } from '../../src/ui/haptics';
import { textStyleFor } from '../../src/ui/i18nLayout';
import { LargeTitleScrollView, PillButton, SquircleCard } from '../../src/ui/v2';
import { CatalogueWidgetPreview } from '../../src/ui/CatalogueWidgetPreview';
import { WidgetPreview } from '../../src/ui/WidgetPreview';
import { useWallpaperPalette } from '../../src/ui/useWallpaperPalette';
import { SizeArt, SwatchArt } from '../../src/ui/WidgetOptionArt';
import { lookSwatch, themeSwatch, type Swatch } from '../../src/core/widgetOptionArt';

/** Untyped lookup for keys carried in data (tabNav card name/size keys). */
type LooseT = (key: string, params?: Record<string, string | number>) => string;

const CATALOGUE_GLYPHS: Record<CatalogueKind, FeatherName> = {
  analogClock: 'clock',
  monthCalendar: 'calendar',
  countdown: 'flag',
  yearProgress: 'bar-chart-2',
  monthProgress: 'bar-chart',
  photoAlbum: 'image',
  habitWater: 'droplet',
  habitMood: 'smile',
  habitSleep: 'moon',
  habitSteps: 'activity',
};

const GUTTER = spaceV2.lg;
const GAP = spaceV2.md;
const CARD_PAD = spaceV2.md;

export default function WidgetsTab() {
  const { c } = useColorsV2();
  const { t, script, formatNumber } = useT();
  const tl = t as unknown as LooseT;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { state } = useStudio();
  // T86: values logged on the Home Screen habit widgets (full iOS build) and the daily goals.
  const widgetHabits = useWidgetHabits();

  // Default theme: the applied one (it may be a Plus theme), else the first bundled theme.
  const applied: Theme | undefined = getAnyTheme(state?.themeId ?? undefined);
  const themes: readonly Theme[] = useMemo(
    () => (applied && !THEMES.some((x) => x.id === applied.id) ? [applied, ...THEMES] : THEMES),
    [applied],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const theme: Theme = themes.find((x) => x.id === picked) ?? applied ?? THEMES[0];
  const [size, setSize] = useState<WidgetTabSize>('small');

  const [look, setLook] = useState<WidgetLook>('theme');

  const baseSet = useMemo(() => generateWidgetSet(theme), [theme]);
  const wallpaper = useWallpaperPalette(theme);
  const set = useMemo(
    () =>
      wallpaper.usesPhoto ? generateWidgetSetFromTokens(wallpaperTokensFor(baseSet.tokens, { usesPhoto: true, sampled: wallpaper.sampled })) : baseSet,
    [baseSet, wallpaper.usesPhoto, wallpaper.sampled],
  );
  const cat = useMemo(() => studioCatalogue(set), [set]);
  const looks: WidgetLook[] = useMemo(() => previewLooks(set.tokens), [set]);
  // fb-1023 C: one swatch per look, from the same tokens (and photo colours) as the previews.
  const lookSwatches: Map<WidgetLook, Swatch> = useMemo(() => new Map(looks.map((l) => [l, lookSwatch(l, set.tokens)])), [looks, set]);
  const editable: string[] = useMemo(() => [...studioKinds(set), ...catalogueStudioKinds()], [set]);
  const cards: WidgetTabCard[] = useMemo(() => widgetTabCards(size, editable), [size, editable]);

  // One device clock for every preview (clock hands, calendar, progress dots), ticking each minute.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const cardWidth = Math.max(120, Math.floor((width - GUTTER * 2 - GAP) / 2));
  const innerWidth = cardWidth - CARD_PAD * 2;

  const pickTheme = (id: string) => {
    if (id === theme.id) return;
    haptic('select');
    setPicked(id);
  };
  const pickLook = (l: WidgetLook) => {
    if (l === look) return;
    haptic('select');
    setLook(l);
  };
  const pickSize = (s: WidgetTabSize) => {
    if (s === size) return;
    haptic('select');
    setSize(s);
  };

  const label = (role: keyof typeof textV2) => [textV2[role], textStyleFor(script, textV2[role])];

  /** "650 ml", "7.5 hours", "Good" / "Not logged" for a tracker value. */
  const habitAmount = (k: HabitKind, v: number): string =>
    HABIT_DEFS[k].mode === 'scale'
      ? v > 0
        ? tl(moodLevelKey(v))
        : t('tabs.widgetsTab.log.notLogged')
      : t('tabs.widgetsTab.goals.amount', {
          value: formatNumber(v, { maximumFractionDigits: HABIT_DEFS[k].decimals }),
          unit: tl(HABIT_DEFS[k].unitKey),
        });

  // T89: one tap logs one step. The haptic fires straight away; a tracker at its maximum buzzes.
  const logHabit = (k: HabitKind) => {
    haptic(canTapHabit(widgetHabits.habits, k, new Date()) ? 'light' : 'warning');
    void logWidgetHabit(k);
  };

  // T94: touch and hold (or the VoiceOver "decrement" action) takes one step off.
  const undoHabit = (k: HabitKind) => {
    haptic(canUndoHabitTap(widgetHabits.habits, k, new Date()) ? 'select' : 'warning');
    void undoWidgetHabit(k);
  };

  const renderLogButton = (k: HabitKind) => {
    const value = widgetHabitValue(widgetHabits, k, now) ?? 0;
    const valueText = habitAmount(k, value);
    const canUndo = canUndoHabitTap(widgetHabits.habits, k, now);
    const tapHint = !canTapHabit(widgetHabits.habits, k, now)
      ? t('tabs.widgetsTab.log.full')
      : HABIT_DEFS[k].mode === 'scale'
        ? t('tabs.widgetsTab.log.moodHint', { next: habitAmount(k, nextHabitTapValue(widgetHabits.habits, k, now)) })
        : t('tabs.widgetsTab.log.hint', { step: habitAmount(k, habitTapStep(widgetHabits.habits, k)) });
    const hint = canUndo ? `${tapHint} ${t('tabs.widgetsTab.log.undoHint')}` : tapHint;
    return (
      <PillButton
        label={t('tabs.widgetsTab.log.today', { value: valueText })}
        icon={HABIT_DEFS[k].mode === 'scale' ? 'smile' : 'plus-circle'}
        variant="glass"
        size="small"
        block
        haptic={false}
        onPress={() => logHabit(k)}
        onLongPress={() => undoHabit(k)}
        accessibilityActions={canUndo ? [{ name: 'decrement', label: t('tabs.widgetsTab.log.undoAction') }] : undefined}
        onAccessibilityAction={(e: AccessibilityActionEvent) => {
          if (e.nativeEvent.actionName === 'decrement') undoHabit(k);
        }}
        accessibilityLabel={t('tabs.widgetsTab.log.a11y', { habit: tl(habitNameKey(k)), value: valueText })}
        accessibilityHint={hint}
        style={styles.logButton}
      />
    );
  };

  /** The catalogue spec a card previews (in the picked look), if it has one. */
  const catSpecFor = (card: WidgetTabCard) => {
    const href = widgetStudioHref(theme.id, card);
    const catBase = card.source === 'catalogue' && href ? catalogueSpecOf(cat, card.kind, card.size) : undefined;
    // Sizes that can't take the look (Lock Screen, StandBy glass) keep their theme look.
    return catBase ? catalogueSpecInLook(catBase, look) : undefined;
  };

  /** T91: which extra rows a card has under its tile (habit cards: log button, count trackers: goal chip). */
  const extrasOf = (card: WidgetTabCard): GridCardExtras => {
    const habit = catSpecFor(card)?.binding.habit;
    return { log: !!habit, goal: !!habit && isGoalHabitKind(habit) };
  };

  /** An empty, hidden slot as tall as the button it stands in for. */
  const slotSpacer = (key: string): ReactNode => <View key={key} style={styles.slot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;

  const renderCard = (card: WidgetTabCard, row: GridCardExtras) => {
    // Catalogue cards use widgetKinds' own name / size keys (the same ones the Studio shows).
    const kind = card.source === 'catalogue' ? tl(catalogueKindKey(card.kind)) : tl(card.nameKey);
    const sizeName = card.source === 'catalogue' ? tl(catalogueSizeKey(card.size)) : tl(card.sizeKey);
    const href = widgetStudioHref(theme.id, card);
    const setBase = card.source === 'set' ? widgetSpecOf(set, card.kind, card.size) : undefined;
    const spec = setBase ? setSpecInLook(setBase, look) : undefined;
    const catSpec = catSpecFor(card);
    const previewOnly = !!catSpec && catalogueHasButtons(catSpec);
    const caption = (
      <View style={styles.caption}>
        <Text style={[...label('subhead'), styles.bold, { color: c.ink }]} numberOfLines={2}>
          {kind}
        </Text>
        <Text style={[...label('caption1'), { color: c.inkSecondary }]} numberOfLines={1}>
          {sizeName}
        </Text>
      </View>
    );
    let art: ReactNode;
    if (spec) {
      art = <WidgetPreview spec={spec} width={innerWidth} now={now} wallpaperUri={wallpaper.photoUri} />;
    } else if (catSpec) {
      art = (
        <CatalogueWidgetPreview
          spec={catSpec}
          width={innerWidth}
          now={now}
          habitValue={widgetHabitValue(widgetHabits, catSpec.binding.habit, now)}
          habitGoal={widgetHabitGoal(widgetHabits, catSpec.binding.habit)}
          wallpaperUri={wallpaper.photoUri}
        />
      );
    } else {
      // Honest placeholder: the catalogue kind's shape and glyph, no fake content.
      const pts = CATALOGUE_SIZE_POINTS[card.size];
      const h = Math.max(36, Math.round((innerWidth * pts.height) / pts.width));
      const glyph = card.source === 'catalogue' ? CATALOGUE_GLYPHS[card.kind] : 'square';
      art = (
        <View style={[styles.placeholder, continuous, { height: h, backgroundColor: c.fill, borderColor: c.separator }]}>
          <Feather name={glyph} size={Math.min(28, h * 0.5)} color={c.inkSecondary} />
        </View>
      );
    }
    const habitKind = catSpec?.binding.habit;
    const goalKind = habitKind && isGoalHabitKind(habitKind) ? habitKind : null;
    const goal = goalKind ? widgetHabitGoal(widgetHabits, goalKind) : undefined;
    const goalText =
      goalKind && goal !== undefined
        ? t('tabs.widgetsTab.goals.amount', {
            value: formatNumber(goal, { maximumFractionDigits: HABIT_DEFS[goalKind].decimals }),
            unit: tl(HABIT_DEFS[goalKind].unitKey),
          })
        : null;
    // T91: every card in the row shows or reserves the same extra rows, pinned to the bottom.
    const logSlot: GridSlot = slotFor(!!habitKind, row.log);
    const goalSlot: GridSlot = slotFor(!!goalKind && goalText !== null, row.goal);
    const tile = (
      <SquircleCard
        padding={CARD_PAD}
        onPress={href ? () => router.push(href) : undefined}
        haptic={href ? 'light' : false}
        accessibilityLabel={
          href
            ? `${tl('tabs.widgetsTab.open', { kind, size: sizeName })}${previewOnly ? ` ${t('tabs.widgetsTab.buttonsNote')}` : ''}`
            : undefined
        }
        style={{ width: cardWidth }}
      >
        {/* Pressable cards are read by their button label; "coming soon" cards are one static element. */}
        <View
          style={styles.cardBody}
          accessible={!href}
          accessibilityLabel={href ? undefined : tl('tabs.widgetsTab.soonA11y', { kind, size: sizeName })}
          importantForAccessibility={href ? 'no-hide-descendants' : 'yes'}
          accessibilityElementsHidden={!!href}
        >
          {art}
          {caption}
          {previewOnly ? (
            <View style={[styles.badge, { backgroundColor: c.fill }]}>
              <Text style={[...label('caption2'), { color: c.inkSecondary }]} numberOfLines={1}>
                {t('tabs.widgetsTab.previewBadge')}
              </Text>
            </View>
          ) : null}
          {href ? null : (
            <View style={[styles.badge, { backgroundColor: c.tintSoft }]}>
              <Text style={[...label('caption2'), { color: c.onTintSoft }]} numberOfLines={1}>
                {t('tabs.widgetsTab.soon')}
              </Text>
            </View>
          )}
        </View>
      </SquircleCard>
    );
    const cellStyle: StyleProp<ViewStyle> = [styles.cell, { width: cardWidth }];
    return (
      <View key={card.id} style={cellStyle}>
        {tile}
        {logSlot || goalSlot ? <View style={styles.cellFill} /> : null}
        {logSlot === 'button' && habitKind ? renderLogButton(habitKind) : logSlot === 'spacer' ? slotSpacer('log') : null}
        {goalSlot === 'button' && goalKind && goalText !== null ? (
          <PillButton
            label={t('tabs.widgetsTab.goals.chip', { goal: goalText })}
            icon="target"
            variant="tinted"
            size="small"
            block
            haptic="select"
            onPress={() => router.push('/habit-goals')}
            accessibilityLabel={t('tabs.widgetsTab.goals.chipA11y', { habit: tl(habitNameKey(goalKind)), goal: goalText })}
            style={styles.slot}
          />
        ) : goalSlot === 'spacer' ? (
          slotSpacer('goal')
        ) : null}
      </View>
    );
  };

  const renderRow = (row: WidgetTabCard[]) => {
    const extras = rowExtras(row.map(extrasOf));
    return (
      <View key={row.map((x) => x.id).join('|')} style={styles.row}>
        {row.map((card) => renderCard(card, extras))}
      </View>
    );
  };

  return (
    <LargeTitleScrollView title={t('tabs.widgets')} subtitle={t('tabs.widgetsTab.subtitle')}>
      <Text accessibilityRole="header" style={[...label('footnote'), styles.section, { color: c.inkSecondary }]}>
        {t('tabs.widgetsTab.themes')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {themes.map((x) => {
          const on = x.id === theme.id;
          return (
            <Pressable
              key={x.id}
              onPress={() => pickTheme(x.id)}
              accessibilityRole="button"
              accessibilityLabel={x.name}
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [
                styles.chip,
                continuous,
                { backgroundColor: on ? c.tint : c.fill, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <SwatchArt swatch={themeSwatch(x.palette)} ring={on ? c.onTint : c.separator} />
              <Text style={[...label('subhead'), styles.bold, { color: on ? c.onTint : c.ink }]} numberOfLines={1}>
                {x.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text accessibilityRole="header" style={[...label('footnote'), styles.section, { color: c.inkSecondary }]}>
        {t('tabs.widgetsTab.looks')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        accessibilityLabel={t('tabs.widgetsTab.looks')}
      >
        {looks.map((l) => {
          const on = l === look;
          const name = tl(widgetLookKey(l));
          const swatch = lookSwatches.get(l) ?? lookSwatch(l, set.tokens);
          return (
            <Pressable
              key={l}
              onPress={() => pickLook(l)}
              accessibilityRole="button"
              accessibilityLabel={name}
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [styles.chip, continuous, { backgroundColor: on ? c.tint : c.fill, opacity: pressed ? 0.7 : 1 }]}
            >
              <SwatchArt swatch={swatch} ring={on ? c.onTint : c.separator} />
              <Text style={[...label('subhead'), styles.bold, { color: on ? c.onTint : c.ink }]} numberOfLines={1}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View accessibilityRole="tablist" accessibilityLabel={t('tabs.widgetsTab.sizes')} style={[styles.sizes, { backgroundColor: c.fill }]}>
        {WIDGET_TAB_SIZES.map((s) => {
          const on = s === size;
          const name = tl(widgetTabSizeKey(s));
          return (
            <Pressable
              key={s}
              onPress={() => pickSize(s)}
              accessibilityRole="tab"
              accessibilityLabel={name}
              accessibilityState={{ selected: on }}
              style={[styles.sizeTab, continuous, on ? { backgroundColor: c.surface } : null]}
            >
              <SizeArt size={s} stroke={on ? c.tint : c.inkSecondary} fill={on ? c.tintSoft : 'transparent'} />
              <Text style={[...label('footnote'), styles.bold, styles.centre, { color: on ? c.ink : c.inkSecondary }]} numberOfLines={2}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {size === 'lock' ? (
        <Text style={[...label('footnote'), styles.note, { color: c.inkSecondary }]}>{t('tabs.widgetsTab.lockNote')}</Text>
      ) : null}

      <View style={styles.grid}>{gridRows(cards, WIDGET_GRID_COLUMNS).map(renderRow)}</View>
      {wallpaper.probe}
    </LargeTitleScrollView>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: GUTTER, marginTop: spaceV2.sm, marginBottom: spaceV2.xs },
  chips: { paddingHorizontal: GUTTER, gap: spaceV2.sm, paddingBottom: spaceV2.md },
  chip: {
    minHeight: sizeV2.touch,
    paddingHorizontal: spaceV2.lg,
    borderRadius: radiusV2.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.sm,
  },
  bold: { fontWeight: '600' },
  centre: { textAlign: 'center' },
  sizes: {
    marginHorizontal: GUTTER,
    padding: spaceV2.xs,
    borderRadius: radiusV2.pill,
    flexDirection: 'row',
    gap: spaceV2.xs,
  },
  sizeTab: {
    flex: 1,
    minHeight: sizeV2.touch,
    borderRadius: radiusV2.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spaceV2.xs,
    // fb-1023 C: room for the size picture above the label.
    paddingVertical: spaceV2.xs,
    gap: spaceV2.xxs,
  },
  note: { paddingHorizontal: GUTTER, marginTop: spaceV2.md },
  grid: {
    paddingHorizontal: GUTTER,
    paddingTop: spaceV2.lg,
    gap: GAP,
  },
  // T91: one row of the grid; cells stretch to the tallest one.
  row: { flexDirection: 'row', alignItems: 'stretch', gap: GAP },
  cell: { gap: spaceV2.sm },
  // Pushes the log / goal rows to the bottom of a stretched cell, so neighbours' buttons line up.
  cellFill: { flexGrow: 1, marginTop: -spaceV2.sm },
  cardBody: { gap: spaceV2.sm },
  // ≥ 48 pt tall without relying on hitSlop; the log button, goal chip and empty slots share it.
  slot: { minHeight: sizeV2.touch },
  logButton: { minHeight: sizeV2.touch },
  caption: { gap: spaceV2.xxs },
  placeholder: {
    borderRadius: radiusV2.control,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radiusV2.pill,
    paddingHorizontal: spaceV2.sm,
    paddingVertical: spaceV2.xxs,
  },
});
