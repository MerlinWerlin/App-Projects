// Settings › Storage (T46): downloaded theme packs with their size, Remove, Re-download and the
// total. Self-contained so Settings only renders <PackStorageSection />. Design v2 (T56): one
// InsetGroup (header, footnote, a block per pack with small pills, the total as the last row).
// T105: a second group lists the downloaded Space (Webb) photos with their size, exact credit and
// Remove (no network; the theme goes back to its drawn wallpaper).
// T173 (docs/PREMIUM_UI.md §3.7): editorial group titles, row icons in pastel circles, sizes in
// inkSecondary, and while the on-phone index is being read the rows show Skeleton sizes (no spinner).
// T225: a one-line pack update status above the total ("Updated 2 packs" / "All packs up to date").
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import type { PackUpdateSummary } from '../core/packUpdates';
import { photoCreditParams } from '../core/photoPack';
import { spaceThemeById } from '../core/spacePack';
import { formatBytes } from '../core/themePack';
import { PlusLockSheet } from '../plus/PlusLockSheet';
import { usePackStorage } from '../plus/usePackAccess';
import { usePackUpdateSummary } from '../plus/usePackUpdate';
import { useT } from '../i18n';
import { circleRadius, fontScaleCap, sizeV2, spaceV2, tabularV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';
import { InsetGroup } from './InsetGroup';
import { PillButton } from './PillButton';
import { ProgressBar } from './ProgressBar';
import { Skeleton } from './Skeleton';
import { useToast } from './Toast';
import { useDownloadedPhotos } from './usePhotoTheme';

export function PackStorageSection() {
  const { c } = useColorsV2();
  const toast = useToast();
  const storage = usePackStorage();
  const photos = useDownloadedPhotos();
  const { t, script, locale } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  const measuring = storage.measuring;
  const bytes = (n: number) => formatBytes(n, locale);
  const [plusOpen, setPlusOpen] = useState(false);
  const updateSummary = usePackUpdateSummary();
  const updateLine = packUpdateLine(updateSummary, t);

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
      <InsetGroup title={t('ui.storage.title')} footer={t('ui.storage.note')}>
        {measuring ? (
          <View key="measuring" style={styles.packHeadRow} accessible accessibilityLabel={t('ui.storage.measuring')}>
            <View style={[styles.tile, { backgroundColor: c.pastels.lilac.fill }]}>
              <Feather name="package" size={17} color={c.pastels.lilac.ink} />
            </View>
            <View style={styles.flex}>
              <Skeleton width="55%" height={textV2.body.lineHeight ?? spaceV2.xl} />
            </View>
            <Skeleton width={sizeV2.touch + spaceV2.lg} height={textV2.body.lineHeight ?? spaceV2.xl} />
          </View>
        ) : null}
        {!measuring && !storage.enabled && storage.packs.length === 0 ? (
          <View style={styles.row}>
            <Feather name="download-cloud" size={20} color={c.inkSecondary} />
            <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), styles.flex, { color: c.inkSecondary }]}>
              {storage.disabledMessage}
            </Text>
          </View>
        ) : null}
        {!measuring && storage.enabled && storage.packs.length === 0 ? (
          <View style={styles.row}>
            <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), styles.flex, { color: c.inkSecondary }]}>
              {t('ui.storage.empty')}
            </Text>
          </View>
        ) : null}
        {storage.packs.map((p) => {
          const busy = p.id in storage.busy;
          const size = bytes(p.bytes);
          return (
            <View key={p.id} style={styles.pack}>
              <View style={styles.packHead} accessible accessibilityLabel={t('ui.storage.packA11y', { name: p.name, count: p.themeIds.length, size })}>
                <View style={[styles.tile, { backgroundColor: c.pastels.lilac.fill }]}>
                  <Feather name="package" size={17} color={c.pastels.lilac.ink} />
                </View>
                <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), styles.flex, { color: c.ink }]}>
                  {p.name}
                </Text>
                <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), tabularV2, { color: c.inkSecondary }]}>
                  {size}
                </Text>
              </View>
              {busy ? <ProgressBar progress={storage.busy[p.id] ?? 0} label={t('ui.storage.downloading', { name: p.name })} /> : null}
              {storage.errors[p.id] ? (
                <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.warn }]}>
                  {storage.errors[p.id]}
                </Text>
              ) : null}
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
        {/* T225: one plain line about pack updates ("Updated 2 packs" / "All packs up to date"). */}
        {!measuring && updateLine ? (
          <View style={styles.row} accessible accessibilityLabel={updateLine.text}>
            <Feather name={updateLine.icon} size={18} color={updateLine.warn ? c.warn : c.inkSecondary} />
            <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), styles.flex, { color: updateLine.warn ? c.warn : c.inkSecondary }]}>
              {updateLine.text}
            </Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[...ts('headline'), styles.flex, { color: c.ink }]}>
            {t('ui.storage.total')}
          </Text>
          {measuring ? (
            <Skeleton width={sizeV2.touch + spaceV2.lg} height={textV2.headline.lineHeight ?? spaceV2.xl} />
          ) : (
            <Text
              maxFontSizeMultiplier={fontScaleCap('headline')}
              style={[...ts('headline'), tabularV2, { color: c.inkSecondary }]}
              accessibilityLabel={t('ui.storage.totalA11y', { size: bytes(storage.totalBytes) })}
            >
              {bytes(storage.totalBytes)}
            </Text>
          )}
        </View>
      </InsetGroup>
      {/* T105: downloaded Space (Webb) photos: size, the exact credit, Remove. */}
      <InsetGroup title={t('ui.storage.photosTitle')} footer={t('ui.storage.photosNote')}>
        {photos.rows.length === 0 ? (
          <View style={styles.row}>
            <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), styles.flex, { color: c.inkSecondary }]}>
              {t('ui.storage.photosEmpty')}
            </Text>
          </View>
        ) : null}
        {photos.rows.map((r) => {
          const size = bytes(r.bytes);
          const theme = spaceThemeById(r.themeId);
          const credit = theme ? photoCreditParams(theme.photo) : { credit: r.credit, licence: '' };
          return (
            <View key={r.themeId} style={styles.pack}>
              <View style={styles.packHead} accessible accessibilityLabel={t('ui.storage.photoA11y', { name: r.name, size })}>
                <View style={[styles.tile, { backgroundColor: c.pastels.lilac.fill }]}>
                  <Feather name="image" size={17} color={c.pastels.lilac.ink} />
                </View>
                <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), styles.flex, { color: c.ink }]}>
                  {r.name}
                </Text>
                <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), tabularV2, { color: c.inkSecondary }]}>
                  {size}
                </Text>
              </View>
              <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]} selectable>
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
            <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[...ts('headline'), styles.flex, { color: c.ink }]}>
              {t('ui.storage.total')}
            </Text>
            <Text
              maxFontSizeMultiplier={fontScaleCap('headline')}
              style={[...ts('headline'), tabularV2, { color: c.inkSecondary }]}
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

