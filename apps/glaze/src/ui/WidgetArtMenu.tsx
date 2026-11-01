// T187 (owner-1101 #5): the theme's widget art menu on the Widgets tab. Every widget option of the
// theme (pack v2 `widgets`, or derived from v1: src/core/widgetOptions.ts) for the chosen size, as a
// grid of large rounded previews grouped under a header per kind, with a clear selected state (tint
// ring + check badge, accessibilityState.selected). Art is FITTED inside each preview, never cropped
// (placeArt), over its background: the theme colour, a blurred copy of the art, or the wallpaper.
// T201 (owner-1101d #4): sections come in shelf order (src/core/widgetOptions.ts widgetShelf): the
// practical kinds (habits, countdown, calendar, date, clock, battery…) first, then plain art; every
// piece is offered in every Home Screen size (fitted).
// T207: names are stable per piece (optionName since T209), and a
// small card stacks the "Live" badge under a two-line name (menuCaptionLayout) so long names fit.
// T208: the backgrounds mimic the native compositor (src/core/widgetPreview.ts): the wallpaper is
// the seamless CROP under the widget's slot (wallpaperUnderSlot), the blurred art uses the bridge's
// CIGaussianBlur radius scaled to the card (blurBackdrop).
// T251 (owner-1101h #2) replaces the T208/T236 blurred backdrop: every option shows the wallpaper crop
// with the art BLENDED on it (BlendedArt; src/core/artBlend.ts), no blurred copy, no frame, no box.
// History, T236 (owner-1101g #1): "theme" / "blur" previews were full bleed like the bridge (fullBleedArt):
// the art whole with no inset, the strips beside it filled by a blurred copy of the art (its own
// edges extended), no veil, so the card never shows a light frame. "wallpaper" is unchanged.
// T209/T206: names come from optionName (the same in every size); a picture with fixed numbers
// (fixedValues: '29 THU OCT', '14 DAYS', '3/5'…) sits with the art and has no "Live" badge.
// T237 (owner-1101g #2): a card is either "Live" (the widget shows a real value: a liveArt piece
// or one with a live counterpart) or "Art", so no picture pretends to work.
// Only tokens for chrome; the theme colour and the art are theme data. No motion. Works in Expo Go
// (expo-image is already used across the app).
import { Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { memo, useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  OPTION_SIZE_POINTS,
  optionName,
  placeArt,
  showsLiveBadge,
  widgetOptionKindKey,
  widgetOptionSections,
  type Box,
  type HomeOptionSize,
  type Rect,
  type WidgetOption,
} from '../core/widgetOptions';
import { widgetTabSizeKey } from '../core/tabNav';
import { fullBleedArt, menuCaptionLayout, wallpaperUnderSlot } from '../core/widgetPreview';
import { previewBlendFor, type PreviewBlend } from '../core/artBlend';
import { useT } from '../i18n';
import { chromeRadiusV2, circleRadius, continuous, fontScaleCap, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { BlendedArt } from './BlendedArt';
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

/** The theme wallpaper and the seamless crop the bridge would cut for the chosen size. */
export type MenuWallpaper = { source: ArtSource; px: Box; crop: Rect };

type CardProps = {
  item: MenuOption;
  size: HomeOptionSize;
  width: number;
  /** The menu name (optionName: the same in every size). */
  name: string;
  selected: boolean;
  themeColour: string;
  wallpaper: MenuWallpaper | null;
  /** T251: how the art blends (src/core/artBlend.ts previewBlendFor). */
  blend: PreviewBlend;
  onSelect: (id: string) => void;
};

const OptionCard = memo(function OptionCard({ item, size, width, name, selected, themeColour, wallpaper, blend, onSelect }: CardProps) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const tl = t as unknown as LooseT;
  const { option, source } = item;
  const box = OPTION_SIZE_POINTS[size];
  const w = Math.max(1, width - RING * 4);
  const h = Math.max(1, Math.round((w * box.h) / box.w));
  // T251 (owner-1101h #2): every option is composed like the phone now does it: the wallpaper crop
  // under the widget's slot with the art inset on it (placeArt, like setSeamless), or, for a theme
  // without a wallpaper, the theme colour with the art full bleed (fullBleedArt, like setWidgetArt).
  // The art is blended (BlendedArt: keyed / feathered), never on a blurred copy of itself.
  const wall = wallpaper ? wallpaperUnderSlot(wallpaper.px, wallpaper.crop, { w, h }) : null;
  const place = wall
    ? placeArt({ w: option.width, h: option.height }, { w, h }, option.fit)
    : { rect: fullBleedArt({ w: option.width, h: option.height }, { w, h }).rect };
  const caption = menuCaptionLayout(size);
  // T206: a picture with fixed numbers (fixedValues) is art: no "Live" badge.
  const live = showsLiveBadge(option);
  const sizeName = tl(widgetTabSizeKey(size));
  const label = (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];
  const wallStyle: StyleProp<ViewStyle> = wall ? { position: 'absolute', left: wall.x, top: wall.y, width: wall.w, height: wall.h } : null;
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
          {/* The whole wallpaper at the crop's scale and offset: the clipped card shows only the crop. */}
          {wall && wallpaper ? <ExpoImage source={wallpaper.source} style={wallStyle} contentFit="fill" cachePolicy="memory-disk" transition={0} /> : null}
          {/* The art itself: always whole (contain inside its fitted rectangle), blended (T251). */}
          <BlendedArt source={source} rect={place.rect} blend={blend} />
          {selected ? (
            <View style={[styles.check, { backgroundColor: c.tint }]}>
              <Feather name="check" size={16} color={c.onTint} />
            </View>
          ) : null}
        </View>
      </View>
      <View style={caption.stacked ? styles.captionStacked : styles.caption}>
        <Text
          maxFontSizeMultiplier={fontScaleCap('subhead')}
          style={[...label('subhead'), styles.bold, styles.name, { color: selected ? c.tint : c.ink }]}
          numberOfLines={caption.nameLines}
        >
          {name}
        </Text>
        {live ? (
          <View style={[styles.badge, caption.stacked ? styles.badgeStacked : null, { backgroundColor: c.tintSoft }]}>
            <Text maxFontSizeMultiplier={fontScaleCap('caption2')} style={[...label('caption2'), { color: c.onTintSoft }]} numberOfLines={1}>
              {t('tabs.widgetsTab.art.live')}
            </Text>
          </View>
        ) : (
          <View style={[styles.badge, caption.stacked ? styles.badgeStacked : null, { backgroundColor: c.fill }]}>
            <Text maxFontSizeMultiplier={fontScaleCap('caption2')} style={[...label('caption2'), { color: c.inkSecondary }]} numberOfLines={1}>
              {t('tabs.widgetsTab.art.artBadge')}
            </Text>
          </View>
        )}
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
  /** The theme wallpaper and its seamless crop for `size`: since T251 behind EVERY option (art blends with it). */
  wallpaper: MenuWallpaper | null;
  /** T251: the theme id (measured production pieces, KNOWN_ART_BLEND) and whether its art is already transparent (bundled heroes). */
  themeId?: string;
  artTransparent?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Extra content under the grid (the Use button and status line). */
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** The menu: one header, then a section per kind with its grid. Renders nothing when there is no option. */
export function WidgetArtMenu({ options, size, width, themeColour, wallpaper, themeId = '', artTransparent = false, selectedId, onSelect, footer, style }: Props) {
  const { t } = useT();
  const tl = t as unknown as LooseT;
  const bySource = useMemo(() => new Map(options.map((o) => [o.option.id, o] as const)), [options]);
  const all = useMemo(() => options.map((o) => o.option), [options]);
  const sections = useMemo(() => widgetOptionSections(all, size), [all, size]);
  if (sections.length === 0) return null;
  const columns = size === 'small' ? 2 : 1;
  const cardWidth = Math.max(120, Math.floor((width - COLUMN_GAP * (columns - 1)) / columns));
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
              const nm = optionName(o, all);
              return (
                <OptionCard
                  key={o.id}
                  item={item}
                  size={size}
                  width={cardWidth}
                  name={'text' in nm ? nm.text : tl(nm.key, nm.params)}
                  selected={o.id === selectedId}
                  themeColour={themeColour}
                  wallpaper={wallpaper}
                  blend={previewBlendFor(themeId, o.id, artTransparent)}
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
  captionStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: spaceV2.xxs, paddingHorizontal: spaceV2.xs },
  name: { flexShrink: 1 },
  bold: { fontWeight: '600' },
  badge: { borderRadius: chromeRadiusV2.pill, paddingHorizontal: spaceV2.sm, paddingVertical: spaceV2.xxs },
  badgeStacked: { alignSelf: 'flex-start' },
});
