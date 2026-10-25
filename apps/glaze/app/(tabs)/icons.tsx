// Icon Studio: pick apps, style the whole set, override single icons, preview live on a
// Home Screen mock, then install. Make-your-own icons are free: nothing here reads Plus.
// Design v2 (docs/DESIGN_V2.md §9, T56): collapsing large title, the live preview on a large
// squircle card on top, the app picker as inset-grouped rows with icon tiles and check
// accessories, style controls in inset groups, and a glass bar with the "Install icons" pill.

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, getById, support, type SupportStatus } from '../../src/core/catalogue';
import { getAnyTheme } from '../../src/core/plusThemes';
import { contrastWarnings, installMethodFor, previewMonogram, type IconShape, type IconSpec } from '../../src/core/iconspec';
import {
  GLYPH_PALETTE,
  GLYPH_SIZES,
  MY_APPS_CATEGORY,
  STYLE_PALETTE,
  addCustomApp,
  activeThemeKey,
  addPopularApps,
  backgroundBase,
  customisedAppIds,
  deleteCustomApp,
  findApp,
  makeBackground,
  pickerResults,
  removeApp,
  setStyle,
  toggleApp,
  type BackgroundKind,
  type PickerRow,
  type StudioState,
} from '../../src/core/studio';
import { IconCanvas } from '../../src/render/IconCanvas';
import { iconAccessibilityLabel } from '../../src/render/a11y';
import { studioSpecs, useStudio } from '../../src/store/studio';
import { listLayout, staggerIn, useMotionReduced } from '../../src/theme/motion';
import { continuous, iconTileRadius, radiusV2, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../../src/theme/tokensV2';
import { useColorsV2 } from '../../src/theme/useTokens';
import type { FeatherName } from '../../src/ui/featherName';
import { CustomisedBadge } from '../../src/ui/CustomisedBadge';
import { HomeMock } from '../../src/ui/HomeMock';
import { IconGridSkeleton } from '../../src/ui/Skeleton';
import { ContextTip } from '../../src/ui/ContextTip';
import { IconOverrideSheet, categoryName, colourName, customAppError, supportLabel } from '../../src/ui/IconOverrideSheet';
import { PressableScale } from '../../src/ui/PressableScale';
import { Segmented, type SegmentedOption } from '../../src/ui/Segmented';
import { Swatches, type Swatch } from '../../src/ui/Swatches';
import { haptic } from '../../src/ui/haptics';
import { Chevron, noMirror, textStyleFor } from '../../src/ui/i18nLayout';
import { GlassBar, InsetGroup, LargeTitle, LargeTitleHeader, PillButton, SquircleCard, SwitchInsetRow, useLargeTitleScroll } from '../../src/ui/v2';
import { useT, type MessageKey, type Script } from '../../src/i18n';

const RESULT_LIMIT = 60;

const SHAPE_OPTIONS = [
  { value: 'squircle', key: 'icons.shapes.squircle' },
  { value: 'circle', key: 'icons.shapes.circle' },
  { value: 'rounded', key: 'icons.shapes.rounded' },
  { value: 'square', key: 'icons.shapes.square' },
  { value: 'blob', key: 'icons.shapes.blob' },
] as const satisfies readonly { value: IconShape; key: MessageKey }[];

const BG_OPTIONS = [
  { value: 'solid', key: 'icons.backgrounds.solid' },
  { value: 'gradient', key: 'icons.backgrounds.gradient' },
  { value: 'glass', key: 'icons.backgrounds.glass' },
] as const satisfies readonly { value: BackgroundKind; key: MessageKey }[];

const SIZE_KEYS = {
  S: 'icons.sizes.small',
  M: 'icons.sizes.medium',
  L: 'icons.sizes.large',
} as const satisfies Record<'S' | 'M' | 'L', MessageKey>;

type SizeKey = (typeof GLYPH_SIZES)[number]['key'];

function nearestSize(scale: number): SizeKey {
  let best = GLYPH_SIZES[0];
  for (const g of GLYPH_SIZES) if (Math.abs(g.scale - scale) < Math.abs(best.scale - scale)) best = g;
  return best.key;
}

const selection = () => haptic('select');

/** Install support for a picker row (catalogue entries carry `verified`; user-added apps never do). */
function rowSupport(r: PickerRow): SupportStatus {
  const e = r.custom ? undefined : getById(r.id);
  return e ? support(e) : support({ urlScheme: r.urlScheme });
}

/** A v2 type role plus the script's line-height adjustment. */
function typeFor(script: Script, role: TypeRoleV2): TextStyle[] {
  return [textV2[role], textStyleFor(script, textV2[role])];
}

export default function IconsScreen() {
  const { c } = useColorsV2();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, script, isRTL } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => typeFor(script, role);
  const { width } = useWindowDimensions();
  const { scrollY, onScroll } = useLargeTitleScroll();
  const { state, update } = useStudio();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [customScheme, setCustomScheme] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  // Chips stagger in on the first loaded render only (POLISH rule 4); later adds/removes use the layout transition.
  const reduced = useMotionReduced();
  const staggered = useRef(false);
  const loaded = state !== null && state !== undefined;
  const animateIn = loaded && !staggered.current;
  useEffect(() => {
    if (loaded) staggered.current = true;
  }, [loaded]);

  const specs: IconSpec[] = useMemo(() => (state ? studioSpecs(state) : []), [state]);
  const results: PickerRow[] = useMemo(
    () => (state ? pickerResults(state, query, category, RESULT_LIMIT + 1) : []),
    [state, query, category],
  );
  const warnings = useMemo(() => contrastWarnings(specs), [specs]);

  if (!state) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <IconGridSkeleton count={8} />
        <Text style={[...ts('body'), { color: c.inkSecondary }]}>{t('icons.loading')}</Text>
      </View>
    );
  }

  const style = state.style;
  // Screen gutter and the card's own padding on both sides.
  const previewWidth = Math.min(width - spaceV2.lg * 4, 300);
  const count = specs.length;
  const selectedSet = new Set(state.selected);
  const editApp = editId ? findApp(state, editId) : null;
  const editSpec = editId ? specs.find((s) => s.appId === editId) ?? null : null;
  // Overrides are kept per theme: here they apply to the applied theme (or the user's own style).
  const themeKey = activeThemeKey(state);
  const themeName = getAnyTheme(state.themeId)?.name ?? t('icons.ownStyle');
  const customised = customisedAppIds(state, themeKey);

  const styleChange = (fn: (s: StudioState) => StudioState) =>
    update((s) => ({ ...fn(s), themeId: null }));

  const shapeOptions: SegmentedOption<IconShape>[] = SHAPE_OPTIONS.map((o) => ({
    value: o.value,
    label: t(o.key),
    accessibilityLabel: t('icons.shapeOption', { shape: t(o.key) }),
    preview: (
      <IconCanvas
        style={noMirror}
        spec={{ shape: o.value, background: style.background, glyph: 'star', glyphColour: style.glyphColour, glyphScale: 0.5 }}
        size={22}
      />
    ),
  }));

  const bgSwatches: Swatch[] = [
    ...(state.wallpaperColour ? [{ hex: state.wallpaperColour, name: t('icons.fromWallpaper'), icon: 'image' as const }] : []),
    ...STYLE_PALETTE.map((p) => ({ hex: p.hex, name: colourName(t, p.name) })),
  ];
  const glyphSwatches: Swatch[] = GLYPH_PALETTE.map((p) => ({ hex: p.hex, name: colourName(t, p.name) }));
  const bgOptions: SegmentedOption<BackgroundKind>[] = BG_OPTIONS.map((o) => ({ value: o.value, label: t(o.key) }));
  // Visible labels stay the compact S / M / L letters; the spoken label is translated.
  const sizeOptions: SegmentedOption<SizeKey>[] = GLYPH_SIZES.map((g) => ({
    value: g.key,
    label: g.key,
    accessibilityLabel: t('icons.sizeOption', { size: t(SIZE_KEYS[g.key]) }),
  }));

  const categoryChips: string[] = [...(state.customApps.length > 0 ? [MY_APPS_CATEGORY] : []), ...CATEGORIES];
  const warnNames = warnings
    .map((id) => specs.find((s) => s.appId === id)?.label)
    .filter((x): x is string => !!x);

  const onAddCustom = () => {
    const r = addCustomApp(state, { name: customName, urlScheme: customScheme });
    if (!r.ok) {
      setCustomError(customAppError(t, customName));
      haptic('warning');
      return;
    }
    const next = r.state;
    update(() => next);
    setCustomName('');
    setCustomScheme('');
    setCustomError(null);
    haptic('success');
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <Animated.ScrollView bounces={false} overScrollMode="never"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + sizeV2.navBar }]}
      >
        <LargeTitle title={t('icons.title')} subtitle={t('icons.intro')} scrollY={scrollY} />
        <ContextTip ids={['missing-app', 'icon-override']} style={styles.side} />

        {/* Preview: the live Home Screen stays on top. */}
        <SquircleCard size="large" elevation="raised" style={styles.side}>
          <View style={styles.previewWrap}>
            <HomeMock
              specs={specs}
              width={previewWidth}
              backgroundColour={state.wallpaperColour ?? undefined}
              customisedIds={customised}
            />
            <Text style={[...ts('footnote'), styles.centerText, { color: c.inkSecondary }]}>
              {state.wallpaperColour ? t('icons.previewWallpaper') : t('icons.previewNoWallpaper')}
            </Text>
          </View>
        </SquircleCard>

        {warnNames.length > 0 ? (
          <SquircleCard tone="butter" elevation="flat" style={styles.side}>
            <View style={styles.warn} accessibilityRole="alert">
              <Feather name="alert-triangle" size={18} color={c.pastels.butter.ink} />
              <Text style={[...ts('footnote'), styles.flex, { color: c.pastels.butter.ink }]}>
                {t('icons.contrastWarning', {
                  count: warnNames.length,
                  names: `${warnNames.slice(0, 5).join(', ')}${warnNames.length > 5 ? '…' : ''}`,
                })}
              </Text>
            </View>
          </SquircleCard>
        ) : null}

        {/* Your apps */}
        <SectionTitle>{t('icons.yourApps')}</SectionTitle>
        {count === 0 ? (
          <SquircleCard style={styles.side}>
            <View style={styles.empty}>
              <Feather name="grid" size={32} color={c.tint} />
              <Text style={[...ts('headline'), styles.centerText, { color: c.ink }]}>{t('icons.emptyTitle')}</Text>
              <Text style={[...ts('callout'), styles.centerText, { color: c.inkSecondary }]}>{t('icons.emptyBody')}</Text>
              <PillButton
                label={t('icons.addPopular')}
                icon="plus"
                onPress={() => {
                  selection();
                  update(addPopularApps);
                }}
                accessibilityHint={t('icons.addPopularHint')}
                style={styles.centerSelf}
              />
            </View>
          </SquircleCard>
        ) : (
          <InsetGroup footer={t('icons.editHelp', { theme: themeName })}>
            <View style={styles.chips}>
              {specs.map((s, i) => (
                <Animated.View
                  key={s.appId}
                  entering={animateIn ? staggerIn(i, reduced) : undefined}
                  layout={listLayout(reduced)}
                  style={[styles.chip, continuous, { backgroundColor: c.fill }]}
                >
                  <Pressable
                    onPress={() => {
                      selection();
                      setEditId(s.appId);
                    }}
                    onLongPress={() => {
                      haptic('warning');
                      update((st) => removeApp(st, s.appId));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t(customised.has(s.appId) ? 'icons.editLabelCustomised' : 'icons.editLabel', {
                      name: iconAccessibilityLabel(s),
                    })}
                    accessibilityHint={t('icons.removeHint')}
                    style={({ pressed }) => [styles.chipMain, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <View>
                      <IconCanvas spec={s} size={28} style={noMirror} />
                      {customised.has(s.appId) ? <CustomisedBadge size={9} /> : null}
                    </View>
                    <Text style={[...ts('subhead'), styles.chipLabel, { color: c.ink }]} numberOfLines={1}>
                      {s.label}
                    </Text>
                  </Pressable>
                  <SmallIconButton
                    icon="x"
                    accessibilityLabel={t('icons.removeLabel', { name: s.label })}
                    onPress={() => {
                      selection();
                      update((st) => removeApp(st, s.appId));
                    }}
                  />
                </Animated.View>
              ))}
            </View>
          </InsetGroup>
        )}

        {/* Add apps */}
        <SectionTitle>{t('icons.addApps')}</SectionTitle>
        <View style={[styles.search, styles.side, continuous, { backgroundColor: c.fill }]}>
          <Feather name="search" size={18} color={c.inkSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('icons.searchPlaceholder')}
            placeholderTextColor={c.inkSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            selectionColor={c.tint}
            accessibilityLabel={t('icons.searchPlaceholder')}
            style={[...ts('body'), styles.searchInput, { color: c.ink }]}
          />
          {query ? <SmallIconButton icon="x-circle" accessibilityLabel={t('icons.clearSearch')} onPress={() => setQuery('')} /> : null}
        </View>
        <ScrollView bounces={false} overScrollMode="never"
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
          accessibilityLabel={t('icons.categoriesLabel')}
        >
          {[null, ...categoryChips].map((cat) => {
            const active = category === cat;
            const name = cat ? categoryName(t, cat) : t('icons.categoryAll');
            return (
              <PressableScale
                key={cat ?? '*'}
                accessibilityRole="button"
                accessibilityLabel={t('icons.categoryLabel', { name })}
                accessibilityState={{ selected: active }}
                pressedScale={0.96}
                onPress={() => {
                  selection();
                  setCategory(cat);
                }}
                style={[styles.catChip, continuous, { backgroundColor: active ? c.tint : c.surface }]}
              >
                <Text style={[...ts('subhead'), styles.semibold, { color: active ? c.onTint : c.ink }]}>{name}</Text>
              </PressableScale>
            );
          })}
        </ScrollView>

        <InsetGroup footer={RESULT_LIMIT < results.length ? t('icons.showingFirst', { limit: RESULT_LIMIT }) : undefined}>
          {results.length === 0 ? (
            <View key="none" style={styles.emptySearch}>
              <Feather name="search" size={28} color={c.tint} />
              <Text style={[...ts('headline'), styles.centerText, { color: c.ink }]}>{t('icons.noMatchTitle')}</Text>
              <Text style={[...ts('callout'), styles.centerText, { color: c.inkSecondary }]}>{t('icons.noMatchBody')}</Text>
            </View>
          ) : null}
          {results.slice(0, RESULT_LIMIT).map((r) => {
            const on = selectedSet.has(r.id);
            const shortcuts = installMethodFor(r) === 'shortcuts';
            const status = rowSupport(r);
            return (
              <TiledRow key={r.id} icon style={styles.pickRow}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={t('icons.rowLabel', {
                    name: r.name,
                    status: supportLabel(t, shortcuts ? 'shortcuts' : status),
                  })}
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    selection();
                    update((st) => toggleApp(st, r.id));
                  }}
                  style={({ pressed }) => [styles.pickMain, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <IconCanvas
                    spec={{
                      appId: r.id,
                      shape: style.shape,
                      background: style.background,
                      glyph: r.glyph,
                      glyphSet: style.glyphSet,
                      glyphColour: style.glyphColour,
                      glyphScale: style.glyphScale,
                      monogram: previewMonogram(r.name, r.glyph, style),
                    }}
                    size={sizeV2.rowIcon}
                    style={noMirror}
                  />
                  <View style={styles.flex}>
                    <Text style={[...ts('body'), { color: c.ink }]} numberOfLines={1}>
                      {r.name}
                    </Text>
                    <View style={styles.metaRow}>
                      <Text style={[...ts('footnote'), styles.shrink, { color: c.inkSecondary }]}>
                        {categoryName(t, r.category)}
                      </Text>
                      {status !== 'verified' ? (
                        <View
                          style={[styles.supportBadge, continuous, { backgroundColor: shortcuts ? c.tintSoft : c.fill }]}
                        >
                          <Text style={[...ts('caption1'), { color: shortcuts ? c.onTintSoft : c.inkSecondary }]}>
                            {supportLabel(t, status)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Feather name={on ? 'check-circle' : 'circle'} size={24} color={on ? c.tint : c.inkTertiary} />
                </Pressable>
                {r.custom ? (
                  <SmallIconButton
                    icon="trash-2"
                    accessibilityLabel={t('icons.deleteCustomLabel', { name: r.name })}
                    onPress={() => {
                      haptic('warning');
                      update((st) => deleteCustomApp(st, r.id));
                    }}
                  />
                ) : null}
              </TiledRow>
            );
          })}
          <TiledRow key="missing" icon>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('icons.missingLabel')}
            onPress={() => {
              selection();
              router.push({ pathname: '/add-app', params: query.trim() ? { q: query.trim() } : {} });
            }}
            style={({ pressed }) => [styles.missingRow, { opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={[styles.tile, continuous, { backgroundColor: c.tintSoft }]}>
              <Feather name="plus" size={17} color={c.onTintSoft} />
            </View>
            <View style={styles.flex}>
              <Text style={[...ts('body'), { color: c.tint }]}>{t('icons.missingTitle')}</Text>
              <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('icons.missingBody')}</Text>
            </View>
            <Feather name={Chevron.forward(isRTL)} size={18} color={c.inkTertiary} />
          </Pressable>
          </TiledRow>
        </InsetGroup>

        {/* Custom app: fields as inset rows with inline inputs. */}
        <InsetGroup header={t('icons.customTitle')} footer={t('icons.schemeNote')}>
          <View style={styles.fieldRow}>
            <TextInput
              value={customName}
              onChangeText={(v) => {
                setCustomName(v);
                setCustomError(null);
              }}
              placeholder={t('icons.appName')}
              placeholderTextColor={c.inkSecondary}
              selectionColor={c.tint}
              accessibilityLabel={t('icons.appName')}
              returnKeyType="next"
              style={[...ts('body'), styles.input, { color: c.ink }]}
            />
          </View>
          <View style={styles.fieldRow}>
            <TextInput
              value={customScheme}
              onChangeText={(v) => {
                setCustomScheme(v);
                setCustomError(null);
              }}
              placeholder={t('icons.schemePlaceholder', { example: 'myapp://' })}
              placeholderTextColor={c.inkSecondary}
              selectionColor={c.tint}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t('icons.schemeLabel')}
              accessibilityHint={t('icons.schemeHint')}
              returnKeyType="done"
              onSubmitEditing={onAddCustom}
              style={[...ts('body'), styles.input, { color: c.ink }]}
            />
          </View>
        </InsetGroup>
        <View style={[styles.side, styles.formEnd]}>
          {customError ? (
            <Text style={[...ts('footnote'), { color: c.warn }]} accessibilityRole="alert">
              {customError}
            </Text>
          ) : null}
          <PillButton
            label={t('icons.addApp')}
            icon="plus"
            variant="tinted"
            size="small"
            haptic={false}
            onPress={onAddCustom}
            disabled={!customName.trim()}
          />
        </View>

        {/* Style */}
        <SectionTitle>{t('icons.styleTitle')}</SectionTitle>
        <InsetGroup header={t('icons.shape')}>
          <View style={styles.block}>
            <Segmented
              vertical
              label={t('icons.shapeLabel')}
              options={shapeOptions}
              value={style.shape}
              onChange={(shape) => styleChange((s) => setStyle(s, { shape }))}
            />
          </View>
        </InsetGroup>

        <InsetGroup header={t('icons.background')}>
          <View style={styles.block}>
            <Segmented
              label={t('icons.backgroundType')}
              options={bgOptions}
              value={style.background.kind}
              onChange={(kind) =>
                styleChange((s) =>
                  setStyle(s, { background: makeBackground(kind, backgroundBase(s.style.background), s.style.background) }),
                )
              }
            />
          </View>
          <View style={styles.block}>
            <Swatches
              label={t('icons.backgroundColour')}
              swatches={bgSwatches}
              value={backgroundBase(style.background)}
              onChange={(hex) =>
                styleChange((s) =>
                  setStyle(s, { background: makeBackground(s.style.background.kind, hex, s.style.background) }),
                )
              }
            />
          </View>
        </InsetGroup>

        <InsetGroup header={t('icons.symbolColour')}>
          <View style={styles.block}>
            <Swatches
              label={t('icons.symbolColour')}
              swatches={glyphSwatches}
              value={style.glyphColour}
              onChange={(hex) => styleChange((s) => setStyle(s, { glyphColour: hex }))}
            />
          </View>
        </InsetGroup>

        <InsetGroup header={t('icons.symbolSize')}>
          <View style={styles.block}>
            <Segmented
              label={t('icons.symbolSize')}
              options={sizeOptions}
              value={nearestSize(style.glyphScale)}
              onChange={(key) => {
                const g = GLYPH_SIZES.find((x) => x.key === key);
                if (g) styleChange((s) => setStyle(s, { glyphScale: g.scale }));
              }}
            />
          </View>
        </InsetGroup>

        {/* Whole row is the ≥ 48 pt target (a bare Switch is only 31 pt tall). */}
        <InsetGroup footer={t('icons.labelsNote')}>
          <SwitchInsetRow
            label={t('icons.showLabels')}
            accessibilityLabel={t('icons.showLabelsA11y')}
            value={style.showLabel}
            onChange={(v) => {
              selection();
              styleChange((s) => setStyle(s, { showLabel: v }));
            }}
          />
        </InsetGroup>
      </Animated.ScrollView>

      <LargeTitleHeader title={t('icons.title')} scrollY={scrollY} />

      {/* Sticky CTA on the bar glass, above the tab bar. */}
      <GlassBar material="bar" hairline="top">
        <View style={styles.cta}>
          <PillButton
            label={count === 0 ? t('icons.install') : t('icons.installCount', { count })}
            icon="download"
            block
            disabled={count === 0}
            onPress={() => {
              haptic('select');
              router.push('/install');
            }}
            accessibilityHint={count === 0 ? t('icons.installHintEmpty') : t('icons.installHint')}
          />
        </View>
      </GlassBar>

      <IconOverrideSheet
        visible={editId !== null && editApp !== null}
        onClose={() => setEditId(null)}
        app={editApp}
        spec={editSpec}
        state={state}
        update={update}
        themeKey={themeKey}
        themeName={themeName}
        wallpaperColour={state.wallpaperColour}
      />
    </View>
  );
}

/** Section heading between groups (title3, a screen-reader header). */
function SectionTitle({ children }: { children?: ReactNode }) {
  const { c } = useColorsV2();
  const { script } = useT();
  return (
    <Text accessibilityRole="header" style={[...typeFor(script, 'title3'), styles.sectionTitle, { color: c.ink }]}>
      {children}
    </Text>
  );
}

/**
 * Plain row container inside an InsetGroup. `icon` is read by InsetGroup (row.props.icon) so the
 * separator starts after the 30 pt tile, like an InsetRow with an icon.
 */
function TiledRow({ children, style }: { icon?: boolean; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={style}>{children}</View>;
}

/** 48 pt icon-only button in the secondary ink (chip remove, clear search, delete). */
function SmallIconButton({ icon, onPress, accessibilityLabel }: { icon: FeatherName; onPress: () => void; accessibilityLabel: string }) {
  const { c } = useColorsV2();
  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.iconBtn}
    >
      <Feather name={icon} size={18} color={c.inkSecondary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: spaceV2.md },
  scroll: { gap: spaceV2.lg, paddingBottom: spaceV2.xxl },
  side: { marginHorizontal: spaceV2.lg },
  sectionTitle: { paddingHorizontal: spaceV2.inset, marginTop: spaceV2.sm },
  centerText: { textAlign: 'center' },
  centerSelf: { alignSelf: 'center' },
  semibold: { fontWeight: '600' },
  previewWrap: { alignItems: 'center', gap: spaceV2.sm },
  warn: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  empty: { padding: spaceV2.sm, alignItems: 'center', gap: spaceV2.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.sm, padding: spaceV2.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radiusV2.pill,
    paddingStart: spaceV2.sm,
    minHeight: sizeV2.touch,
  },
  chipMain: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm, minHeight: sizeV2.touch },
  chipLabel: { maxWidth: 120 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radiusV2.pill,
    paddingStart: spaceV2.lg,
    minHeight: sizeV2.touch,
    gap: spaceV2.sm,
  },
  searchInput: { flex: 1, minHeight: sizeV2.touch, paddingVertical: spaceV2.sm },
  catRow: { gap: spaceV2.sm, paddingVertical: spaceV2.xs, paddingHorizontal: spaceV2.lg },
  catChip: {
    minHeight: sizeV2.touch,
    justifyContent: 'center',
    paddingHorizontal: spaceV2.lg,
    borderRadius: radiusV2.pill,
  },
  pickRow: { flexDirection: 'row', alignItems: 'center', minHeight: sizeV2.rowMin, paddingEnd: spaceV2.xs },
  pickMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.md,
    paddingVertical: spaceV2.sm,
    paddingStart: spaceV2.lg,
    paddingEnd: spaceV2.md,
    minHeight: sizeV2.rowMin,
  },
  flex: { flex: 1, flexShrink: 1, gap: spaceV2.xxs },
  shrink: { flexShrink: 1 },
  tile: {
    width: sizeV2.rowIcon,
    height: sizeV2.rowIcon,
    borderRadius: iconTileRadius(sizeV2.rowIcon),
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.md,
    minHeight: sizeV2.rowMin,
    paddingVertical: spaceV2.sm + spaceV2.xxs,
    paddingHorizontal: spaceV2.lg,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.xs },
  supportBadge: {
    borderRadius: radiusV2.pill,
    paddingHorizontal: spaceV2.sm,
    paddingVertical: spaceV2.xxs,
    flexShrink: 0,
  },
  emptySearch: { alignItems: 'center', gap: spaceV2.xs, paddingVertical: spaceV2.lg, paddingHorizontal: spaceV2.lg },
  fieldRow: { minHeight: sizeV2.rowMin, paddingHorizontal: spaceV2.lg, justifyContent: 'center' },
  input: { minHeight: sizeV2.touch, paddingVertical: spaceV2.sm },
  formEnd: { gap: spaceV2.sm, alignItems: 'flex-end' },
  block: { paddingHorizontal: spaceV2.lg, paddingVertical: spaceV2.md, gap: spaceV2.sm },
  iconBtn: { width: sizeV2.touch, height: sizeV2.touch, alignItems: 'center', justifyContent: 'center' },
  cta: { paddingHorizontal: spaceV2.inset, paddingVertical: spaceV2.md },
});
