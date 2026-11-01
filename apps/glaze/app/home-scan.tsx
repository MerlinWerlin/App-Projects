// T171 "Scan my Home Screen": iOS can't list installed apps, so the user picks screenshots of their
// Home Screen pages, Vision reads the labels on the phone (modules/glaze-home-scan through
// src/native/homeScan.ts), src/core/homeScan.ts matches the names to the catalogue, and the user
// confirms the list. Found apps keep their glyph; unknown names become custom apps drawn with their
// category family's glyph (T231: keyword rules on the phone, refined by Apple's public App Store
// search when online, src/native/appCategory.ts). T230: App Library list-view screenshots work too,
// and everything found starts ticked so one tap on Add (pinned at the bottom) takes it all.
// Screenshots are read on the device only and never uploaded. Without the native module (Expo Go,
// Android, the plain production build) the screen offers manual picking in add-app instead.

import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getById } from '../src/core/catalogue';
import type { AppFamily } from '../src/core/appCategory';
import { keywordFamilies } from '../src/core/appCategoryOnline';
import { MAX_SCREENSHOTS, applyScan, glyphForScannedName, pickedFromScan, scanHomeScreens, type OcrObservation, type ScanResult } from '../src/core/homeScan';
import { previewMonogram } from '../src/core/iconspec';
import { MONOGRAM_GLYPH } from '../src/core/monogram';
import { getAnyTheme } from '../src/core/plusThemes';
import { THEMES, type Theme } from '../src/core/themes';
import { refineAppFamilies } from '../src/native/appCategory';
import { homeScan } from '../src/native/homeScan';
import { IconCanvas } from '../src/render/IconCanvas';
import { openAppSettings } from '../src/render/saveWallpaper';
import { useStudio } from '../src/store/studio';
import { continuous, radiusV2, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../src/theme/tokensV2';
import { useColorsV2 } from '../src/theme/useTokens';
import { useToast } from '../src/ui/Toast';
import { haptic } from '../src/ui/haptics';
import { noMirror, textStyleFor } from '../src/ui/i18nLayout';
import { PressableScale } from '../src/ui/PressableScale';
import { InsetGroup, PillButton } from '../src/ui/v2';
import { useT, type Script } from '../src/i18n';

type Phase = 'intro' | 'reading' | 'confirm';
type Problem = 'denied' | 'failed' | 'empty' | null;
const ROW_ICON = 36;

function typeFor(script: Script, role: TypeRoleV2): TextStyle[] {
  return [textV2[role], textStyleFor(script, textV2[role])];
}

async function libraryDenied(): Promise<boolean> {
  try {
    const p = await ImagePicker.getMediaLibraryPermissionsAsync();
    return p.status === 'denied' && !p.canAskAgain;
  } catch {
    return false;
  }
}

export default function HomeScanScreen() {
  const { c } = useColorsV2();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { t, script } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => typeFor(script, role);
  const { state, update } = useStudio();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [problem, setProblem] = useState<Problem>(null);
  const [result, setResult] = useState<ScanResult>({ matched: [], unmatched: [] });
  const [offIds, setOffIds] = useState<ReadonlySet<string>>(new Set());
  const [offNames, setOffNames] = useState<ReadonlySet<string>>(new Set());
  const [families, setFamilies] = useState<Readonly<Record<string, AppFamily>>>({});
  // Bumped per scan and on unmount, so a late App Store answer never lands on another scan.
  const scanGen = useRef(0);

  useEffect(() => {
    let alive = true;
    homeScan
      .isAvailable()
      .then((a) => {
        if (alive) setAvailable(a.available);
      })
      .catch(() => {
        if (alive) setAvailable(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () => () => {
      scanGen.current++;
    },
    [],
  );

  const theme: Theme = getAnyTheme(state?.themeId) ?? THEMES[0];
  const picked = useMemo(() => pickedFromScan(result, { ids: offIds, names: offNames }), [result, offIds, offNames]);
  const ids = picked.catalogueIds;
  const names = picked.customNames;
  const chosen = ids.length + names.length;

  const pick = async () => {
    if (phase === 'reading') return;
    setProblem(null);
    let res: ImagePicker.ImagePickerResult;
    try {
      res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: MAX_SCREENSHOTS,
        orderedSelection: true,
        quality: 1,
        exif: false,
      });
    } catch {
      setProblem((await libraryDenied()) ? 'denied' : 'failed');
      haptic('warning');
      return;
    }
    if (res.canceled || !res.assets || res.assets.length === 0) return;
    setPhase('reading');
    const pages: OcrObservation[][] = [];
    for (const asset of res.assets.slice(0, MAX_SCREENSHOTS)) {
      if (!asset.uri || asset.type === 'video') continue;
      const r = await homeScan.recognizeText(asset.uri);
      if (r.ok) pages.push(r.lines);
    }
    if (pages.length === 0) {
      setPhase('intro');
      setProblem('failed');
      haptic('warning');
      return;
    }
    const found = scanHomeScreens(pages);
    if (found.matched.length === 0 && found.unmatched.length === 0) {
      setPhase('intro');
      setProblem('empty');
      haptic('warning');
      return;
    }
    setResult(found);
    // Everything found starts ticked; the user unticks what they don't want.
    setOffIds(new Set());
    setOffNames(new Set());
    // Families for unknown names: keyword rules now, App Store genres when they arrive (never blocks).
    const gen = ++scanGen.current;
    setFamilies(keywordFamilies(found.unmatched));
    if (found.unmatched.length > 0) {
      refineAppFamilies(found.unmatched)
        .then((f) => {
          if (scanGen.current === gen) setFamilies(f);
        })
        .catch(() => undefined);
    }
    setPhase('confirm');
    haptic('success');
  };

  const toggleId = (id: string) => {
    haptic('select');
    setOffIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleName = (name: string) => {
    haptic('select');
    setOffNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const addChosen = () => {
    if (!state || chosen === 0) return;
    const r = applyScan(state, { catalogueIds: ids, customNames: names, families });
    const next = r.state;
    update(() => next);
    haptic('success');
    toast.show(t('addApp.scan.added', { count: r.addedCatalogue + r.addedCustom }), 'success');
    router.navigate('/icons');
  };

  const manual = () => {
    haptic('select');
    router.replace('/add-app');
  };

  const icon = (appId: string, name: string, glyph: string) => (
    <View style={[styles.iconTile, continuous, { backgroundColor: c.fill }]}>
      <IconCanvas
        spec={{
          appId,
          shape: theme.iconStyle.shape,
          background: theme.iconStyle.background,
          glyph,
          glyphColour: theme.iconStyle.glyphColour,
          glyphScale: theme.iconStyle.glyphScale,
          monogram: previewMonogram(name, glyph, theme.iconStyle),
        }}
        size={ROW_ICON}
        style={noMirror}
      />
    </View>
  );

  const row = (key: string, name: string, sub: string | null, on: boolean, art: ReactNode, onPress: () => void) => {
    return (
      <PressableScale
        key={key}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={name}
        accessibilityHint={t('addApp.scan.toggleHint')}
        onPress={onPress}
        feedback="fade"
        style={styles.row}
      >
        {art}
        <View style={styles.flex}>
          <Text style={[...ts('body'), { color: c.ink }]} numberOfLines={1}>
            {name}
          </Text>
          {sub ? (
            <Text style={[...ts('footnote'), { color: c.inkSecondary }]} numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
        </View>
        <Feather name={on ? 'check-circle' : 'circle'} size={22} color={on ? c.tint : c.inkTertiary} />
      </PressableScale>
    );
  };

  const problemText =
    problem === 'denied' ? t('addApp.scan.photosDenied') : problem === 'empty' ? t('addApp.scan.nothingFound') : problem === 'failed' ? t('addApp.scan.readFailed') : null;

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spaceV2.xxl }]}>
        {phase !== 'confirm' ? (
          <View style={[styles.card, continuous, { backgroundColor: c.surface }]}>
            <View style={[styles.badge, continuous, { backgroundColor: c.tintSoft }]}>
              <Feather name="lock" size={16} color={c.onTintSoft} />
            </View>
            <Text style={[...ts('body'), { color: c.ink }]}>{t('addApp.scan.intro')}</Text>
            <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('addApp.scan.howTo')}</Text>
            {available === false ? (
              <>
                <Text style={[...ts('callout'), { color: c.inkSecondary }]}>{t('addApp.scan.unavailable')}</Text>
                <PillButton label={t('addApp.scan.manual')} icon="list" block haptic={false} onPress={manual} accessibilityHint={t('addApp.scan.manualHint')} />
              </>
            ) : (
              <PillButton
                label={phase === 'reading' ? t('addApp.scan.reading') : t('addApp.scan.pick')}
                icon="image"
                block
                busy={phase === 'reading'}
                disabled={available !== true || phase === 'reading'}
                onPress={pick}
                accessibilityHint={t('addApp.scan.pickHint')}
              />
            )}
            {problemText ? (
              <Text style={[...ts('footnote'), { color: c.warn }]} accessibilityRole="alert">
                {problemText}
              </Text>
            ) : null}
            {problem === 'denied' ? <PillButton label={t('iconsUi.openSettings')} icon="settings" variant="tinted" size="small" onPress={openAppSettings} /> : null}
          </View>
        ) : null}

        {phase === 'confirm' ? (
          <>
            {result.matched.length > 0 ? (
              <InsetGroup header={t('addApp.scan.foundHeader', { count: result.matched.length })} footer={t('addApp.scan.foundFooter')}>
                {result.matched.map((m) => {
                  const entry = getById(m.catalogueId);
                  const sub = m.label && m.label !== m.name ? t('addApp.scan.readAs', { label: m.label }) : null;
                  return row(`id:${m.catalogueId}`, m.name, sub, !offIds.has(m.catalogueId), icon(m.catalogueId, m.name, entry?.glyph ?? MONOGRAM_GLYPH), () => toggleId(m.catalogueId));
                })}
              </InsetGroup>
            ) : null}
            {result.unmatched.length > 0 ? (
              <InsetGroup header={t('addApp.scan.customHeader', { count: result.unmatched.length })} footer={t('addApp.scan.customFooter')}>
                {result.unmatched.map((n) => row(`name:${n}`, n, null, !offNames.has(n), icon(`custom-${n}`, n, glyphForScannedName(n, families[n])), () => toggleName(n)))}
              </InsetGroup>
            ) : null}
            {result.unmatched.length > 0 ? (
              <Text style={[...ts('footnote'), styles.side, { color: c.inkSecondary }]}>{t('addApp.scan.categoryNote')}</Text>
            ) : null}
            <View style={[styles.side, styles.gap]}>
              <PillButton
                label={t('addApp.scan.again')}
                icon="refresh-cw"
                variant="plain"
                block
                haptic={false}
                onPress={() => {
                  haptic('select');
                  setPhase('intro');
                }}
              />
              <PillButton label={t('addApp.scan.manual')} icon="list" variant="plain" block haptic={false} onPress={manual} accessibilityHint={t('addApp.scan.manualHint')} />
            </View>
          </>
        ) : null}
      </ScrollView>
      {phase === 'confirm' ? (
        <View style={[styles.footer, { backgroundColor: c.bg, paddingBottom: insets.bottom + spaceV2.md }]}>
          <PillButton label={t('addApp.scan.add', { count: chosen })} icon="plus" block disabled={chosen === 0 || !state} onPress={addChosen} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingTop: spaceV2.lg, gap: spaceV2.lg },
  side: { marginHorizontal: spaceV2.lg },
  footer: { paddingHorizontal: spaceV2.lg, paddingTop: spaceV2.md },
  gap: { gap: spaceV2.sm },
  flex: { flex: 1, flexShrink: 1 },
  card: { marginHorizontal: spaceV2.lg, borderRadius: radiusV2.group, padding: spaceV2.lg, gap: spaceV2.md },
  badge: {
    width: sizeV2.rowIcon,
    height: sizeV2.rowIcon,
    borderRadius: radiusV2.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.md,
    minHeight: sizeV2.rowMin,
    paddingHorizontal: spaceV2.lg,
    paddingVertical: spaceV2.sm,
  },
  iconTile: { borderRadius: radiusV2.control, padding: spaceV2.xxs },
});
