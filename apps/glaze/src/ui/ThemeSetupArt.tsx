// ThemeSetupArt (T265, owner-1101i #1): small ORIGINAL redrawn mocks for the guided "Use this
// theme" flow (src/ui/ThemeSetupFlow.tsx): the Photos share sheet with "Use as Wallpaper", the
// wallpaper preview with Add, the Home Screen choice with Blur OFF, the Home Screen + App Library,
// the Home Screen in edit mode with Edit, the widget gallery with Glaze, and the Edit Widget sheet
// with the Art row. Plain Views/Text/Feather glyphs in v2 tokens with placeholder content only:
// no images, no screenshots, no Apple logos or brand marks. The profile-install steps reuse
// src/ui/ProfileGuideArt.tsx. The thing to tap sits inside a tint ring; each mock is one image to
// screen readers, with a label.

import { Feather } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useT } from '../i18n';
import {
  circleRadius,
  continuous,
  fontScaleCap,
  iconTileRadius,
  radiusV2,
  spaceV2,
  textV2,
  type PaletteV2,
  type TypeRoleV2,
} from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { Chevron, textStyleFor } from './i18nLayout';

export type SetupArtKind =
  | 'photos-share'
  | 'wallpaper-add'
  | 'home-blur'
  | 'home-library'
  | 'jiggle-edit'
  | 'widget-gallery'
  | 'edit-widget';

type FeatherName = ComponentProps<typeof Feather>['name'];

const TILE = 26;
const SMALL_TILE = 18;
const TOGGLE_W = 36;
const TOGGLE_H = 22;
const KNOB = 18;

/** The app name in the widget gallery (a brand name, never translated). */
const APP_NAME = 'Glaze'; // i18n-ignore

export function ThemeSetupArt({ kind }: { kind: SetupArtKind }) {
  const { c } = useColorsV2();
  const { t } = useT();
  const label =
    kind === 'photos-share'
      ? t('theme.setup.art.shareA11y')
      : kind === 'wallpaper-add'
        ? t('theme.setup.art.addA11y')
        : kind === 'home-blur'
          ? t('theme.setup.art.blurA11y')
          : kind === 'home-library'
            ? t('theme.setup.art.homeA11y')
            : kind === 'jiggle-edit'
              ? t('theme.setup.art.jiggleA11y')
              : kind === 'widget-gallery'
                ? t('theme.setup.art.galleryA11y')
                : t('theme.setup.art.editA11y');
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.screen, continuous, { backgroundColor: c.bg, borderColor: c.separator }]}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {kind === 'photos-share' ? <ShareSheet c={c} /> : null}
        {kind === 'wallpaper-add' ? <WallpaperAdd c={c} /> : null}
        {kind === 'home-blur' ? <HomeBlur c={c} /> : null}
        {kind === 'home-library' ? <HomeLibrary c={c} /> : null}
        {kind === 'jiggle-edit' ? <JiggleEdit c={c} /> : null}
        {kind === 'widget-gallery' ? <WidgetGallery c={c} /> : null}
        {kind === 'edit-widget' ? <EditWidget c={c} /> : null}
      </View>
    </View>
  );
}

function Label({
  role,
  color,
  lines = 1,
  style,
  children,
}: {
  role: TypeRoleV2;
  color: string;
  lines?: number;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
}) {
  const { script } = useT();
  return (
    <Text
      numberOfLines={lines}
      maxFontSizeMultiplier={Math.min(1.2, fontScaleCap(role))}
      style={[textV2[role], textStyleFor(script, textV2[role]), { color }, style]}
    >
      {children}
    </Text>
  );
}

/** The ring around the thing to tap. */
function Ring({ c, children, round }: { c: PaletteV2; children: ReactNode; round?: boolean }) {
  return (
    <View
      style={[
        styles.ring,
        continuous,
        round ? styles.ringFit : styles.ringStretch,
        { borderColor: c.tint, borderRadius: round ? radiusV2.pill : radiusV2.control },
      ]}
    >
      {children}
    </View>
  );
}

