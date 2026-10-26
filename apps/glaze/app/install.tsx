// /install: add the Icon Studio set to the Home Screen.
// Bulk: render icons -> one web clip .mobileconfig -> served to Safari from 127.0.0.1 on this
// iPhone (T126, src/native/profileServer.ts) -> Allow -> Settings. Builds without the native
// server (Expo Go, old builds) fall back to the share sheet and recommend Shortcuts.
// Shortcuts: save icons to a "Glaze icons" Photos album -> per-app checklist with copyable URL.
// Delivery path chosen in docs/SPIKE_PROFILE.md. Free feature: nothing here reads Plus.
// Design v2 (docs/DESIGN_V2.md §9, T55): method choice as two squircle cards (the recommended one
// raised with a "Recommended" pill), steps and the Shortcuts checklist in inset groups with
// numbered pastel tiles, every button a PillButton.

import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from '../src/native/fs';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Illustration } from '../src/core/install';
import type { IconSpec } from '../src/core/iconspec';
import {
  PHOTO_ICON_SIZE,
  PHOTOS_ALBUM,
  PROFILE_ICON_SIZE,
  PROFILE_MIME,
  SHORTCUTS_URL,
  batchFraction,
  buildInstallProfiles,
  checklistCount,
  iconFilename,
  isProfileStepDone,
  joinPath,
  overallProgress,
  planInstall,
  profileStepCards,
  profileThemeName,
  shortcutItems,
  toggleProfileStep,
  toggleShortcutDone,
  withoutMissingImages,
  type InstallChoice,
  type InstallPhase,
  type ShortcutItem,
} from '../src/core/install';
import {
  SHORTCUT_UNDO_STEPS,
  availableMethods,
  bulkSelectable,
  effectiveChoice,
  installSummary,
  recommendedMethod,
  showBulkCard,
  showMethodPicker,
} from '../src/core/installMethods';
import { profileRoute } from '../src/core/profileServer';
import { profileServer } from '../src/native/profileServer';
import { PROFILE_INSTALL_ENABLED } from '../src/config/install';
import { getTheme } from '../src/core/themes';
import { t as tStatic, useT, type Script } from '../src/i18n';
import {
  IconCanvas,
  OffscreenIconRenderer,
  isRenderCancelled,
  useIconBatchRenderer,
  type RenderCancelToken,
} from '../src/render';
import { openAppSettings } from '../src/render/saveWallpaper';
import { androidNative } from '../src/native/android';
import { useInstallState } from '../src/store/install';
import { overrideImageUris } from '../src/core/studio';
import { loadStudio, studioSpecs, type StudioState } from '../src/store/studio';
import {
  continuous,
  iconTileRadius,
  radiusV2,
  shadowV2,
  sizeV2,
  spaceV2,
  textV2,
  type TypeRoleV2,
} from '../src/theme/tokensV2';
import { useColorsV2 } from '../src/theme/useTokens';
import { ProgressBar } from '../src/ui/ProgressBar';
import { IconGridSkeleton } from '../src/ui/Skeleton';
import { StepIllustration } from '../src/ui/StepCard';
import { ContextTip } from '../src/ui/ContextTip';
import { haptic } from '../src/ui/haptics';
import { PressableScale } from '../src/ui/PressableScale';
import { Chevron, textStyleFor } from '../src/ui/i18nLayout';
import { InsetGroup, InsetRow, PillButton, SquircleCard } from '../src/ui/v2';

/** A v2 type role plus the script's line-height adjustment. */
function typeFor(script: Script, role: TypeRoleV2): TextStyle[] {
  return [textV2[role], textStyleFor(script, textV2[role])];
}

/** Profile step cards (src/core/install.ts profileStepCards ids) to catalogue keys. */
const CARD_KEYS = {
  save: { titleKey: 'install.cards.save.title', bodyKey: 'install.cards.save.body' },
  open: { titleKey: 'install.cards.open.title', bodyKey: 'install.cards.open.body' },
  install: { titleKey: 'install.cards.install.title', bodyKey: 'install.cards.install.body' },
  'not-verified': { titleKey: 'install.cards.notVerified.title', bodyKey: 'install.cards.notVerified.body' },
  'hide-old': { titleKey: 'install.cards.hideOld.title', bodyKey: 'install.cards.hideOld.body' },
  remove: { titleKey: 'install.cards.remove.title', bodyKey: 'install.cards.remove.body' },
  // T126: Safari route.
  safari: { titleKey: 'install.safari.cards.safari.title', bodyKey: 'install.safari.cards.safari.body' },
  allow: { titleKey: 'install.safari.cards.allow.title', bodyKey: 'install.safari.cards.allow.body' },
  settings: { titleKey: 'install.safari.cards.settings.title', bodyKey: 'install.safari.cards.settings.body' },
  home: { titleKey: 'install.safari.cards.home.title', bodyKey: 'install.safari.cards.home.body' },
} as const;
type CardId = keyof typeof CARD_KEYS;
const isCardId = (id: string): id is CardId => Object.prototype.hasOwnProperty.call(CARD_KEYS, id);

const tapLight = () => haptic('select');
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

type SavedProfile = { filename: string; uri: string };
type PhotoStatus = 'idle' | 'saving' | 'saved' | 'denied' | 'error';

