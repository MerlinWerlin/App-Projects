// T251 (owner-1101h #2): widget art in the Widgets tab preview, blended like the phone composes it
// (src/core/artBlend.ts; the bridge's GlazeArtBlend does the real pixel work at "Use on my widget"):
//   none     → the art as is (its edge is already transparent);
//   screen   → a plain DARK background drops out (mixBlendMode 'screen': black adds nothing), so a
//              moon on a black square floats on the wallpaper crop under it;
//   multiply → the same for a plain LIGHT background;
//   feather  → a painted background fades out at the edges (react-native-svg gradient masks, the
//              same band as BLEND_FEATHER_SHARE).
// No border, shadow, blur or panel: the art sits straight on what is behind it. No motion.
import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Defs, G, Image as SvgImage, LinearGradient, Mask, Rect, Stop } from 'react-native-svg';
import { FEATHER_MASK_HIDE, FEATHER_MASK_SHOW, featherStops, type PreviewBlend } from '../core/artBlend';
import type { Rect as Box } from '../core/widgetOptions';
import type { ArtSource } from './WidgetArtMenu';

type Props = { source: ArtSource; rect: Box; blend: PreviewBlend };

export function BlendedArt({ source, rect, blend }: Props) {
  const raw = useId();
  const id = raw.replace(/[^A-Za-z0-9]/g, '');
  const pos = { position: 'absolute' as const, left: rect.x, top: rect.y, width: rect.w, height: rect.h };
  if (blend === 'feather') {
    const [a, b, c, d] = featherStops();
    return (
      <View pointerEvents="none" style={pos}>
        <Svg width={rect.w} height={rect.h} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`fx${id}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset={a} stopColor={FEATHER_MASK_HIDE} />
              <Stop offset={b} stopColor={FEATHER_MASK_SHOW} />
              <Stop offset={c} stopColor={FEATHER_MASK_SHOW} />
              <Stop offset={d} stopColor={FEATHER_MASK_HIDE} />
            </LinearGradient>
            <LinearGradient id={`fy${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset={a} stopColor={FEATHER_MASK_HIDE} />
              <Stop offset={b} stopColor={FEATHER_MASK_SHOW} />
              <Stop offset={c} stopColor={FEATHER_MASK_SHOW} />
              <Stop offset={d} stopColor={FEATHER_MASK_HIDE} />
            </LinearGradient>
            <Mask id={`mx${id}`}>
              <Rect x="0" y="0" width={rect.w} height={rect.h} fill={`url(#fx${id})`} />
            </Mask>
            <Mask id={`my${id}`}>
              <Rect x="0" y="0" width={rect.w} height={rect.h} fill={`url(#fy${id})`} />
            </Mask>
          </Defs>
          <G mask={`url(#my${id})`}>
            <G mask={`url(#mx${id})`}>
              <SvgImage href={source} x="0" y="0" width={rect.w} height={rect.h} preserveAspectRatio="xMidYMid meet" />
            </G>
          </G>
        </Svg>
      </View>
    );
  }
  const mix = blend === 'screen' ? styles.screen : blend === 'multiply' ? styles.multiply : null;
  // The blend sits on a plain View (a ViewStyle prop since RN 0.77, new architecture); the image fills it.
  return (
    <View pointerEvents="none" style={[pos, mix]}>
      <ExpoImage source={source} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" transition={0} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { mixBlendMode: 'screen' },
  multiply: { mixBlendMode: 'multiply' },
});
