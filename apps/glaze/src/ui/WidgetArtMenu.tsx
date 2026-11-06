// Read-only previews of a theme's widget art, in shelf order.
import { Image as ExpoImage } from 'expo-image';
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
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
import { fullBleedArt, menuCaptionLayout, wallpaperUnderSlot } from '../core/widgetPreview';
import { previewBlendFor, type PreviewBlend } from '../core/artBlend';
import { useT } from '../i18n';
import { chromeRadiusV2, continuous, fontScaleCap, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { BlendedArt } from './BlendedArt';
import { textStyleFor } from './i18nLayout';
import { SectionHeader } from './SectionHeader';

type LooseT = (key: string, params?: Record<string, string | number>) => string;

export type ArtSource = number | { uri: string };
/** One option and the image that draws it (bundled module or downloaded file). */
export type MenuOption = { option: WidgetOption; source: ArtSource };

const COLUMN_GAP = spaceV2.md;

/** The theme wallpaper and the seamless crop the bridge would cut for the chosen size. */
export type MenuWallpaper = { source: ArtSource; px: Box; crop: Rect };

type CardProps = {
  item: MenuOption;
  size: HomeOptionSize;
  width: number;
  /** The menu name (optionName: the same in every size). */
  name: string;
  themeColour: string;
  wallpaper: MenuWallpaper | null;
  /** T251: how the art blends (src/core/artBlend.ts previewBlendFor). */
  blend: PreviewBlend;
};

const OptionCard = memo(function OptionCard({ item, size, width, name, themeColour, wallpaper, blend }: CardProps) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const { option, source } = item;
  const preserveArtwork = option.numberFree === true && !!option.liveFrame && (option.kind === 'clock' && !!option.liveFrame.clockStyle || !!option.liveFrame.valueStyle);
  const box = OPTION_SIZE_POINTS[size];
  const w = Math.max(1, width);
  const h = Math.max(1, Math.round((w * box.h) / box.w));
  // T251 (owner-1101h #2): every option is composed like the phone now does it: the wallpaper crop
  // under the widget's slot with the art inset on it (placeArt, like setSeamless), or, for a theme
  // without a wallpaper, the theme colour with the art full bleed (fullBleedArt, like setWidgetArt).
  // The art is blended (BlendedArt: keyed / feathered), never on a blurred copy of itself.
  const wall = wallpaper && !preserveArtwork ? wallpaperUnderSlot(wallpaper.px, wallpaper.crop, { w, h }) : null;
  const place = wall
    ? placeArt({ w: option.width, h: option.height }, { w, h }, option.fit)
    : { rect: fullBleedArt({ w: option.width, h: option.height }, { w, h }).rect };
  const caption = menuCaptionLayout(size);
  // T206: a picture with fixed numbers (fixedValues) is art: no "Live" badge.
  const live = showsLiveBadge(option);
  const label = (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];
  // T276: ImageStyle, not ViewStyle: it styles an expo-image (StyleProp<ImageStyle>).
  const wallStyle: StyleProp<ImageStyle> = wall ? { position: 'absolute', left: wall.x, top: wall.y, width: wall.w, height: wall.h } : null;
  return (
    <View style={[styles.card, { width }]}>
      <View style={[styles.preview, continuous, { width: w, height: h, backgroundColor: themeColour }]}>
        {/* The whole wallpaper at the crop's scale and offset: the clipped card shows only the crop. */}
        {wall && wallpaper ? <ExpoImage source={wallpaper.source} style={wallStyle} contentFit="fill" cachePolicy="memory-disk" transition={0} /> : null}
        {/* The art itself: always whole (contain inside its fitted rectangle), blended (T251). */}
        {preserveArtwork ? (
          <ExpoImage source={source} style={{ position:'absolute',left:place.rect.x,top:place.rect.y,width:place.rect.w,height:place.rect.h }} contentFit="contain" cachePolicy="memory-disk" transition={0} />
        ) : <BlendedArt source={source} rect={place.rect} blend={blend} assetPath={option.image} />}
      </View>
      <View style={caption.stacked ? styles.captionStacked : styles.caption}>
        <Text
          maxFontSizeMultiplier={fontScaleCap('subhead')}
          style={[...label('subhead'), styles.bold, styles.name, { color: c.ink }]}
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
    </View>
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
  style?: StyleProp<ViewStyle>;
};

/** The menu: one header, then a section per kind with its grid. Renders nothing when there is no option. */
export function WidgetArtMenu({ options, size, width, themeColour, wallpaper, themeId = '', artTransparent = false, style }: Props) {
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
      <SectionHeader eyebrow={t('tabs.widgetsTab.art.eyebrow')} title={t('tabs.widgetsTab.art.title')} flushTop />
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
                  themeColour={themeColour}
                  wallpaper={wallpaper}
                  blend={previewBlendFor(themeId, o.id, artTransparent)}
                />
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spaceV2.sm, marginBottom: spaceV2.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: COLUMN_GAP },
  card: { gap: spaceV2.sm },
  preview: { borderRadius: chromeRadiusV2.card, overflow: 'hidden' },
  caption: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm, paddingHorizontal: spaceV2.xs },
  captionStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: spaceV2.xxs, paddingHorizontal: spaceV2.xs },
  name: { flexShrink: 1 },
  bold: { fontWeight: '600' },
  badge: { borderRadius: chromeRadiusV2.pill, paddingHorizontal: spaceV2.sm, paddingVertical: spaceV2.xxs },
  badgeStacked: { alignSelf: 'flex-start' },
});
