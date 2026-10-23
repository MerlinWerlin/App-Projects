// Lock + Home pair card for /wallpaper (T62): a small side-by-side preview of the Lock
// wallpaper and its softened Home version (src/core/wallpaperPair.ts), a softness
// choice and one button that saves both images to Photos. The saving itself lives in
// the screen (it owns the offscreen capture views); this card is presentational.
// Design v2 (T83): surface squircle card with the `card` shadow, tinted block pill.

import { StyleSheet, Text, View } from 'react-native';
import type { IconSpec } from '../core/iconspec';
import type { WallpaperParams } from '../core/wallpaper';
import type { HomeVersion, PairStrength } from '../core/wallpaperPair';
import { HomeTint, HomeWallpaperView } from '../render/HomeWallpaperView';
import { Overlay, PhotoWallpaperView, type PhotoWallpaperData } from '../render/PhotoWallpaperView';
import { WallpaperView } from '../render/WallpaperView';
import { useT } from '../i18n';
import { continuous, radiusV2, shadowV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { PillButton } from './PillButton';
import { HomeMock } from './HomeMock';
import { LockMock } from './LockMock';
import { Segmented, type SegmentedOption } from './Segmented';
import { noMirror, textStyleFor } from './i18nLayout';

export type WallpaperPairCardProps = {
  /** Size of each half of the preview, in points. */
  width: number;
  height: number;
  /** The user's photo when the background source is "My photo", else null (designed wallpaper). */
  photo: PhotoWallpaperData | null;
  params: WallpaperParams;
  home: HomeVersion;
  iconSpecs: IconSpec[];
  strength: PairStrength;
  onStrengthChange: (s: PairStrength) => void;
  pixels: { width: string; height: string };
  saving: boolean;
  disabled: boolean;
  onSave: () => void;
};

export function WallpaperPairCard({
  width,
  height,
  photo,
  params,
  home,
  iconSpecs,
  strength,
  onStrengthChange,
  pixels,
  saving,
  disabled,
  onSave,
}: WallpaperPairCardProps) {
  const { c, scheme } = useColorsV2();
  const { t, script } = useT();
  const heading = [textV2.headline, textStyleFor(script, textV2.headline)];
  const small = [textV2.footnote, textStyleFor(script, textV2.footnote)];
  const strengths: SegmentedOption<PairStrength>[] = [
    { value: 'soft', label: t('wallpaper.pair.soft') },
    { value: 'strong', label: t('wallpaper.pair.strong') },
  ];
  const frame = [styles.phone, continuous, noMirror, { width, height, borderColor: c.separator }];

  return (
    <View
      style={[
        styles.card,
        continuous,
        shadowV2('card', scheme),
        { backgroundColor: c.surface },
        scheme === 'dark' ? { borderColor: c.separator, borderWidth: StyleSheet.hairlineWidth } : null,
      ]}
    >
      <Text accessibilityRole="header" style={[...heading, { color: c.ink }]}>
        {t('wallpaper.pair.heading')}
      </Text>
      <Text style={[...small, { color: c.inkSecondary }]}>{t('wallpaper.pair.body')}</Text>
      <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel={t('wallpaper.pair.previewA11y')}>
        <View style={styles.half}>
          <View style={frame}>
            {photo ? (
              <PhotoWallpaperView photo={photo} width={width} height={height} maxGrain={150} />
            ) : (
              <WallpaperView params={params} width={width} height={height} maxGrain={150} />
            )}
            <LockMock width={width} height={height} showGuides={false} />
          </View>
          <Text style={[...small, { color: c.inkSecondary }]}>{t('wallpaper.pair.lock')}</Text>
        </View>
        <View style={styles.half}>
          <View style={frame}>
            {/* Preview approximation: a photo is blurred live; a designed wallpaper (SVG) can't be,
                so it drops its grain and gets the same wash + dim. The saved Home image blurs the
                captured Lock image either way. */}
            {photo ? (
              <HomeWallpaperView
                data={{
                  uri: photo.uri,
                  imageW: photo.imageW,
                  imageH: photo.imageH,
                  transform: photo.transform,
                  home,
                  background: photo.palette.bg,
                }}
                width={width}
                height={height}
              >
                <Overlay overlay={{ ...photo.overlay, grain: false }} palette={photo.palette} width={width} height={height} maxGrain={0} />
              </HomeWallpaperView>
            ) : (
              <View style={{ width, height }}>
                <WallpaperView params={params} width={width} height={height} maxGrain={0} />
                <HomeTint home={home} />
              </View>
            )}
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
              <HomeMock specs={iconSpecs} width={width} backgroundColour="transparent" maxIcons={16} />
            </View>
          </View>
          <Text style={[...small, { color: c.inkSecondary }]}>{t('wallpaper.pair.home')}</Text>
        </View>
      </View>
      <Segmented label={t('wallpaper.pair.strength')} options={strengths} value={strength} onChange={onStrengthChange} />
      <PillButton
        label={saving ? t('wallpaper.save.saving') : t('wallpaper.pair.save')}
        icon="layers"
        variant="tinted"
        block
        haptic={false}
        busy={saving}
        disabled={disabled}
        onPress={onSave}
        accessibilityHint={t('wallpaper.pair.hint', { width: pixels.width, height: pixels.height })}
      />
      <Text style={[...small, { color: c.inkSecondary }]}>{t('wallpaper.pair.howTo')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radiusV2.card, padding: spaceV2.lg, gap: spaceV2.md },
  row: { flexDirection: 'row', justifyContent: 'center', gap: spaceV2.md },
  half: { alignItems: 'center', gap: spaceV2.xs },
  phone: { borderRadius: radiusV2.control, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
});
