// How to get a loop onto the iPhone Lock Screen, per iOS version and Glaze build (T30).
// Pure TS (no React Native imports) so the copy and the decisions are unit-tested.
//
// The honest facts (docs/AUDIT_2026-10-12.md "iOS limits"):
// - No app can set a wallpaper; iOS wallpapers never animate a GIF or a plain video.
// - iOS 26+ with the full Glaze build: a true loop, played as the animated artwork of Glaze's
//   muted Now Playing item (docs/LIVELOCK.md). It stays while Glaze is playing it.
// - iOS 16–25 with the full build: a Live Photo wallpaper (docs/LIVEPHOTO.md). It moves only
//   briefly (on wake, or when you touch and hold, depending on the iOS version), never a loop.
// - Expo Go (the trial): preview only; you can save a still-frame wallpaper and the clip itself.

export type LiveBuild = 'expo-go' | 'full';
export type LiveKind = 'video' | 'gif';
export type LiveMode = 'loop' | 'live-photo' | 'still';

export type ApplyInput = { iosMajor: number; build: LiveBuild; kind: LiveKind };

export type ApplyInstructions = {
  mode: LiveMode;
  headline: string;
  steps: string[];
  limits: string[];
};

/** First iOS version with the Now Playing animated artwork loop (matches LIVELOCK_MIN_IOS). */
export const LOOP_MIN_IOS = 26;

export const WALLPAPER_PATH = 'Settings › Wallpaper › Add New Wallpaper › Photos';

/**
 * iOS major version from Platform.Version ('26.0', '17.4.1', 18, '18'). Anything unreadable
 * gives 0 ("unknown").
 */
export function parseIosMajor(version: unknown): number {
  if (typeof version === 'number') return Number.isFinite(version) && version > 0 ? Math.floor(version) : 0;
  if (typeof version !== 'string') return 0;
  const m = /^\s*(\d{1,3})(?:\.\d+)*\s*$/.exec(version);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return n > 0 ? n : 0;
}

const GIF_LIMIT = 'iOS wallpapers never animate a GIF directly. Glaze has to turn it into a moving Lock Screen another way.';

const STILL_STEPS: readonly string[] = [
  'Frame it in the loop editor, then tap Save to Photos when the moment you like is showing (the preview pauses there; a GIF uses its first frame).',
  'Tap Still frame wallpaper. Glaze saves it at your iPhone’s screen size.',
  `Open ${WALLPAPER_PATH} and pick the still Glaze saved.`,
  'Check the clock does not cover anything important, then tap Add and Set as Wallpaper Pair (or Customise Home Screen).',
];

function fullBuildNote(iosMajor: number, kind: LiveKind): string {
  if (iosMajor >= LOOP_MIN_IOS) {
    return `The full Glaze build can loop this ${kind === 'gif' ? 'GIF' : 'clip'} on your Lock Screen on iOS ${iosMajor}.`;
  }
  if (iosMajor > 0) {
    return kind === 'gif'
      ? `The full Glaze build loops GIFs on the Lock Screen on iOS ${LOOP_MIN_IOS} or later; on iOS ${iosMajor} it can save a video (not a GIF) as a Live Photo.`
      : `On iOS ${iosMajor} the full Glaze build can save this clip as a Live Photo, which moves briefly but does not loop. A true loop needs iOS ${LOOP_MIN_IOS} or later.`;
  }
  return `The full Glaze build loops clips on the Lock Screen on iOS ${LOOP_MIN_IOS} or later, and saves Live Photos on earlier versions.`;
}

/** Step-by-step instructions and honest limits for this device, build and source kind. */
export function applyInstructions(input: ApplyInput): ApplyInstructions {
  const iosMajor = parseIosMajor(input.iosMajor);
  const { build, kind } = input;

  if (build === 'expo-go') {
    const limits = [
      'You are trying Glaze in Expo Go, so it can preview the loop but cannot put a moving Lock Screen on your iPhone.',
      fullBuildNote(iosMajor, kind),
      'Save the clip too, so you can use it with the full build later.',
    ];
    if (kind === 'gif') limits.unshift(GIF_LIMIT);
    return {
      mode: 'still',
      headline: 'Preview here, then save a still frame as your wallpaper',
      steps: [...STILL_STEPS],
      limits,
    };
  }

  if (iosMajor >= LOOP_MIN_IOS) {
    const limits = [
      'The loop plays as Glaze’s Now Playing artwork, so it stays only while Glaze is playing it.',
      'Playing music or a podcast in another app replaces it; start it again from Glaze afterwards.',
      'Low Power Mode stops it. It is always silent.',
    ];
    if (kind === 'gif') limits.unshift('iOS never animates a GIF wallpaper itself; Glaze converts your GIF to a short video for the loop.');
    return {
      mode: 'loop',
      headline: `iOS ${iosMajor}: a true looping Lock Screen`,
      steps: [
        'Frame, trim and set the speed in the loop editor (or add a few loops to the playlist).',
        'Tap Set on Lock Screen (or Set playlist on Lock Screen). Glaze prepares the loop, then starts playing it.',
        'Lock your iPhone. The loop fills the Lock Screen every time it wakes.',
        'To stop, tap Stop in Glaze or pause it from the player on the Lock Screen.',
      ],
      limits,
    };
  }

  // Full build, iOS 16–25 (or unknown): Live Photo wallpaper for videos.
  const versionLabel = iosMajor > 0 ? `iOS ${iosMajor}` : 'This iOS version';
  if (kind === 'gif') {
    return {
      mode: 'still',
      headline: `${versionLabel}: save a still frame (GIFs can’t be Live Photos)`,
      steps: [...STILL_STEPS],
      limits: [
        GIF_LIMIT,
        'Live Photo export needs a video. Turn the GIF into a video first (for example with a screen recording) and pick that in Glaze.',
        `A true loop needs iOS ${LOOP_MIN_IOS} or later.`,
      ],
    };
  }
  return {
    mode: 'live-photo',
    headline: `${versionLabel}: a Live Photo wallpaper`,
    steps: [
      'Frame and trim the clip in the loop editor.',
      'Tap Save as Live Photo. Glaze saves the first 3 seconds of the loop to Photos.',
      `Open ${WALLPAPER_PATH} and pick the Live Photo Glaze saved.`,
      'If a Live Photo button is offered, turn it on so it plays, then tap Add.',
    ],
    limits: [
      'A Live Photo wallpaper is not a constant loop: it plays briefly when the iPhone wakes or when you touch and hold, depending on the iOS version. Some versions show it as a still.',
      `A true loop needs iOS ${LOOP_MIN_IOS} or later.`,
    ],
  };
}

