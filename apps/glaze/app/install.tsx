// /install: add the Icon Studio set to the Home Screen.
// Install all at once (T202, owner-1101d #5: ALWAYS the main method): render icons -> one web clip
// .mobileconfig -> served to Safari from 127.0.0.1 on this iPhone (T126, src/native/profileServer.ts)
// -> Allow -> Settings. Builds without the native server (Expo Go, old builds) use the share sheet.
// One stable profile id per install (src/store/installId.ts), so a new theme's profile replaces
// the old one. The screen says plainly how many apps open via a quick Safari tap (safariTapCount).
// Shortcuts: only a small "Prefer Shortcuts? One icon at a time" fallback link, plus the apps a
// profile can't open: save icons to a "Glaze icons" Photos album -> one app at a time, a Home
// Screen shortcut with the "Open App" action (no URL, so no Safari hop).
// Delivery path chosen in docs/SPIKE_PROFILE.md. Free feature: nothing here reads Plus.
// Design v2 (docs/DESIGN_V2.md §9, T55): steps and the Shortcuts checklist in inset groups with
// numbered pastel tiles, every button a PillButton.
// T173 premium (docs/PREMIUM_UI.md §3.5): editorial SectionHeaders as the headings; the profile
// steps as a calm numbered sequence on one lifted card (no separators) where the first step not
// done yet is "current" (filled number, soft highlight that fades in, ≤ base duration, ease-out,
// shorter under Reduce Motion) and the others are muted; waits (drawing icons, saving) show
// skeletons of the result under the progress bar; a finished "Done" panel after the profile is
// made (the one `success` haptic of the flow stays in generate()); Dynamic Type caps on every Text.
// T210 (premium pass on the owner-1101d screens): every card lifts by surface (raised in dark mode,
// no hairline); the summary is the hero (icons on a soft well + one "Your icon set" heading); Install
// all at once is an editorial header (eyebrow + title + count line); the Prefer Shortcuts link sits
// centred at the card's foot; file rows and coverage rows are spaced surfaces, not ruled lines; the
// first load is a skeleton of the screen; the Shortcuts undo steps use an editorial group title.

