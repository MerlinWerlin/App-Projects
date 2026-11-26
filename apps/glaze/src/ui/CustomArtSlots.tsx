// Owner 2026-11-15 ("make your own theme, be creative"): "Your artwork" on the Widgets tab (Small).
// Five slots, Custom 1 to Custom 5, one per Home Screen widget of the same name
// (targets/widget/CustomArtWidgets.swift). Tapping an empty slot opens the system photo picker with
// its square crop (pickCustomArtPhoto); the picture is resized and kept in the App Group on this
// device only (src/native/customArt.ts), and every change reloads the widgets. A filled slot has
// Replace and Remove. Hidden without the native bridge (Expo Go, Android, an older build).
import { Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ARTWORK_GROUPS, sizeOfArtworkNumber } from '../core/artworkSlots';
import type { CustomArtList } from '../core/customArtSlots';
import type { WidgetArtSize } from '../core/widgetArtLibrary';
import { useT } from '../i18n';
import { customArt } from '../native/customArt';
import { chromeRadiusV2, continuous, fontScaleCap, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { WatchHowButton } from './HowToSheet';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';
import { pickCustomArtPhoto } from './pickCustomArtPhoto';
import { PillButton } from './PillButton';

type Props = {
  /** Opens the Widgets tab's how-to video (the same one as the corner Watch how). */
  onWatchHow: () => void;
  style?: StyleProp<ViewStyle>;
};

const THUMB = 96;
/** Owner 2026-11-27: Custom 6-7 (medium) and 8-9 (large) show in their widget's shape. */
const THUMB_SIZE: Record<WidgetArtSize, { width: number; height: number }> = {
  small: { width: THUMB, height: THUMB },
  medium: { width: 132, height: 62 },
  large: { width: 92, height: 96 },
};

export function CustomArtSlots({ onWatchHow, style }: Props) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const label = (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];
  const [slots, setSlots] = useState<CustomArtList | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const list = await customArt.list();
    if (alive.current) setSlots(list);
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);
  // 1.0.39: a theme artwork added from My widget art ("Add to Custom n") shows here at once.
  useEffect(() => customArt.subscribe(() => void load().catch(() => undefined)), [load]);

  const choose = useCallback(
    async (n: number) => {
      if (busy !== null) return;
      setNote(null);
      const picked = await pickCustomArtPhoto(sizeOfArtworkNumber(n) === 'small' ? 'square' : 'widget');
      if (picked.kind === 'cancelled') return;
      if (picked.kind !== 'picked') {
        if (alive.current) setNote(t(picked.kind === 'denied' ? 'tabs.widgetsTab.custom.denied' : 'tabs.widgetsTab.custom.failed'));
        return;
      }
      setBusy(n);
      const ok = await customArt.set(n, picked.uri);
      if (!alive.current) return;
      setBusy(null);
      haptic(ok ? 'success' : 'warning');
      if (!ok) setNote(t('tabs.widgetsTab.custom.failed'));
      await load();
    },
    [busy, load, t],
  );

  const remove = useCallback(
    (n: number) => {
      if (busy !== null) return;
      Alert.alert(t('tabs.widgetsTab.custom.removeTitle', { n }), t('tabs.widgetsTab.custom.removeBody', { n }), [
        { text: t('tabs.widgetsTab.custom.cancel'), style: 'cancel' },
        {
          text: t('tabs.widgetsTab.custom.remove'),
          style: 'destructive',
          onPress: () => {
            setBusy(n);
            customArt
              .clear(n)
              .then(() => load())
              .catch(() => undefined)
              .finally(() => {
                if (alive.current) setBusy(null);
              });
          },
        },
      ]);
    },
    [busy, load, t],
  );

  if (slots === null) return null;

  return (
    <View style={[styles.wrap, style]}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('headline')} style={[...label('headline'), { color: c.ink }]}>
        {t('tabs.widgetsTab.custom.title')}
      </Text>
      <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...label('subhead'), { color: c.inkSecondary }]}>
        {t('tabs.widgetsTab.custom.makeItYours')}
      </Text>
      {ARTWORK_GROUPS.map((g) => (
        <View key={g.size} style={styles.section}>
          {/* Owner 2026-11-27: Small 1-5, Medium 6-7, Large 8-9, the same numbers as Artwork. */}
          <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...label('footnote'), styles.sectionTitle, { color: c.inkSecondary }]}>
            {`${t(`ui.seamless.sizes.${g.size}` as never)} · ${g.first}–${g.first + g.count - 1}`}
          </Text>
          {slots.slice(g.first - 1, g.first - 1 + g.count).map((uri, i) => {
        const n = g.first + i;
        const thumbSize = THUMB_SIZE[g.size];
        const name = t('tabs.widgetsTab.custom.slot', { n });
        const working = busy === n;
        if (!uri) {
          return (
            <Pressable
              key={n}
              onPress={() => choose(n)}
              disabled={busy !== null}
              accessibilityRole="button"
              accessibilityLabel={t('tabs.widgetsTab.custom.addA11y', { n })}
              style={({ pressed }) => [styles.row, { borderColor: c.separator, opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={[styles.thumb, thumbSize, styles.empty, continuous, { borderColor: c.tint, backgroundColor: c.fill }]}>
                <Feather name="plus" size={28} color={c.tint} />
              </View>
              <View style={styles.text}>
                <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...label('body'), styles.bold, { color: c.ink }]}>{name}</Text>
                <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...label('footnote'), { color: c.tint }]}>
                  {working ? t('tabs.widgetsTab.custom.saving') : t('tabs.widgetsTab.custom.add')}
                </Text>
              </View>
            </Pressable>
          );
        }
        return (
          <View key={n} style={[styles.row, { borderColor: c.separator }]}>
            <ExpoImage
              source={{ uri }}
              recyclingKey={uri}
              cachePolicy="none"
              contentFit="cover"
              style={[styles.thumb, thumbSize, { backgroundColor: c.surfaceRaised }]}
              accessible
              accessibilityLabel={t('tabs.widgetsTab.custom.filledA11y', { n })}
              accessibilityIgnoresInvertColors
            />
            <View style={styles.text}>
              <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...label('body'), styles.bold, { color: c.ink }]}>{name}</Text>
              <View style={styles.actions}>
                <PillButton
                  label={t('tabs.widgetsTab.custom.replace')}
                  variant="tinted"
                  size="small"
                  busy={working}
                  disabled={busy !== null && !working}
                  accessibilityLabel={t('tabs.widgetsTab.custom.replaceA11y', { n })}
                  onPress={() => choose(n)}
                />
                <PillButton
                  label={t('tabs.widgetsTab.custom.remove')}
                  variant="plain"
                  size="small"
                  disabled={busy !== null}
                  accessibilityLabel={t('tabs.widgetsTab.custom.removeA11y', { n })}
                  onPress={() => remove(n)}
                />
              </View>
            </View>
          </View>
        );
          })}
        </View>
      ))}
      {note ? (
        <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...label('footnote'), { color: c.warn }]}>
          {note}
        </Text>
      ) : null}
      <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...label('footnote'), { color: c.inkSecondary }]}>
        {t('tabs.widgetsTab.custom.privacy')}
      </Text>
      <WatchHowButton onPress={onWatchHow} style={styles.how} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spaceV2.sm },
  section: { gap: spaceV2.xs },
  sectionTitle: { marginTop: spaceV2.sm, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, minHeight: sizeV2.touch, paddingVertical: spaceV2.sm, borderTopWidth: StyleSheet.hairlineWidth },
  thumb: { width: THUMB, height: THUMB, borderRadius: chromeRadiusV2.control },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: spaceV2.xs },
  bold: { fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.xs },
  how: { marginTop: spaceV2.xs },
});
