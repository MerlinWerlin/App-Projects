// This device's iOS major version and Glaze build, for the live instructions (T30).
// Also the localized copy of src/core/liveSteps.ts: core decides (mode, availability) and stays
// the tested English source; these helpers pick the matching catalogue keys (liveUi.instr.*,
// liveUi.options.*, liveUi.hero.*) by the same branches, so every language gets the same facts.
import { Platform } from 'react-native';
import {
  LOOP_MIN_IOS,
  applyInstructions,
  parseIosMajor,
  saveOptions,
  type ApplyInput,
  type ApplyInstructions,
  type LiveBuild,
  type LiveKind,
  type SaveOption,
} from '../core/liveSteps';
import type { TFunction } from '../i18n';
import { isExpoGo } from '../native/livelock';

export type LiveContext = { isIos: boolean; iosMajor: number; build: LiveBuild };

export function liveContext(): LiveContext {
  const isIos = Platform.OS === 'ios';
  return {
    isIos,
    iosMajor: isIos ? parseIosMajor(Platform.Version) : 0,
    build: isExpoGo() ? 'expo-go' : 'full',
  };
}

/** Same as applyInstructions, with headline, steps and limits in the app language. */
export function localizedInstructions(t: TFunction, input: ApplyInput): ApplyInstructions {
  const base = applyInstructions(input);
  const ios = parseIosMajor(input.iosMajor);
  const { build, kind } = input;
  const path = t('liveUi.wallpaperPath');
  // Version numbers go in as strings so they keep Latin digits (iOS shows them that way).
  const min = LOOP_MIN_IOS;
  const still = [
    t('liveUi.instr.still1'),
    t('liveUi.instr.still2'),
    t('liveUi.instr.still3', { path }),
    t('liveUi.instr.still4'),
  ];
  const gifLimit = t('liveUi.instr.limitGif');

  if (build === 'expo-go') {
    const fullNote =
      ios >= min
        ? kind === 'gif'
          ? t('liveUi.instr.fullLoopGif', { version: String(ios) })
          : t('liveUi.instr.fullLoopClip', { version: String(ios) })
        : ios > 0
          ? kind === 'gif'
            ? t('liveUi.instr.fullOldGif', { version: String(ios), min: String(min) })
            : t('liveUi.instr.fullOldClip', { version: String(ios), min: String(min) })
          : t('liveUi.instr.fullUnknown', { min: String(min) });
    const limits = [t('liveUi.instr.limitExpoGo'), fullNote, t('liveUi.instr.limitSaveClip')];
    if (kind === 'gif') limits.unshift(gifLimit);
    return { mode: base.mode, headline: t('liveUi.instr.headStill'), steps: still, limits };
  }

  if (ios >= min) {
    const limits = [t('liveUi.instr.loopNowPlaying'), t('liveUi.instr.loopOtherAudio'), t('liveUi.instr.loopLowPower')];
    if (kind === 'gif') limits.unshift(t('liveUi.instr.loopGif'));
    return {
      mode: base.mode,
      headline: t('liveUi.instr.headLoop', { version: String(ios) }),
      steps: [t('liveUi.instr.loop1'), t('liveUi.instr.loop2'), t('liveUi.instr.loop3'), t('liveUi.instr.loop4')],
      limits,
    };
  }

  const label = ios > 0 ? t('liveUi.instr.iosVersion', { version: String(ios) }) : t('liveUi.instr.thisIos');
  if (kind === 'gif') {
    return {
      mode: base.mode,
      headline: t('liveUi.instr.headGifStill', { label }),
      steps: still,
      limits: [gifLimit, t('liveUi.instr.gifNeedsVideo'), t('liveUi.instr.needsMin', { min: String(min) })],
    };
  }
  return {
    mode: base.mode,
    headline: t('liveUi.instr.headLivePhoto', { label }),
    steps: [t('liveUi.instr.lp1'), t('liveUi.instr.lp2'), t('liveUi.instr.lp3', { path }), t('liveUi.instr.lp4')],
    limits: [t('liveUi.instr.lpBrief'), t('liveUi.instr.needsMin', { min: String(min) })],
  };
}

/** saveOptions with label, detail and unavailableReason in the app language (matched by id). */
export function localizedSaveOptions(t: TFunction, build: LiveBuild, kind: LiveKind, iosMajor?: number): SaveOption[] {
  const gif = kind === 'gif';
  const full = build === 'full';
  return saveOptions(build, kind, iosMajor).map((o): SaveOption => {
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
    if (o.id === 'live-photo') {
      return {
        ...o,
        label: t('liveUi.options.livePhotoLabel'),
        detail: t('liveUi.options.livePhotoDetail'),
        unavailableReason: o.available ? undefined : !full ? t('liveUi.options.needsFull') : t('liveUi.options.needsVideo'),
      };
    }
    return {
      ...o,
      label: t('liveUi.options.loopLabel'),
      detail: t('liveUi.options.loopDetail'),
      unavailableReason: o.available ? undefined : !full ? t('liveUi.options.needsFull') : t('liveUi.options.needsIos', { min: String(LOOP_MIN_IOS) }),
    };
  });
}

/** heroSubline in the app language. */
export function localizedHeroSubline(t: TFunction, build: LiveBuild, iosMajor: number): string {
  const ios = parseIosMajor(iosMajor);
  if (build === 'expo-go') return t('liveUi.hero.subExpoGo');
  if (ios >= LOOP_MIN_IOS) return t('liveUi.hero.subLoop');
  if (ios > 0) return t('liveUi.hero.subLivePhoto', { version: String(ios) });
  return t('liveUi.hero.subUnknown');
}