type UpdateLine = { text: string; icon: 'check-circle' | 'refresh-cw' | 'alert-circle' | 'download-cloud'; warn: boolean };

/** T225: the Storage status text for a PackUpdateSummary (null = no line). */
function packUpdateLine(s: PackUpdateSummary, t: ReturnType<typeof useT>['t']): UpdateLine | null {
  switch (s.kind) {
    case 'upToDate':
      return { text: t('ui.storage.updates.upToDate'), icon: 'check-circle', warn: false };
    case 'updated':
      return { text: t('ui.storage.updates.updated', { count: s.count }), icon: 'check-circle', warn: false };
    case 'updating':
      return { text: t('ui.storage.updates.updating', { count: s.count }), icon: 'refresh-cw', warn: false };
    case 'available':
      return { text: t('ui.storage.updates.available', { count: s.count }), icon: 'download-cloud', warn: false };
    case 'failed':
      return { text: t('ui.storage.updates.failed', { count: s.count }), icon: 'alert-circle', warn: true };
    default:
      return null;
  }
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
  // Skeleton row in the pack head's shape, with the pack block's padding.
  packHeadRow: {
    minHeight: sizeV2.rowMin,
    paddingHorizontal: spaceV2.lg,
    paddingVertical: spaceV2.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.md,
  },
  tile: {
    width: sizeV2.rowIcon,
    height: sizeV2.rowIcon,
    borderRadius: circleRadius(sizeV2.rowIcon),
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.sm },
  flex: { flex: 1, flexShrink: 1 },
});
