// T103: credit and licence for a photo theme (Space / Webb), with tappable links to the official
// release page and the licence, plus an optional Download / Remove control. The credit line is data
// and is shown exactly as the release page publishes it (never translated or shortened). Fixed text
// comes from the catalogue (ui.photoCredit.*). Renders nothing for a theme that is not a photo theme.
// T108: the Download control (PhotoDownloadControl, also used by Apply's Wallpaper step) follows the
// tested state in src/core/photoPack.ts photoDownloadView: a failed or blocked download shows a
// friendly offline / error panel with Retry; nothing half-downloaded is ever shown as ready.
import { Feather } from '@expo/vector-icons';
import { Linking, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { httpsHost, licenceName } from '../core/photoPack';
import { formatBytes } from '../core/themePack';
import type { Theme } from '../core/themes';
import { useT } from '../i18n';
import { continuous, radiusV2, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';
import { PillButton } from './PillButton';
import { ProgressBar } from './ProgressBar';
import { usePhotoTheme, type PhotoThemeState } from './usePhotoTheme';

type Props = {
  theme: Theme | string | null | undefined;
  /** Show Download / Remove for the photo (theme detail). Off for a credit-only line (e.g. over a preview). */
  showActions?: boolean;
  style?: StyleProp<ViewStyle>;
};

function open(url: string) {
  Linking.openURL(url).catch(() => undefined);
}

/** Start (or retry) the download from a tap, with haptics. Never rejects. */
async function tapDownload(p: PhotoThemeState): Promise<void> {
  haptic('select');
  const err = await p.download();
  haptic(err ? 'warning' : 'success');
}

type ControlProps = {
  p: PhotoThemeState;
  /** Offer Remove once downloaded (theme detail credit card). */
  allowRemove?: boolean;
};

/** Download / progress / friendly failure + Retry / Remove for one photo theme. */
export function PhotoDownloadControl({ p, allowRemove = true }: ControlProps) {
  const { c } = useColorsV2();
  const { t, script, locale } = useT();
  if (!p.photo) return null;
  const name = p.photo.name;
  const size = formatBytes(p.photo.photo.approxBytes, locale);
  const v = p.view;
  const body = [textV2.footnote, { color: c.inkSecondary }, textStyleFor(script, textV2.footnote)];

  if (v.kind === 'ready') {
    return allowRemove ? (
      <PillButton
        label={t('ui.photoCredit.remove')}
        variant="tinted"
        size="small"
        icon="trash-2"
        onPress={() => void p.remove()}
        accessibilityLabel={t('ui.photoCredit.removeA11y', { name })}
      />
    ) : null;
  }
  if (v.kind === 'downloading') {
    return (
      <View style={styles.progress}>
        <ProgressBar progress={v.percent / 100} label={t('ui.photoCredit.downloading')} />
      </View>
    );
  }
  if (v.kind === 'failed') {
    const tone = c.pastels.peach;
    return (
      <View
        style={[styles.failed, continuous, { backgroundColor: tone.fill }]}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        <View style={styles.failedHead}>
          <Feather name={v.failure === 'offline' ? 'wifi-off' : 'alert-circle'} size={18} color={tone.ink} />
          <Text style={[textV2.subhead, styles.flex, { color: tone.ink, fontWeight: '600' }, textStyleFor(script, textV2.subhead)]}>
            {t(v.titleKey)}
          </Text>
        </View>
        <Text style={[textV2.footnote, { color: tone.ink }, textStyleFor(script, textV2.footnote)]}>{t(v.bodyKey)}</Text>
        <PillButton
          label={t('ui.photoCredit.retry')}
          variant="filled"
          size="small"
          icon="refresh-cw"
          onPress={() => void tapDownload(p)}
          accessibilityLabel={t('ui.photoCredit.retryA11y', { name })}
        />
      </View>
    );
  }
  return (
    <View style={styles.block}>
      <PillButton
        label={t('ui.photoCredit.download', { size })}
        variant="filled"
        size="small"
        icon="download"
        onPress={() => void tapDownload(p)}
        accessibilityLabel={t('ui.photoCredit.downloadA11y', { name, size })}
      />
      <Text style={body}>{t('ui.photoCredit.note')}</Text>
    </View>
  );
}

export function PhotoCredit({ theme, showActions = true, style }: Props) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const p = usePhotoTheme(theme);
  if (!p.photo) return null;
  const src = p.photo.photo;
  const host = httpsHost(src.pageUrl) ?? '';
  const licence = licenceName(src.licence);
  const body = [textV2.footnote, { color: c.inkSecondary }, textStyleFor(script, textV2.footnote)];
  const link = [textV2.footnote, { color: c.tint, fontWeight: '600' as const }, textStyleFor(script, textV2.footnote)];

  return (
    <View style={[styles.card, continuous, { backgroundColor: c.surface }, style]}>
      <Text style={[textV2.subhead, { color: c.ink, fontWeight: '600' }, textStyleFor(script, textV2.subhead)]} accessibilityRole="header">
        {t('ui.photoCredit.title')}
      </Text>
      <Text style={[textV2.footnote, { color: c.ink }]} selectable>
        {src.credit}
      </Text>
      <Text style={body} selectable>
        {src.title}
      </Text>
      <View style={styles.links}>
        <Text
          style={[link, styles.link]}
          onPress={() => open(src.pageUrl)}
          accessibilityRole="link"
          accessibilityLabel={t('ui.photoCredit.sourceA11y', { host })}
        >
          {t('ui.photoCredit.source', { host })}
        </Text>
        <Text
          style={[link, styles.link]}
          onPress={() => open(src.licenceUrl)}
          accessibilityRole="link"
          accessibilityLabel={t('ui.photoCredit.licenceA11y', { licence })}
        >
          {t('ui.photoCredit.licence', { licence })}
        </Text>
      </View>
      {showActions ? (
        <View style={styles.actions}>
          <PhotoDownloadControl p={p} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radiusV2.card, padding: spaceV2.lg, gap: spaceV2.xs },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spaceV2.lg },
  link: { minHeight: sizeV2.touch, textAlignVertical: 'center', paddingVertical: spaceV2.md },
  actions: { marginTop: spaceV2.sm, gap: spaceV2.sm, alignItems: 'stretch' },
  block: { gap: spaceV2.sm, alignItems: 'flex-start', alignSelf: 'stretch' },
  progress: { gap: spaceV2.sm, alignSelf: 'stretch' },
  failed: { borderRadius: radiusV2.card, padding: spaceV2.md, gap: spaceV2.sm, alignItems: 'flex-start', alignSelf: 'stretch' },
  failedHead: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm, alignSelf: 'stretch' },
  flex: { flex: 1, flexShrink: 1 },
});