import { Feather } from '@expo/vector-icons';
import * as FileSystem from '../src/native/fs';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
  isGuideArt,
  isProfileStepDone,
  joinPath,
  overallProgress,
  planInstall,
  profileStepCards,
  profileThemeName,
  safariTapCount,
  shortcutItems,
  toggleProfileStep,
  toggleShortcutDone,
  withoutMissingImages,
  type InstallChoice,
  type InstallPhase,
  type ShortcutItem,
} from '../src/core/install';
import {
  CHOICE_EPOCH,
  SHORTCUT_UNDO_STEPS,
  bulkSelectable,
  effectiveChoice,
  installSummary,
  isCurrentPick,
  showShortcutsFallback,
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
import { getInstallId } from '../src/store/installId';
import { DEFERRED_STEPS, requestDeferred } from '../src/store/deferredWork';
import { useIconCleanupRecord } from '../src/store/iconCleanup';
import { cleanupThemeId, markOldRemoved, namesList, oldIconNames, oldIconsToRemove, recordWalk } from '../src/core/iconCleanup';
import { activeThemeKey, findApp, overrideImageUris } from '../src/core/studio';
import { coverageRows, coverageSummary } from '../src/core/iconCoverage';
import { loadStudio, studioSpecs, useStudio, type StudioState } from '../src/store/studio';
import { IconOverrideSheet } from '../src/ui/IconOverrideSheet';
import {
  continuous,
  editorialV2,
  fontScaleCap,
  iconTileRadius,
  radiusV2,
  sizeV2,
  spaceV2,
  textV2,
  type TypeRoleV2,
} from '../src/theme/tokensV2';
import { durations, easeOutCurve, useMotionReduced } from '../src/theme/motion';
import { useColorsV2 } from '../src/theme/useTokens';
import { ProgressBar } from '../src/ui/ProgressBar';
import { IconGridSkeleton } from '../src/ui/Skeleton';
import { StepIllustration } from '../src/ui/StepCard';
import { ProfileGuideArt } from '../src/ui/ProfileGuideArt';
import { ContextTip } from '../src/ui/ContextTip';
import { haptic } from '../src/ui/haptics';
import { PressableScale } from '../src/ui/PressableScale';
import { Chevron, textStyleFor } from '../src/ui/i18nLayout';
import { InsetGroup, InsetRow, PillButton, SectionHeader, Skeleton, SquircleCard } from '../src/ui/v2';

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
  // T262 (owner-1101i): iOS 27 "More for Your iPhone" and View Profile steps.
  more: { titleKey: 'install.safari.cards.more.title', bodyKey: 'install.safari.cards.more.body' },
  view: { titleKey: 'install.safari.cards.view.title', bodyKey: 'install.safari.cards.view.body' },
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
  const { c, scheme } = useColorsV2();
  const { t, script, isRTL, formatNumber, locale } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => typeFor(script, role);
  const router = useRouter();
  const reduced = useMotionReduced();
  // T210 (PREMIUM_UI §1.6): every card lifts by surface, never a dark-mode hairline.
  const cardTone: CardTone = scheme === 'dark' ? 'raised' : 'surface';
  // T126: can this build serve the profile to Safari? (false in Expo Go, on Android, old builds)
  const [serverAvailable] = useState<boolean>(() => profileServer.status().available);
  const route = profileRoute(serverAvailable);
  const [studio, setStudio] = useState<StudioState | null>(null);
  // T170: tap a monogram app to open the glyph / photo picker. Edits go through the shared studio
  // store (persisted, other screens told) and the same pure change is applied to this screen's copy.
  const live = useStudio();
  const liveUpdate = live.update;
  const [editId, setEditId] = useState<string | null>(null);
  const updateStudio = useCallback(
    (fn: (s: StudioState) => StudioState) => {
      liveUpdate(fn);
      setStudio((s) => (s ? fn(s) : s));
    },
    [liveUpdate],
  );
  const [missing, setMissing] = useState<ReadonlySet<string>>(() => new Set<string>());  const [loadError, setLoadError] = useState<string | null>(null);  const install = useInstallState();
  // T194: the Shortcuts icons Glaze last walked through, for the "remove these old icons" note.
  const cleanup = useIconCleanupRecord();
  const cleanupUpdate = cleanup.update;
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
  const [photoNote, setPhotoNote] = useState<string | null>(null);  const [shortcutsError, setShortcutsError] = useState<string | null>(null);  const [expanded, setExpanded] = useState<string | null>(null);
  // T183: which app's single icon is being saved to Photos from its row (null = none / the whole set).
  const [savingOne, setSavingOne] = useState<string | null>(null);

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
      profileServer.stop();
    };
  }, [load]);

  const resolved = useMemo(
    () => withoutMissingImages(studio ? studioSpecs(studio) : [], missing),
    [studio, missing],
  );
  const specs: IconSpec[] = resolved.specs;
  const plan = useMemo(() => planInstall(specs), [specs]);
  // T170: which apps get theme art and which fall back to a (theme-designed) monogram.
  const coverage = useMemo(() => coverageSummary(specs), [specs]);
  const monogramRows = useMemo(() => coverageRows(specs).filter((r) => r.coverage === 'monogram'), [specs]);
  const themeName = profileThemeName(getTheme(studio?.themeId)?.name ?? null);
  const themeId = studio?.themeId ?? null;
  const backdrop = studio?.wallpaperColour ?? undefined;
  // T60: the profile method can be switched off in src/config/install.ts (App Review risk).
  const methodOpts = {
    profileEnabled: PROFILE_INSTALL_ENABLED,
    profileCount: plan.profile.length,
    profileServer: serverAvailable,
  };
  // T202 (owner-1101d #5): Install all at once unless the Shortcuts fallback was explicitly taken
  // since the switch (choiceExplicit + choiceEpoch, src/core/installMethods.ts isCurrentPick).
  const choice: InstallChoice = effectiveChoice(install.state.choice, methodOpts, isCurrentPick(install.state));
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
      // T194: one stable profile identifier per install, so this profile replaces the last one.
      const installId = await getInstallId();
      const files = buildInstallProfiles(plan.profile, rendered, themeName, { installId });
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
      // T250: an icon install re-checks the installed apps once (queued, chunked, after interactions).
      requestDeferred(DEFERRED_STEPS.installedProbe, 'install');
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

  // T265: "Install all icons" in the guided "Use this theme" flow opens this screen with auto=1,
  // which starts the same bulk profile install once (Install all at once only; nothing else changes).
  const { auto } = useLocalSearchParams<{ auto?: string }>();
  const autoStarted = useRef(false);
  useEffect(() => {
    if (auto !== '1' || autoStarted.current || !studio || busy) return;
    if (!PROFILE_INSTALL_ENABLED || choice !== 'bulk' || plan.profile.length === 0) return;
    autoStarted.current = true;
    generate().catch(() => {});
  }, [auto, studio, busy, choice, plan.profile.length, generate]);

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

  /** Save every listed icon (no argument) or one app's icon (T183, from its row) to the album. */
  const saveToPhotos = useCallback(async (one: IconSpec | null = null) => {
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
    setSavingOne(one ? one.appId : null);
    try {
      const list = one ? [one] : items.map((i) => i.spec);
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
      setSavingOne(null);
      setPhotoStatus('saved');
      haptic('success');
      cleanupUpdate((r) => recordWalk(r, cleanupThemeId(themeId), themeName, list.map((x) => ({ id: x.appId, label: x.label }))));
    } catch (e) {
      cancelToken.current = null;
      if (!alive.current) return;
      setSavingOne(null);
      if (isRenderCancelled(e)) {
        setPhotoStatus('idle');
        return;
      }
      haptic('warning');
      setShortcutsError(errText(e));
      setPhotoStatus('error');
    }
  }, [busy, items, renderer, t, cleanupUpdate, themeId, themeName]);

  const cancelRender = useCallback(() => {
    if (cancelToken.current) cancelToken.current.cancelled = true;
  }, []);

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
        <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), styles.centerText, { color: c.ink }]}>{t('install.state.loadError')}</Text>
        <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), styles.centerText, { color: c.inkSecondary }]}>{loadError}</Text>
        <PillButton label={t('common.retry')} icon="refresh-cw" onPress={load} style={styles.selfCenter} />
      </SafeAreaView>
    );
  }

  if (!studio || !install.loaded) {
    // T210: the wait is a skeleton of the screen itself (summary card, method header, method card).
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.root, { backgroundColor: c.bg }]}>
        <InstallSkeleton label={t('install.state.loading')} tone={cardTone} />
      </SafeAreaView>
    );
  }

  if (specs.length === 0) {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.root, styles.center, { backgroundColor: c.bg }]}>
        <Feather name="grid" size={32} color={c.tint} />
        <Text maxFontSizeMultiplier={fontScaleCap('title2')} accessibilityRole="header" style={[...ts('title2'), styles.centerText, { color: c.ink }]}>
          {t('install.state.emptyTitle')}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), styles.centerText, { color: c.inkSecondary }]}>{t('install.state.emptyBody')}</Text>
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
  // T183: the summary counts the profile only when Bulk is the method in use.
  const sum = installSummary(plan, PROFILE_INSTALL_ENABLED && choice === 'bulk');
  const summary =
    sum.kind === 'none'
      ? t('install.summary.none')
      : sum.kind === 'viaShortcuts'
        ? t('install.summary.viaShortcuts', { count: sum.shortcuts })
        : sum.kind === 'viaProfile'
          ? t('install.summary.viaProfile', { count: sum.profile })
          : t('install.summary.mixed', { count: sum.profile, shortcuts: sum.shortcuts });
  const editApp = editId ? findApp(live.state ?? studio, editId) : null;
  const editSpec = editId ? specs.find((s) => s.appId === editId) ?? null : null;
  const shortcutIds = items.map((i) => i.spec.appId);
  const tick = checklistCount(shortcutIds, install.state.shortcutsDone);
  // T194: old Glaze Shortcuts icons from a different theme, to remove before adding these.
  const oldIcons = cleanup.loaded ? oldIconsToRemove(cleanup.record, themeId, shortcutIds) : null;
  const oldNames = oldIcons ? namesList(oldIconNames(oldIcons), 8, t('install.cleanup.listSeparator')) : null;
  const openCleanup = () => {
    tapLight();
    router.push('/icons-cleanup');
  };

  const pickChoice = (next: InstallChoice) => {
    if (next === choice || busy) return;
    install.update((s) => ({ ...s, choice: next, choiceExplicit: true, choiceEpoch: CHOICE_EPOCH }));
  };
  // T202: how many profile apps open with a quick Safari tap (computed from the URLs).
  const tapInfo = safariTapCount(plan.profile);
  // Guided Shortcuts (T126): one icon at a time, the first app not ticked off yet is "next".
  const nextItem = items.find((i) => !install.state.shortcutsDone.includes(i.spec.appId)) ?? null;
  const toggleShortcut = (appId: string) => {
    const wasDone = install.state.shortcutsDone.includes(appId);
    install.update((s) => toggleShortcutDone(s, appId));
    // Ticking an app off opens the steps for the next one still to do.
    if (!wasDone) {
      const made = items.find((i) => i.spec.appId === appId);
      if (made) cleanup.update((r) => recordWalk(r, cleanupThemeId(themeId), themeName, [{ id: appId, label: made.spec.label }]));
      const next = items.find((i) => i.spec.appId !== appId && !install.state.shortcutsDone.includes(i.spec.appId));
      setExpanded(next ? next.spec.appId : null);
    }
  };

  // T173 step sequence: done flags per card, and the first card not done is the current step.
  const stepDone = cards.map((card) => isProfileStepDone(install.state, profileKey, card.id));
  const currentStep = stepDone.indexOf(false);
  const stepsDone = stepDone.filter(Boolean).length;
  // The profile is made and handed to Safari / the share sheet without an error: show "Done".
  const bulkFinished = phase === 'done' && profiles.length !== 0 && !bulkError;

  const bulkProgress =
    phase === 'rendering'
      ? overallProgress('rendering', step.done, step.total)
      : overallProgress(phase, step.done, Math.max(1, step.total));

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: c.bg }]}>
      <OffscreenIconRenderer ref={renderer.ref} backdrop={backdrop} />
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll}>
        {PROFILE_INSTALL_ENABLED && choice === 'bulk' ? (
          <View style={styles.side}>
            <ContextTip id="install-not-verified" />
          </View>
        ) : null}
        {/* Summary */}
        {/* T210: the summary card opens the screen as its hero: the set's first icons on a soft
            well, then one editorial heading (eyebrow "Your icon set" + the count line). */}
        <SquircleCard size="large" tone={cardTone} outline={false} style={styles.side}>
          <View style={styles.stack}>
            <View
              style={[styles.strip, styles.well, continuous, { backgroundColor: c.fill }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {specs.slice(0, 6).map((s) => (
                <IconCanvas key={s.appId} spec={s} size={RESULT_ICON} />
              ))}
              {specs.length > 6 ? (
                <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('install.summary.more', { count: specs.length - 6 })}</Text>
              ) : null}
            </View>
            <SectionHeader level="group" flushTop eyebrow={t('install.summary.eyebrow')} title={summary} style={styles.headerFlush} />
            {!PROFILE_INSTALL_ENABLED || choice !== 'bulk' ? null : noScheme.length > 0 ? (
              <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>
                {t('install.summary.noScheme', { count: noScheme.length, apps: noScheme.join(', ') })}
              </Text>
            ) : (
              <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('install.summary.allProfile')}</Text>
            )}
            {resolved.fellBack.length > 0 ? (
              <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.warn }]}>
                {t('install.summary.fellBack', { count: resolved.fellBack.length })}
              </Text>
            ) : null}
            <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('install.summary.cantReplace')}</Text>
          </View>
        </SquircleCard>

        {/* T170: themed vs monogram. Monogram apps are listed, one tap from the glyph / photo picker. */}
        <View style={styles.section}>
          <SectionHeader title={t('install.coverage.heading')} style={[styles.sideText, styles.headerTight]} />
          <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...ts('subhead'), styles.sideText, { color: c.ink }]}>
            {coverage.photo > 0
              ? t('install.coverage.countsWithPhotos', {
                  themed: formatNumber(coverage.themed),
                  monogram: formatNumber(coverage.monogram),
                  photo: formatNumber(coverage.photo),
                })
              : t('install.coverage.counts', { themed: formatNumber(coverage.themed), monogram: formatNumber(coverage.monogram) })}
          </Text>
          <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), styles.sideText, { color: c.inkSecondary }]}>
            {coverage.monogram > 0 ? t('install.coverage.monogramHint') : t('install.coverage.allThemed')}
          </Text>
          {monogramRows.length > 0 ? (
            <SquircleCard tone={cardTone} outline={false} padding={spaceV2.sm} style={styles.side}>
              <View style={styles.coverageList}>
                {monogramRows.map(({ spec }) => (
                  <CoverageRow
                    key={spec.appId}
                    spec={spec}
                    tag={t('install.coverage.tag')}
                    disabled={busy || !live.state}
                    accessibilityLabel={t('install.coverage.rowA11y', { app: spec.label })}
                    accessibilityHint={t('install.coverage.rowHint')}
                    onPress={() => setEditId(spec.appId)}
                  />
                ))}
              </View>
            </SquircleCard>
          ) : null}
        </View>

        {/* Method (T202, owner-1101d #5): Install all at once is ALWAYS the main method. No picker:
            Shortcuts is one small fallback link inside the profile card. When the profile can't be
            used (switch off, or no picked app has a link), one line of Shortcuts text. When the
            fallback was taken, a link back to Install all at once. */}
        {!bulkSelectable(methodOpts) ? (
          <>
            <SectionHeader title={t('install.method.heading')} style={[styles.sideText, styles.headerTight]} />
            <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), styles.sideText, { color: c.ink }]}>{t('install.method.shortcutsOnly')}</Text>
          </>
        ) : null}
        {bulkSelectable(methodOpts) && choice !== 'bulk' ? (
          <View style={[styles.side, styles.btnRow]}>
            <PillButton
              label={t('install.method.backToBulk')}
              icon="layers"
              variant="tinted"
              size="small"
              disabled={busy}
              onPress={() => pickChoice('bulk')}
              accessibilityHint={t('install.method.backToBulkHint')}
            />
          </View>
        ) : null}

        {choice === 'bulk' ? (
          <View style={styles.section}>
            {/* T210: the main method reads as one editorial heading (eyebrow + title + the count
                line as its body), so the card under it starts with the facts and the pill. */}
            <SectionHeader
              eyebrow={t('install.method.bulkEyebrow')}
              title={t('install.method.bulk')}
              body={t('install.method.bulkBody', { count: plan.profile.length })}
              style={[styles.sideText, styles.headerTight]}
            />
            <SquircleCard tone={cardTone} outline={false} style={styles.side}>
              <View style={styles.stack}>
                {/* T202: say plainly, from the data, how many apps still need a quick Safari tap. */}
                {tapInfo.tap > 0 ? (
                  <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>
                    {tapInfo.tap === tapInfo.total
                      ? t('install.method.safariTapAll', { count: tapInfo.tap })
                      : t('install.method.safariTap', { count: tapInfo.tap, total: tapInfo.total })}
                  </Text>
                ) : null}
                <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), { color: c.ink }]}>
                  {route === 'safari' ? t('install.safari.intro') : t('install.bulk.intro')}
                </Text>
                {route === 'share' ? (
                  <Notice tone="warn" icon="alert-triangle">
                    <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.ink }]}>{t('install.safari.fallbackNote')}</Text>
                  </Notice>
                ) : null}
                {bulkBusy ? (
                  <ProgressBar progress={bulkProgress} label={phaseText(phase, step.done, step.total)} />
                ) : null}
                {/* T173: the wait (drawing icons, building, saving) as a skeleton of the result. */}
                {bulkBusy ? <ResultSkeleton icons={Math.min(RESULT_ICONS, plan.profile.length)} file /> : null}
                {bulkFinished ? (
                  <FinishedPanel
                    title={t('install.finished.title')}
                    body={route === 'safari' ? t('install.finished.safari') : t('install.finished.share')}
                    reduced={reduced}
                  />
                ) : null}
                {bulkFinished ? <CleanupTip onPress={openCleanup} /> : null}
                {renderTiming && !bulkBusy ? (
                  <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]} accessibilityLabel={renderTiming}>
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
                    <View key={p.filename} style={[styles.fileRow, continuous, { backgroundColor: c.fill }]}>
                      <Feather name="file" size={18} color={c.tint} />
                      <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), styles.flex, { color: c.ink }]} numberOfLines={2}>
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
                  <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.ink }]}>
                    {t('install.safari.oneAtATime', { files: profiles.length })}
                  </Text>
                ) : null}
                <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>
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
                {/* T202: Shortcuts only as a small fallback link. T210: centred at the card's foot,
                    after a little extra space, so it reads as the quiet alternative. */}
                {showShortcutsFallback(methodOpts) ? (
                  <View style={styles.fallbackLink}>
                    <PillButton
                      label={t('install.method.shortcutsFallback')}
                      icon="command"
                      variant="plain"
                      size="small"
                      disabled={busy}
                      onPress={() => pickChoice('shortcuts')}
                      accessibilityHint={t('install.method.shortcutsFallbackHint')}
                    />
                  </View>
                ) : null}
              </View>
            </SquircleCard>

            {/* T173: the steps as one calm numbered sequence; the first step not done is current. */}
            <SectionHeader
              eyebrow={t('install.sequence.eyebrow')}
              title={t('install.sequence.title')}
              body={t('install.shortcuts.progress', { done: stepsDone, total: cards.length })}
              style={[styles.sideText, styles.headerTight]}
            />
            <SquircleCard
              tone={scheme === 'dark' ? 'raised' : 'surface'}
              outline={false}
              padding={spaceV2.sm}
              style={styles.side}
            >
              <View style={styles.sequence}>
                {cards.map((card, i) => {
                  const done = stepDone[i];
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
                      total={cards.length}
                      title={keys ? t(keys.titleKey) : card.title}
                      body={cardBody}
                      illustration={card.illustration}
                      state={done ? 'done' : i === currentStep ? 'current' : 'upcoming'}
                      reduced={reduced}
                      onToggleDone={() => install.update((s) => toggleProfileStep(s, profileKey, card.id))}
                    />
                  );
                })}
                {currentStep < 0 ? (
                  <FinishedPanel title={t('install.finished.title')} body={t('install.sequence.allDone')} reduced={reduced} />
                ) : null}
                {currentStep < 0 ? <CleanupTip onPress={openCleanup} /> : null}
              </View>
            </SquircleCard>
          </View>
        ) : null}

        {items.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title={choice === 'bulk' ? t('install.shortcuts.headingRest') : t('install.shortcuts.heading')}
              style={[styles.sideText, styles.headerTight]}
            />
            <SquircleCard tone={cardTone} outline={false} style={styles.side}>
              <View style={styles.stack}>
                <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), { color: c.ink }]}>{t('install.shortcuts.intro')}</Text>
                {oldIcons && oldNames && oldNames.shown ? (
                  <Notice tone="warn" icon="trash-2">
                    <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.ink }]}>
                      {oldNames.more > 0
                        ? t('install.cleanup.removeOldMore', { theme: oldIcons.themeName, apps: oldNames.shown, more: oldNames.more })
                        : t('install.cleanup.removeOld', { theme: oldIcons.themeName, apps: oldNames.shown })}
                    </Text>
                    <View style={styles.btnRow}>
                      <PillButton
                        label={t('install.cleanup.howTo')}
                        icon="help-circle"
                        variant="tinted"
                        size="small"
                        onPress={openCleanup}
                        accessibilityHint={t('install.cleanup.openHint')}
                      />
                      <PillButton
                        label={t('install.cleanup.markRemoved')}
                        variant="plain"
                        size="small"
                        onPress={() => cleanup.update((r) => markOldRemoved(r, themeId))}
                      />
                    </View>
                  </Notice>
                ) : null}
                {photosBusy ? (
                  <ProgressBar
                    progress={batchFraction(photoStep.done, photoStep.total)}
                    label={t('install.shortcuts.savingProgress', { done: Math.min(photoStep.done, photoStep.total), total: photoStep.total })}
                  />
                ) : null}
                {photosBusy ? <ResultSkeleton icons={Math.min(RESULT_ICONS, items.length)} /> : null}
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
                    <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.ink }]}>
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
                      <PillButton label={t('common.retry')} variant="plain" size="small" onPress={() => saveToPhotos()} />
                    </View>
                  </Notice>
                ) : null}
                {photoNote ? (
                  <View style={styles.okRow}>
                    <Feather name="check-circle" size={18} color={c.ok} />
                    <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), styles.flex, { color: c.ink }]}>{photoNote}</Text>
                  </View>
                ) : null}
                {shortcutsError ? (
                  <InlineError
                    message={shortcutsError}
                    onRetry={photoStatus === 'error' ? () => saveToPhotos() : undefined}
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
                  onPress={() => saveToPhotos()}
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
                    <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[...ts('headline'), styles.flex, { color: c.ink }]}>
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
                    <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), styles.flex, { color: c.ink }]}>{t('install.guided.allDone')}</Text>
                  </View>
                ) : null}
                {!nextItem && tick.total > 0 ? <CleanupTip onPress={openCleanup} /> : null}
                <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('install.guided.oneAtATime')}</Text>
              </View>
            </SquircleCard>

            <InsetGroup>
              {items.map((item) => (
                <ShortcutRow
                  key={item.spec.appId}
                  item={item}
                  done={install.state.shortcutsDone.includes(item.spec.appId)}
                  open={expanded === item.spec.appId}
                  busy={busy}
                  savingIcon={photosBusy && savingOne === item.spec.appId}
                  onToggleOpen={() => {
                    setExpanded((cur) => (cur === item.spec.appId ? null : item.spec.appId));
                  }}
                  onToggleDone={() => toggleShortcut(item.spec.appId)}
                  onSaveIcon={() => saveToPhotos(item.spec)}
                  onOpenShortcuts={openShortcuts}
                />
              ))}
            </InsetGroup>

            {/* T60: how to undo the Shortcuts method */}
            <InsetGroup title={t('install.shortcuts.undo.title')}>
              {SHORTCUT_UNDO_STEPS.map((id) => (
                <InsetRow key={id} title={t(`install.shortcuts.undo.${id}`)} />
              ))}
            </InsetGroup>
          </View>
        ) : null}

        {androidNative.isAndroid ? (
          <SquircleCard tone={cardTone} outline={false} style={styles.side}>
            <View style={styles.stack}>
              <Text maxFontSizeMultiplier={fontScaleCap('title3')} accessibilityRole="header" style={[...ts('title3'), { color: c.ink }]}>
                {t('install.android.heading')}
              </Text>
              <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>
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
      {live.state ? (
        <IconOverrideSheet
          visible={editId !== null && editApp !== null}
          onClose={() => setEditId(null)}
          app={editApp}
          spec={editSpec}
          state={live.state}
          update={updateStudio}
          themeKey={activeThemeKey(studio)}
          themeName={getTheme(studio.themeId)?.name ?? t('icons.ownStyle')}
          wallpaperColour={studio.wallpaperColour}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------- pieces

/**
 * T170: one monogram app in the install screen's "Your apps" card: its icon as it will install,
 * its name, a small "Monogram" tag and a chevron. Tapping opens the glyph / photo picker.
 */
function CoverageRow({
  spec,
  tag,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  onPress,
}: {
  spec: IconSpec;
  tag: string;
  disabled: boolean;
  accessibilityLabel: string;
  accessibilityHint: string;
  onPress: () => void;
}) {
  const { c } = useColorsV2();
  const { script, isRTL } = useT();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="select"
      pressedScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={[styles.coverageRow, disabled ? styles.dim : null]}
    >
      <IconCanvas spec={spec} size={COVERAGE_ICON} />
      <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...typeFor(script, 'body'), styles.flex, { color: c.ink }]} numberOfLines={1}>
        {spec.label}
      </Text>
      <View style={[styles.badge, continuous, { backgroundColor: c.pastels.butter.fill }]}>
        <Text maxFontSizeMultiplier={fontScaleCap('caption1')} style={[...typeFor(script, 'caption1'), styles.badgeText, { color: c.pastels.butter.ink }]}>{tag}</Text>
      </View>
      <Feather name={Chevron.forward(isRTL)} size={18} color={c.inkTertiary} />
    </PressableScale>
  );
}

/** Icon edge in the coverage rows (points). */
const COVERAGE_ICON = 36;

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

/** Soft notice box (warning tint) with an icon and free content. */
function Notice({ tone, icon, children }: { tone: 'warn'; icon: 'lock' | 'alert-triangle' | 'trash-2'; children?: ReactNode }) {
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
      <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...typeFor(script, 'footnote'), { color: c.ink }]}>{message}</Text>
      <View style={styles.btnRow}>
        {onRetry ? <PillButton label={retryLabel} icon="refresh-cw" variant="tinted" size="small" onPress={onRetry} /> : null}
        {onDismiss ? <PillButton label={t('install.shortcuts.dismiss')} variant="plain" size="small" onPress={onDismiss} /> : null}
      </View>
    </Notice>
  );
}

