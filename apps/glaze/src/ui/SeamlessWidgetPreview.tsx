// T131 Seamless widget preview (Expo Go safe; docs/WIDGETS.md "Seamless widget"). A mock Home
// Screen at the device's aspect: the wallpaper aspect-filled behind everything, and one widget
// whose background is the same wallpaper cut at the widget's slot (an overflow-hidden box holding
// the full wallpaper image at the negative crop offset) with the transparent hero art on top.
// Everything comes from src/core/seamlessWidget.ts, so the preview shows exactly the crop the
// native bridge will write. The nudge moves the widget box and its crop together (it models
// "the real widget sits a few points off the table"), so the preview always stays seamless.
// Never mirrored (a picture of an iPhone screen): `noMirror`.
import { Image as ExpoImage } from 'expo-image';
import { useMemo } from 'react';
import { PixelRatio, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import {
  heroRect,
  lookupDevice,
  seamlessCrop,
  wallpaperToScreen,
  widgetCornerPx,
  type Nudge,
  type SeamlessDevice,
  type SeamlessSize,
  type Size,
} from '../core/seamlessWidget';
import { tabularV2 } from '../theme/tokensV2';
import { noMirror, noMirrorText } from './i18nLayout';

export type SeamlessWidgetPreviewProps = {
  /** The wallpaper image (require() or { uri }). */
  wallpaper: ImageSourcePropType;
  /** The wallpaper's pixel size (e.g. 1290 x 2796); the crop maths needs it. */
  wallpaperPx: Size;
  /** Transparent hero art drawn on the widget; null = wallpaper crop only. */
  hero?: ImageSourcePropType | null;
  /** Hero pixel size (aspect only; default square). */
  heroPx?: Size;
  size: SeamlessSize;
  /** Grid slot (src/core/seamlessWidget.ts slotsFor); an invalid one falls back to the first. */
  slot: string;
  nudge?: Nudge;
  /** Outer width of the mock in points; the height follows the device's aspect. */
  width: number;
  /** Device row to mock; default: this phone (lookupDevice from the window size and scale). */
  device?: SeamlessDevice;
  /** Dashed outline round the widget, so its edges can be found while setting up. */
  outline?: boolean;
  /** Read by screen readers (the whole mock is one image). */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

export function SeamlessWidgetPreview({
  wallpaper,
  wallpaperPx,
  hero = null,
  heroPx,
  size,
  slot,
  nudge,
  width,
  device: deviceProp,
  outline = false,
  accessibilityLabel,
  style,
}: SeamlessWidgetPreviewProps) {
  const win = useWindowDimensions();
  const device = useMemo(() => {
    if (deviceProp) return deviceProp;
    let scale = 3;
    try {
      scale = PixelRatio.get();
    } catch {
      scale = 3;
    }
    return lookupDevice({ width: win.width, height: win.height, scale }).device;
  }, [deviceProp, win.width, win.height]);

  const layout = useMemo(() => {
    const crop = seamlessCrop({ device, wallpaper: wallpaperPx, size, slot, nudge });
    const w = Math.max(80, width);
    const k = w / device.px.w;
    const h = device.px.h * k;
    const fill = crop.fill;
    const wallW = wallpaperPx.w * fill.scale * k;
    const wallH = wallpaperPx.h * fill.scale * k;
    // Where the (clamped) crop really lands on the screen, in mock points.
    const box = wallpaperToScreen(crop.cropPx, fill);
    const boxX = box.x * k;
    const boxY = box.y * k;
    const boxW = box.w * k;
    const boxH = box.h * k;
    const heroBox = heroRect({ w: boxW, h: boxH }, heroPx ?? { w: 1, h: 1 });
    return {
      w,
      h,
      k,
      wall: { left: fill.offsetX * k, top: fill.offsetY * k, width: wallW, height: wallH },
      box: { left: boxX, top: boxY, width: boxW, height: boxH },
      inner: { left: fill.offsetX * k - boxX, top: fill.offsetY * k - boxY, width: wallW, height: wallH },
      hero: { left: heroBox.x, top: heroBox.y, width: heroBox.w, height: heroBox.h },
      radius: widgetCornerPx(device) * k,
    };
  }, [device, wallpaperPx, size, slot, nudge, width, heroPx]);

  const { w, h, k } = layout;
  const statusFont = Math.max(8, w * 0.04);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.phone, noMirror, { width: w, height: h, borderRadius: w * 0.12 }, style]}
    >
      <ExpoImage source={wallpaper} style={[styles.abs, layout.wall]} contentFit="fill" cachePolicy="memory-disk" transition={0} />

      <View pointerEvents="none" style={[styles.status, { height: h * 0.06, paddingHorizontal: w * 0.09 }]}>
        <Text maxFontSizeMultiplier={1.4} style={[styles.statusText, tabularV2, noMirrorText, { fontSize: statusFont }]}>
          9:41
        </Text>
      </View>

      <View
        pointerEvents="none"
        style={[
          styles.abs,
          styles.widget,
          layout.box,
          { borderRadius: layout.radius },
          outline ? styles.outline : null,
        ]}
      >
        <ExpoImage source={wallpaper} style={[styles.abs, layout.inner]} contentFit="fill" cachePolicy="memory-disk" transition={0} />
        {hero ? (
          <ExpoImage source={hero} style={[styles.abs, layout.hero]} contentFit="contain" cachePolicy="memory-disk" transition={0} />
        ) : null}
      </View>

      {/* Dock band, as on the Home Screen (sits over the wallpaper only). */}
      <View
        pointerEvents="none"
        style={[
          styles.dock,
          {
            left: w * 0.035, // rtl-ok
            right: w * 0.035, // rtl-ok
            bottom: w * 0.035,
            height: Math.max(24, 300 * k),
            borderRadius: w * 0.09,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  phone: { overflow: 'hidden', backgroundColor: '#000000' },
  abs: { position: 'absolute' },
  status: { flexDirection: 'row', alignItems: 'center' },
  statusText: { color: '#FFFFFF', fontWeight: '700' },
  widget: { overflow: 'hidden' },
  outline: { borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.75)' },
  dock: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.22)' },
});
