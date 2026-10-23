// Settings › Storage (T46): downloaded theme packs with their size, Remove, Re-download and the
// total. Self-contained so Settings only renders <PackStorageSection />. Design v2 (T56): one
// InsetGroup (header, footnote, a block per pack with small pills, the total as the last row).
// T105: a second group lists the downloaded Space (Webb) photos with their size, exact credit and
// Remove (no network; the theme goes back to its drawn wallpaper).
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import { photoCreditParams } from '../core/photoPack';
import { spaceThemeById } from '../core/spacePack';
import { formatBytes } from '../core/themePack';
import { PlusLockSheet } from '../plus/PlusLockSheet';
import { usePackStorage } from '../plus/usePackAccess';
import { useT } from '../i18n';
import { continuous, iconTileRadius, sizeV2, spaceV2, tabularV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';
import { InsetGroup } from './InsetGroup';
import { PillButton } from './PillButton';
import { ProgressBar } from './ProgressBar';
import { useToast } from './Toast';
import { useDownloadedPhotos } from './usePhotoTheme';

export function PackStorageSection() {
  const { c } = useColorsV2();
  const toast = useToast();
  const storage = usePackStorage();
  const photos = useDownloadedPhotos();
  const { t, script, locale } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  const bytes = (n: number) => formatBytes(n, locale);
  const [plusOpen, setPlusOpen] = useState(false);

  const onRemove = async (id: string, name: string) => {
    await storage.remove(id);
    haptic('success');
    toast.show(t('ui.storage.removed', { name }), 'success');
  };

  const onRemovePhoto = async (themeId: string, name: string) => {
    await photos.remove(themeId);
    haptic('success');
    toast.show(t('ui.storage.photoRemoved', { name }), 'success');
  };

  const onRedownload = async (id: string, name: string) => {
    const r = await storage.redownload(id);
    if (r === 'locked') setPlusOpen(true);
    else if (r === 'disabled') toast.show(storage.disabledMessage);
    else if (r === 'ok') {
      haptic('success');
      toast.show(t('ui.storage.redownloaded', { name }), 'success');
    }
  };

  return (
    <>
      <InsetGroup header={t('ui.storage.title')} footer={t('ui.storage.note')}>
        {!storage.enabled && storage.packs.length === 0 ? (
          <View style={styles.row}>
            <Feather name="download-cloud" size={20} color={c.inkSecondary} />
            <Text style={[...ts('body'), styles.flex, { color: c.inkSecondary }]}>{storage.disabledMessage}</Text>
          </View>
        ) : null}
        {storage.enabled && storage.packs.length === 0 ? (
          <View style={styles.row}>
            <Text style={[...ts('body'), styles.flex, { color: c.inkSecondary }]}>{t('ui.storage.empty')}</Text>
          </View>
        ) : null}
        {storage.packs.map((p) => {
          const busy = p.id in storage.busy;
          const size = bytes(p.bytes);
          return (
            <View key={p.id} style={styles.pack}>
              <View style={styles.packHead} accessible accessibilityLabel={t('ui.storage.packA11y', { name: p.name, count: p.themeIds.length, size })}>
                <View style={[styles.tile, continuous, { backgroundColor: c.pastels.lilac.fill }]}>
                  <Feather name="package" size={17} color={c.pastels.lilac.ink} />
                </View>
                <Text style={[...ts('body'), styles.flex, { color: c.ink }]}>{p.name}</Text>
                <Text style={[...ts('body'), tabularV2, { color: c.inkSecondary }]}>{size}</Text>
              </View>
              {busy ? <ProgressBar progress={storage.busy[p.id] ?? 0} label={t('ui.storage.downloading', { name: p.name })} /> : null}
              {storage.errors[p.id] ? <Text style={[...ts('footnote'), { color: c.warn }]}>{storage.errors[p.id]}</Text> : null}
              <View style={styles.actions}>
                <PillButton
                  label={t('ui.storage.remove')}
                  icon="trash-2"
                  variant="tinted"
                  size="small"
                  disabled={busy}
                  accessibilityLabel={t('ui.storage.removeA11y', { name: p.name })}
                  accessibilityHint={t('ui.storage.removeHint', { size })}
                  onPress={() => void onRemove(p.id, p.name)}
                />
                <PillButton
                  label={t('ui.storage.redownload')}
                  icon="refresh-cw"
                  variant="plain"
                  size="small"
                  disabled={busy || !storage.enabled}
                  accessibilityLabel={t('ui.storage.redownloadA11y', { name: p.name })}
                  onPress={() => void onRedownload(p.id, p.name)}
                />
              </View>
            </View>
          );
        })}
        <View style={styles.row}>
          <Text style={[...ts('headline'), styles.flex, { color: c.ink }]}>{t('ui.storage.total')}</Text>
          <Text style={[...ts('headline'), tabularV2, { color: c.ink }]} accessibilityLabel={t('ui.storage.totalA11y', { size: bytes(storage.totalBytes) })}>
            {bytes(storage.totalBytes)}
          </Text>
        </View>
      </InsetGroup>
      {/* T105: downloaded Space (Webb) photos: size, the exact credit, Remove. */}
      <InsetGroup header={t('ui.storage.photosTitle')} footer={t('ui.storage.photosNote')}>
        {photos.rows.length === 0 ? (
          <View style={styles.row}>
            <Text style={[...ts('body'), styles.flex, { color: c.inkSecondary }]}>{t('ui.storage.photosEmpty')}</Text>
          </View>
        ) : null}
        {photos.rows.map((r) => {
          const size = bytes(r.bytes);
          const theme = spaceThemeById(r.themeId);
          const credit = theme ? photoCreditParams(theme.photo) : { credit: r.credit, licence: '' };
          return (
            <View key={r.themeId} style={styles.pack}>
              <View style={styles.packHead} accessible accessibilityLabel={t('ui.storage.photoA11y', { name: r.name, size })}>
                <View style={[styles.tile, continuous, { backgroundColor: c.pastels.lilac.fill }]}>
                  <Feather name="image" size={17} color={c.pastels.lilac.ink} />
                </View>
                <Text style={[...ts('body'), styles.flex, { color: c.ink }]}>{r.name}</Text>
                <Text style={[...ts('body'), tabularV2, { color: c.inkSecondary }]}>{size}</Text>
              </View>
              <Text style={[...ts('footnote'), { color: c.inkSecondary }]} selectable>
                {t('ui.photoCredit.creditLine', credit)}
              </Text>
              <View style={styles.actions}>
                <PillButton
                  label={t('ui.storage.remove')}
                  icon="trash-2"
                  variant="tinted"
                  size="small"
                  accessibilityLabel={t('ui.photoCredit.removeA11y', { name: r.name })}
                  accessibilityHint={t('ui.storage.photoRemoveHint', { size })}
                  onPress={() => void onRemovePhoto(r.themeId, r.name)}
                />
              </View>
            </View>
          );
        })}
        {photos.rows.length > 0 ? (
          <View style={styles.row}>
            <Text style={[...ts('headline'), styles.flex, { color: c.ink }]}>{t('ui.storage.total')}</Text>
            <Text
              style={[...ts('headline'), tabularV2, { color: c.ink }]}
              accessibilityLabel={t('ui.storage.photosTotalA11y', { size: bytes(photos.totalBytes) })}
            >
              {bytes(photos.totalBytes)}
            </Text>
          </View>
        ) : null}
      </InsetGroup>
      <PlusLockSheet visible={plusOpen} onClose={() => setPlusOpen(false)} subject={t('ui.storage.plusSubject')} />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizeV2.rowMin,
    paddingHorizontal: spaceV2.lg,
    paddingVertical: spaceV2.sm + spaceV2.xxs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.md,
  },
  pack: { paddingHorizontal: spaceV2.lg, paddingVertical: spaceV2.md, gap: spaceV2.sm },
  packHead: { minHeight: sizeV2.touch, flexDirection: 'row', alignItems: 'center', gap: spaceV2.md },
  tile: {
    width: sizeV2.rowIcon,
    height: sizeV2.rowIcon,
    borderRadius: iconTileRadius(sizeV2.rowIcon),
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.sm },
  flex: { flex: 1, flexShrink: 1 },
});