/** Icon skeletons shown while a batch is drawn (the result's first icons). */
const RESULT_ICONS = 6;
/** Icon edge in the result skeleton and the summary strip (points). */
const RESULT_ICON = 40;

/** Timed opacity for a step's "current" highlight and the finished panel: ease-out, never a spring. */
function fadeTiming(reduced: boolean) {
  return { duration: reduced ? durations.fast : durations.base, easing: easeOutCurve };
}

/**
 * T173: the wait as a skeleton of the result: a row of icon-shaped blocks (the icons being drawn)
 * and, for the profile, a file row. Hidden from VoiceOver; the progress bar above announces.
 */
function ResultSkeleton({ icons, file = false }: { icons: number; file?: boolean }) {
  const n = Math.max(1, icons);
  return (
    <View style={styles.stack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.strip}>
        {Array.from({ length: n }, (_, i) => (
          <Skeleton key={i} width={RESULT_ICON} height={RESULT_ICON} radius={iconTileRadius(RESULT_ICON)} />
        ))}
      </View>
      {file ? (
        <View style={styles.okRow}>
          <Skeleton width={sizeV2.rowIcon} height={sizeV2.rowIcon} radius={iconTileRadius(sizeV2.rowIcon)} />
          <Skeleton width="60%" height={spaceV2.lg} />
        </View>
      ) : null}
    </View>
  );
}