function Bar({ c, width }: { c: PaletteV2; width: number }) {
  return <View style={[styles.bar, { width, backgroundColor: c.separator }]} />;
}

/** A placeholder wallpaper: soft tint bands (no picture). */
function Wall({ c, height, children }: { c: PaletteV2; height: number; children?: ReactNode }) {
  return (
    <View style={[styles.wall, continuous, { height, backgroundColor: c.tintSoft }]}>
      <View style={[styles.wallBand, { backgroundColor: c.pastels.lilac.fill }]} />
      <View style={[styles.wallBand, { backgroundColor: c.pastels.peach.fill }]} />
      {children ? <View style={styles.wallOver}>{children}</View> : null}
    </View>
  );
}

function Tile({ c, size = TILE, tone, glyph }: { c: PaletteV2; size?: number; tone: string; glyph?: FeatherName }) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: iconTileRadius(size), backgroundColor: tone }]}>
      {glyph ? <Feather name={glyph} size={Math.round(size * 0.55)} color={c.onTintSoft} /> : null}
    </View>
  );
}

function ShareRow({ c, icon, label, ringed = false }: { c: PaletteV2; icon: FeatherName; label: string; ringed?: boolean }) {
  return (
    <RingIf c={c} on={ringed}>
      <View style={styles.row}>
        <Label role="footnote" color={c.ink} style={styles.flexText}>
          {label}
        </Label>
        <Feather name={icon} size={14} color={c.inkSecondary} />
      </View>
    </RingIf>
  );
}

function RingIf({ c, on, children }: { c: PaletteV2; on: boolean; children: ReactNode }) {
  return on ? <Ring c={c}>{children}</Ring> : <>{children}</>;
}

/** Step 1a: Photos share sheet; "Use as Wallpaper" ringed. */
function ShareSheet({ c }: { c: PaletteV2 }) {
  const { t } = useT();
  return (
    <View style={styles.stack}>
      <Wall c={c} height={44} />
      <View style={[styles.group, continuous, { backgroundColor: c.surface }]}>
        <ShareRow c={c} icon="copy" label={t('theme.setup.art.copyPhoto')} />
        <View style={[styles.rule, { backgroundColor: c.separator }]} />
        <ShareRow c={c} icon="smartphone" label={t('theme.setup.art.useAsWallpaper')} ringed />
      </View>
    </View>
  );
}

/** Step 1b: the wallpaper preview; Cancel and the ringed Add, then "Set as Wallpaper Pair". */
function WallpaperAdd({ c }: { c: PaletteV2 }) {
  const { t } = useT();
  return (
    <View style={styles.stack}>
      <View style={styles.rowBetween}>
        <View style={[styles.pill, { backgroundColor: c.fill }]}>
          <Label role="caption1" color={c.ink}>
            {t('theme.setup.art.cancel')}
          </Label>
        </View>
        <Ring c={c} round>
          <View style={[styles.pill, { backgroundColor: c.tint }]}>
            <Label role="caption1" color={c.onTint} style={styles.bold}>
              {t('theme.setup.art.add')}
            </Label>
          </View>
        </Ring>
      </View>
      <Wall c={c} height={56}>
        <View style={[styles.sheetCard, continuous, { backgroundColor: c.surfaceRaised }]}>
          <Label role="caption1" color={c.ink} style={[styles.bold, styles.center]}>
            {t('theme.setup.art.pair')}
          </Label>
        </View>
      </Wall>
    </View>
  );
}