/** Subfolder of the cache directory, created on demand. */
async function cacheSubdir(name: string): Promise<string> {
  const base = FileSystem.cacheDirectory;
  if (!base) throw new Error(tStatic('install.errors.noCache'));
  const dir = joinPath(base, `${name}/`);
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

/** Full Photos access is needed to find or create the album. True when granted or limited. */
async function ensurePhotosAccess(): Promise<boolean> {
  try {
    const current = await MediaLibrary.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const res = await MediaLibrary.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}

/** Put saved assets in the "Glaze icons" album. Returns false if the album step failed. */
async function addToAlbum(assets: MediaLibrary.Asset[]): Promise<boolean> {
  if (assets.length === 0) return true;
  try {
    const existing = await MediaLibrary.getAlbumAsync(PHOTOS_ALBUM);
    if (existing) {
      await MediaLibrary.addAssetsToAlbumAsync(assets, existing, false);
    } else {
      const album = await MediaLibrary.createAlbumAsync(PHOTOS_ALBUM, assets[0], false);
      if (assets.length > 1) await MediaLibrary.addAssetsToAlbumAsync(assets.slice(1), album, false);
    }
    return true;
  } catch {
    return false;
  }
}

export default function InstallScreen() {
  const { c } = useColorsV2();
  const { t, script, isRTL, formatNumber, locale } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => typeFor(script, role);
  const router = useRouter();
  // T126: can this build serve the profile to Safari? (false in Expo Go, on Android, old builds)
  const [serverAvailable] = useState<boolean>(() => profileServer.status().available);
  const route = profileRoute(serverAvailable);
  const [studio, setStudio] = useState<StudioState | null>(null);  const [missing, setMissing] = useState<ReadonlySet<string>>(() => new Set<string>());  const [loadError, setLoadError] = useState<string | null>(null);  const install = useInstallState();
  const renderer = useIconBatchRenderer();
  const alive = useRef(true);
  // Cancel token for the current icon batch: set on Cancel or when leaving the screen.
  const cancelToken = useRef<RenderCancelToken | null>(null);
  // Bulk profile
  const [phase, setPhase] = useState<InstallPhase>('idle');
  const [step, setStep] = useState({ done: 0, total: 0 });
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);  const [bulkError, setBulkError] = useState<string | null>(null);  // On-device render time for the last bulk render (oversight D4-1: owner reports it).
  const [renderTiming, setRenderTiming] = useState<string | null>(null);
  // Shortcuts / Photos
  const [photoStatus, setPhotoStatus] = useState<PhotoStatus>('idle');
  const [photoStep, setPhotoStep] = useState({ done: 0, total: 0 });
  const [photoNote, setPhotoNote] = useState<string | null>(null);  const [shortcutsError, setShortcutsError] = useState<string | null>(null);  const [expanded, setExpanded] = useState<string | null>(null);  const [copied, setCopied] = useState<string | null>(null);  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const s = await loadStudio();
      // Override images deleted from disk fall back to the theme artwork (never a blank icon).
      const gone = new Set<string>();
      for (const uri of overrideImageUris(s)) {
        if (!uri.startsWith('file:')) continue;
        try {
          if (!(await FileSystem.getInfoAsync(uri)).exists) gone.add(uri);
        } catch {
          // Can't tell: keep the image.
        }
      }
      if (alive.current) {
        setMissing(gone);
        setStudio(s);
      }
    } catch (e) {
      if (alive.current) setLoadError(errText(e));
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
      if (cancelToken.current) cancelToken.current.cancelled = true;
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      profileServer.stop();
    };
  }, [load]);

  const resolved = useMemo(
    () => withoutMissingImages(studio ? studioSpecs(studio) : [], missing),
    [studio, missing],
  );
  const specs: IconSpec[] = resolved.specs;
  const plan = useMemo(() => planInstall(specs), [specs]);
  const themeName = profileThemeName(getTheme(studio?.themeId)?.name ?? null);
  const backdrop = studio?.wallpaperColour ?? '#000000';
  // T60: the profile method can be switched off in src/config/install.ts (App Review risk).
  const methodOpts = {
    profileEnabled: PROFILE_INSTALL_ENABLED,
    profileCount: plan.profile.length,
    profileServer: serverAvailable,
  };
  // Owner 25 Oct: Bulk whenever it can be used; Shortcuts only as the fallback (src/core/installMethods.ts).
  const choice: InstallChoice = effectiveChoice(install.state.choice, methodOpts, install.state.choiceExplicit === true);
  const items: ShortcutItem[] = useMemo(() => shortcutItems(specs, choice), [specs, choice]);
  const profileKey = `profile:${themeName}`;
  const cards = useMemo(() => profileStepCards(Math.max(1, profiles.length), route), [profiles.length, route]);

  const bulkBusy = phase !== 'idle' && phase !== 'done';
  const photosBusy = photoStatus === 'saving';
  const busy = bulkBusy || photosBusy;

  // ---- bulk ----

  const shareProfile = useCallback(async (p: SavedProfile) => {
    await Sharing.shareAsync(p.uri, {
      mimeType: PROFILE_MIME,
      dialogTitle: t('install.bulk.dialogTitle'),
    });
  }, [t]);

  /**
   * T126: serve one saved profile to Safari and open it there. Returns false when this build has
   * no server after all (the caller then uses the share sheet). Never throws.
   */
  const openInSafari = useCallback(
    async (p: SavedProfile): Promise<boolean> => {
      const outcome = await profileServer.serveAndOpen(p.uri, {
        lang: String(locale),
        dir: isRTL ? 'rtl' : 'ltr',
        title: t('install.safari.page.title'),
        body: t('install.safari.page.body'),
        button: t('install.safari.page.button'),
      });
      if (outcome.kind === 'unavailable') return false;
      if (outcome.kind === 'failed' && alive.current) setBulkError(`${t('install.safari.failed')} (${outcome.message})`);
      return true;
    },
    [isRTL, locale, t],
  );

  const generate = useCallback(async () => {
    if (busy || plan.profile.length === 0) return;
    tapLight();
    setBulkError(null);
    setProfiles([]);
    setRenderTiming(null);
    try {
      if (route === 'share' && !(await Sharing.isAvailableAsync())) {
        throw new Error(t('install.errors.noSharing'));
      }
      const total = plan.profile.length;
      setStep({ done: 0, total });
      setPhase('rendering');
      const token: RenderCancelToken = { cancelled: false };
      cancelToken.current = token;
      const renderStart = Date.now();
      const rendered = await renderer.renderAll(
        plan.profile,
        PROFILE_ICON_SIZE,
        (done, tot) => {
          if (alive.current) setStep({ done, total: tot });
        },
        token,
      );
      cancelToken.current = null;
      if (alive.current) setRenderTiming(timingText(rendered.length, Date.now() - renderStart));
      setPhase('building');
      const files = buildInstallProfiles(plan.profile, rendered, themeName);
      if (files.length === 0) throw new Error(t('install.errors.noIcons'));
      setPhase('saving');
      const dir = await cacheSubdir('profiles');
      const saved: SavedProfile[] = [];
      for (let i = 0; i < files.length; i++) {
        setStep({ done: i, total: files.length });
        const uri = joinPath(dir, files[i].filename);
        await FileSystem.writeAsStringAsync(uri, files[i].xml, { encoding: FileSystem.EncodingType.UTF8 });
        saved.push({ filename: files[i].filename, uri });
      }
      if (!alive.current) return;
      setProfiles(saved);
      haptic('success');
      setPhase('sharing');
      // Safari route: open part 1 now; iOS holds one downloaded profile at a time, so later parts
      // are opened from their rows after part 1 is installed.
      if (route === 'safari' && (await openInSafari(saved[0]))) {
        if (alive.current) setPhase('done');
        return;
      }
      for (let i = 0; i < saved.length; i++) {
        setStep({ done: i, total: saved.length });
        await shareProfile(saved[i]);
      }
      if (alive.current) setPhase('done');
    } catch (e) {
      cancelToken.current = null;
      if (!alive.current) return;
      if (isRenderCancelled(e)) {
        setPhase('idle');
        return;
      }
      haptic('warning');
      setBulkError(errText(e));
      setPhase('idle');
    }
    // timingText only formats with the current t.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, plan.profile, renderer, themeName, shareProfile, openInSafari, route, t]);

  const shareAgain = useCallback(
    async (p: SavedProfile, via: 'safari' | 'share' = 'share') => {
      tapLight();
      setBulkError(null);
      try {
        const info = await FileSystem.getInfoAsync(p.uri);
        if (!info.exists) throw new Error(t('install.errors.cleared'));
        if (via === 'safari' && (await openInSafari(p))) return;
        await shareProfile(p);
      } catch (e) {
        if (alive.current) setBulkError(errText(e));
      }
    },
    [openInSafari, shareProfile, t],
  );

  // ---- shortcuts ----

  const saveToPhotos = useCallback(async () => {
    if (busy || items.length === 0) return;
    tapLight();
    setShortcutsError(null);
    setPhotoNote(null);
    if (!(await ensurePhotosAccess())) {
      haptic('warning');
      setPhotoStatus('denied');
      return;
    }
    setPhotoStatus('saving');
    try {
      const list = items.map((i) => i.spec);
      setPhotoStep({ done: 0, total: list.length });
      const token: RenderCancelToken = { cancelled: false };
      cancelToken.current = token;
      const rendered = await renderer.renderAll(
        list,
        PHOTO_ICON_SIZE,
        (done, tot) => {
          if (alive.current) setPhotoStep({ done, total: tot });
        },
        token,
      );
      cancelToken.current = null;
      const dir = await cacheSubdir('glaze-icons');
      const assets: MediaLibrary.Asset[] = [];
      for (let i = 0; i < rendered.length; i++) {
        const spec = list.find((s) => s.appId === rendered[i].appId);
        const path = joinPath(dir, iconFilename(spec?.label ?? rendered[i].appId, i));
        await FileSystem.writeAsStringAsync(path, rendered[i].pngBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        assets.push(await MediaLibrary.createAssetAsync(path));
      }
      const inAlbum = await addToAlbum(assets);
      if (!alive.current) return;
      setPhotoNote(
        inAlbum
          ? t('install.shortcuts.savedAlbum', { count: assets.length, album: PHOTOS_ALBUM })
          : t('install.shortcuts.savedNoAlbum', { count: assets.length, album: PHOTOS_ALBUM }),
      );
      setPhotoStatus('saved');
      haptic('success');
    } catch (e) {
      cancelToken.current = null;
      if (!alive.current) return;
      if (isRenderCancelled(e)) {
        setPhotoStatus('idle');
        return;
      }
      haptic('warning');
      setShortcutsError(errText(e));
      setPhotoStatus('error');
    }
  }, [busy, items, renderer, t]);

  const cancelRender = useCallback(() => {
    if (cancelToken.current) cancelToken.current.cancelled = true;
  }, []);

  const copyUrl = useCallback(async (appId: string, url: string) => {
    try {
      await Clipboard.setStringAsync(url);
      haptic('success');
      setCopied(appId);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => {
        if (alive.current) setCopied(null);
      }, 1500);
    } catch {
      setShortcutsError(t('install.errors.copyFailed'));
    }
  }, [t]);

  const openShortcuts = useCallback(() => {
    tapLight();
    Linking.openURL(SHORTCUTS_URL).catch(() => {
      if (alive.current) setShortcutsError(t('install.errors.noShortcutsApp'));
    });
  }, [t]);

  // ---- text (src/core/install.ts keeps the English originals for tests and logs) ----

  /** On-device render timing ("Drew 60 icons in 14 s (0.24 s each)"); null for no icons or a bad duration. */
  function timingText(count: number, ms: number): string | null {
    if (!Number.isFinite(count) || !Number.isFinite(ms) || count < 1 || ms < 0) return null;
    const n = Math.floor(count);
    const secs = ms / 1000;
    const total =
      secs < 10 ? formatNumber(secs, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : formatNumber(Math.round(secs));
    const each = formatNumber(secs / n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return t('install.timing', { count: n, total, each });
  }

  function phaseText(ph: InstallPhase, done: number, total: number): string {
    switch (ph) {
      case 'idle':
        return t('install.phase.idle');
      case 'rendering':
        return t('install.phase.rendering', { done: Math.min(done, total), total });
      case 'building':
        return t('install.phase.building');
      case 'saving':
        return total !== 0 && total !== 1
          ? t('install.phase.savingOf', { current: Math.min(done + 1, total), total })
          : t('install.phase.saving');
      case 'sharing':
        if (route === 'safari') return t('install.safari.opening');
        return total !== 0 && total !== 1
          ? t('install.phase.sharingOf', { current: Math.min(done + 1, total), total })
          : t('install.phase.sharing');
      case 'done':
        return t('install.phase.done');
    }
  }

  // ---- states ----

  if (loadError) {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.root, styles.center, { backgroundColor: c.bg }]}>
        <Feather name="alert-circle" size={28} color={c.warn} />
        <Text style={[...ts('body'), styles.centerText, { color: c.ink }]}>{t('install.state.loadError')}</Text>
        <Text style={[...ts('footnote'), styles.centerText, { color: c.inkSecondary }]}>{loadError}</Text>
        <PillButton label={t('common.retry')} icon="refresh-cw" onPress={load} style={styles.selfCenter} />
      </SafeAreaView>
    );
  }

  if (!studio || !install.loaded) {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.root, styles.center, { backgroundColor: c.bg }]}>
        <IconGridSkeleton count={8} />
        <Text style={[...ts('body'), { color: c.inkSecondary }]}>{t('install.state.loading')}</Text>
      </SafeAreaView>
    );
  }

  if (specs.length === 0) {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.root, styles.center, { backgroundColor: c.bg }]}>
        <Feather name="grid" size={32} color={c.tint} />
        <Text accessibilityRole="header" style={[...ts('title2'), styles.centerText, { color: c.ink }]}>
          {t('install.state.emptyTitle')}
        </Text>
        <Text style={[...ts('body'), styles.centerText, { color: c.inkSecondary }]}>{t('install.state.emptyBody')}</Text>
        <PillButton
          label={t('install.state.chooseApps')}
          icon={Chevron.arrowBack(isRTL)}
          onPress={() => router.navigate('/icons')}
          style={styles.selfCenter}
        />
      </SafeAreaView>
    );
  }

  const noScheme = plan.shortcuts.map((s) => s.label);
  const sum = installSummary(plan, PROFILE_INSTALL_ENABLED);
  const summary =
    sum.kind === 'none'
      ? t('install.summary.none')
      : sum.kind === 'viaShortcuts'
        ? t('install.summary.viaShortcuts', { count: sum.shortcuts })
        : sum.kind === 'viaProfile'
          ? t('install.summary.viaProfile', { count: sum.profile })
          : t('install.summary.mixed', { count: sum.profile, shortcuts: sum.shortcuts });
  const shortcutIds = items.map((i) => i.spec.appId);
  const tick = checklistCount(shortcutIds, install.state.shortcutsDone);

  const pickChoice = (next: InstallChoice) => {
    if (next === choice || busy) return;
    install.update((s) => ({ ...s, choice: next, choiceExplicit: true }));
  };
  const recommended = recommendedMethod(methodOpts);
  // Guided Shortcuts (T126): one icon at a time, the first app not ticked off yet is "next".
  const nextItem = items.find((i) => !install.state.shortcutsDone.includes(i.spec.appId)) ?? null;
  const toggleShortcut = (appId: string) => {
    const wasDone = install.state.shortcutsDone.includes(appId);
    install.update((s) => toggleShortcutDone(s, appId));
    // Ticking an app off opens the steps for the next one still to do.
    if (!wasDone) {
      const next = items.find((i) => i.spec.appId !== appId && !install.state.shortcutsDone.includes(i.spec.appId));
      setExpanded(next ? next.spec.appId : null);
    }
  };

  const bulkProgress =
    phase === 'rendering'
      ? overallProgress('rendering', step.done, step.total)
      : overallProgress(phase, step.done, Math.max(1, step.total));

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: c.bg }]}>
      <OffscreenIconRenderer ref={renderer.ref} backdrop={backdrop} />
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll}>
        {!androidNative.isAndroid ? <>
        {PROFILE_INSTALL_ENABLED ? (
          <View style={styles.side}>
            <ContextTip id="install-not-verified" />
          </View>
        ) : null}
        {/* Summary */}
        <SquircleCard size="large" style={styles.side}>
          <View style={styles.stack}>
            <View style={styles.strip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {specs.slice(0, 6).map((s) => (
                <IconCanvas key={s.appId} spec={s} size={40} />
              ))}
              {specs.length > 6 ? (
                <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('install.summary.more', { count: specs.length - 6 })}</Text>
              ) : null}
            </View>
            <Text accessibilityRole="header" style={[...ts('title3'), { color: c.ink }]}>
              {summary}
            </Text>
            {!PROFILE_INSTALL_ENABLED ? null : noScheme.length > 0 ? (
              <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>
                {t('install.summary.noScheme', { count: noScheme.length, apps: noScheme.join(', ') })}
              </Text>
            ) : (
              <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('install.summary.allProfile')}</Text>
            )}
            {resolved.fellBack.length > 0 ? (
              <Text style={[...ts('footnote'), { color: c.warn }]}>
                {t('install.summary.fellBack', { count: resolved.fellBack.length })}
              </Text>
            ) : null}
            <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('install.summary.cantReplace')}</Text>
          </View>
        </SquircleCard>

        {/* Method: the Bulk card when Bulk can be used (owner 25 Oct: the only method), else the
            Shortcuts-only fallback text. showMethodPicker stays for a future second method. */}
        <Text accessibilityRole="header" style={[...ts('title2'), styles.sideText, { color: c.ink }]}>
          {t('install.method.heading')}
        </Text>
        {!showMethodPicker(methodOpts) && !showBulkCard(methodOpts) ? (
          <Text style={[...ts('body'), styles.sideText, { color: c.ink }]}>{t('install.method.shortcutsOnly')}</Text>
        ) : (
        <View accessibilityRole="radiogroup" accessibilityLabel={t('install.method.groupLabel')} style={[styles.methods, styles.side]}>
          {availableMethods(methodOpts).map((m) =>
            m === 'bulk' ? (
              <MethodCard
                key="bulk"
                selected={choice === 'bulk'}
                disabled={!bulkSelectable(methodOpts) || busy}
                icon="layers"
                title={t('install.method.bulk')}
                badge={recommended === 'bulk' ? t('install.method.recommended') : undefined}
                body={
                  plan.profile.length === 0
                    ? t('install.method.bulkNone')
                    : t('install.method.bulkBody', { count: plan.profile.length })
                }
                onPress={() => pickChoice('bulk')}
              />
            ) : (
              <MethodCard
                key="shortcuts"
                selected={choice === 'shortcuts'}
                disabled={busy}
                icon="command"
                title={t('install.method.shortcuts')}
                badge={recommended === 'shortcuts' ? t('install.method.recommended') : undefined}
                body={t('install.method.shortcutsBody')}
                onPress={() => pickChoice('shortcuts')}
              />
            ),
          )}
        </View>
        )}

        {choice === 'bulk' ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={[...ts('title2'), styles.sideText, { color: c.ink }]}>
              {t('install.method.bulk')}
            </Text>
            <SquircleCard style={styles.side}>
              <View style={styles.stack}>
                <Text style={[...ts('body'), { color: c.ink }]}>
                  {route === 'safari' ? t('install.safari.intro') : t('install.bulk.intro')}
                </Text>
                {route === 'share' ? (
                  <Notice tone="warn" icon="alert-triangle">
                    <Text style={[...ts('footnote'), { color: c.ink }]}>{t('install.safari.fallbackNote')}</Text>
                  </Notice>
                ) : null}
                {bulkBusy ? (
                  <ProgressBar progress={bulkProgress} label={phaseText(phase, step.done, step.total)} />
                ) : null}
                {renderTiming && !bulkBusy ? (
                  <Text style={[...ts('footnote'), { color: c.inkSecondary }]} accessibilityLabel={renderTiming}>
                    {renderTiming}
                  </Text>
                ) : null}
                {phase === 'rendering' ? (
                  <PillButton
                    label={t('common.cancel')}
                    variant="plain"
                    onPress={cancelRender}
                    accessibilityHint={t('install.bulk.cancelHint')}
                  />
                ) : null}
                {bulkError ? (
                  <InlineError message={bulkError} onRetry={generate} retryLabel={t('common.retry')} />
                ) : null}
                <PillButton
                  label={profiles.length === 0 ? t('install.bulk.generate') : t('install.bulk.generateAgain')}
                  icon="download"
                  variant={profiles.length === 0 ? 'filled' : 'tinted'}
                  block
                  disabled={busy}
                  busy={bulkBusy}
                  onPress={generate}
                  accessibilityHint={route === 'safari' ? t('install.safari.generateHint') : t('install.bulk.generateHint')}
                />
                {profiles.map((p) => {
                  const done = isProfileStepDone(install.state, p.filename, 'installed');
                  return (
                    <View key={p.filename} style={[styles.fileRow, { borderTopColor: c.separator }]}>
                      <Feather name="file" size={18} color={c.tint} />
                      <Text style={[...ts('footnote'), styles.flex, { color: c.ink }]} numberOfLines={2}>
                        {p.filename}
                      </Text>
                      {route === 'safari' ? (
                        <PressableScale
                          onPress={() => shareAgain(p, 'safari')}
                          disabled={busy}
                          pressedScale={0.9}
                          accessibilityRole="button"
                          accessibilityLabel={t('install.safari.openAgainA11y', { file: p.filename })}
                          accessibilityState={{ disabled: busy }}
                          style={[styles.smallBtn, busy ? styles.dim : null]}
                        >
                          <Feather name="compass" size={18} color={c.tint} />
                        </PressableScale>
                      ) : null}
                      <PressableScale
                        onPress={() => shareAgain(p)}
                        disabled={busy}
                        pressedScale={0.9}
                        accessibilityRole="button"
                        accessibilityLabel={t('install.bulk.shareAgain', { file: p.filename })}
                        accessibilityState={{ disabled: busy }}
                        style={[styles.smallBtn, busy ? styles.dim : null]}
                      >
                        <Feather name="share" size={18} color={c.tint} />
                      </PressableScale>
                      {profiles.length !== 1 ? (
                        <CheckBox
                          checked={done}
                          label={t('install.bulk.installed', { file: p.filename })}
                          onPress={() => install.update((s) => toggleProfileStep(s, p.filename, 'installed'))}
                        />
                      ) : null}
                    </View>
                  );
                })}
                {route === 'safari' && profiles.length > 0 ? (
                  <PillButton
                    label={t('install.safari.openAgain')}
                    icon="compass"
                    variant="tinted"
                    block
                    disabled={busy}
                    onPress={() => shareAgain(profiles[0], 'safari')}
                  />
                ) : null}
                {route === 'safari' && profiles.length > 1 ? (
                  <Text style={[...ts('footnote'), { color: c.ink }]}>
                    {t('install.safari.oneAtATime', { files: profiles.length })}
                  </Text>
                ) : null}
                <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>
                  {route === 'safari' ? t('install.safari.hurry') : t('install.bulk.noSaveToFiles')}
                </Text>
                {route === 'safari' && profiles.length > 0 ? (
                  <PillButton
                    label={t('install.safari.shareInstead')}
                    icon="share"
                    variant="plain"
                    size="small"
                    disabled={busy}
                    onPress={() => shareAgain(profiles[0])}
                  />
                ) : null}
              </View>
            </SquircleCard>

            <InsetGroup>
              {cards.map((card, i) => {
                const done = isProfileStepDone(install.state, profileKey, card.id);
                const keys = isCardId(card.id) ? CARD_KEYS[card.id] : null;
                const cardBody =
                  card.id === 'save' && profiles.length > 1
                    ? t('install.cards.save.bodyMany', { files: profiles.length })
                    : keys
                      ? t(keys.bodyKey)
                      : card.body;
                return (
                  <StepRow
                    key={card.id}
                    index={i + 1}
                    title={keys ? t(keys.titleKey) : card.title}
                    body={cardBody}
                    illustration={card.illustration}
                    done={done}
                    onToggleDone={() => install.update((s) => toggleProfileStep(s, profileKey, card.id))}
                  />
                );
              })}
            </InsetGroup>
          </View>
        ) : null}

        {items.length > 0 ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={[...ts('title2'), styles.sideText, { color: c.ink }]}>
              {choice === 'bulk' ? t('install.shortcuts.headingRest') : t('install.shortcuts.heading')}
            </Text>
            <SquircleCard style={styles.side}>
              <View style={styles.stack}>
                <Text style={[...ts('body'), { color: c.ink }]}>{t('install.shortcuts.intro')}</Text>
                {photosBusy ? (
                  <ProgressBar
                    progress={batchFraction(photoStep.done, photoStep.total)}
                    label={t('install.shortcuts.savingProgress', { done: Math.min(photoStep.done, photoStep.total), total: photoStep.total })}
                  />
                ) : null}
                {photosBusy && photoStep.done < photoStep.total ? (
                  <PillButton
                    label={t('common.cancel')}
                    variant="plain"
                    onPress={cancelRender}
                    accessibilityHint={t('install.bulk.cancelHint')}
                  />
                ) : null}
                {photoStatus === 'denied' ? (
                  <Notice tone="warn" icon="lock">
                    <Text style={[...ts('footnote'), { color: c.ink }]}>
                      {t('install.shortcuts.denied', { album: PHOTOS_ALBUM })}
                    </Text>
                    <View style={styles.btnRow}>
                      <PillButton
                        label={t('install.shortcuts.openSettings')}
                        icon="settings"
                        variant="tinted"
                        size="small"
                        onPress={openAppSettings}
                      />
                      <PillButton label={t('common.retry')} variant="plain" size="small" onPress={saveToPhotos} />
                    </View>
                  </Notice>
                ) : null}
                {photoNote ? (
                  <View style={styles.okRow}>
                    <Feather name="check-circle" size={18} color={c.ok} />
                    <Text style={[...ts('footnote'), styles.flex, { color: c.ink }]}>{photoNote}</Text>
                  </View>
                ) : null}
                {shortcutsError ? (
                  <InlineError
                    message={shortcutsError}
                    onRetry={photoStatus === 'error' ? saveToPhotos : undefined}
                    retryLabel={t('common.retry')}
                    onDismiss={() => setShortcutsError(null)}
                  />
                ) : null}
                <PillButton
                  label={
                    photoStatus === 'saved'
                      ? t('install.shortcuts.saveAgain')
                      : t('install.shortcuts.save', { count: items.length })
                  }
                  icon="image"
                  variant={photoStatus === 'saved' ? 'tinted' : 'filled'}
                  block
                  disabled={busy}
                  busy={photosBusy}
                  onPress={saveToPhotos}
                  accessibilityHint={
                    photoStatus === 'saved'
                      ? t('install.shortcuts.saveAgainHint')
                      : t('install.shortcuts.saveHint', { album: PHOTOS_ALBUM })
                  }
                />
                <PillButton
                  label={t('install.shortcuts.open')}
                  icon="external-link"
                  variant="tinted"
                  block
                  onPress={openShortcuts}
                />
                {tick.total > 0 ? (
                  <ProgressBar
                    progress={batchFraction(tick.done, tick.total)}
                    label={t('install.shortcuts.progress', { done: tick.done, total: tick.total })}
                  />
                ) : null}
                {nextItem ? (
                  <View style={styles.okRow}>
                    <Feather name="arrow-right-circle" size={18} color={c.tint} />
                    <Text style={[...ts('headline'), styles.flex, { color: c.ink }]}>
                      {t('install.guided.next', { app: nextItem.spec.label })}
                    </Text>
                    {expanded !== nextItem.spec.appId ? (
                      <PillButton
                        label={t('install.guided.showNext')}
                        variant="tinted"
                        size="small"
                        onPress={() => setExpanded(nextItem.spec.appId)}
                      />
                    ) : null}
                  </View>
                ) : tick.total > 0 ? (
                  <View style={styles.okRow}>
                    <Feather name="check-circle" size={18} color={c.ok} />
                    <Text style={[...ts('footnote'), styles.flex, { color: c.ink }]}>{t('install.guided.allDone')}</Text>
                  </View>
                ) : null}
                <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('install.guided.oneAtATime')}</Text>
              </View>
            </SquircleCard>

            <InsetGroup>
              {items.map((item) => (
                <ShortcutRow
                  key={item.spec.appId}
                  item={item}
                  done={install.state.shortcutsDone.includes(item.spec.appId)}
                  open={expanded === item.spec.appId}
                  copied={copied === item.spec.appId}
                  onToggleOpen={() => {
                    setExpanded((cur) => (cur === item.spec.appId ? null : item.spec.appId));
                  }}
                  onToggleDone={() => toggleShortcut(item.spec.appId)}
                  onCopy={(url) => copyUrl(item.spec.appId, url)}
                />
              ))}
            </InsetGroup>

            {/* T60: how to undo the Shortcuts method */}
            <InsetGroup header={t('install.shortcuts.undo.title')}>
              {SHORTCUT_UNDO_STEPS.map((id) => (
                <InsetRow key={id} title={t(`install.shortcuts.undo.${id}`)} />
              ))}
            </InsetGroup>
          </View>
        ) : null}

        </> : null}
        {androidNative.isAndroid ? (
          <SquircleCard style={styles.side}>
            <View style={styles.stack}>
              <Text accessibilityRole="header" style={[...ts('title3'), { color: c.ink }]}>
                {t('install.android.heading')}
              </Text>
              <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>
                {androidNative.status().available
                  ? t('install.android.available')
                  : t('install.android.preview')}
              </Text>
              {androidNative.status().available ? (
                <PillButton
                  label={t('install.android.pin')}
                  icon="plus-square"
                  variant="tinted"
                  disabled={busy}
                  onPress={() =>
                    androidNative
                      .pinAllWithFeedback(specs, (list) => renderer.renderAll(list, PHOTO_ICON_SIZE))
                      .catch(() => {})
                  }
                />
              ) : null}
            </View>
          </SquircleCard>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------- pieces

/** 48 pt checkbox: tint check when done, tertiary empty box otherwise. Selection haptic. */
function CheckBox({ checked, label, onPress, size = 22 }: { checked: boolean; label: string; onPress: () => void; size?: number }) {
  const { c } = useColorsV2();
  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      pressedScale={0.9}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      style={styles.smallBtn}
    >
      <Feather name={checked ? 'check-square' : 'square'} size={size} color={checked ? c.ok : c.inkTertiary} />
    </PressableScale>
  );
}

/**
 * Install method choice as a squircle card (radio). The recommended method sits raised with a
 * "Recommended" pill; the selected card gets the tint ring.
 */
function MethodCard({
  selected,
  disabled,
  icon,
  title,
  badge,
  body,
  onPress,
}: {
  selected: boolean;
  disabled: boolean;
  icon: 'layers' | 'command';
  title: string;
  badge?: string;
  body: string;
  onPress: () => void;
}) {
  const { c, scheme } = useColorsV2();
  const { t, script } = useT();
  const raised = Boolean(badge);
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="select"
      accessibilityRole="radio"
      accessibilityLabel={badge ? t('install.method.a11y', { title, badge, body }) : t('install.method.a11yNoBadge', { title, body })}
      accessibilityState={{ selected, checked: selected, disabled }}
      style={[
        styles.method,
        continuous,
        shadowV2(raised ? 'raised' : 'card', scheme),
        {
          backgroundColor: raised ? c.surfaceRaised : c.surface,
          borderColor: selected ? c.tint : scheme === 'dark' ? c.separator : 'transparent',
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
        },
        disabled && !selected ? styles.dim : null,
      ]}
    >
      <Feather name={selected ? 'check-circle' : 'circle'} size={22} color={selected ? c.tint : c.inkTertiary} />
      <View style={styles.flex}>
        <View style={styles.methodTitle}>
          <View
            style={[
              styles.methodTile,
              continuous,
              { borderRadius: iconTileRadius(sizeV2.rowIcon), backgroundColor: c.pastels[icon === 'layers' ? 'lilac' : 'sky'].fill },
            ]}
          >
            <Feather name={icon} size={16} color={c.pastels[icon === 'layers' ? 'lilac' : 'sky'].ink} />
          </View>
          <Text style={[...typeFor(script, 'headline'), styles.shrink, { color: c.ink }]}>{title}</Text>
          {badge ? (
            <View style={[styles.badge, continuous, { backgroundColor: c.tint }]}>
              <Text style={[...typeFor(script, 'caption1'), styles.badgeText, { color: c.onTint }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[...typeFor(script, 'footnote'), { color: c.inkSecondary }]}>{body}</Text>
      </View>
    </PressableScale>
  );
}

/** Soft notice box (warning tint) with an icon and free content. */
function Notice({ tone, icon, children }: { tone: 'warn'; icon: 'lock' | 'alert-triangle'; children?: ReactNode }) {
  const { c } = useColorsV2();
  const colour = tone === 'warn' ? c.warn : c.ink;
  return (
    <View style={[styles.notice, continuous, { backgroundColor: c.pastels.butter.fill }]} accessibilityLiveRegion="polite">
      <Feather name={icon} size={18} color={colour} />
      <View style={[styles.flex, styles.noticeBody]}>{children}</View>
    </View>
  );
}

function InlineError({
  message,
  onRetry,
  retryLabel,
  onDismiss,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel: string;
  onDismiss?: () => void;
}) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  return (
    <Notice tone="warn" icon="alert-triangle">
      <Text style={[...typeFor(script, 'footnote'), { color: c.ink }]}>{message}</Text>
      <View style={styles.btnRow}>
        {onRetry ? <PillButton label={retryLabel} icon="refresh-cw" variant="tinted" size="small" onPress={onRetry} /> : null}
        {onDismiss ? <PillButton label={t('install.shortcuts.dismiss')} variant="plain" size="small" onPress={onDismiss} /> : null}
      </View>
    </Notice>
  );
}

/**
 * One profile install step as an inset row: numbered pastel tile (a check once done), title, body,
 * the schematic phone illustration and a "Mark as done" checkbox row.
 */
function StepRow({
  index,
  title,
  body,
  illustration,
  done,
  onToggleDone,
}: {
  index: number;
  title: string;
  body: string;
  illustration: Illustration;
  done: boolean;
  onToggleDone: () => void;
}) {
  const { c } = useColorsV2();
  const { t, script, formatNumber } = useT();
  const tile = c.pastels[done ? 'mint' : 'berry'];
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepTop}>
        <View
          style={[
            styles.numTile,
            continuous,
            { borderRadius: iconTileRadius(sizeV2.rowIcon), backgroundColor: tile.fill },
          ]}
        >
          {done ? (
            <Feather name="check" size={16} color={tile.ink} />
          ) : (
            <Text style={[...typeFor(script, 'subhead'), styles.badgeText, { color: tile.ink }]}>{formatNumber(index)}</Text>
          )}
        </View>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={[...typeFor(script, 'headline'), { color: c.ink }]}>
            {title}
          </Text>
          <Text style={[...typeFor(script, 'footnote'), { color: c.inkSecondary }]}>{body}</Text>
        </View>
        <StepIllustration kind={illustration} />
      </View>
      <Pressable
        onPress={() => {
          haptic('select');
          onToggleDone();
        }}
        accessibilityRole="checkbox"
        accessibilityLabel={t('install.stepCard.a11yDone', { index, title })}
        accessibilityState={{ checked: done }}
        style={({ pressed }) => [styles.doneRow, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Feather name={done ? 'check-square' : 'square'} size={20} color={done ? c.ok : c.inkTertiary} />
        <Text style={[...typeFor(script, 'subhead'), styles.flex, { color: done ? c.ok : c.tint }]}>
          {done ? t('install.stepCard.done') : t('install.stepCard.markDone')}
        </Text>
      </Pressable>
    </View>
  );
}

function ShortcutRow({
  item,
  done,
  open,
  copied,
  onToggleOpen,
  onToggleDone,
  onCopy,
}: {
  item: ShortcutItem;
  done: boolean;
  open: boolean;
  copied: boolean;
  onToggleOpen: () => void;
  onToggleDone: () => void;
  onCopy: (url: string) => void;
}) {
  const { c } = useColorsV2();
  const { t, script, formatNumber } = useT();
  const { spec, url } = item;
  const name = spec.label.trim() || t('install.steps.appFallback');
  const steps = [
    t('install.steps.openShortcuts'),
    ...(url
      ? [t('install.steps.addOpenUrl'), t('install.steps.pasteUrl', { url })]
      : [t('install.steps.addOpenApp'), t('install.steps.chooseApp', { name })]),
    t('install.steps.rename', { name }),
    t('install.steps.addToHome'),
    t('install.steps.choosePhoto'),
    t('install.steps.pickIcon', { album: PHOTOS_ALBUM, name }),
    t('install.steps.add'),
  ];
  return (
    <View style={styles.sRow}>
      <View style={styles.sHead}>
        <CheckBox checked={done} label={t('install.shortcuts.made', { app: spec.label })} onPress={onToggleDone} />
        <IconCanvas spec={spec} size={40} />
        <View style={styles.flex}>
          <Text
            style={[...typeFor(script, 'body'), { color: c.ink, textDecorationLine: done ? 'line-through' : 'none' }]}
          >
            {spec.label}
          </Text>
          <Text style={[...typeFor(script, 'footnote'), { color: c.inkSecondary }]} numberOfLines={url ? 2 : undefined}>
            {item.reason === 'no-scheme' ? t('install.shortcuts.noLink') : url ?? ''}
          </Text>
        </View>
        <PressableScale
          onPress={onToggleOpen}
          haptic="select"
          pressedScale={0.9}
          accessibilityRole="button"
          accessibilityLabel={open ? t('install.shortcuts.hideSteps', { app: spec.label }) : t('install.shortcuts.showSteps', { app: spec.label })}
          accessibilityState={{ expanded: open }}
          style={styles.smallBtn}
        >
          <Feather name={open ? 'chevron-up' : 'chevron-down'} size={22} color={c.tint} />
        </PressableScale>
      </View>
      {url ? (
        <View style={[styles.urlRow, continuous, { backgroundColor: c.fill }]}>
          <Text selectable style={[...typeFor(script, 'footnote'), styles.flex, { color: c.ink }]} numberOfLines={1}>
            {url}
          </Text>
          <PillButton
            label={copied ? t('install.shortcuts.copied') : t('install.shortcuts.copy')}
            icon={copied ? 'check' : 'copy'}
            variant={copied ? 'plain' : 'tinted'}
            size="small"
            haptic={false}
            onPress={() => onCopy(url)}
            accessibilityLabel={copied ? t('install.shortcuts.linkCopied', { app: spec.label }) : t('install.shortcuts.copyLink', { app: spec.label, url })}
          />
        </View>
      ) : null}
      {open ? (
        <View style={styles.steps}>
          {steps.map((s, i) => (
            <View key={i} style={styles.stepLine}>
              <Text style={[...typeFor(script, 'footnote'), styles.stepNum, { color: c.tint }]}>{formatNumber(i + 1)}.</Text>
              <Text style={[...typeFor(script, 'footnote'), styles.flex, { color: c.ink }]}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: spaceV2.md, padding: spaceV2.xl },
  centerText: { textAlign: 'center' },
  selfCenter: { alignSelf: 'center' },
  scroll: { paddingTop: spaceV2.lg, gap: spaceV2.lg, paddingBottom: spaceV2.xxxl * 2 },
  side: { marginHorizontal: spaceV2.lg },
  sideText: { paddingHorizontal: spaceV2.inset },
  stack: { gap: spaceV2.md },
  strip: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm, flexWrap: 'wrap' },
  section: { gap: spaceV2.md },
  methods: { gap: spaceV2.md },
  method: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spaceV2.md,
    padding: spaceV2.lg,
    borderRadius: radiusV2.card,
    minHeight: sizeV2.touch,
  },
  methodTitle: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm, flexWrap: 'wrap', marginBottom: spaceV2.xs },
  methodTile: { width: sizeV2.rowIcon, height: sizeV2.rowIcon, alignItems: 'center', justifyContent: 'center' },
  badge: { borderRadius: radiusV2.pill, paddingHorizontal: spaceV2.sm, paddingVertical: spaceV2.xxs },
  badgeText: { fontWeight: '700' },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  dim: { opacity: 0.45 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spaceV2.sm,
  },
  smallBtn: { width: sizeV2.touch, height: sizeV2.touch, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: spaceV2.sm, borderRadius: radiusV2.control, padding: spaceV2.md },
  noticeBody: { gap: spaceV2.sm },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.sm },
  stepRow: { paddingHorizontal: spaceV2.lg, paddingTop: spaceV2.md, gap: spaceV2.xs },
  stepTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceV2.md },
  numTile: { width: sizeV2.rowIcon, height: sizeV2.rowIcon, alignItems: 'center', justifyContent: 'center' },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.sm,
    minHeight: sizeV2.touch,
    paddingStart: sizeV2.rowIcon + spaceV2.md,
  },
  sRow: { paddingVertical: spaceV2.sm, paddingStart: spaceV2.xs, paddingEnd: spaceV2.sm, gap: spaceV2.sm },
  sHead: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.sm,
    marginStart: sizeV2.touch + spaceV2.sm,
    borderRadius: radiusV2.control,
    paddingStart: spaceV2.md,
    paddingVertical: spaceV2.xxs,
    paddingEnd: spaceV2.xxs,
  },
  steps: { marginStart: sizeV2.touch + spaceV2.sm, gap: spaceV2.xs, paddingBottom: spaceV2.sm },
  stepLine: { flexDirection: 'row', gap: spaceV2.sm },
  stepNum: { minWidth: 20, fontWeight: '700' },
});