/** Card tone for the screen's lifted cards: raised in dark mode, the plain surface in light. */
type CardTone = 'surface' | 'raised';

/**
 * T210: the first load as a skeleton of the screen it becomes: the summary card (a row of icon
 * tiles on its well, eyebrow, title and a body line), the method header, and the method card with
 * a pill-shaped block. One accessible "Loading your icons…" label; calm pulse (Skeleton), no spinner.
 */
function InstallSkeleton({ label, tone }: { label: string; tone: CardTone }) {
  const { c } = useColorsV2();
  return (
    <View style={styles.scroll} accessible accessibilityLabel={label}>
      <SquircleCard size="large" tone={tone} outline={false} style={styles.side}>
        <View style={styles.stack}>
          <View style={[styles.well, continuous, { backgroundColor: c.fill }]}>
            <IconGridSkeleton count={RESULT_ICONS} size={RESULT_ICON} cols={RESULT_ICONS} />
          </View>
          <Skeleton width="35%" height={spaceV2.md} />
          <Skeleton width="75%" height={spaceV2.xl} />
          <Skeleton width="90%" height={spaceV2.lg} />
        </View>
      </SquircleCard>
      <View style={[styles.sideText, styles.skeletonHead]}>
        <Skeleton width="30%" height={spaceV2.md} />
        <Skeleton width="60%" height={spaceV2.xl} />
      </View>
      <SquircleCard tone={tone} outline={false} style={styles.side}>
        <View style={styles.stack}>
          <Skeleton width="90%" height={spaceV2.lg} />
          <Skeleton width="70%" height={spaceV2.lg} />
          <Skeleton width="100%" height={sizeV2.pill} radius={radiusV2.pill} />
        </View>
      </SquircleCard>
    </View>
  );
}

