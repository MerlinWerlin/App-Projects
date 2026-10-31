// T187 (owner-1101 #5): the theme's widget art menu on the Widgets tab. Every widget option of the
// theme (pack v2 `widgets`, or derived from v1: src/core/widgetOptions.ts) for the chosen size, as a
// grid of large rounded previews grouped under a header per kind, with a clear selected state (tint
// ring + check badge, accessibilityState.selected). Art is FITTED inside each preview, never cropped
// (placeArt), over its background: the theme colour, a blurred copy of the art, or the wallpaper.
// Only tokens for chrome; the theme colour and the art are theme data. No motion. Works in Expo Go
// (expo-image is already used across the app).
import { Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { memo, useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  OPTION_SIZE_POINTS,
  liveKindOf,
  placeArt,
  widgetOptionKindKey,
  widgetOptionSections,
  type HomeOptionSize,
  type WidgetOption,
} from '../core/widgetOptions';
import { widgetTabSizeKey } from '../core/tabNav';
import { useT } from '../i18n';
import { chromeRadiusV2, circleRadius, continuous, fontScaleCap, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { textStyleFor } from './i18nLayout';
import { SectionHeader } from './SectionHeader';

type LooseT = (key: string, params?: Record<string, string | number>) => string;

export type ArtSource = number | { uri: string };
/** One option and the image that draws it (bundled module or downloaded file). */
export type MenuOption = { option: WidgetOption; source: ArtSource };

const COLUMN_GAP = spaceV2.md;
/** Selected ring width (points). */
const RING = 3;
const CHECK = 26;

type CardProps = {
  item: MenuOption;
  size: HomeOptionSize;
  width: number;
  index: number;
  selected: boolean;
  themeColour: string;
  wallpaper: ArtSource | null;
  onSelect: (id: string) => void;
};

const OptionCard = memo(function OptionCard({ item, size, width, index, selected, themeColour, wallpaper, onSelect }: CardProps) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const tl = t as unknown as LooseT;
  const { option, source } = item;
  const box = OPTION_SIZE_POINTS[size];
  const w = Math.max(1, width - RING * 4);
  const h = Math.max(1, Math.round((w * box.h) / box.w));
  const place = placeArt({ w: option.width, h: option.height }, { w, h }, option.fit);
  const name = option.label ?? tl('tabs.widgetsTab.art.numbered', { n: index + 1 });
  const live = liveKindOf(option.kind) !== null;
  const sizeName = tl(widgetTabSizeKey(size));
  const label = (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];
  // Background only (it may be cut at the edges): a blurred copy of the art, or the wallpaper.
  const backdrop: ArtSource | null = option.background === 'blur' ? source : option.background === 'wallpaper' ? wallpaper : null;
  const blur = option.background === 'blur' ? 24 : 0;
  const artStyle: StyleProp<ViewStyle> = useMemo(
    () => ({ position: 'absolute', left: place.rect.x, top: place.rect.y, width: place.rect.w, height: place.rect.h }),
    [place.rect.x, place.rect.y, place.rect.w, place.rect.h],
  );
  return (
    <Pressable
      onPress={() => onSelect(option.id)}
      accessibilityRole="button"
      accessibilityLabel={tl('tabs.widgetsTab.art.optionA11y', { name, size: sizeName })}
      accessibilityHint={live ? t('tabs.widgetsTab.art.liveHint') : undefined}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.card, { width, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.ring, continuous, { borderColor: selected ? c.tint : 'transparent' }]}>
        <View style={[styles.preview, continuous, { width: w, height: h, backgroundColor: themeColour }]}>
          {backdrop ? <ExpoImage source={backdrop} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={blur} cachePolicy="memory-disk" transition={0} /> : null}
          {/* The art itself: always whole (contain inside its fitted rectangle). */}
          <ExpoImage source={source} style={artStyle} contentFit="contain" cachePolicy="memory-disk" transition={0} />
          {selected ? (
            <View style={[styles.check, { backgroundColor: c.tint }]}>
              <Feather name="check" size={16} color={c.onTint} />
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.caption}>
        <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...label('subhead'), styles.bold, { color: selected ? c.tint : c.ink }]} numberOfLines={1}>
          {name}
        </Text>
        {live ? (
          <View style={[styles.badge, { backgroundColor: c.tintSoft }]}>
            <Text maxFontSizeMultiplier={fontScaleCap('caption2')} style={[...label('caption2'), { color: c.onTintSoft }]} numberOfLines={1}>
              {t('tabs.widgetsTab.art.live')}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

type Props = {
  options: readonly MenuOption[];
  size: HomeOptionSize;
  /** Width available for the grid (inside the side gutters). */
  width: number;
  /** The theme's own background colour (#RRGGBB), behind fitted art. */
  themeColour: string;
  /** The theme wallpaper, for options whose background is the wallpaper (seamless). */
  wallpaper: ArtSource | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Extra content under the grid (the Use button and status line). */
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** The menu: one header, then a section per kind with its grid. Renders nothing when there is no option. */
export function WidgetArtMenu({ options, size, width, themeColour, wallpaper, selectedId, onSelect, footer, style }: Props) {
  const { t } = useT();
  const tl = t as unknown as LooseT;
  const bySource = useMemo(() => new Map(options.map((o) => [o.option.id, o] as const)), [options]);
  const sections = useMemo(() => widgetOptionSections(options.map((o) => o.option), size), [options, size]);
  if (sections.length === 0) return null;
  const columns = size === 'small' ? 2 : 1;
  const cardWidth = Math.max(120, Math.floor((width - COLUMN_GAP * (columns - 1)) / columns));
  let n = 0;
  const kindHeaders = sections.length !== 1 || sections[0].kind !== 'art';
  return (
    <View style={style}>
      <SectionHeader eyebrow={t('tabs.widgetsTab.art.eyebrow')} title={t('tabs.widgetsTab.art.title')} body={t('tabs.widgetsTab.art.body')} flushTop />
      {sections.map((s) => (
        <View key={s.kind} style={styles.section}>
          {kindHeaders ? <SectionHeader level="group" title={tl(widgetOptionKindKey(s.kind))} flushTop={s === sections[0]} /> : null}
          <View style={styles.grid}>
            {s.options.map((o) => {
              const item = bySource.get(o.id);
              if (!item) return null;
              const index = n++;
              return (
                <OptionCard
                  key={o.id}
                  item={item}
                  size={size}
                  width={cardWidth}
                  index={index}
                  selected={o.id === selectedId}
                  themeColour={themeColour}
                  wallpaper={wallpaper}
                  onSelect={onSelect}
                />
              );
            })}
          </View>
        </View>
      ))}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spaceV2.sm, marginBottom: spaceV2.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: COLUMN_GAP },
  card: { gap: spaceV2.sm, minHeight: sizeV2.touch },
  ring: { borderWidth: RING, borderRadius: chromeRadiusV2.card + RING * 2, padding: RING },
  preview: { borderRadius: chromeRadiusV2.card, overflow: 'hidden' },
  check: {
    position: 'absolute',
    top: spaceV2.sm,
    end: spaceV2.sm,
    width: CHECK,
    height: CHECK,
    borderRadius: circleRadius(CHECK),
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm, paddingHorizontal: spaceV2.xs },
  bold: { fontWeight: '600' },
  badge: { borderRadius: chromeRadiusV2.pill, paddingHorizontal: spaceV2.sm, paddingVertical: spaceV2.xxs },
});
