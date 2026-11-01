// Wallpapers tab (T186, owner-1101 #4; owner 1 Nov supersedes T70/T71/T77/T176's gallery here).
// Three parts, top to bottom:
//   1. "Live Photo from a clip": opens the Live Photo maker (/live, app/live/index.tsx), which used
//      to be its own tab.
//   2. The photo collage maker (/collage, T76).
//   3. "My wallpapers": every wallpaper saved from inside Glaze (collages, wallpaper-maker saves,
//      Live Photo stills), newest first, as a virtualised grid of thumbnails. Tap one to see it,
//      save it to Photos again or delete it (src/store/myWallpapers.ts; nothing leaves the device).
// The old bundled wallpaper gallery is gone from this tab; theme wallpapers stay on each theme's
// page. Motion is calm: the sheet fades in, nothing bounces. Tokens from tokensV2 only.
// T198: Wallpapers is the 4th tab again (Pets were cut). Sections are spaced by SectionHeader's own
// editorial rhythm (sectionTop above, sectionBottom below), with no extra gap stacked on top.
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View, useWindowDimensions, type ListRenderItem } from 'react-native';
import { myWallpaperKindKey, type MyWallpaper } from '../../src/core/myWallpapers';
import { LIVE_MAKER_HREF } from '../../src/core/tabNav';
import { useT } from '../../src/i18n';
import { forgetWallpaper, saveWallpaperAgain, useMyWallpapers, type SaveAgainResult } from '../../src/store/myWallpapers';
import { chromeRadiusV2, editorialV2, fontScaleCap, spaceV2, textV2 } from '../../src/theme/tokensV2';
import { useColorsV2 } from '../../src/theme/useTokens';
import { haptic } from '../../src/ui/haptics';
import { textStyleFor } from '../../src/ui/i18nLayout';
import { PressableScale } from '../../src/ui/PressableScale';
import { Sheet } from '../../src/ui/Sheet';
import { LargeTitleFlatList, PillButton, SectionHeader, Skeleton } from '../../src/ui/v2';

/** The editorial card rhythm, between thumbnails in a row and between rows. */
const GAP = editorialV2.cardGap;
const COLUMNS = 3;
/** Thumbnails are phone-shaped (about 9 : 19.5). */
const THUMB_ASPECT = 19.5 / 9;
type LooseT = (key: string, params?: Record<string, string | number>) => string;

const sizeLabel = (w: MyWallpaper): string => `⁦${w.width} × ${w.height}⁩`;

function chunk(items: readonly MyWallpaper[]): MyWallpaper[][] {
  const rows: MyWallpaper[][] = [];
  for (let i = 0; i < items.length; i += COLUMNS) rows.push(items.slice(i, i + COLUMNS));
  return rows;
}

const rowKey = (row: readonly MyWallpaper[]): string => row.map((w) => w.id).join('|');

type RowProps = {
  row: readonly MyWallpaper[];
  width: number;
  height: number;
  onOpen: (item: MyWallpaper) => void;
};

/** One row of thumbnails (memoised; a row only re-renders when its items or size change). */
const ThumbRow = memo(function ThumbRow({ row, width, height, onOpen }: RowProps) {
  const { c } = useColorsV2();
  const { t } = useT();
  const tl = t as unknown as LooseT;
  const box = useMemo(() => [styles.thumb, { width, height, backgroundColor: c.fill }], [width, height, c.fill]);
  return (
    <View style={styles.row}>
      {row.map((item) => (
        <PressableScale
          key={item.id}
          onPress={() => onOpen(item)}
          haptic="select"
          accessibilityRole="button"
          accessibilityLabel={t('tabs.wallpapersTab.mine.itemA11y', { kind: tl(myWallpaperKindKey(item.kind)), size: sizeLabel(item) })}
          accessibilityHint={t('tabs.wallpapersTab.mine.itemHint')}
          style={box}
        >
          <ExpoImage source={{ uri: item.uri }} style={styles.fill} contentFit="cover" cachePolicy="memory-disk" transition={0} recyclingKey={item.id} />
        </PressableScale>
      ))}
    </View>
  );
});