// ---------------------------------------------------------------------------
// What can be saved

export type SaveOptionId = 'lock-loop' | 'live-photo' | 'still-frame' | 'clip';

export type SaveOption = {
  id: SaveOptionId;
  label: string;
  detail: string;
  available: boolean;
  /** Why it is not available here (only when available is false). */
  unavailableReason?: string;
};

/**
 * What this build can save for a video or GIF. Pass iosMajor when known; without it the
 * full-build loop is listed as available (the native adapter checks the version itself).
 */
export function saveOptions(build: LiveBuild, kind: LiveKind, iosMajor?: number): SaveOption[] {
  const ios = iosMajor === undefined ? undefined : parseIosMajor(iosMajor);
  const full = build === 'full';
  const loopOk = full && (ios === undefined || ios === 0 || ios >= LOOP_MIN_IOS);
  const livePhotoOk = full && kind === 'video';
  return [
    {
      id: 'still-frame',
      label: 'Still frame wallpaper',
      detail: kind === 'gif'
        ? 'The first frame of the GIF, framed for your Lock Screen at your iPhone’s screen size.'
        : 'The frame at the current position, framed for your Lock Screen at your iPhone’s screen size.',
      available: true,
    },
    {
      id: 'clip',
      label: kind === 'gif' ? 'Save the GIF' : 'Save the clip',
      detail: kind === 'gif'
        ? 'A copy of the original GIF, to keep or use elsewhere.'
        : 'A copy of the original video (untrimmed), to keep for the full build or other uses.',
      available: true,
    },
    {
      id: 'live-photo',
      label: 'Live Photo',
      detail: 'The first 3 seconds as a Live Photo wallpaper that moves briefly.',
      available: livePhotoOk,
      unavailableReason: livePhotoOk
        ? undefined
        : !full
          ? 'Needs the full Glaze build.'
          : 'Live Photos need a video, not a GIF.',
    },
    {
      id: 'lock-loop',
      label: 'Looping Lock Screen',
      detail: 'Plays the loop on the Lock Screen while Glaze is playing it.',
      available: loopOk,
      unavailableReason: loopOk
        ? undefined
        : !full
          ? 'Needs the full Glaze build.'
          : `Needs iOS ${LOOP_MIN_IOS} or later.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Save helpers

const VIDEO_EXTS = ['mov', 'mp4', 'm4v', '3gp'] as const;

export type ClipSaveCheck = { ok: true; ext: string } | { ok: false; reason: 'unsupported' | 'missing' };

/** Lower-case file extension of a URI or path ('' when none). */
export function fileExtension(uri: string): string {
  const m = /\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(uri ?? '');
  return m ? m[1].toLowerCase() : '';
}

/** Whether Photos can take this source copy as-is: videos as mov/mp4/m4v/3gp, GIFs as .gif. */
export function checkClipForPhotos(uri: string, kind: LiveKind): ClipSaveCheck {
  if (typeof uri !== 'string' || uri.trim() === '') return { ok: false, reason: 'missing' };
  if (/^https?:/i.test(uri)) return { ok: false, reason: 'unsupported' };
  const ext = fileExtension(uri);
  if (kind === 'gif') return ext === 'gif' ? { ok: true, ext } : { ok: false, reason: 'unsupported' };
  return (VIDEO_EXTS as readonly string[]).includes(ext) ? { ok: true, ext } : { ok: false, reason: 'unsupported' };
}

/**
 * Seconds to grab the still frame at: the player's position, kept inside the trimmed range
 * (and the clip). Non-finite input falls back to the trim start.
 */
export function stillFrameSeconds(currentSec: number, trim: { startMs: number; endMs: number }, durationMs: number): number {
  const start = Math.max(0, trim.startMs);
  let end = trim.endMs > start ? trim.endMs : durationMs > start ? durationMs : start;
  if (durationMs > 0) end = Math.min(end, durationMs);
  const ms = Number.isFinite(currentSec) ? currentSec * 1000 : start;
  const clamped = Math.min(Math.max(ms, start), Math.max(start, end - 1));
  return Math.round(clamped) / 1000;
}

/** One honest line under the Themes hero card for this device and build. */
export function heroSubline(build: LiveBuild, iosMajor: number): string {
  const ios = parseIosMajor(iosMajor);
  if (build === 'expo-go') {
    return 'Frame and preview it here, then save a still wallpaper and the clip. The full Glaze build makes it move.';
  }
  if (ios >= LOOP_MIN_IOS) return 'Loops on your Lock Screen while Glaze plays it. Silent, and you can stop it any time.';
  if (ios > 0) return `On iOS ${ios} it becomes a Live Photo that moves briefly when your iPhone wakes.`;
  return 'Trim, frame and preview it, then follow the steps for your iPhone.';
}