/** T194: after a finish, the reminder to hide the original app icons, linking to the cleanup steps. */
function CleanupTip({ onPress }: { onPress: () => void }) {
  const { c } = useColorsV2();
  const { t, script, isRTL } = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityHint={t('install.cleanup.openHint')}
      style={({ pressed }) => [styles.okRow, styles.tipRow, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Feather name="eye-off" size={18} color={c.tint} />
      <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...typeFor(script, 'footnote'), styles.flex, { color: c.ink }]}>
        {t('install.cleanup.tipHide')}
      </Text>
      <Feather name={Chevron.forward(isRTL)} size={18} color={c.inkTertiary} />
    </Pressable>
  );
}

/**
 * T173 finished state: a check, a clear "Done" and one line on what is left. Fades in (timed,
 * ease-out). No haptic here: the flow's one `success` fires where the work finishes.
 */
function FinishedPanel({ title, body, reduced }: { title: string; body: string; reduced: boolean }) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withTiming(1, fadeTiming(reduced));
  }, [reduced, shown]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <Animated.View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={t('install.method.a11yNoBadge', { title, body })}
      style={[styles.finished, continuous, { backgroundColor: c.pastels.mint.fill }, fade]}
    >
      <Feather name="check-circle" size={22} color={c.pastels.mint.ink} />
      <View style={styles.flex}>
        <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[...typeFor(script, 'headline'), { color: c.pastels.mint.ink }]}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...typeFor(script, 'footnote'), { color: c.pastels.mint.ink }]}>
          {body}
        </Text>
      </View>
    </Animated.View>
  );
}

