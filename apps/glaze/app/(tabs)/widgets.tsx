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
// T118 (fb-1024 B, owner 24 Oct: "a little laggy moving around the UI"):
// - each card's spec (in the picked look) is computed once per set / look / size in a memo and
//   cached per spec object, instead of re-solving every card's look on every render (twice for
//   catalogue cards); widget sets, catalogues and swatches are cached per theme / palette;
// - cards are a memoised WidgetCell with stable handlers: a habit log re-renders the habit cards
//   only; a chip tap or a focus reload (the studio store) no longer re-renders every preview;
// - the grid is its own memoised component and mounts new rows progressively (two rows, then a
//   row per frame) behind same-height spacers; rows already mounted stay mounted;
// - the theme and look the grid draws are deferred values: the chip highlight answers at once and
//   the previews follow in a background render;
// - the minute clock only ticks while the tab is in focus.
// T146 (fb-1025 A): one calm "widget link check" line under the theme chips, in native iOS builds
// only (src/store/widgetLink.ts; nothing is drawn in Expo Go or on Android). Checked on focus and
// a few seconds after each theme pick. No motion.
// T173 (premium UI, docs/PREMIUM_UI.md §3.4): the grid reads as editorial sections, one per widget
// family (src/core/widgetFamilies.ts: theme set / everyday / habits), each opened by a SectionHeader
// (eyebrow + title + body) and split into its own rows; cards on the 16-pt rhythm (editorialV2), lifted
// by surface in dark mode (no hairline); previews wait as calm skeletons in their final shape while a
// photo wallpaper is being sampled; Dynamic Type caps (fontScaleCap) on every Text; only tokens. Still
// one virtualised list of memoised rows, with the ~16 pt spacer above the first section (T166).
import { Feather } from '@expo/vector-icons';
import { IslandPetArt } from '../../src/ui/IslandPetArt';
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useDeferredValue, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type AccessibilityActionEvent, type ListRenderItem, type StyleProp, type ViewStyle } from 'react-native';
import { WIDGET_TAB_SIZES, widgetStudioHref, widgetTabCards, widgetTabSizeKey, type WidgetTabCard, type WidgetTabSize } from '../../src/core/tabNav';
import { getAnyTheme } from '../../src/core/plusThemes';
import { THEMES, type Theme } from '../../src/core/themes';
import { CATALOGUE_SIZE_POINTS, catalogueKindKey, catalogueSizeKey, catalogueSpecOf, type CatalogueKind, type CatalogueSpec } from '../../src/core/widgetKinds';
import { wallpaperTokensFor } from '../../src/core/wallpaperPalette';
import { widgetLookKey, type WidgetLook } from '../../src/core/widgetLook';
import { generateWidgetSet, generateWidgetSetFromTokens, widgetSpecOf, type WidgetSpec } from '../../src/core/widgetSets';
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
import { WIDGET_GRID_COLUMNS, rowExtras, slotFor, type GridCardExtras, type GridSlot } from '../../src/core/widgetGrid';
import { familyRows, widgetFamilyKeys, type FamilyRow, type WidgetFamily } from '../../src/core/widgetFamilies';
import { weakKeyedCache, weakMemo } from '../../src/core/perfCache';
import { useT } from '../../src/i18n';
import { useStudio } from '../../src/store/studio';
import { applyWidgetTheme } from '../../src/store/widgetTheme';
import { useWidgetLink } from '../../src/store/widgetLink';
import { widgetLinkVisible, type WidgetLinkVerdict } from '../../src/core/widgetLink';
import { logWidgetHabit, undoWidgetHabit, useWidgetHabits, widgetHabitGoal, widgetHabitValue, type WidgetHabits } from '../../src/store/widgetHabits';
import { chromeRadiusV2, continuous, editorialV2, fontScaleCap, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../../src/theme/tokensV2';
import { useColorsV2 } from '../../src/theme/useTokens';
import type { FeatherName } from '../../src/ui/featherName';
import { haptic } from '../../src/ui/haptics';
import { textStyleFor } from '../../src/ui/i18nLayout';
import { LargeTitleFlatList, PillButton, SectionHeader, Skeleton, SquircleCard } from '../../src/ui/v2';
import { CatalogueWidgetPreview } from '../../src/ui/CatalogueWidgetPreview';
import { WidgetPreview } from '../../src/ui/WidgetPreview';
import { useWallpaperPalette } from '../../src/ui/useWallpaperPalette';
import { SizeArt, SwatchArt } from '../../src/ui/WidgetOptionArt';
import { lookSwatch, themeSwatch as rawThemeSwatch, type Swatch } from '../../src/core/widgetOptionArt';

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

/** T146: the message for each verdict the link line draws. */
const LINK_KEYS = {
  ok: 'tabs.widgetsTab.link.ok',
  noAppGroup: 'tabs.widgetsTab.link.noAppGroup',
  notReadYet: 'tabs.widgetsTab.link.notReadYet',
  stale: 'tabs.widgetsTab.link.stale',
  wrongTheme: 'tabs.widgetsTab.link.wrongTheme',
} as const satisfies Record<Exclude<WidgetLinkVerdict, 'expoGo' | 'unknown'>, string>;

const GUTTER = spaceV2.lg;
/** T173: the editorial 16-pt card rhythm (between cards in a row and between rows). */
const GAP = editorialV2.cardGap;
const CARD_PAD = spaceV2.md;

// T118: per-object caches (themes, palettes and specs are stable objects), so switching back to a
// theme or a look reuses the solved specs instead of solving every card again.
/** A theme chip's swatch, once per palette. */
const themeSwatch = weakMemo((palette: Theme['palette']): Swatch => rawThemeSwatch(palette));
/** The bundled widget set of a theme, once per theme. */
const setForTheme = weakMemo((theme: Theme) => generateWidgetSet(theme));
/** Every card spec's look variant, once per spec and look. */
const SET_LOOKS = weakKeyedCache<WidgetSpec, WidgetSpec>(6);
const CAT_LOOKS = weakKeyedCache<CatalogueSpec, CatalogueSpec>(6);
const setInLook = (spec: WidgetSpec, look: WidgetLook): WidgetSpec => SET_LOOKS.get(spec, look, () => setSpecInLook(spec, look));
const catInLook = (spec: CatalogueSpec, look: WidgetLook): CatalogueSpec => CAT_LOOKS.get(spec, look, () => catalogueSpecInLook(spec, look));

/** Everything a card draws that depends only on the theme, look and size (computed once per change). */
type CardModel = {
  card: WidgetTabCard;
  href: string | null;
  /** Theme-set preview spec (in the look). */
  spec?: WidgetSpec;
  /** Catalogue preview spec (in the look; sizes that can't take the look keep their theme look). */
  catSpec?: CatalogueSpec;
  previewOnly: boolean;
  /** The habit a tracker card shows, if any. */
  habit: HabitKind | null;
  /** The tracker's goal chip (water / sleep / steps). */
  goalKind: HabitKind | null;
  extras: GridCardExtras;
};

type CellProps = {
  model: CardModel;
  /** T91: extra rows the whole row shows or reserves. */
  rowLog: boolean;
  rowGoal: boolean;
  cardWidth: number;
  innerWidth: number;
  now: Date;
  wallpaperUri: string | null;
  /** T173: the photo wallpaper is still being sampled; previews show a skeleton in their shape. */
  sampling: boolean;
  /** Logged values and goals: passed to tracker cards only, so a log re-renders just those. */
  habits: WidgetHabits | undefined;
  onOpen: (href: string) => void;
  logHabit: (k: HabitKind) => void;
  undoHabit: (k: HabitKind) => void;
  onGoals: () => void;
};

/** One widget card with its log button / goal chip rows (memoised; all props stable between changes). */
const WidgetCell = memo(function WidgetCell({
  model,
  rowLog,
  rowGoal,
  cardWidth,
  innerWidth,
  now,
  wallpaperUri,
  sampling,
  habits,
  onOpen,
  logHabit,
  undoHabit,
  onGoals,
}: CellProps) {
  const { c, scheme } = useColorsV2();
  const { t, script, formatNumber } = useT();
  const tl = t as unknown as LooseT;
  const label = (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];
  const { card, href, spec, catSpec, previewOnly } = model;
  // T162: one width style object per card width (no new inline object on every render).
  const widthStyle = useMemo(() => ({ width: cardWidth }), [cardWidth]);
  const cellStyle: StyleProp<ViewStyle> = useMemo(() => [styles.cell, widthStyle], [widthStyle]);

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

  const renderLogButton = (k: HabitKind, h: WidgetHabits) => {
    const value = widgetHabitValue(h, k, now) ?? 0;
    const valueText = habitAmount(k, value);
    const canUndo = canUndoHabitTap(h.habits, k, now);
    const tapHint = !canTapHabit(h.habits, k, now)
      ? t('tabs.widgetsTab.log.full')
      : HABIT_DEFS[k].mode === 'scale'
        ? t('tabs.widgetsTab.log.moodHint', { next: habitAmount(k, nextHabitTapValue(h.habits, k, now)) })
        : t('tabs.widgetsTab.log.hint', { step: habitAmount(k, habitTapStep(h.habits, k)) });
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

  /** An empty, hidden slot as tall as the button it stands in for. */
  const slotSpacer = (key: string): ReactNode => <View key={key} style={styles.slot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />; // i18n-ignore (code after a JSX element)

  // Catalogue cards use widgetKinds' own name / size keys (the same ones the Studio shows).
  const kind = card.source === 'catalogue' ? tl(catalogueKindKey(card.kind)) : tl(card.nameKey);
  const sizeName = card.source === 'catalogue' ? tl(catalogueSizeKey(card.size)) : tl(card.sizeKey);
  const caption = (
    <View style={styles.caption}>
      <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...label('subhead'), styles.bold, { color: c.ink }]} numberOfLines={2}>
        {kind}
      </Text>
      <Text maxFontSizeMultiplier={fontScaleCap('caption1')} style={[...label('caption1'), { color: c.inkSecondary }]} numberOfLines={1}>
        {sizeName}
      </Text>
    </View>
  );
  const habitKind = model.habit;
  // The preview's own aspect (widget points), for the skeleton and the honest placeholder.
  const pts = CATALOGUE_SIZE_POINTS[card.size];
  const artHeight = Math.max(36, Math.round((innerWidth * pts.height) / pts.width));
  let art: ReactNode;
  if (sampling && (spec || catSpec)) {
    // T173: the photo wallpaper is being sampled (up to a few seconds): a calm skeleton in the
    // preview's shape instead of a preview that redraws in other colours a moment later.
    art = <Skeleton width={innerWidth} height={artHeight} radius={chromeRadiusV2.control} />;
  } else if (spec) {
    art = <WidgetPreview spec={spec} width={innerWidth} now={now} wallpaperUri={wallpaperUri} />;
  } else if (catSpec) {
    art = (
      <CatalogueWidgetPreview
        spec={catSpec}
        width={innerWidth}
        now={now}
        habitValue={habits ? widgetHabitValue(habits, habitKind, now) : undefined}
        habitGoal={habits ? widgetHabitGoal(habits, habitKind) : undefined}
        wallpaperUri={wallpaperUri}
      />
    );
  } else {
    // Honest placeholder: the catalogue kind's shape and glyph, no fake content. T173: a soft fill,
    // no hairline (depth from surfaces, not lines).
    const glyph = card.source === 'catalogue' ? CATALOGUE_GLYPHS[card.kind] : 'square';
    art = (
      <View style={[styles.placeholder, continuous, { height: artHeight, backgroundColor: c.fill }]}>
        <Feather name={glyph} size={Math.min(28, artHeight * 0.5)} color={c.inkSecondary} />
      </View>
    );
  }
  const goalKind = model.goalKind;
  const goal = goalKind && habits ? widgetHabitGoal(habits, goalKind) : undefined;
  const goalText =
    goalKind && goal !== undefined
      ? t('tabs.widgetsTab.goals.amount', {
          value: formatNumber(goal, { maximumFractionDigits: HABIT_DEFS[goalKind].decimals }),
          unit: tl(HABIT_DEFS[goalKind].unitKey),
        })
      : null;
  // T91: every card in the row shows or reserves the same extra rows, pinned to the bottom.
  const logSlot: GridSlot = slotFor(!!habitKind, rowLog);
  const goalSlot: GridSlot = slotFor(!!goalKind && goalText !== null, rowGoal);
  const open = useCallback(() => {
    if (href) onOpen(href);
  }, [href, onOpen]);
  const tile = (
    <SquircleCard
      padding={CARD_PAD}
      tone={scheme === 'dark' ? 'raised' : 'surface'}
      outline={false}
      onPress={href ? open : undefined}
      haptic={href ? 'light' : false}
      accessibilityLabel={
        href
          ? `${tl('tabs.widgetsTab.open', { kind, size: sizeName })}${previewOnly ? ` ${t('tabs.widgetsTab.buttonsNote')}` : ''}`
          : undefined
      }
      style={widthStyle}
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
            <Text maxFontSizeMultiplier={fontScaleCap('caption2')} style={[...label('caption2'), { color: c.inkSecondary }]} numberOfLines={1}>
              {t('tabs.widgetsTab.previewBadge')}
            </Text>
          </View>
        ) : null}
        {href ? null : (
          <View style={[styles.badge, { backgroundColor: c.tintSoft }]}>
            <Text maxFontSizeMultiplier={fontScaleCap('caption2')} style={[...label('caption2'), { color: c.onTintSoft }]} numberOfLines={1}>
              {t('tabs.widgetsTab.soon')}
            </Text>
          </View>
        )}
      </View>
    </SquircleCard>); // i18n-ignore (code after a JSX element)
  return (
    <View style={cellStyle}>
      {tile}
      {logSlot || goalSlot ? <View style={styles.cellFill} /> : null}
      {logSlot === 'button' && habitKind && habits ? renderLogButton(habitKind, habits) : logSlot === 'spacer' ? slotSpacer('log') : null}
      {goalSlot === 'button' && goalKind && goalText !== null ? (
        <PillButton
          label={t('tabs.widgetsTab.goals.chip', { goal: goalText })}
          icon="target"
          variant="tinted"
          size="small"
          block
          haptic="select"
          onPress={onGoals}
          accessibilityLabel={t('tabs.widgetsTab.goals.chipA11y', { habit: tl(habitNameKey(goalKind)), goal: goalText })}
          style={styles.slot}
        />
      ) : goalSlot === 'spacer' ? (
        slotSpacer('goal')
      ) : null}
    </View>
  );
});