/** Step 1c: the Home Screen choice; the Blur toggle shown OFF, ringed. */
function HomeBlur({ c }: { c: PaletteV2 }) {
  const { t } = useT();
  return (
    <View style={styles.stack}>
      <Label role="footnote" color={c.ink} style={[styles.bold, styles.center]}>
        {t('theme.setup.art.homeScreen')}
      </Label>
      <Wall c={c} height={64}>
        <View style={styles.tileRow}>
          <Tile c={c} size={SMALL_TILE} tone={c.surface} />
          <Tile c={c} size={SMALL_TILE} tone={c.surface} />
          <Tile c={c} size={SMALL_TILE} tone={c.surface} />
          <Tile c={c} size={SMALL_TILE} tone={c.surface} />
        </View>
      </Wall>
      <Ring c={c}>
        <View style={styles.row}>
          <Feather name="droplet" size={14} color={c.inkSecondary} />
          <Label role="footnote" color={c.ink} style={styles.flexText}>
            {t('theme.setup.art.blur')}
          </Label>
          <Label role="caption2" color={c.inkSecondary}>
            {t('theme.setup.art.off')}
          </Label>
          <View style={[styles.toggle, { backgroundColor: c.fill }]}>
            <View style={[styles.knob, { backgroundColor: c.surface }]} />
          </View>
        </View>
      </Ring>
    </View>
  );
}

/** Step 2e: the Home Screen with themed icons, and the App Library holding the old ones. */
function HomeLibrary({ c }: { c: PaletteV2 }) {
  const { t } = useT();
  const tones = [c.pastels.berry.fill, c.pastels.lilac.fill, c.pastels.mint.fill, c.pastels.sky.fill];
  const glyphs: FeatherName[] = ['camera', 'music', 'map', 'mail'];
  return (
    <View style={styles.stack}>
      <Wall c={c} height={60}>
        <View style={styles.tileRow}>
          {tones.map((tone, i) => (
            <Tile key={glyphs[i]} c={c} tone={tone} glyph={glyphs[i]} />
          ))}
        </View>
      </Wall>
      <View style={styles.row}>
        <Feather name="arrow-down" size={14} color={c.tint} />
        <View style={[styles.group, styles.flex, continuous, { backgroundColor: c.surface }]}>
          <Label role="caption1" color={c.ink} style={styles.bold}>
            {t('theme.setup.art.appLibrary')}
          </Label>
          <View style={styles.tileRow}>
            <Tile c={c} size={SMALL_TILE} tone={c.fill} />
            <Tile c={c} size={SMALL_TILE} tone={c.fill} />
            <Tile c={c} size={SMALL_TILE} tone={c.fill} />
          </View>
        </View>
      </View>
    </View>
  );
}

/** Step 3a: the Home Screen in edit mode (minus badges on the icons) with Edit ringed, then Add Widget. */
function JiggleEdit({ c }: { c: PaletteV2 }) {
  const { t } = useT();
  return (
    <View style={styles.stack}>
      <View style={styles.rowBetween}>
        <Ring c={c} round>
          <View style={[styles.pill, { backgroundColor: c.fill }]}>
            <Label role="caption1" color={c.ink} style={styles.bold}>
              {t('theme.setup.art.edit')}
            </Label>
          </View>
        </Ring>
        <View style={[styles.pill, { backgroundColor: c.fill }]}>
          <Label role="caption1" color={c.ink}>
            {t('theme.setup.done')}
          </Label>
        </View>
      </View>
      <Wall c={c} height={56}>
        <View style={styles.tileRow}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i}>
              <Tile c={c} tone={c.surface} />
              <View style={[styles.minus, { backgroundColor: c.inkTertiary }]}>
                <Feather name="minus" size={8} color={c.surface} />
              </View>
            </View>
          ))}
        </View>
      </Wall>
      <View style={[styles.menu, continuous, { backgroundColor: c.surfaceRaised }]}>
        <View style={styles.row}>
          <Feather name="plus-square" size={14} color={c.tint} />
          <Label role="footnote" color={c.ink} style={styles.flexText}>
            {t('theme.setup.art.addWidget')}
          </Label>
        </View>
      </View>
    </View>
  );
}

