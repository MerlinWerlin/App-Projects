import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { DESIGNED_KINDS, DESIGNED_SIZE, designedWidget, type DesignedWidget } from '../core/designedWidgets';
import { designedWidgetSvg } from '../core/designedWidgetPreview';
import type { Theme } from '../core/themes';
import type { HomeOptionSize } from '../core/widgetOptions';
import type { WidgetTabSize } from '../core/tabNav';
import { useT } from '../i18n';
import { widgets } from '../native/widgets';
import { packClockArtworkUri, subscribePacks, syncPackClockFace } from '../native/packs';
import { chromeRadiusV2, continuous, fontScaleCap, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { SectionHeader } from './SectionHeader';
import { bundledArtUri } from './artPackSources';

type Props = { theme: Theme; size: WidgetTabSize; width: number; style?: StyleProp<ViewStyle> };

const alpineClockFace = require('../../assets/widgets/alpine-clock-face.jpg');

function useOriginalClockArtwork(design: DesignedWidget): string | undefined {
  const id = design.packFace?.id;
  const read = () => id ? packClockArtworkUri(id) : null;
  const local = useSyncExternalStore(subscribePacks, read, read);
  useEffect(() => { if (id) void syncPackClockFace(id); }, [id]);
  if (design.kind === 'clock' && design.identity?.originalFace === 'alpine') return bundledArtUri(alpineClockFace) ?? undefined;
  return local ?? undefined;
}

/** Every theme has all three functional pieces, including bundled themes and offline packs. */
export function DesignedThemeWidgets({ theme, size, width, style }: Props) {
  const { t } = useT();
  const { c } = useColorsV2();
  const [now, setNow] = useState(() => new Date());
  const [battery, setBattery] = useState<number | null>(null);
  const designs = useMemo(() => DESIGNED_KINDS.map(kind => designedWidget(theme, kind)), [theme]);
  useFocusEffect(useCallback(() => {
    let alive = true;
    const refresh = () => { setNow(new Date()); widgets.designedBattery().then(v => { if (alive) setBattery(v); }).catch(() => undefined); };
    refresh(); const timer = setInterval(refresh, 30000);
    return () => { alive = false; clearInterval(timer); };
  }, []));
  if (size === 'lock') return null;
  const previewWidth = size === 'small' ? Math.min(220, width) : width;
  return (
    <View testID="designed-widgets" style={[styles.wrap, style]}>
      <SectionHeader title={t('ui.designedWidgets.title')} body={t('ui.designedWidgets.body')} flushTop />
      {designs.map(design => <WidgetFacePreview key={design.kind} design={design} size={size}
        width={previewWidth} themeName={theme.name} now={now} battery={battery} />)}
      <Text style={[textV2.footnote, { color: c.inkSecondary }]} maxFontSizeMultiplier={fontScaleCap('footnote')}>
        {t('ui.designedWidgets.setup')}
      </Text>
    </View>
  );
}

function WidgetFacePreview({ design, size, width, themeName, now, battery }: {
  design: DesignedWidget; size: HomeOptionSize; width: number; themeName: string; now: Date; battery: number | null;
}) {
  const { t, locale } = useT();
  const { c } = useColorsV2();
  const originalArtwork = useOriginalClockArtwork(design);
  const name = t(`ui.designedWidgets.${design.kind}`);
  const height = width * DESIGNED_SIZE[size].h / DESIGNED_SIZE[size].w;
  const xml = designedWidgetSvg(design, size, { date: now, battery, locale, batteryLabel: t('ui.designedWidgets.battery'),
    unavailableLabel: t('ui.designedWidgets.unavailable'), originalArtwork });
  return <View style={styles.face}>
    <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('subhead')} style={[textV2.subhead, { color: c.ink }]}>{name}</Text>
    <View style={[styles.preview, continuous, { width, height, backgroundColor: design.background[0] }]}>
      <SvgXml xml={xml} width={width} height={height} accessible accessibilityLabel={[name, themeName].join(', ')} />
    </View>
  </View>;
}

/** Library thumbnails use the same functional composition, rather than a blank placeholder. */
export function DesignedWidgetThumbnail({ design, size, width }: { design: DesignedWidget; size: HomeOptionSize; width: number }) {
  const { locale, t } = useT();
  const originalArtwork = useOriginalClockArtwork(design);
  return <SvgXml xml={designedWidgetSvg(design, size, { date: new Date(), battery: null, locale, batteryLabel: t('ui.designedWidgets.battery'), unavailableLabel: t('ui.designedWidgets.unavailable'), originalArtwork })} width={width} height={width * DESIGNED_SIZE[size].h / DESIGNED_SIZE[size].w} />;
}

const styles = StyleSheet.create({
  wrap: { gap: spaceV2.md }, face: { alignItems: 'center', gap: spaceV2.xs },
  preview: { alignSelf: 'center', overflow: 'hidden', borderRadius: chromeRadiusV2.card },
});