type StepState = 'current' | 'upcoming' | 'done';

/**
 * One profile install step in the numbered sequence. The current step has a filled tint number, a
 * "Current step" label and a soft highlight that fades in when the sequence moves to it (and out of
 * the step before); upcoming steps are muted (quiet number, secondary text); done steps show a
 * check. Schematic phone illustration and a "Mark as done" checkbox row as before.
 */
function StepRow({
  index,
  total,
  title,
  body,
  illustration,
  state,
  reduced,
  onToggleDone,
}: {
  index: number;
  total: number;
  title: string;
  body: string;
  illustration: Illustration;
  state: StepState;
  reduced: boolean;
  onToggleDone: () => void;
}) {
  const { c } = useColorsV2();
  const { t, script, formatNumber } = useT();
  const done = state === 'done';
  const current = state === 'current';
  const on = useSharedValue(current ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(current ? 1 : 0, fadeTiming(reduced));
  }, [current, reduced, on]);
  const glow = useAnimatedStyle(() => ({ opacity: on.value }));
  const guideArt = isGuideArt(illustration);
  const tileFill = done ? c.pastels.mint.fill : current ? c.tint : c.fill;
  const tileInk = done ? c.pastels.mint.ink : current ? c.onTint : c.inkSecondary;
  const label = current
    ? t('install.sequence.a11yCurrent', { index, total, title, body })
    : t('install.sequence.a11yStep', { index, total, title, body });
  return (
    <View style={styles.stepRow}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.stepGlow, continuous, { backgroundColor: c.fill }, glow]}
      />
      <View style={styles.stepTop}>
        <View
          style={[
            styles.numTile,
            continuous,
            { borderRadius: iconTileRadius(sizeV2.rowIcon), backgroundColor: tileFill },
          ]}
        >
          {done ? (
            <Feather name="check" size={16} color={tileInk} />
          ) : (
            <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...typeFor(script, 'subhead'), styles.badgeText, { color: tileInk }]}>{formatNumber(index)}</Text>
          )}
        </View>
        <View style={styles.flex} accessible accessibilityLabel={label}>
          {current ? (
            <Animated.View style={glow}>
              <Text maxFontSizeMultiplier={fontScaleCap('caption1')} style={[...typeFor(script, 'caption1'), styles.badgeText, { color: c.tint }]}>
                {t('install.sequence.current')}
              </Text>
            </Animated.View>
          ) : null}
          <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[...typeFor(script, 'headline'), { color: current ? c.ink : c.inkSecondary }]}>
            {title}
          </Text>
          <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...typeFor(script, 'footnote'), { color: current ? c.ink : c.inkSecondary }]}>{body}</Text>
        </View>
        {guideArt ? null : <StepIllustration kind={illustration} />}
      </View>
      {/* T262: the redrawn iOS 27 screen for this step, full width under its text. */}
      {guideArt ? (
        <View style={styles.guideArt}>
          <ProfileGuideArt kind={illustration} />
        </View>
      ) : null}
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
        <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...typeFor(script, 'subhead'), styles.flex, { color: done ? c.ok : c.tint }]}>
          {done ? t('install.stepCard.done') : t('install.stepCard.markDone')}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * One app on the guided Shortcuts checklist. T183: every app uses the "Open App" action (no URL to
 * copy). Open, the row shows the numbered steps plus the two things they need: this app's icon in
 * Photos (saved on its own, for the "Choose Photo" step) and a button to the Shortcuts app.
 */
