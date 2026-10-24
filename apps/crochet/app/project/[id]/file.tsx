// Pattern file viewer (PDF or image) with a reading ruler: a highlighter bar that dims everything else, which
// you drag or nudge line by line, and a counter docked at the bottom that can move the ruler as you count.
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { bump, mainCounter } from '../../../src/core/model';
import { t } from '../../../src/i18n';
import { changeCounters, updateProject, useProject } from '../../../src/store/data';
import { removeFile, shareFile } from '../../../src/store/files';
import { useSettings } from '../../../src/store/settings';
import { font, radius, space, useColors } from '../../../src/theme/tokens';
import { speakCount } from '../../../src/ui/Counter';
import { haptic } from '../../../src/ui/haptics';
import { Body, Button, IconButton } from '../../../src/ui/kit';
import { useToast } from '../../../src/ui/Toast';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export default function FileViewer() {
  const { id, f } = useLocalSearchParams<{ id: string; f: string }>();
  const p = useProject(id);
  const file = p?.files.find((x) => x.id === f);
  const { c } = useColors();
  const settings = useSettings();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [ruler, setRuler] = useState(true);
  const [follow, setFollow] = useState(true);
  const [h, setH] = useState(1);
  const [ratio, setRatio] = useState(0.7);
  const [barY, setBarY] = useState(file?.barY ?? 0.35);
  const [barH, setBarH] = useState(file?.barH ?? 0.07);
  const startY = useRef(0);
  const live = useRef({ barY, h });
  live.current = { barY, h };

  useEffect(() => {
    if (!settings.keepAwake) return;
    activateKeepAwakeAsync('file').catch(() => {});
    return () => {
      deactivateKeepAwake('file').catch(() => {});
    };
  }, [settings.keepAwake]);

  // Save the ruler position (debounced) so it's where you left it next time.
  useEffect(() => {
    if (!p || !file) return;
    const tm = setTimeout(() => {
      if (file.barY !== barY || file.barH !== barH) {
        updateProject(p.id, (q) => ({ ...q, files: q.files.map((x) => (x.id === file.id ? { ...x, barY, barH } : x)) }), false);
      }
    }, 600);
    return () => clearTimeout(tm);
  }, [barY, barH, p, file]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startY.current = live.current.barY;
        },
        onPanResponderMove: (_e, g) => {
          setBarY(clamp(startY.current + g.dy / Math.max(1, live.current.h), 0, 0.97));
        },
        onPanResponderRelease: () => haptic('select'),
      }),
    [],
  );

  if (!p || !file) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: space.l, paddingTop: insets.top + space.xl, gap: space.l }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Body muted>{t('files.missing')}</Body>
        <Button title={t('nav.back')} onPress={() => router.back()} />
      </View>
    );
  }
  const main = mainCounter(p)!;
  const step = (dir: 1 | -1) => {
    setBarY((y) => clamp(y + dir * barH, 0, 0.97));
  };

  const plus = () => {
    haptic('tap');
    changeCounters(p.id, (cs) => bump(cs, main.id, 1), main.value + 1);
    speakCount(main.label, main.value + 1);
    if (ruler && follow) step(1);
  };
  const minus = () => {
    haptic('select');
    changeCounters(p.id, (cs) => bump(cs, main.id, -1), Math.max(0, main.value - 1));
    if (ruler && follow) step(-1);
  };

  const onLayout = (e: LayoutChangeEvent) => setH(e.nativeEvent.layout.height);
  const top = barY * h;
  const height = barH * h;
  const androidPdf = file.kind === 'pdf' && Platform.OS !== 'ios';

  const removeThis = () => {
    updateProject(p.id, (q) => ({ ...q, files: q.files.filter((x) => x.id !== file.id) }));
    removeFile(file.uri);
    toast(t('files.removed'));
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.surface2 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingTop: insets.top, backgroundColor: c.bg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.s }}>
        <IconButton icon="chevron-left" label={t('nav.back')} onPress={() => router.back()} />
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.bodyBold, fontSize: 16, color: c.ink }}>
          {file.name}
        </Text>
        <IconButton icon={ruler ? 'eye-off' : 'eye'} label={ruler ? t('ruler.hide') : t('ruler.show')} onPress={() => setRuler(!ruler)} />
        <IconButton icon="share" label={t('files.share')} onPress={() => shareFile(file.uri, file.kind === 'pdf' ? 'application/pdf' : undefined).then((r) => !r.ok && r.reason !== 'cancelled' && toast(r.message))} />
        <IconButton icon="trash-2" label={t('files.remove')} onLongPress={removeThis} onPress={() => toast(t('files.holdToRemove'))} />
      </View>

      <View style={{ flex: 1 }} onLayout={onLayout}>
        {androidPdf ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.l }}>
            <Feather name="file-text" size={40} color={c.ink3} />
            <Body muted style={{ textAlign: 'center' }}>
              {t('files.androidPdf')}
            </Body>
            <Button title={t('files.openWith')} icon="external-link" onPress={() => shareFile(file.uri, 'application/pdf').catch(() => {})} />
          </View>
        ) : file.kind === 'pdf' ? (
          <WebView
            source={{ uri: file.uri }}
            originWhitelist={['*']}
            allowFileAccess
            allowingReadAccessToURL={file.uri}
            style={{ flex: 1, backgroundColor: c.surface2 }}
            onError={() => toast(t('files.pdfFailed'))}
          />
        ) : (
          <ScrollView maximumZoomScale={5} minimumZoomScale={1} contentContainerStyle={{ flexGrow: 1 }} centerContent>
            <Image source={{ uri: file.uri }} style={{ width: '100%', aspectRatio: ratio }}
              contentFit="contain"
              accessibilityLabel={file.name}
              onLoad={(e) => {
                if (e.source.width > 0 && e.source.height > 0) setRatio(e.source.width / e.source.height);
              }}
            />
          </ScrollView>
        )}

        {ruler && !androidPdf ? (
          <>
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: top, backgroundColor: c.overlay }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: top + height, bottom: 0, backgroundColor: c.overlay }} />
            <View
              pointerEvents="box-none"
              style={{ position: 'absolute', left: 0, right: 0, top, height, borderTopWidth: 2, borderBottomWidth: 2, borderColor: c.accent, backgroundColor: c.highlight }}
            >
              <View
                {...pan.panHandlers}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={t('ruler.a11y')}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
                style={{ position: 'absolute', right: 6, top: '50%', marginTop: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}
              >
                <Feather name="move" size={20} color={c.accentInk} />
              </View>
            </View>
          </>
        ) : null}
      </View>

      <View style={{ backgroundColor: c.bg, paddingBottom: insets.bottom + space.s, paddingTop: space.s, paddingHorizontal: space.l, gap: space.s }}>
        {ruler && !androidPdf ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <IconButton icon="arrow-up" tone="soft" size={18} label={t('ruler.up')} onPress={() => step(-1)} />
            <IconButton icon="arrow-down" tone="soft" size={18} label={t('ruler.down')} onPress={() => step(1)} />
            <IconButton icon="minimize-2" tone="soft" size={18} label={t('ruler.thinner')} onPress={() => setBarH((v) => clamp(v - 0.01, 0.02, 0.3))} />
            <IconButton icon="maximize-2" tone="soft" size={18} label={t('ruler.thicker')} onPress={() => setBarH((v) => clamp(v + 0.01, 0.02, 0.3))} />
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: follow }}
              accessibilityLabel={t('ruler.follow')}
              onPress={() => {
                haptic('select');
                setFollow(!follow);
              }}
              style={{ flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}
            >
              <Feather name={follow ? 'check-square' : 'square'} size={18} color={c.accent} />
              <Text style={{ fontFamily: font.bodySemi, fontSize: 13, color: c.ink2 }}>{t('ruler.follow')}</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('counter.minusA11y', { label: main.label })}
            onPress={minus}
            style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}
          >
            <Feather name="minus" size={24} color={c.ink} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${main.label} ${main.value}`}>
            <Text style={{ fontFamily: font.heavy, fontSize: 12, color: c.ink2, textTransform: 'uppercase', letterSpacing: 1 }}>{main.label}</Text>
            <Text style={{ fontFamily: font.display, fontSize: 34, color: c.ink, fontVariant: ['tabular-nums'] }}>{main.value}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('counter.plusA11y', { label: main.label, value: main.value + 1 })}
            onPress={plus}
            style={({ pressed }) => ({ width: 110, height: 60, borderRadius: radius.pill, backgroundColor: pressed ? c.ink : c.accent, alignItems: 'center', justifyContent: 'center' })}
          >
            <Feather name="plus" size={30} color={c.accentInk} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