type RowProps = {
  /** One grid row (up to WIDGET_GRID_COLUMNS cards of one family). */
  row: readonly WidgetTabCard[];
  /** T173: the row's widget family, and whether it opens the family's section (draws the header). */
  family: WidgetFamily;
  first: boolean;
  /** The first section sits under the T166 spacer, so it needs no extra space above. */
  firstSection: boolean;
  sampling: boolean;
  models: ReadonlyMap<string, CardModel>;
  cardWidth: number;
  innerWidth: number;
  now: Date;
  wallpaperUri: string | null;
  habits: WidgetHabits;
  onOpen: (href: string) => void;
  logHabit: (k: HabitKind) => void;
  undoHabit: (k: HabitKind) => void;
  onGoals: () => void;
};

/**
 * T162 (owner 30 Oct C): one row of the virtualised grid (memoised). The FlatList mounts rows as
 * they scroll in and unmounts the far ones, which replaces T118's progressive reveal.
 */
const WidgetRow = memo(function WidgetRow({
  row,
  family,
  first,
  firstSection,
  sampling,
  models,
  cardWidth,
  innerWidth,
  now,
  wallpaperUri,
  habits,
  onOpen,
  logHabit,
  undoHabit,
  onGoals,
}: RowProps) {
  const { t } = useT();
  const tl = t as unknown as LooseT;
  const rowModels = row.map((card) => models.get(card.id)).filter((m): m is CardModel => m !== undefined);
  const extras = rowExtras(rowModels.map((m) => m.extras));
  const keys = widgetFamilyKeys(family);
  const cells = (
    <View style={styles.row}>
      {rowModels.map((m) => (
        <WidgetCell
          key={m.card.id}
          model={m}
          rowLog={extras.log}
          rowGoal={extras.goal}
          cardWidth={cardWidth}
          innerWidth={innerWidth}
          now={now}
          wallpaperUri={wallpaperUri}
          sampling={sampling}
          habits={m.habit ? habits : undefined}
          onOpen={onOpen}
          logHabit={logHabit}
          undoHabit={undoHabit}
          onGoals={onGoals}
        />
      ))}
    </View>); // i18n-ignore (code after a JSX element)
  if (!first) return cells;
  // T173: the family's editorial header (one accessibility heading) above its first row.
  return (
    <View>
      <SectionHeader
        eyebrow={tl(keys.eyebrow)}
        title={tl(keys.title)}
        body={tl(keys.body)}
        flushTop={firstSection}
        style={firstSection ? styles.sectionHeader : [styles.sectionHeader, styles.sectionAfterRow]}
      />
      {cells}
    </View>
  );
});