function ShortcutRow({
  item,
  done,
  open,
  busy,
  savingIcon,
  onToggleOpen,
  onToggleDone,
  onSaveIcon,
  onOpenShortcuts,
}: {
  item: ShortcutItem;
  done: boolean;
  open: boolean;
  busy: boolean;
  savingIcon: boolean;
  onToggleOpen: () => void;
  onToggleDone: () => void;
  onSaveIcon: () => void;
  onOpenShortcuts: () => void;
}) {
  const { c } = useColorsV2();
  const { t, script, formatNumber } = useT();
  const { spec } = item;
  const name = spec.label.trim() || t('install.steps.appFallback');
  const steps = [
    t('install.steps.openShortcuts'),
    t('install.steps.addOpenApp'),
    t('install.steps.chooseApp', { name }),
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
            maxFontSizeMultiplier={fontScaleCap('body')}
            style={[...typeFor(script, 'body'), { color: c.ink, textDecorationLine: done ? 'line-through' : 'none' }]}
          >
            {spec.label}
          </Text>
          <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...typeFor(script, 'footnote'), { color: c.inkSecondary }]}>
            {item.reason === 'no-scheme' ? t('install.shortcuts.noLink') : t('install.shortcuts.viaOpenApp')}
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
      {open ? (
        <View style={styles.steps}>
          {steps.map((s, i) => (
            <View key={i} style={styles.stepLine}>
              <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...typeFor(script, 'footnote'), styles.stepNum, { color: c.tint }]}>{formatNumber(i + 1)}.</Text>
              <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...typeFor(script, 'footnote'), styles.flex, { color: c.ink }]}>{s}</Text>
            </View>
          ))}
          <View style={styles.btnRow}>
            <PillButton
              label={t('install.shortcuts.saveOne', { app: spec.label })}
              icon="image"
              variant="tinted"
              size="small"
              disabled={busy}
              busy={savingIcon}
              onPress={onSaveIcon}
              accessibilityHint={t('install.shortcuts.saveHint', { album: PHOTOS_ALBUM })}
            />
            <PillButton label={t('install.shortcuts.open')} icon="external-link" variant="plain" size="small" onPress={onOpenShortcuts} />
          </View>
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
  badge: { borderRadius: radiusV2.pill, paddingHorizontal: spaceV2.sm, paddingVertical: spaceV2.xxs },
  badgeText: { fontWeight: '700' },
  coverageRow: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, minHeight: sizeV2.touch, paddingVertical: spaceV2.sm },
  flex: { flex: 1 },
  dim: { opacity: 0.45 },
  // T210: a saved profile file is a soft filled row (surface, not a hairline above it).
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.sm,
    borderRadius: radiusV2.control,
    paddingStart: spaceV2.md,
    paddingEnd: spaceV2.xs,
  },
  // T210: the summary's icon strip sits on a soft well; the coverage rows are spaced, not ruled.
  well: { borderRadius: radiusV2.control, padding: spaceV2.md },
  headerFlush: { paddingBottom: 0 },
  coverageList: { gap: spaceV2.xs, paddingHorizontal: spaceV2.sm },
  fallbackLink: { alignItems: 'center', paddingTop: spaceV2.sm },
  skeletonHead: { gap: spaceV2.sm, paddingTop: editorialV2.sectionTop - spaceV2.lg },
  smallBtn: { width: sizeV2.touch, height: sizeV2.touch, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: spaceV2.sm, borderRadius: radiusV2.control, padding: spaceV2.md },
  noticeBody: { gap: spaceV2.sm },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  tipRow: { minHeight: sizeV2.rowMin },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.sm },
  headerTight: { paddingTop: editorialV2.sectionTop - spaceV2.lg, paddingBottom: 0 },
  sequence: { gap: spaceV2.xs },
  finished: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceV2.md, borderRadius: radiusV2.control, padding: spaceV2.md },
  stepRow: { paddingHorizontal: spaceV2.md, paddingTop: spaceV2.md, gap: spaceV2.xs },
  stepGlow: { borderRadius: radiusV2.control },
  stepTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceV2.md },
  guideArt: { paddingVertical: spaceV2.xs },
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
  steps: { marginStart: sizeV2.touch + spaceV2.sm, gap: spaceV2.xs, paddingBottom: spaceV2.sm },
  stepLine: { flexDirection: 'row', gap: spaceV2.sm },
  stepNum: { minWidth: 20, fontWeight: '700' },
});
