// "My drawings" (T67, docs/MARKET.md §2.3 + §4.7): a free, local gallery of paper-check snapshots saved from the
// trace screen. Newest first; tap opens the before/after (the existing CompareView: reference vs your paper);
// delete asks first. Local only, never gated by Plus.
import { useCallback, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space, tabular } from '../../src/theme/tokens';
import { fitForView, type Drawing } from '../../src/core/drawings';
import { getTemplate } from '../../src/core/templates';
import { deleteDrawing, loadDrawings } from '../../src/native/drawings';
import { select, success } from '../../src/native/haptics';
import { CompareView } from '../../src/ui/CompareView';
import { EmptyStateV2 } from '../../src/ui/v2';
import { StaggerIn } from '../../src/ui/StaggerIn';
import { useT } from '../../src/i18n';
import { useTypography } from '../../src/theme/typography';

const GUTTER = space.xl;
const GRID_GAP = space.sm;
const COLS = 3;
const DATE_STYLE: Intl.DateTimeFormatOptions = { dateStyle: 'medium' };

export default function DrawingsScreen() {
  const ty = useTypography();
  const { c } = useTheme();
  const { t, date } = useT();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  // T86: the empty state's one action goes to Templates to pick something to trace.
  const traceSomething = useCallback(() => router.push('/templates'), [router]);
  const [list, setList] = useState<Drawing[] | null>(null);
  const [open, setOpen] = useState<Drawing | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadDrawings().then((l) => {
        if (alive) setList(l);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const close = useCallback(() => {
    select();
    setOpen(null);
  }, []);

  const confirmDelete = useCallback(
    (d: Drawing) => {
      select();
      Alert.alert(t('drawings.deleteTitle'), t('drawings.deleteBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('drawings.delete'),
          style: 'destructive',
          onPress: () => {
            deleteDrawing(d.id)
              .then((l) => {
                success();
                setList(l);
                setOpen(null);
              })
              .catch(() => Alert.alert(t('common.errorTitle'), t('drawings.deleteFailed')));
          },
        },
      ]);
    },
    [t],
  );

  const tile = Math.floor((width - GUTTER * 2 - GRID_GAP * (COLS - 1)) / COLS);
  const items = list ?? [];
  const view = { width, height };
  const fit = open ? fitForView(open.fit, view) : null;
  const template = open ? getTemplate(open.templateId) : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space.md, paddingBottom: space.xxl }}>
        {list === null ? null : items.length === 0 ? (
          <EmptyStateV2
            art="drawings"
            title={t('drawings.emptyTitle')}
            body={t('drawings.emptyBody')}
            action={{
              title: t('drawings.empty.action'),
              accessibilityHint: t('drawings.empty.actionHint'),
              icon: 'edit-3',
              onPress: traceSomething,
            }}
          />
        ) : (
          <>
            <Text
              maxFontSizeMultiplier={1.4}
              style={[{ ...ty.face('bodyMedium'), fontSize: 15, lineHeight: ty.lhOf(21), color: c.graphite }, tabular]}
            >
              {t('drawings.count', { count: items.length })}
            </Text>
            <Text
              maxFontSizeMultiplier={1.4}
              style={{ ...ty.face('body'), fontSize: 14, lineHeight: ty.lhOf(20), color: c.muted, marginBottom: space.md }}
            >
              {t('drawings.privacy')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {items.map((d, n) => (
                <StaggerIn
                  key={d.id}
                  index={n}
                  style={{ marginEnd: n % COLS === COLS - 1 ? 0 : GRID_GAP, marginBottom: GRID_GAP }}
                >
                  <Pressable
                    onPress={() => {
                      select();
                      setOpen(d);
                    }}
                    onLongPress={() => confirmDelete(d)}
                    delayLongPress={400}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={t('drawings.itemLabel', { date: date(d.createdAt, DATE_STYLE) })}
                    accessibilityHint={t('drawings.itemHint')}
                    style={({ pressed }) => ({
                      width: tile,
                      height: tile,
                      borderRadius: radius.sm,
                      overflow: 'hidden',
                      backgroundColor: c.card,
                      borderWidth: 1,
                      borderColor: c.line,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Image
                      source={{ uri: d.photoUri }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                  </Pressable>
                </StaggerIn>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={open !== null} animationType="fade" presentationStyle="fullScreen" onRequestClose={close}>
        {open && fit ? (
          <CompareView
            photo={{ uri: open.photoUri, width: open.photoWidth, height: open.photoHeight }}
            view={view}
            base={fit.base}
            transform={{ x: fit.x, y: fit.y, scale: fit.scale, rotation: fit.rotation, mirror: fit.mirror, locked: true }}
            template={template}
            overlayUri={template ? '' : open.sourceUri ?? ''}
            onClose={close}
            onDelete={() => confirmDelete(open)}
          />
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}
