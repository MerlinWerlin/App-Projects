import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { DESIGNED_KINDS, DESIGNED_SIZE, designedLiveSpec, designedOptionId, designedWidget, type DesignedKind, type DesignedWidget } from '../core/designedWidgets';
import { designedWidgetSvg } from '../core/designedWidgetPreview';
import type { Theme } from '../core/themes';
import { themePieceId } from '../core/widgetArtLibrary';
import type { HomeOptionSize } from '../core/widgetOptions';
import type { WidgetTabSize } from '../core/tabNav';
import { useT } from '../i18n';
import { widgets } from '../native/widgets';
import { chromeRadiusV2, continuous, fontScaleCap, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { PillButton } from './PillButton';
import { SectionHeader } from './SectionHeader';

type Props = { theme: Theme; size: WidgetTabSize; width: number; style?: StyleProp<ViewStyle>; onLibraryChange?: () => void };

/** Every theme has all three functional pieces, including bundled themes and offline packs. */
export function DesignedThemeWidgets({ theme, size, width, style, onLibraryChange }: Props) {
  const { t, locale } = useT();
  const { c } = useColorsV2();
  const [kind, setKind] = useState<DesignedKind>('clock');
  const [now, setNow] = useState(() => new Date());
  const [battery, setBattery] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'saved' | 'update' | 'failed' | null>(null);
  useEffect(() => {
    let alive = true;
    const refresh = () => { setNow(new Date()); widgets.designedBattery().then(v => { if (alive) setBattery(v); }).catch(() => undefined); };
    refresh(); const timer = setInterval(refresh, 30000);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  useEffect(() => { setStatus(null); }, [theme.id, kind, size]);
  const design = useMemo(() => designedWidget(theme, kind), [theme, kind]);
  if (size === 'lock') return null;
  const name = (value: DesignedKind) => t(`ui.designedWidgets.${value}`);
  const previewWidth = size === 'small' ? Math.min(220, width) : width;
  const previewHeight = previewWidth * DESIGNED_SIZE[size].h / DESIGNED_SIZE[size].w;
  const xml = designedWidgetSvg(design, size, { date: now, battery, locale, batteryLabel: name('battery'), unavailableLabel: t('ui.designedWidgets.unavailable') });
  const save = async () => {
    if (busy) return;
    setBusy(true); setStatus(null);
    try {
      const label = `${name(kind)} · ${t(`ui.seamless.sizes.${size}`)}`;
      const result = await widgets.saveDesignedWidget({
        id: themePieceId(theme.id, designedOptionId(kind), size), name: label, themeName: theme.name,
        themeId: theme.id, source: 'theme', created: Date.now(), aspect: DESIGNED_SIZE[size].w / DESIGNED_SIZE[size].h,
        size, slot: DESIGNED_KINDS.indexOf(kind), live: designedLiveSpec(theme, kind),
      });
      const next = result.ok ? 'saved' : !result.available ? 'update' : 'failed';
      setStatus(next);
      AccessibilityInfo.announceForAccessibility(next === 'saved' ? t('ui.seamless.library.added') : next === 'update' ? t('ui.designedWidgets.update') : t('ui.seamless.failed'));
      if (result.ok) onLibraryChange?.();
    } catch { setStatus('failed'); }
    finally { setBusy(false); }
  };
  return (
    <View style={[styles.wrap, style]}>
      <SectionHeader title={t('ui.designedWidgets.title')} body={t('ui.designedWidgets.body')} flushTop />
      <View style={styles.choices}>
        {DESIGNED_KINDS.map(value => (
          <PillButton key={value} label={name(value)} size="small" variant={value === kind ? 'filled' : 'tinted'}
            accessibilityLabel={name(value)} accessibilityState={{ selected: value === kind }} disabled={busy}
            onPress={() => setKind(value)} />
        ))}
      </View>
      <View style={[styles.preview, continuous, { width: previewWidth, height: previewHeight, backgroundColor: design.background[0] }]}>
        <SvgXml xml={xml} width={previewWidth} height={previewHeight} accessible accessibilityLabel={`${name(kind)}, ${theme.name}`} />
      </View>
      <PillButton label={t('tabs.widgetsTab.art.use')} icon="check-circle" variant="filled" block busy={busy} onPress={() => { void save(); }} />
      <Text style={[textV2.footnote, { color: c.inkSecondary }]} maxFontSizeMultiplier={fontScaleCap('footnote')}>
        {status === 'saved' ? t('ui.seamless.library.added') : status === 'update' ? t('ui.designedWidgets.update') : status === 'failed' ? t('ui.seamless.failed') : t('ui.designedWidgets.setup')}
      </Text>
      {kind === 'battery' ? <Text style={[textV2.footnote, { color: c.inkSecondary }]} maxFontSizeMultiplier={fontScaleCap('footnote')}>{t('ui.designedWidgets.batteryNote')}</Text> : null}
    </View>
  );
}

/** Library thumbnails use the same functional composition, rather than a blank placeholder. */
export function DesignedWidgetThumbnail({ design, size, width }: { design: DesignedWidget; size: HomeOptionSize; width: number }) {
  const { locale, t } = useT();
  return <SvgXml xml={designedWidgetSvg(design, size, { date: new Date(), battery: null, locale, batteryLabel: t('ui.designedWidgets.battery'), unavailableLabel: t('ui.designedWidgets.unavailable') })} width={width} height={width * DESIGNED_SIZE[size].h / DESIGNED_SIZE[size].w} />;
}

const styles = StyleSheet.create({
  wrap: { gap: spaceV2.md }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.xs },
  preview: { alignSelf: 'center', overflow: 'hidden', borderRadius: chromeRadiusV2.card },
});
