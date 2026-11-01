import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../src/i18n/react';
import { useCast } from '../src/state/cast';
import { space, textStyle } from '../src/theme/design';
import { Text } from '../src/ui/Text';
import { PillButton } from '../src/ui/v2';

/**
 * AirPlay show (owner 1 Nov 2026): the TCL C7K takes Cast requests but never downloads files from
 * the phone, so the queue is shown full screen here while the phone is Screen Mirroring to the TV.
 * Black background, the photo fitted to the screen, tap the left / right half for previous / next.
 * A tip explains how to start Screen Mirroring (apps can't start it themselves). Videos need a
 * player in the next native build; for now they show a note.
 */
export default function AirPlayShowScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { snap } = useCast();
  const items = snap.queue.items;
  const [index, setIndex] = useState(() => Math.max(0, Math.min(items.length - 1, snap.queue.index)));
  const [tip, setTip] = useState(true);
  const item = items[Math.min(index, items.length - 1)] ?? null;
  const go = (d: number): void => {
    if (items.length === 0) return;
    setIndex((i) => (i + d + items.length) % items.length);
  };

  return (
    <View style={styles.fill}>
      {item && item.kind === 'photo' ? (
        <Image source={{ uri: item.uri }} style={styles.fill} resizeMode="contain" accessibilityLabel={item.title} />
      ) : item ? (
        <View style={[styles.fill, styles.center]}>
          <Text style={[textStyle('body'), styles.light, styles.pad]}>{t('app.airplayShow.video')}</Text>
        </View>
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.row]}>
        <Pressable style={styles.half} onPress={() => go(-1)} accessibilityRole="button" accessibilityLabel={t('app.airplayShow.prev')} />
        <Pressable style={styles.half} onPress={() => go(1)} accessibilityRole="button" accessibilityLabel={t('app.airplayShow.next')} />
      </View>
      <View style={[styles.top, { paddingTop: insets.top + space.xs }]} pointerEvents="box-none">
        <Text style={[textStyle('footnote'), styles.light]}>
          {items.length > 0 ? t('app.airplayShow.count', { n: String(Math.min(index, items.length - 1) + 1), total: String(items.length) }) : ''}
        </Text>
        <PillButton variant="plain" label={t('app.airplayShow.done')} onPress={() => router.back()} />
      </View>
      {tip ? (
        <View style={[styles.tip, { paddingBottom: insets.bottom + space.md }]}>
          <Text style={[textStyle('subheadline'), styles.light]}>{t('app.airplayShow.hint')}</Text>
          <PillButton variant="plain" label={t('app.airplayShow.hideHint')} onPress={() => setTip(false)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  pad: { padding: space.lg, textAlign: 'center' },
  light: { color: '#fff' },
  row: { flexDirection: 'row' },
  half: { flex: 1 },
  top: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
  },
  tip: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    gap: space.xs,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
});