/** Step 3b: the widget gallery; search field, then the ringed Glaze row with a small widget. */
function WidgetGallery({ c }: { c: PaletteV2 }) {
  const { t } = useT();
  return (
    <View style={styles.stack}>
      <View style={[styles.search, { backgroundColor: c.fill }]}>
        <Feather name="search" size={12} color={c.inkTertiary} />
        <Label role="caption1" color={c.inkTertiary}>
          {t('theme.setup.art.searchWidgets')}
        </Label>
      </View>
      <View style={[styles.group, continuous, { backgroundColor: c.surface }]}>
        <View style={styles.row}>
          <Tile c={c} tone={c.fill} />
          <Bar c={c} width={80} />
        </View>
        <View style={[styles.rule, { backgroundColor: c.separator }]} />
        <Ring c={c}>
          <View style={styles.row}>
            <Tile c={c} tone={c.tintSoft} glyph="droplet" />
            <Label role="footnote" color={c.ink} style={[styles.bold, styles.flexText]}>
              {APP_NAME}
            </Label>
            <View style={[styles.miniWidget, continuous, { backgroundColor: c.pastels.lilac.fill }]} />
          </View>
        </Ring>
      </View>
    </View>
  );
}

/** Step 3c: the Edit Widget sheet; the Art row ringed. */
function EditWidget({ c }: { c: PaletteV2 }) {
  const { t, isRTL } = useT();
  return (
    <View style={styles.stack}>
      <View style={[styles.miniWidgetLarge, continuous, { backgroundColor: c.pastels.lilac.fill }]} />
      <View style={[styles.group, continuous, { backgroundColor: c.surfaceRaised }]}>
        <Label role="caption1" color={c.inkSecondary} style={styles.center}>
          {t('theme.setup.art.editWidget')}
        </Label>
        <View style={[styles.rule, { backgroundColor: c.separator }]} />
        <Ring c={c}>
          <View style={styles.row}>
            <Label role="footnote" color={c.ink} style={styles.flexText}>
              {t('theme.setup.art.artRow')}
            </Label>
            <Label role="footnote" color={c.tint}>
              {t('theme.setup.art.artValue')}
            </Label>
            <Feather name={Chevron.forward(isRTL)} size={14} color={c.inkTertiary} />
          </View>
        </Ring>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    width: '100%',
    maxWidth: 300,
    alignSelf: 'center',
    borderRadius: radiusV2.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spaceV2.md,
    overflow: 'hidden',
  },
  stack: { gap: spaceV2.sm },
  bar: { height: 6, borderRadius: circleRadius(6) },
  rule: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: spaceV2.xxs },
  ring: { borderWidth: 2, paddingHorizontal: spaceV2.sm, paddingVertical: spaceV2.xxs },
  ringStretch: { alignSelf: 'stretch' },
  ringFit: { alignSelf: 'center' },
  group: { borderRadius: radiusV2.control, padding: spaceV2.sm, gap: spaceV2.xxs },
  menu: { borderRadius: radiusV2.control, padding: spaceV2.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spaceV2.sm },
  wall: { borderRadius: radiusV2.control, overflow: 'hidden', justifyContent: 'center' },
  wallBand: { flex: 1, opacity: 0.7 },
  wallOver: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: spaceV2.sm },
  sheetCard: { borderRadius: radiusV2.control, paddingHorizontal: spaceV2.sm, paddingVertical: spaceV2.xs },
  tile: { alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: radiusV2.pill, paddingHorizontal: spaceV2.sm, paddingVertical: spaceV2.xxs },
  toggle: { width: TOGGLE_W, height: TOGGLE_H, borderRadius: circleRadius(TOGGLE_H), padding: spaceV2.xxs, alignItems: 'flex-start' },
  knob: { width: KNOB, height: KNOB, borderRadius: circleRadius(KNOB) },
  minus: {
    position: 'absolute',
    top: -spaceV2.xs,
    start: -spaceV2.xs,
    width: 12,
    height: 12,
    borderRadius: circleRadius(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.xs,
    borderRadius: radiusV2.pill,
    paddingHorizontal: spaceV2.sm,
    paddingVertical: spaceV2.xs,
  },
  miniWidget: { width: 40, height: 22, borderRadius: radiusV2.control },
  miniWidgetLarge: { width: 72, height: 72, alignSelf: 'center', borderRadius: radiusV2.card },
  flex: { flex: 1 },
  flexText: { flex: 1 },
  bold: { fontWeight: '600' },
  center: { textAlign: 'center' },
});