const rowKey = (row: FamilyRow<WidgetTabCard>): string => row.key;

export default function WidgetsTab() {
  const { c } = useColorsV2();
  const { t, script } = useT();
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
  // T146: link check; re-checked a few seconds after each pick (pickNonce) and on focus.
  const [pickNonce, setPickNonce] = useState(0);
  const linkVerdict = useWidgetLink(picked, pickNonce);

  const [look, setLook] = useState<WidgetLook>('theme');

  // T118: the chips answer at once; the previews follow with the deferred theme and look.
  const gridTheme = useDeferredValue(theme);
  const gridLook = useDeferredValue(look);

  const baseSet = useMemo(() => setForTheme(gridTheme), [gridTheme]);
  const wallpaper = useWallpaperPalette(gridTheme);
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

  // T118: each card's spec in the look, solved once per set / catalogue / look / size.
  const models: ReadonlyMap<string, CardModel> = useMemo(() => {
    const out = new Map<string, CardModel>();
    for (const card of cards) {
      const href = widgetStudioHref(gridTheme.id, card);
      const setBase = card.source === 'set' ? widgetSpecOf(set, card.kind, card.size) : undefined;
      const spec = setBase ? setInLook(setBase, gridLook) : undefined;
      const catBase = card.source === 'catalogue' && href ? catalogueSpecOf(cat, card.kind, card.size) : undefined;
      // Sizes that can't take the look (Lock Screen, StandBy glass) keep their theme look.
      const catSpec = catBase ? catInLook(catBase, gridLook) : undefined;
      const habit = catSpec?.binding.habit ?? null;
      const goalKind = habit && isGoalHabitKind(habit) ? habit : null;
      out.set(card.id, {
        card,
        href,
        spec,
        catSpec,
        previewOnly: !!catSpec && catalogueHasButtons(catSpec),
        habit,
        goalKind,
        extras: { log: !!habit, goal: !!goalKind },
      });
    }
    return out;
  }, [cards, set, cat, gridLook, gridTheme.id]);

  // One device clock for every preview (clock hands, calendar, progress dots), ticking each minute
  // while the tab is in focus (T118: no re-render of every preview while another tab is up).
  const [now, setNow] = useState<Date>(() => new Date());
  useFocusEffect(
    useCallback(() => {
      const tick = () =>
        setNow((prev) => {
          const d = new Date();
          return Math.floor(d.getTime() / 60_000) === Math.floor(prev.getTime() / 60_000) ? prev : d;
        });
      tick();
      const id = setInterval(tick, 60_000);
      return () => clearInterval(id);
    }, []),
  );

  const cardWidth = Math.max(120, Math.floor((width - GUTTER * 2 - GAP) / 2));
  const innerWidth = cardWidth - CARD_PAD * 2;

  // Owner 25 Oct (glaze-retest A: "just shows the same line of widgets with the same colour scheme
  // every time"): picking a theme here used to change the in-app previews only, so the Home Screen
  // widgets (and the iOS widget gallery) kept the old theme. Picking a theme now also writes it to
  // the widgets through the App Group (no-op in Expo Go).
  const pickTheme = (id: string) => {
    if (id === theme.id) return;
    haptic('select');
    setPicked(id);
    const next = themes.find((x) => x.id === id);
    if (next) void applyWidgetTheme(next);
    setPickNonce((n) => n + 1);
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

  const label = (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];

  // Stable handlers for the memoised cards (they read the latest habits through a ref).
  const habitsRef = useRef(widgetHabits);
  habitsRef.current = widgetHabits;
  // T89: one tap logs one step. The haptic fires straight away; a tracker at its maximum buzzes.
  const logHabit = useCallback((k: HabitKind) => {
    haptic(canTapHabit(habitsRef.current.habits, k, new Date()) ? 'light' : 'warning');
    void logWidgetHabit(k);
  }, []);
  // T94: touch and hold (or the VoiceOver "decrement" action) takes one step off.
  const undoHabit = useCallback((k: HabitKind) => {
    haptic(canUndoHabitTap(habitsRef.current.habits, k, new Date()) ? 'select' : 'warning');
    void undoWidgetHabit(k);
  }, []);
  const onOpen = useCallback((href: string) => router.push(href), [router]);
  const onGoals = useCallback(() => router.push('/habit-goals'), [router]);

  // T162 (owner 30 Oct C): the grid is a virtualised list of rows; everything above it is the header.
  // T173: rows per widget family (a row never mixes families); a family's first row draws its header.
  const rows = useMemo(() => familyRows(cards, WIDGET_GRID_COLUMNS), [cards]);
  const firstFamily: WidgetFamily | null = rows.length ? rows[0].family : null;
  const wallpaperUri = wallpaper.photoUri;
  // useWallpaperPalette renders its probe only while it samples the user's photo.
  const sampling = wallpaper.probe !== null;
  const renderRow: ListRenderItem<FamilyRow<WidgetTabCard>> = useCallback(
    ({ item }) => (
      <WidgetRow
        row={item.cards}
        family={item.family}
        first={item.first}
        firstSection={item.family === firstFamily}
        sampling={sampling}
        models={models}
        cardWidth={cardWidth}
        innerWidth={innerWidth}
        now={now}
        wallpaperUri={wallpaperUri}
        habits={widgetHabits}
        onOpen={onOpen}
        logHabit={logHabit}
        undoHabit={undoHabit}
        onGoals={onGoals}
      />), // i18n-ignore (code after a JSX element)
    [models, cardWidth, innerWidth, now, wallpaperUri, sampling, firstFamily, widgetHabits, onOpen, logHabit, undoHabit, onGoals],
  );

  const header = (
    <>
      <Pressable
        onPress={() => router.push('/pets')}
        accessibilityRole="button"
        accessibilityLabel={t('pets.title')}
        accessibilityHint={t('pets.intro')}
        style={[styles.pets, continuous, { backgroundColor: c.fill }]}
      >
        <IslandPetArt pet="cat" mood="happy" size={48} />
        <View style={styles.petsText}>
          <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[...label('headline'), { color: c.ink }]}>
            {t('pets.title')}
          </Text>
          <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...label('footnote'), { color: c.inkSecondary }]}>
            {t('pets.intro')}
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={c.inkSecondary} />
      </Pressable>
      <Text maxFontSizeMultiplier={fontScaleCap('footnote')} accessibilityRole="header" style={[...label('footnote'), styles.section, { color: c.inkSecondary }]}>
        {t('tabs.widgetsTab.themes')}
      </Text>
      <ScrollView bounces={false} overScrollMode="never" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
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
              <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...label('subhead'), styles.bold, { color: on ? c.onTint : c.ink }]} numberOfLines={1}>
                {x.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* T146: hidden unless a native iOS build answered the link check (never in Expo Go). */}
      {widgetLinkVisible(linkVerdict) ? (
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={t('tabs.widgetsTab.link.a11y', { status: t(LINK_KEYS[linkVerdict]) })}
          style={styles.link}
        >
          <Feather name={linkVerdict === 'ok' ? 'check-circle' : 'info'} size={14} color={linkVerdict === 'ok' ? c.ok : c.warn} style={styles.linkIcon} />
          <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...label('footnote'), styles.linkText, { color: c.inkSecondary }]}>
            {t(LINK_KEYS[linkVerdict])}
          </Text>
        </View>
      ) : null}

      <Text maxFontSizeMultiplier={fontScaleCap('footnote')} accessibilityRole="header" style={[...label('footnote'), styles.section, { color: c.inkSecondary }]}>
        {t('tabs.widgetsTab.looks')}
      </Text>
      <ScrollView bounces={false} overScrollMode="never"
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
              <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...label('subhead'), styles.bold, { color: on ? c.onTint : c.ink }]} numberOfLines={1}>
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
              <Text
                maxFontSizeMultiplier={fontScaleCap('footnote')}
                style={[...label('footnote'), styles.bold, styles.centre, { color: on ? c.ink : c.inkSecondary }]}
                numberOfLines={2}
              >
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {size === 'lock' ? (
        <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...label('footnote'), styles.note, { color: c.inkSecondary }]}>
          {t('tabs.widgetsTab.lockNote')}
        </Text>
      ) : null}

      {/* T166: the grid's top padding from before T162 (rows are list items now). T173: the first
          family's section header sits right under it (flushTop), so the gap stays ~16 pt. */}
      <View style={styles.gridTop} />
    </>); // i18n-ignore (code after a JSX element)

  return (
    <LargeTitleFlatList
      title={t('tabs.widgets')}
      subtitle={t('tabs.widgetsTab.subtitle')}
      header={header}
      data={rows}
      renderItem={renderRow}
      keyExtractor={rowKey}
      footer={wallpaper.probe ? <>{wallpaper.probe}</> : null}
    />
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: GUTTER, marginTop: spaceV2.sm, marginBottom: spaceV2.xs },
  chips: { paddingHorizontal: GUTTER, gap: spaceV2.sm, paddingBottom: spaceV2.md },
  chip: {
    minHeight: sizeV2.touch,
    paddingHorizontal: spaceV2.lg,
    borderRadius: chromeRadiusV2.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.sm,
  },
  // T146: link check line (icon + one or two lines of footnote text).
  link: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spaceV2.xs,
    paddingHorizontal: GUTTER,
    marginTop: -spaceV2.xs,
    marginBottom: spaceV2.sm,
  },
  linkIcon: { marginTop: spaceV2.xxs },
  linkText: { flex: 1 },
  bold: { fontWeight: '600' },
  centre: { textAlign: 'center' },
  sizes: {
    marginHorizontal: GUTTER,
    padding: spaceV2.xs,
    borderRadius: chromeRadiusV2.pill,
    flexDirection: 'row',
    gap: spaceV2.xs,
  },
  sizeTab: {
    flex: 1,
    minHeight: sizeV2.touch,
    borderRadius: chromeRadiusV2.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spaceV2.xs,
    // fb-1023 C: room for the size picture above the label.
    paddingVertical: spaceV2.xs,
    gap: spaceV2.xxs,
  },
  note: { paddingHorizontal: GUTTER, marginTop: spaceV2.md },
  // Pets entry card (T162: was an inline style object). T173: tokens only (spacing grid, card radius).
  pets: { margin: GUTTER, padding: spaceV2.lg, borderRadius: chromeRadiusV2.card, flexDirection: 'row', alignItems: 'center', gap: spaceV2.md },
  petsText: { flex: 1, gap: spaceV2.xs },
  // T91: one row of the grid; cells stretch to the tallest one. T162: rows are list items, so each
  // row carries the grid's side gutter and the gap below it.
  row: { flexDirection: 'row', alignItems: 'stretch', gap: GAP, paddingHorizontal: GUTTER, marginBottom: GAP },
  // T166: restores the ~16 pt gap above the first row that the pre-T162 grid had (paddingTop lg).
  gridTop: { height: spaceV2.lg },
  // T173: family section headers carry the grid's side gutter. After a row (which already leaves the
  // 16-pt card gap below it), the header adds the rest of the 32-pt editorial space above a section.
  sectionHeader: { paddingHorizontal: GUTTER },
  sectionAfterRow: { paddingTop: editorialV2.sectionTop - editorialV2.cardGap },
  cell: { gap: spaceV2.sm },
  // Pushes the log / goal rows to the bottom of a stretched cell, so neighbours' buttons line up.
  cellFill: { flexGrow: 1, marginTop: -spaceV2.sm },
  cardBody: { gap: spaceV2.sm },
  // ≥ 48 pt tall without relying on hitSlop; the log button, goal chip and empty slots share it.
  slot: { minHeight: sizeV2.touch },
  logButton: { minHeight: sizeV2.touch },
  caption: { gap: spaceV2.xxs },
  placeholder: {
    borderRadius: chromeRadiusV2.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: chromeRadiusV2.pill,
    paddingHorizontal: spaceV2.sm,
    paddingVertical: spaceV2.xxs,
  },
});