export default function WallpapersTab() {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const tl = t as unknown as LooseT;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { items, loaded } = useMyWallpapers();
  const [open, setOpen] = useState<MyWallpaper | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveAgainResult | null>(null);

  const thumbW = Math.max(1, Math.floor((width - spaceV2.lg * 2 - GAP * (COLUMNS - 1)) / COLUMNS));
  const thumbH = Math.round(thumbW * THUMB_ASPECT);
  const rows = useMemo(() => chunk(items), [items]);

  const onOpen = useCallback((item: MyWallpaper) => {
    setResult(null);
    setOpen(item);
  }, []);
  const onClose = useCallback(() => {
    setOpen(null);
    setResult(null);
  }, []);

  const onSaveAgain = async () => {
    if (!open || saving) return;
    setSaving(true);
    const res = await saveWallpaperAgain(open);
    setSaving(false);
    haptic(res === 'saved' ? 'success' : 'warning');
    setResult(res);
  };

  const onDelete = () => {
    if (!open) return;
    const target = open;
    Alert.alert(t('tabs.wallpapersTab.mine.deleteTitle'), t('tabs.wallpapersTab.mine.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          haptic('warning');
          setOpen(null);
          setResult(null);
          void forgetWallpaper(target.id);
        },
      },
    ]);
  };

  const onOpenClip = () => {
    if (!open?.loopId) return;
    const id = open.loopId;
    setOpen(null);
    router.push({ pathname: '/live/[id]', params: { id } });
  };

  const renderRow: ListRenderItem<MyWallpaper[]> = useCallback(
    ({ item }) => <ThumbRow row={item} width={thumbW} height={thumbH} onOpen={onOpen} />,
    [thumbW, thumbH, onOpen],
  );

  const footnote = [textV2.footnote, textStyleFor(script, textV2.footnote), { color: c.inkSecondary }];
  let resultText: string | null = null;
  if (result === 'saved') resultText = t('tabs.wallpapersTab.mine.saved');
  else if (result === 'denied') resultText = t('wallpaper.status.denied');
  else if (result === 'missing') resultText = t('tabs.wallpapersTab.mine.missing');
  else if (result === 'error') resultText = t('tabs.wallpapersTab.mine.failed');

  // My wallpapers waits as thumbnail-shaped skeletons (never a false "nothing here yet").
  const mineWait = loaded ? null : (
    <View style={styles.skeletonRow} accessible accessibilityRole="progressbar" accessibilityLabel={t('tabs.wallpapersTab.mine.loading')}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} width={thumbW} height={thumbH} radius={chromeRadiusV2.card} />
      ))}
    </View>); // i18n-ignore (code after a JSX element)
  const mineEmpty =
    loaded && items.length === 0 ? (
      <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={footnote}>
        {t('tabs.wallpapersTab.mine.empty')}
      </Text>) : null; // i18n-ignore (code after a JSX element)

  const header = (
    <View style={styles.body}>
      {/* 1. Live Photo from a clip (the Live Photo maker, formerly the Live tab). */}
      <View>
        <SectionHeader
          flushTop
          eyebrow={t('tabs.wallpapersTab.liveEntry.eyebrow')}
          title={t('tabs.wallpapersTab.liveEntry.title')}
          body={t('tabs.wallpapersTab.liveEntry.body')}
        />
        <PillButton
          label={t('tabs.wallpapersTab.liveEntry.action')}
          variant="filled"
          icon="film"
          block
          accessibilityHint={t('tabs.wallpapersTab.liveEntry.hint')}
          onPress={() => router.push(LIVE_MAKER_HREF)}
        />
      </View>
      {/* 2. T76: the photo collage maker. */}
      <View>
        <SectionHeader
          eyebrow={t('tabs.wallpapersTab.collageEntry.eyebrow')}
          title={t('tabs.wallpapersTab.collageEntry.title')}
          body={t('tabs.wallpapersTab.collageEntry.body')}
        />
        <PillButton
          label={t('wallpaper.collage.entry')}
          variant="tinted"
          icon="grid"
          block
          accessibilityHint={t('wallpaper.collage.entryHint')}
          onPress={() => router.push('/collage')}
        />
      </View>
      {/* 3. My wallpapers: the header here, the thumbnails are the list rows below. */}
      <View>
        <SectionHeader
          eyebrow={t('tabs.wallpapersTab.mine.eyebrow')}
          title={t('tabs.wallpapersTab.mine.title')}
          body={t('tabs.wallpapersTab.mine.body')}
        />
        {mineWait}
        {mineEmpty}
      </View>
    </View>); // i18n-ignore (code after a JSX element)

  const sheetW = Math.min(width - spaceV2.lg * 4, 240);
  const sheetH = open ? Math.round((sheetW * open.height) / open.width) : 0;

  return (
    <>
      <LargeTitleFlatList
        title={t('tabs.wallpapers')}
        subtitle={t('tabs.wallpapersTab.subtitle')}
        header={header}
        data={rows}
        renderItem={renderRow}
        keyExtractor={rowKey}
      />
      <Sheet visible={open !== null} onClose={onClose} title={open ? tl(myWallpaperKindKey(open.kind)) : t('tabs.wallpapersTab.mine.title')}>
        {open ? (
          <View style={styles.sheetBody}>
            <View style={[styles.preview, { width: sheetW, height: Math.min(sheetH, sheetW * 2.4), backgroundColor: c.fill }]}>
              <ExpoImage
                source={{ uri: open.uri }}
                style={styles.fill}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={0}
                accessibilityLabel={t('tabs.wallpapersTab.mine.itemA11y', { kind: tl(myWallpaperKindKey(open.kind)), size: sizeLabel(open) })}
              />
            </View>
            {resultText ? (
              <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={footnote} accessibilityLiveRegion="polite">
                {resultText}
              </Text>
            ) : null}
            <PillButton label={t('tabs.wallpapersTab.mine.saveAgain')} variant="filled" icon="download" block busy={saving} onPress={() => void onSaveAgain()} />
            {open.loopId ? <PillButton label={t('tabs.wallpapersTab.mine.openClip')} variant="tinted" icon="film" block onPress={onOpenClip} /> : null}
            <PillButton label={t('common.delete')} variant="destructive" icon="trash-2" block onPress={onDelete} />
          </View>
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spaceV2.lg, paddingBottom: spaceV2.lg },
  // Each row is a list item, so it carries the side gutter and the gap below it.
  row: { flexDirection: 'row', gap: GAP, paddingHorizontal: spaceV2.lg, marginBottom: GAP },
  thumb: { borderRadius: chromeRadiusV2.card, overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  skeletonRow: { flexDirection: 'row', gap: GAP },
  sheetBody: { gap: spaceV2.md, alignItems: 'stretch' },
  preview: { alignSelf: 'center', borderRadius: chromeRadiusV2.card, overflow: 'hidden' },
});
