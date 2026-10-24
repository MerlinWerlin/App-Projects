// This device's iOS major version and Glaze build, for the live instructions (T30, T127).
// Also the localized copy of src/core/liveSteps.ts: core decides (notice, notes, availability)
// and stays the tested English source; these helpers pick the matching catalogue keys
// (liveUi.guide.*, liveUi.options.*, liveUi.hero.*) by the same branches, so every language gets
// the same facts.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  LIVE_PHOTO_WALLPAPER_MIN_IOS,
  livePhotoGuide,
  parseIosMajor,
  saveOptions,
  type GuideInput,
  type GuideNoteId,
  type GuideNotice,
  type GuideStepId,
  type LiveBuild,
  type LiveKind,
  type SaveOption,
} from '../core/liveSteps';
import type { TFunction } from '../i18n';

// Expo Go check (was in src/native/livelock.ts, parked in docs/future/live-wallpaper on 24 Oct).
function isExpoGo(): boolean {
  try {
    return (
      String(Constants.executionEnvironment) === 'storeClient' ||
      String((Constants as { appOwnership?: unknown }).appOwnership) === 'expo'
    );
  } catch {
    return false;
  }
}

export type LiveContext = { isIos: boolean; iosMajor: number; build: LiveBuild };

export function liveContext(): LiveContext {
  const isIos = Platform.OS === 'ios';
  return {
    isIos,
    iosMajor: isIos ? parseIosMajor(Platform.Version) : 0,
    build: isExpoGo() ? 'expo-go' : 'full',
  };
}

export type LocalizedGuideStep = { id: GuideStepId; title: string; body: string };

export type LocalizedGuide = {
  canSave: boolean;
  notice: GuideNotice;
  /** The notice in the app language ('' when there is none). */
  noticeText: string;
  steps: LocalizedGuideStep[];
  notes: string[];
};

/** Title and body of one guide step in the app language (keys spelled out for the typed t()). */
export function localizedStep(t: TFunction, id: GuideStepId): LocalizedGuideStep {
  if (id === 'photos') return { id, title: t('liveUi.guide.photosTitle'), body: t('liveUi.guide.photosBody') };
  if (id === 'share') return { id, title: t('liveUi.guide.shareTitle'), body: t('liveUi.guide.shareBody') };
  return { id, title: t('liveUi.guide.lockTitle'), body: t('liveUi.guide.lockBody') };
}

/** livePhotoGuide with every string in the app language. */
export function localizedGuide(t: TFunction, input: GuideInput): LocalizedGuide {
  const g = livePhotoGuide(input);
  const ios = parseIosMajor(input.iosMajor);
  const note = (id: GuideNoteId): string => {
    if (id === 'moves') return t('liveUi.guide.moves');
    if (id === 'needs') return t('liveUi.guide.needs');
    // Version numbers go in as strings so they keep Latin digits (iOS shows them that way).
    if (id === 'old-ios') return t('liveUi.guide.oldIos', { version: String(ios) });
    return t('liveUi.guide.altPath', { path: t('liveUi.wallpaperPath') });
  };
  const noticeText =
    g.notice === 'needs-full'
      ? t('liveUi.guide.needsFull')
      : g.notice === 'needs-build'
        ? t('liveUi.guide.needsBuild')
        : g.notice === 'gif'
          ? t('liveUi.livePhoto.msgGif')
          : '';
  return {
    canSave: g.canSave,
    notice: g.notice,
    noticeText,
    steps: g.steps.map((s) => localizedStep(t, s.id)),
    notes: g.notes.map(note),
  };
}

/** saveOptions with label, detail and unavailableReason in the app language (matched by id). */
export function localizedSaveOptions(t: TFunction, build: LiveBuild, kind: LiveKind): SaveOption[] {
  const gif = kind === 'gif';
  const full = build === 'full';
  return saveOptions(build, kind).map((o): SaveOption => {
    if (o.id === 'still-frame') {
      return { ...o, label: t('liveUi.options.stillLabel'), detail: gif ? t('liveUi.options.stillDetailGif') : t('liveUi.options.stillDetailVideo') };
    }
    if (o.id === 'clip') {
      return {
        ...o,
        label: gif ? t('liveUi.options.clipLabelGif') : t('liveUi.options.clipLabelVideo'),
        detail: gif ? t('liveUi.options.clipDetailGif') : t('liveUi.options.clipDetailVideo'),
      };
    }
    return {
      ...o,
      label: t('liveUi.options.livePhotoLabel'),
      detail: t('liveUi.options.livePhotoDetail'),
      unavailableReason: o.available ? undefined : !full ? t('liveUi.options.needsFull') : t('liveUi.options.needsVideo'),
    };
  });
}

/** heroSubline in the app language. */
export function localizedHeroSubline(t: TFunction, build: LiveBuild, iosMajor: number): string {
  const ios = parseIosMajor(iosMajor);
  if (build === 'expo-go') return t('liveUi.hero.subExpoGo');
  if (ios > 0 && ios < LIVE_PHOTO_WALLPAPER_MIN_IOS) return t('liveUi.hero.subLivePhoto', { version: String(ios) });
  return t('liveUi.hero.subLive');
}
